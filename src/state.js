import { EXAMPLE, NUTS, UNITS, PERIODS, WEIGHT_UNITS, DEFAULT_TITLE, newId, usdaId, isInfo } from "./data.js";
import { BUNDLED } from "./bundled.js";
import { evalExpr } from "./expr.js";

/* ---------- localStorage wrapper ---------- */
export const store = {
  get(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
};

/* ---------- current recipe (live binding: importers see reassignment) ---------- */
export let S = null;
export function setState(next){ S = next; }
export function loadLocal(){ const st = sanitize(store.get("lady.state")); if(st) backfill(st); return st || structuredClone(EXAMPLE); }
export function saveLocal(){ store.set("lady.state", S); }

const num = (v,d)=> Number.isFinite(+v) && v!=="" && v!==null ? +v : d;
/** a number that cannot sensibly be negative (weights, amounts of a nutrient) */
const pos = (v,d)=> Math.max(0, num(v,d));
/** a nutrient value: a non-negative number, or null when the source did not report it */
const nut = v => v==null || v==="" || !Number.isFinite(+v) ? null : Math.max(0, +v);
const str = (v,d="")=> typeof v==="string" ? v.slice(0,300) : d;

/**
 * v1 recipes (before the per-day expression column) had batch/day/week modes
 * with qty × gPerUnit and a batch fraction. Rewrite each into amount/unit/per.
 */
function migrateV1(raw){
  const cups = num(raw.cupsPerDay, 2), batch = num(raw.batchCups, 10) || 10;
  const foods = raw.foods.filter(x=>x && typeof x==="object").map(x=>{
    const qty = num(x.qty, 0), g = num(x.gPerUnit, 1), unit = str(x.unit, "g") || "g";
    const base = g===1 ? `${qty}` : `${qty}*${g}`;
    const amount = x.mode==="batch" ? `${base}*${cups}/${batch}` : base;
    const per = x.mode==="week" ? "week" : "day";
    const note = unit==="g" ? (x.mode==="batch" ? `${qty} g per batch` : "") : `${qty} ${unit} × ${g} g${x.mode==="batch" ? " per batch" : ""}`;
    return { ...x, amount, unit:"g", per, src: [str(x.src), note].filter(Boolean).join(" · ") };
  });
  return { title: raw.title, weight: raw.weight, activity: raw.activity, foods };
}

/**
 * Coerce an untrusted recipe object (from localStorage or a shared link) into a
 * well-formed one. Returns null if it is not recognisably a recipe.
 * v2 recipes (amount expression, `kind`, no unit/per) need no rewriting: unit
 * and per default to g / day and `kind` is simply dropped.
 */
export function sanitize(raw){
  if(!raw || typeof raw!=="object" || !Array.isArray(raw.foods)) return null;
  if("batchCups" in raw || raw.foods.some(x=>x && "mode" in x)) raw = migrateV1(raw);
  return {
    title:    str(raw.title, DEFAULT_TITLE).trim() || DEFAULT_TITLE,
    weight:   pos(raw.weight, EXAMPLE.weight),
    weightUnit: raw.weightUnit in WEIGHT_UNITS ? raw.weightUnit : "kg",
    activity: pos(raw.activity, EXAMPLE.activity),
    foods: raw.foods.filter(x=>x && typeof x==="object").map(x=>({
      id:     str(x.id) || newId(),
      name:   str(x.name, "Unnamed"),
      amount: typeof x.amount==="number" ? String(x.amount) : str(x.amount, "0").slice(0,60),
      unit:   x.unit in UNITS ? x.unit : "g",
      per:    x.per in PERIODS ? x.per : "day",
      src:    str(x.src),
      per100: NUTS.map((_,j)=> nut(Array.isArray(x.per100)? x.per100[j] : null)),
    })),
  };
}

/**
 * Fill in nutrients a food does not report from the built-in table, when the
 * food is recognisably the same item: same USDA id in its source note, or the
 * same name. Only blanks are filled; nothing typed is ever overwritten. Diets
 * saved before a nutrient was added to the table come back complete this way.
 * Returns how many values were filled.
 */
export function backfill(state){
  let n = 0;
  for(const it of state.foods){
    if(!it.per100.some(v=>v==null)) continue;
    const id = usdaId(it.src), name = it.name.trim().toLowerCase();
    const b = BUNDLED.find(b=> (id && usdaId(b.src)===id) || b.name.toLowerCase()===name);
    if(!b) continue;
    it.per100 = it.per100.map((v,j)=>{ if(v==null && b.per100[j]!=null){ n++; return b.per100[j]; } return v; });
  }
  return n;
}

/* ---------- ration maths ---------- */
/* Each takes the diet to work on and defaults to the current one, so the same
   functions serve the page and the tests. */
/** the dog's weight in kilograms, whatever unit it was entered in */
export const weightKg = (state = S) => state.weight * WEIGHT_UNITS[state.weightUnit];
/** grams per day for an item; NaN when its expression does not parse */
export const gramsPerDay = it => evalExpr(it.amount) * UNITS[it.unit] / PERIODS[it.per];
const g0 = it => { const g = gramsPerDay(it); return Number.isFinite(g) && g>0 ? g : 0; };

/** amount of each nutrient eaten per day, in NUTS order and units; unknown values count as 0, see missing() */
export function totals(state = S){
  const t = NUTS.map(()=>0);
  for(const it of state.foods){
    const g = g0(it);
    it.per100.forEach((v,j)=> t[j]+= g*Math.max(0, v||0)/100);
  }
  return t;
}
export const totalGrams = (state = S) => state.foods.reduce((a,x)=>a+g0(x),0);
/** indexes of the nutrients an item does not report (the informational ones excepted: nothing depends on them) */
export const unknownOf = it => it.per100.map((v,j)=> v==null && !isInfo(j) ? j : -1).filter(j=>j>=0);
/**
 * For each nutrient, the foods actually being fed (grams > 0) whose value for
 * it is unknown, as [{ name, grams }]. A non-empty list means that nutrient's
 * total is a lower bound.
 */
export function missing(state = S){
  const m = NUTS.map(()=>[]);
  for(const it of state.foods){
    const g = g0(it); if(!g) continue;
    it.per100.forEach((v,j)=>{ if(v==null && !isInfo(j)) m[j].push({ name: it.name, grams: g }); });
  }
  return m;
}

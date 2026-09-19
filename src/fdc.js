/* ---------- USDA FoodData Central search, with a localStorage cache ---------- */
import { store } from "./state.js";
import { NUTS, usdaId } from "./data.js";
import { BUNDLED } from "./bundled.js";

const API="https://api.nal.usda.gov/fdc/v1";
export const SIGNUP_URL="https://fdc.nal.usda.gov/api-key-signup";
/** USDA's public key: rate-limited per network address. Limits from the API's x-ratelimit-limit header. */
export const DEMO_KEY="DEMO_KEY", DEMO_LIMIT=10, KEY_LIMIT=1000;
export const hasKey = ()=> !!currentKey;

let currentKey = "";
export function setApiKey(k){ currentKey = (k||"").trim(); }
const apiKey = ()=> currentKey || DEMO_KEY;

/* ---- built-in ingredients: instant, offline, no quota ---- */
export function searchBundled(q){
  const toks = q.toLowerCase().split(/\s+/).filter(Boolean);
  if(!toks.length) return [];
  return BUNDLED.map((b,i)=>({...b, i})).filter(b=> toks.every(t=> b.name.toLowerCase().includes(t))).slice(0,8);
}
export const bundledAt = i => BUNDLED[i];
/**
 * USDA hits remembered from earlier searches in this browser, matched the same
 * way as built-ins (every word of the query somewhere in the description).
 * Instant and offline; nothing is fetched. De-duplicated by FoodData Central id.
 */
export function searchCached(q){
  const toks = q.toLowerCase().split(/\s+/).filter(Boolean);
  if(!toks.length) return [];
  const seen = new Map();
  try{
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i); if(!k?.startsWith("fdc.s2.")) continue;
      for(const x of store.get(k)||[]){
        if(!x?.per100 || x.per100.length!==NUTS.length || seen.has(x.fdcId)) continue;
        const text = `${x.description} ${x.brandOwner||""}`.toLowerCase();
        if(toks.every(t=> text.includes(t))) seen.set(x.fdcId, x);
      }
    }
  }catch(e){}
  return [...seen.values()].slice(0,8);
}
/** FoodData Central id a bundled entry was built from, so USDA results can be de-duplicated against it. */
export const bundledFdcId = b => usdaId(b.src);

export function cacheCount(){
  let n=0; try{ for(let i=0;i<localStorage.length;i++) if(localStorage.key(i).startsWith("fdc.")) n++; }catch(e){}
  return n;
}

/**
 * Errors carry a `kind` the UI can act on:
 *   demo-limit  USDA's shared DEMO_KEY is out of requests for this network
 *   key-limit   the personal key has used its hourly quota
 *   bad-key     USDA rejected the personal key
 *   offline     the request never reached USDA
 *   http        anything else
 */
async function fetchJson(url){
  let r;
  try{ r = await fetch(url); }
  catch(e){ const err = new Error("Could not reach USDA FoodData Central. Check your connection and try again."); err.kind="offline"; throw err; }
  if(r.ok) return r.json();
  const limited = r.status===429 || (r.status===403 && !currentKey);
  const err = new Error(
    limited && !currentKey ? "USDA\u2019s shared demo key has no requests left right now."
    : limited ? "This API key has used its hourly USDA quota."
    : r.status===403 ? "USDA rejected this API key."
    : "USDA FoodData Central returned an error ("+r.status+")." );
  err.kind = limited ? (currentKey ? "key-limit" : "demo-limit") : r.status===403 ? "bad-key" : "http";
  throw err;
}
/**
 * Search results already carry each food's nutrients (per 100 g, for every
 * data type), so `per100` is filled in here and adding a result needs no
 * second request. It is null when the hit came back without usable numbers.
 */
export async function search(q){
  const key="fdc.s2."+q.toLowerCase();
  const hit=store.get(key); if(hit && hit.every(x=> !x.per100 || x.per100.length===NUTS.length)) return hit; // a cache from before a nutrient was added is refetched
  const j = await fetchJson(`${API}/foods/search?api_key=${apiKey()}&query=${encodeURIComponent(q)}&pageSize=10&dataType=${encodeURIComponent("Foundation,SR Legacy,Branded")}`);
  const foods=(j.foods||[]).map(x=>{
    const per100 = mapNutrients(x);
    return {fdcId:x.fdcId, description:x.description, dataType:x.dataType, brandOwner:x.brandOwner||"", ingredients:(x.ingredients||"").slice(0,600), per100: per100.some(v=>v>0) ? per100 : null};
  });
  store.set(key,foods); return foods;
}
/* cache only the mapped 24 numbers, not the raw FDC JSON (which can be
   hundreds of KB and silently overflow localStorage) */
export async function nutrientsFor(id){
  const key="fdc.d."+id;
  const hit=store.get(key); if(hit && hit.per100?.length===NUTS.length) return hit;
  const food = await fetchJson(`${API}/food/${id}?api_key=${apiKey()}&format=abridged`);
  const rec = {dataType:food.dataType||"", per100:mapNutrients(food)};
  store.set(key,rec); return rec;
}

/* FDC nutrient mapping → our 24 columns.
   Each candidate is [modernId, legacyNumberString, multiplier]; first found wins.
   A nutrient the record does not report at all maps to null ("unknown"), which
   the app shows as missing data rather than as zero. FDC responses carry
   identifiers inconsistently: full details use nutrient.id / nutrient.number /
   amount, abridged details use number / amount, and search hits use
   nutrientId / nutrientNumber / value. Index by id and number. */
const MAP=[
 [[1008,"208",1],[2047,"957",1],[2048,"958",1]],          // kcal
 [[1003,"203",1]], [[1004,"204",1],[1085,"298",1]],       // protein, fat
 [[1087,"301",1]], [[1091,"305",1]], [[1092,"306",1]],    // Ca P K
 [[1093,"307",1]], [[1090,"304",1]], [[1089,"303",1]],    // Na Mg Fe
 [[1095,"309",1]], [[1098,"312",1]], [[1101,"315",1]],    // Zn Cu Mn
 [[1103,"317",1]], [[1100,"314",1]],                      // Se, iodine
 "VIT_A",                                                 // IU, see vitaminA()
 [[1110,"324",1],[1114,"328",40]],                        // vit D IU, else ug x40
 [[1109,"323",1.49]],                                     // vit E mg alpha-toc x1.49
 [[1165,"404",1]], [[1166,"405",1]], [[1175,"415",1]],    // B1 B2 B6
 [[1178,"418",1]], [[1177,"417",1],[1187,"431",1]],       // B12, folate
 [[1180,"421",1]], "EPA_DHA",
 [[1269,"618",1],[1316,"675",1]],                         // linoleic 18:2 (n-6 c,c in newer records)
 [[1270,"619",1],[1404,"851",1]],                         // alpha-linolenic 18:3 (n-3 c,c,c in newer records)
 [[1271,"620",1]],                                        // arachidonic 20:4
 [[1293,"646",1]],                                        // total PUFA
 [[1167,"406",1]], [[1170,"410",1]],                      // niacin, pantothenic acid
 [[1005,"205",1]], [[2000,"269",1],[1063,"269",1]]];       // carbohydrate by difference; sugars (total, or NLEA)
const EPA=[1278,"629"], DHA=[1272,"621"];
const VA_IU=[1104,"318"], VA_RAE=[1106,"320"], RETINOL=[1105,"319"], B_CAR=[1107,"321"], A_CAR=[1108,"322"], CRYPTO=[1120,"334"];
if(MAP.length!==NUTS.length) throw new Error("FDC MAP does not match NUTS");
/**
 * Vitamin A in IU. USDA's own IU field when the record has one (SR Legacy);
 * otherwise USDA's definition of the IU from the components newer records do
 * carry: 1 IU = 0.3 µg retinol = 0.6 µg β-carotene = 1.2 µg α-carotene or
 * β-cryptoxanthin. Only as a last resort µg RAE × 3.33, which is right for
 * retinol but understates carotene-rich plants about six-fold.
 */
function vitaminA(pick){
  const iu = pick(...VA_IU); if(iu!=null) return iu;
  const parts = [[RETINOL,0.3],[B_CAR,0.6],[A_CAR,1.2],[CRYPTO,1.2]].map(([k,per])=>{ const v=pick(...k); return v==null? null : v/per; });
  if(parts.some(v=>v!=null)) return parts.reduce((a,v)=>a+(v||0),0);
  const rae = pick(...VA_RAE); return rae==null? null : rae*3.33;
}
export function mapNutrients(food){
  const byId={}, byNum={};
  (food.foodNutrients||[]).forEach(fn=>{
    const n = fn.nutrient||{};
    const id  = n.id ?? fn.nutrientId;
    const num = String(n.number ?? fn.nutrientNumber ?? fn.number ?? "");
    const a   = fn.amount ?? fn.value;
    if(a==null) return;
    if(id!=null && byId[id]==null) byId[id]=+a;
    if(num && byNum[num]==null) byNum[num]=+a;
  });
  const pick=(id,num)=> byId[id]!=null? byId[id] : (byNum[num]!=null? byNum[num] : null);
  return MAP.map(spec=>{
    if(spec==="EPA_DHA"){ const e=pick(...EPA), d=pick(...DHA); return e==null&&d==null ? null : (e||0)+(d||0); }
    if(spec==="VIT_A") return vitaminA(pick);
    for(const[id,num,m]of spec){ const v=pick(id,num); if(v!=null) return v*m; }
    return null; });
}

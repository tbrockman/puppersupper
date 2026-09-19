import { NUTS, UNITS, PERIODS, SOURCES, NOTES, PURPOSE, DISPLAY, hazardsOf, isInfo, iKcal, iALA, iAA, iPUFA } from "./data.js";
import { S, gramsPerDay, unknownOf } from "./state.js";
import { analyze, ENERGY_TOLERANCE, N6N3_MAX, E_PUFA_MIN } from "./analysis.js";
import { icon } from "./icons.js";
import { editable, fitAll } from "./editable.js";

/** Escape text for innerHTML. Names/sources can arrive from a shared link. */
export const esc = s => String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const fmt = v => !Number.isFinite(v) ? "\u2013" : v>=100? v.toFixed(0) : v>=10? v.toFixed(1) : v.toFixed(2);
export const gramsText = it => { const g = gramsPerDay(it); return Number.isFinite(g) ? `${g.toFixed(g<10?1:0)} g` : "?"; };
const opts = (obj, sel) => Object.keys(obj).map(k=>`<option value="${k}" ${k===sel?"selected":""}>${k}</option>`).join("");
export const info = (tip, size=14, attrs="") => `<span ${attrs.includes("class=")?"":'class="info" '}tabindex="0" role="note" data-tip="${esc(tip)}"${attrs}>${icon("info",size)}</span>`;
/** Amber marker for a value that rests on missing data; `attrs` can add e.g. a data-jump target. */
export const warn = (tip, size=13, attrs="") => `<span class="info warn" tabindex="0" role="note" data-tip="${esc(tip)}"${attrs}>${icon("alert",size)}</span>`;
/** "A", "A and B", "A, B, and C" */
const list = names => names.length<=1 ? names.join("") : names.length===2 ? names.join(" and ") : names.slice(0,-1).join(", ") + ", and " + names.at(-1);

/* ---------- food table ---------- */
/** ids of the foods whose nutrient panel is open (any number at once) */
export const openEditors = new Set();

/** The count of unknown nutrients shown on the row's editor button (empty when everything is known). */
export const badgeHtml = it => { const n = unknownOf(it).length; return n ? `<span class="badge">${n}</span>` : ""; };
function foodRow(it){
  const g = gramsPerDay(it), bad = !Number.isFinite(g), open = openEditors.has(it.id);
  const hz = hazardsOf(it);
  const hazard = hz.length ? `<span class="info hazard" tabindex="0" role="note" data-tip="${esc(`Known to harm dogs: ${hz.map(h=>h.what).join("; ")}. ${hz.map(h=>h.why).join(" ")}`)}" data-src="${esc(SOURCES[hz[0].src].url)}" data-src-title="${esc(SOURCES[hz[0].src].title)}">${icon("alert",14)}</span>` : "";
  return `<tr data-id="${esc(it.id)}" class="${open?"open":""}${hz.length?" hazardous":""}">
    <td class="foodname">${hazard}${editable({ value:it.name, cls:"name", attrs:`data-f="name" aria-label="Food name"`, label:"Rename" })}</td>
    <td class="num amount">${editable({ value:it.amount, cls:"amt", inputCls:bad?"bad":"", attrs:`inputmode="decimal" data-f="amount" aria-label="${esc(it.name)} amount"`, label:"Edit amount" })}</td>
    <td><select data-f="unit" aria-label="unit">${opts(UNITS, it.unit)}</select></td>
    <td><select data-f="per" aria-label="per">${opts(PERIODS, it.per)}</select></td>
    <td class="num gday ${bad?"bad":""}">${gramsText(it)}</td>
    <td class="actions"><button class="quiet iconbtn ${open?"on":""}" data-f="edit" title="${open?"Close":"Edit"} nutritional information" aria-pressed="${open}" aria-expanded="${open}">${icon("sliders")}${badgeHtml(it)}</button><button class="quiet iconbtn" data-f="del" title="Remove" aria-label="Remove ${esc(it.name)}">${icon("trash")}</button></td></tr>`;
}
function editorRow(it){
  return `<tr class="editor" data-id="${esc(it.id)}"><td colspan="6">
    <label class="notefield"><span class="lt">Note or source</span>${editable({ value:it.src, cls:"note", attrs:`data-f="src"`, placeholder:"where these numbers came from, batch size, brand\u2026", label:"Edit note" })}</label>
    <div class="src edhead">Nutrients per 100 g</div>
    <div class="nutgrid">${NUTS.map((n,j)=>{ const v = it.per100[j], soft = isInfo(j);
      return `<label class="${v==null?"unknown":""}${soft?" soft":""}"><span class="lt">${n[0]} ${n[1]} ${soft
        ? info("Not reported. Shown for information only, so nothing depends on it.", 11)
        : warn("Not reported; counts as 0. Type a value if you know it, or 0 if there is none.", 11)}</span><input type="number" step="any" min="0" value="${v==null?"":+(+v).toFixed(3)}" placeholder="${v==null?"not reported":""}" data-f="n" data-j="${j}" aria-label="${esc(n[0])} per 100 g${v==null?", not reported":""}"></label>`; }).join("")}
    </div></td></tr>`;
}
/** The table's last row: where foods are searched for and added. Created once by main.js and kept across re-renders. */
let adderRow = null;
export function setAdderRow(el){ adderRow = el; }
export function renderFoods(){
  const head = `<thead><tr><th>Food</th><th class="num amount">Amount</th><th>Unit</th><th>Per</th><th class="num">g / day</th><th></th></tr></thead>`;
  const tbl = document.getElementById("tbl-foods");
  const focused = adderRow && adderRow.contains(document.activeElement) ? document.activeElement : null;
  tbl.innerHTML = head + "<tbody>" + S.foods.map(it=> foodRow(it) + (openEditors.has(it.id) ? editorRow(it) : "")).join("") + "</tbody>";
  if(adderRow){ tbl.tBodies[0].prepend(adderRow); focused?.focus({ preventScroll:true }); } // moving the node drops focus; give it back
  fitAll(tbl);
  document.querySelectorAll("input[data-g]").forEach(i=>{ if(+i.value !== S[i.dataset.g]) i.value = S[i.dataset.g]; });
  fitAll(document.getElementById("tbl-in"));
  const wu = document.getElementById("g-weightUnit"); if(wu.value !== S.weightUnit) wu.value = S.weightUnit;
  const t = document.getElementById("title");
  if(t.value !== S.title){ t.value = S.title; t.dispatchEvent(new Event("input", { bubbles:true })); } // input event re-fits the box
  document.title = S.title;
}

/* ---------- analysis ---------- */
/**
 * A tick number under a strip at pos % (centred there by placeLabels()).
 * `cls` marks a special tick ("adv": an advisory level; "nomax": an open
 * end); `tip` (with optional source) makes it hoverable like an info marker.
 */
const tick = (text, pos, cls="", tip="", src=null) => text
  ? `<span class="tk${cls?" "+cls:""}${tip?" info":""}" style="--x:${pos}%"${tip?` tabindex="0" role="note" data-tip="${esc(tip)}"`:""}${src?` data-src="${esc(src.url)}" data-src-title="${esc(src.title)}"`:""}>${esc(text)}</span>`
  : "";
/** value label above the dot, the strip, and the tick numbers beneath: one block, as tall as a name with its unit line */
const range = (inner, ticks, pos, label) =>
  `<div class="range"><div class="vlabel"><span class="vl" style="--x:${pos}%">${esc(label)}</span></div><div class="strip">${inner}</div><div class="ticks">${ticks}</div></div>`;
/**
 * Centre every label on its point: the value label on the dot, each tick on
 * the band edge it names. Labels sit above and below the strip, on different
 * lines from the neighbouring cells' text, so one centred on an end of the
 * strip simply spills past it. Two ticks that would overlap are nudged apart.
 */
export function placeLabels(){
  const dotR = 4.5;
  document.querySelectorAll(".range").forEach(r=>{
    const w = r.clientWidth;
    const at = el => parseFloat(el.style.getPropertyValue("--x")) / 100 * w;
    const vl = r.querySelector(".vl");
    if(vl) vl.style.left = Math.max(dotR, Math.min(w - dotR, at(vl))) + "px";   // where the dot really is
    const tks = [...r.querySelectorAll(".tk")];
    const xs = tks.map(at);                                   // an end tick sits exactly on the band's edge
    if(tks.length===2){                                       // keep min and max apart by a small gap
      const gap = 6, need = tks[0].offsetWidth/2 + tks[1].offsetWidth/2 + gap - (xs[1] - xs[0]);
      if(need > 0){ xs[0] -= need/2; xs[1] += need/2; }
    }
    tks.forEach((t,i)=> t.style.left = xs[i] + "px");
  });
}
/**
 * A range strip. The strip *is* the acceptable range: it runs from the minimum
 * to the maximum (or, with no maximum, on past the value). A value outside it
 * sits at the band's end. Log scale between the ends. Ticks beneath give the
 * minimum and maximum in the row's unit.
 */
/**
 * `ends` describes the right-hand end when there is no AAFCO maximum: either
 * { adv: {tip, src} } for an advisory level, or { open: tip } for a "no max" label.
 */
function strip(v, mn, mx, label, fmtTick=fmt, adv=null, noMin=false, ends={}){
  if(!(mn>0)) return range(`<div class="dot" style="--x:50%"></div>`, "", 50, label);   // nothing to judge against: the value alone
  v = Number.isFinite(v) ? v : v>0 ? (mx ?? adv ?? mn)*3 : 0;  // an infinite ratio sits well past the end
  const top = mx ?? adv, isAdv = mx==null && adv!=null;           // an advisory level stands in for a missing maximum
  // the strip runs from the minimum to the maximum (or on past the value when there is no maximum). A value
  // outside that range becomes the strip's end itself, with the band stopping short of it; the range keeps at
  // least half the strip, so a value far outside simply sits at the end
  const below = v < mn, above = top!=null && v > top;
  let lo = below ? v : mn, hi = above ? v : (top ?? Math.max(v, mn)*1.3);
  lo = Math.max(lo, mn*mn/(top ?? hi));
  if(above) hi = Math.min(hi, top*top/mn);
  const pos = noMin ? x => Math.max(0, Math.min(100, 100*x/hi))
                    : x => Math.max(0, Math.min(100, 100*Math.log(Math.max(x,lo)/lo)/Math.log(hi/lo)));
  const bandL = noMin ? 0 : pos(mn), bandR = top!=null ? pos(top) : 100, dot = pos(v);
  const right = top==null ? tick("-", 100, "nomax", ends.open || "")
              : isAdv     ? tick(fmtTick(top), bandR, "adv", ends.adv?.tip || "", ends.adv?.src)
              :             tick(fmtTick(top), bandR);
  // the band's edges are the minimum and maximum; the tick numbers beneath them say which is which
  return range(`<div class="band" style="left:${bandL}%; width:${bandR-bandL}%"></div>
    <div class="dot" style="--x:${dot}%"></div>`,
    tick(fmtTick(noMin ? 0 : mn), bandL) + right, dot, label);
}
const pctText = p => Number.isFinite(p) ? (100*p).toFixed(0)+"%" : "?";
/** A tick or cross for the status column: ok/marginal → tick, low/high/watch → cross, coloured by kind; the title says why. */
const mark = (kind, title) => kind==="none" ? `<span class="mark none" title="${esc(title||"")}">\u2013</span>`
  : `<span class="mark ${kind}" title="${esc(title||"")}">${icon(kind==="ok"||kind==="marg" ? "check" : "x", 15)}</span>`;
const kindOf = st => ({ ok:"ok", marginal:"marg", low:"low", high:"high", watch:"watch" })[st] || "none";
export function renderAnalysis(){
  const a = analyze(), { kcal, rer, mer, ePct, caP } = a;
  const missWarn = (what, list_) => list_.length ? " " + warn(`${what} is not reported for: ${list(list_.map(m=>m.name))}.`) : "";
  const ratioText = (v, dp=2) => Number.isFinite(v) ? v.toFixed(dp) : v===Infinity ? "\u221e" : "\u2013";
  const tol = (100*ENERGY_TOLERANCE).toFixed(0);
  const vrow = (cls, name, tip, strip, status, sub="") =>
    `<tr class="${cls}"><td>${name}${tip?" "+info(tip):""}${sub?`<span class="src" style="display:block">${sub}</span>`:""}</td>
     <td class="c-range">${strip}</td><td class="status">${status}</td></tr>`;
  // input rows: what the dog's numbers produce
  document.getElementById("w-status").textContent = mer>0 ? `RER \u2248 ${rer.toFixed(0)} kcal` : "enter a weight above 0";
  document.getElementById("a-status").textContent = mer>0 ?
    `need \u2248 ${mer.toFixed(0)} kcal \u00b7 ` + (S.activity<1.2 ? "below typical" : S.activity<=1.4 ? "inactive adult" : S.activity<=1.8 ? "active adult" : "working or growing")
    : "";
  // computed rows
  const caText = Number.isFinite(caP) ? caP.toFixed(2) : caP===Infinity ? "\u221e" : "\u2013";
  const caKind = Number.isNaN(caP) ? "none" : caP<1 ? "low" : caP>2 ? "high" : "ok";
  const caStatus = mark(caKind, caText) + (caKind==="none" ? " no calcium or phosphorus yet" : caKind==="low" ? " add calcium" : caKind==="high" ? " too much calcium" : "");
  const vitals =
    vrow(a.energy==="ok"?"okrow":"low", "Calories per day",
        `Energy in the diet versus the estimated need: RER \u00d7 activity, where RER = 70 \u00d7 kg^0.75 = ${rer.toFixed(0)} kcal here. Within \u00b1${tol}% counts as on target. Adjust to the dog\u2019s body condition over time.`,
        strip(kcal, mer*(1-ENERGY_TOLERANCE), mer*(1+ENERGY_TOLERANCE), `${kcal.toFixed(0)} kcal`, v=>v.toFixed(0)),
        a.energy==="unknown" ? mark("none") + " enter the dog\u2019s weight" : mark(kindOf(a.energy), `${pctText(ePct)} of daily need`) + (a.energy==="high"?" overfeeding":a.energy==="low"?" underfeeding":""),
        `in ${a.grams.toFixed(0)} g of food`)
  + vrow(caKind==="ok"?"okrow":caKind==="none"?"":"low", "Ca : P ratio",
        "Calcium to phosphorus by weight. Meat is phosphorus-rich, so home-cooked diets usually need a calcium source to land between 1:1 and 2:1.",
        strip(Number.isNaN(caP)?0:caP, 1, 2, caText, v=>v.toFixed(1)), caStatus + missWarn("Calcium or phosphorus", a.caPMissing))
  + vrow(a.n6n3.status==="ok"?"okrow":a.n6n3.status==="high"?"low":"",
        `<span class="wrap">Omega-6 :<br>Omega-3 ${info(`AAFCO caps (linoleic + arachidonic) : (alpha-linolenic + EPA + DHA) at ${N6N3_MAX}:1 for adult dogs. Omega-3 has no minimum of its own; enough is needed to hold the ratio. More omega-3 (fish, fish oil, flaxseed) or less omega-6 (vegetable oils, poultry fat) lowers it.`)}</span>`,
        "",
        strip(Number.isNaN(a.n6n3.value)?0:a.n6n3.value, 1, N6N3_MAX, ratioText(a.n6n3.value, 1) + " : 1", v=>v.toFixed(0), null, true),
        a.n6n3.status==="unknown" ? mark("none") + (a.n6n3.missing.length ? missWarn("A fatty acid", a.n6n3.missing) : " no fatty-acid data")
          : a.n6n3.status==="high" ? mark("high", `above ${N6N3_MAX}:1`) + " more omega-3 or less omega-6" : mark("ok", `within ${N6N3_MAX}:1`))
  + vrow(a.ePufa.status==="ok"?"okrow":a.ePufa.status==="low"?"low":"", "Vitamin E : PUFA",
        `AAFCO asks for at least ${E_PUFA_MIN} IU of vitamin E per gram of polyunsaturated fat, since vitamin E is used up protecting those fats. Adding fish oil raises the need.`,
        strip(Number.isNaN(a.ePufa.value)?0:a.ePufa.value, E_PUFA_MIN, null, ratioText(a.ePufa.value) + " IU/g", v=>v.toFixed(1), null, false,
              { open: "There is no upper limit on vitamin E per gram of polyunsaturated fat; more is fine. The band is open-ended and drawn just past the value." }),
        a.ePufa.status==="unknown" ? mark("none") + (a.ePufa.missing.length ? missWarn("Vitamin E or polyunsaturated fat", a.ePufa.missing) : " no data")
          : a.ePufa.status==="low" ? mark("low", `below ${E_PUFA_MIN} IU/g`) + " add vitamin E" : mark("ok", `at least ${E_PUFA_MIN} IU/g`));

  const srcAttrs = keys => { const sr = SOURCES[keys[0]]; return sr ? ` data-src="${esc(sr.url)}" data-src-title="${esc(sr.title)}"` : ""; };
  const rows = DISPLAY.map(j=>a.rows[j]).map(r=>{
    if(r.j===iKcal) return "";
    const note = NOTES[r.name];
    const breeds = note?.breeds ? " " + info(note.breeds, 12, srcAttrs(note.src) + ` class="info breed"`) : "";
    const isEPA = r.name==="EPA+DHA", u = r.unit;
    const miss = r.missing.length ? " " + warn(`${r.name} is not reported for: ${list(r.missing.map(m=>m.name))}.`, 13, ` data-jump="${r.j}"`) : "";
    // a nutrient with no minimum of its own is judged by the balance it feeds
    const related = r.j===iALA || r.j===iAA ? a.n6n3 : r.j===iPUFA ? a.ePufa : null;
    const relKind = !related ? "none" : related.status==="ok" ? "ok" : related.status==="unknown" ? "none" : related.status;
    const purpose = PURPOSE[r.name] ? " " + info(PURPOSE[r.name], 12) : "";
    const cls = ({ high:"high", watch:"marg", low:"low", marginal:"marg", ok:"okrow", unknown:"", info:"infor" }[r.status])
      + (!r.dayMin && r.status!=="info" && relKind!=="none" && relKind!=="ok" ? " low" : "");   // a no-minimum row whose balance is off is tinted too
    const ge = r.missing.length ? "\u2265 " : "";   // a lower bound when some food's value is unknown
    const advTip = r.adv ? `${r.name} has no AAFCO maximum. The dashed line is ${r.adv.basis}: ${fmt(r.adv.max)} ${u} per 1,000 kcal, ${fmt(r.dayAdv)} ${u} a day for this dog. ${r.adv.why}` : "";
    const over = r.status==="high" || r.status==="watch", under = r.status==="low" || r.status==="marginal";
    const sign = over ? note?.excess : under ? note?.deficit : "";        // what sustained excess or shortfall looks like
    const noteIcon = sign ? " " + info(sign, 12, srcAttrs(note.src)) : "";
    const st = r.status==="info" ? mark("none", "for information") + purpose
      : r.status==="unknown" ? mark("none") + " enter the dog\u2019s weight"
      // the note sits next to what it explains: the verdict; the data warning comes after
      : r.status==="high" ? mark("high", `${ge}${pctText(r.pct)} of daily minimum`) + " above the maximum" + noteIcon + miss
      : r.status==="watch" ? mark("watch", `${ge}${pctText(r.pct)} of daily minimum`) + " above the advisory" + noteIcon + miss
      : r.status==="low" ? mark("low", `${ge}${pctText(r.pct)} of ${isEPA ? "target" : "daily minimum"}`) + (isEPA ? " below the target" : " below the minimum") + noteIcon + miss
      : r.status==="marginal" ? mark("marg", `${ge}${pctText(r.pct)} of daily minimum`) + " marginal" + noteIcon + miss
      : r.dayMin ? mark("ok", `${ge}${pctText(r.pct)} of ${isEPA ? "target" : "daily minimum"}`) + miss
      : mark(relKind, related ? `judged by the ${r.j===iPUFA ? "vitamin E : PUFA" : "omega-6 : omega-3"} balance` : "") + purpose + miss;
    // with no energy need to scale by, fall back to judging density against the per-1,000 kcal profile
    const ends = r.adv ? { adv: { tip: advTip, src: SOURCES[r.adv.src[0]] } }
      : { open: `AAFCO sets no maximum for ${r.name.toLowerCase()}, and no other published upper figure exists. The band is open-ended: it is drawn to 1.3\u00d7 the larger of the value and the minimum so the dot has room, and being well above the minimum is normal.` };
    const bar = r.status==="unknown" ? strip(r.per1000, r.min, r.max, `${fmt(r.per1000)} /1,000 kcal`, fmt, r.adv?.max, false, ends)
                                     : strip(r.day, r.dayMin, r.dayMax, fmt(r.day), fmt, r.dayAdv, false, ends);
    return `<tr class="${cls}"><td><span class="nm">${r.name}${breeds}</span><span class="src" style="display:block">${u}</span></td>
      <td class="c-range">${bar}</td><td class="status">${st}</td></tr>`;
  }).join("");
  document.querySelector("#tbl-an tbody").innerHTML = vitals + rows;
  syncColumns();
}
/**
 * Size the analysis table's columns. The first column is measured at its
 * content width (its widest entry), the status column likewise. (The inputs
 * table keeps its own compact layout, with each value beside its label.) The
 * strip takes its full width (STRIP_MAX) unless the table is too narrow, in
 * which case it shrinks towards STRIP_MIN. A modest fixed gap (GAP) sits on
 * either side of the strip, shrinking only when the table is too narrow, so
 * the strip stays close to the names and the status close to the strip; any
 * width left over falls at the far right. Each measured column is shrunk to
 * its content for a moment to measure it.
 */
const STRIP_MAX = 14, STRIP_MIN = 4, GAP = 1.25, GAP_MIN = 0.5; // rem
export function syncColumns(){
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const th = (id, col) => document.getElementById(id)?.tHead?.rows[0]?.cells[col];
  const measure = ths => {
    ths = ths.filter(Boolean);
    ths.forEach(t => { t.style.width = ""; t.classList.add("fit"); });
    const w = Math.ceil(Math.max(...ths.map(t => t.getBoundingClientRect().width)));
    ths.forEach(t => t.classList.remove("fit"));
    return w;
  };
  const first = [th("tbl-an", 0)], ranges = [th("tbl-an", 1)], status = [th("tbl-an", 2)];
  const c0 = measure(first), c2 = measure(status);
  const table = document.getElementById("tbl-an")?.clientWidth || 0;
  // the measured columns include their cell padding; the range cell needs its own padding on top of strip + gap
  const cell = ranges.filter(Boolean)[0], pad = cell ? parseFloat(getComputedStyle(cell).paddingLeft) + parseFloat(getComputedStyle(cell).paddingRight) : 0;
  const strip = Math.max(STRIP_MIN * rem, Math.min(STRIP_MAX * rem, table - c0 - c2 - pad - 3 * GAP_MIN * rem));
  const gap = Math.max(0, Math.min(GAP * rem, (table - c0 - strip - c2 - pad) / 3));
  first.filter(Boolean).forEach(t => t.style.width = Math.round(c0 + gap) + "px");
  ranges.filter(Boolean).forEach(t => t.style.width = Math.round(strip + gap + pad) + "px");
  status.filter(Boolean).forEach(t => t.style.width = "");      // takes the rest: its content plus the same gap
  document.getElementById("tbl-an")?.style.setProperty("--strip", strip + "px");
  placeLabels();
}

export function toast(msg){ const t=document.getElementById("toast");
  t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),1800); }

/* ---------- floating tooltip for .info markers: never leaves the viewport ---------- */
export function initTooltips(){
  const tip = document.getElementById("tip");
  let current = null;
  function show(el){
    current = el; shownAt = performance.now();
    const jump = "jump" in el.dataset, src = el.dataset.src;    // a tip that acts when clicked, or carries a source link
    tip.innerHTML = esc(el.dataset.tip) + (jump ? icon("arrow",12) : "")
      + (src ? ` <a href="${esc(src)}" target="_blank" rel="noopener" title="${esc(el.dataset.srcTitle||"")}">source ${icon("external",11)}</a>` : "");
    tip.hidden = false;
    tip.classList.toggle("act", jump || !!src);
    const r = el.getBoundingClientRect(), pad = 8, vw = window.innerWidth, vh = window.innerHeight;
    tip.style.maxWidth = Math.min(280, vw - 2*pad) + "px";
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let left = r.left + r.width/2 - w/2;
    left = Math.max(pad, Math.min(left, vw - w - pad));
    let top = r.top - h - 8;
    if(top < pad) top = Math.min(r.bottom + 8, vh - h - pad);
    tip.style.left = left + "px"; tip.style.top = top + "px";
  }
  function hide(){ current = null; tip.hidden = true; }
  let shownAt = 0;
  const target = e => e.target.closest?.(".info[data-tip]");
  const inTip = el => !!el && tip.contains(el);
  // hover only for a real mouse: a touch tap emits emulated hover events right before its click
  document.addEventListener("pointerover", e=>{ if(e.pointerType!=="mouse") return; const el = target(e); if(el && el!==current) show(el); });
  document.addEventListener("pointerout", e=>{ if(e.pointerType!=="mouse") return; const el = target(e); if(el && !el.contains(e.relatedTarget) && !inTip(e.relatedTarget)) hide(); });
  // an actionable tip stays while the pointer is on it; leaving it (not back to its marker) closes it
  tip.addEventListener("pointerout", e=>{ if(e.pointerType==="mouse" && current && !inTip(e.relatedTarget) && !current.contains(e.relatedTarget)) hide(); });
  document.addEventListener("focusin", e=>{ const el = target(e); if(el) show(el); });
  document.addEventListener("focusout", e=>{ if(target(e)) hide(); });
  document.addEventListener("click", e=>{
    if(inTip(e.target)){                                         // a tap on an actionable tip fires its action
      if(e.target.closest("a")){ hide(); return; }               // a source link just opens
      const j = current?.dataset.jump; hide();
      if(j!=null) document.dispatchEvent(new CustomEvent("jump-to-missing", { detail:{ j:+j } }));
      return;
    }
    const el = target(e);
    if(!el){ if(current) hide(); return; }                       // a tap anywhere else dismisses
    if(el===current && !tip.hidden && performance.now() - shownAt > 400) hide(); // second tap closes
    else show(el);                                               // (a click right after hover/focus opened it is not a toggle)
  });
  document.addEventListener("keydown", e=>{ if(e.key==="Escape") hide(); });
  window.addEventListener("scroll", ()=>{ if(current) show(current); }, { passive:true });
}

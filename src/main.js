import { EXAMPLE, EMPTY, WEIGHT_UNITS, UNITS, PERIODS, NUTS, HAZARDS, hazardsOf, f } from "./data.js";
import { S, setState, loadLocal, saveLocal, sanitize, backfill, store, weightKg, gramsPerDay } from "./state.js";
import { renderFoods, renderAnalysis, toast, openEditors, esc, gramsText, initTooltips, badgeHtml, syncColumns, setAdderRow } from "./render.js";
import { encodeRecipe, decodeRecipe, readHash, buildHash } from "./share.js";
import { search, searchBundled, searchCached, bundledAt, bundledFdcId, nutrientsFor, setApiKey, DEMO_LIMIT, KEY_LIMIT, SIGNUP_URL } from "./fdc.js";
import { icon, mountIcons } from "./icons.js";
import { initEditable, fitAll, editable } from "./editable.js";

const $ = id => document.getElementById(id);
mountIcons();
initTooltips();
initEditable();

/* ---------- the adder row: first row of the food table, holding the search box (created before the table first renders) ---------- */
const opts = (obj, sel) => Object.keys(obj).map(k=>`<option value="${k}" ${k===sel?"selected":""}>${k}</option>`).join("");
const adder = document.createElement("tr"); adder.className = "adder";
adder.innerHTML = `<td class="foodname">${editable({ value:"", cls:"q", fit:false, label:"Search", placeholder:"type an ingredient, e.g. sardines",
    attrs:`id="q" aria-label="Search ingredients or add a food" role="combobox" aria-expanded="false" aria-controls="results" aria-autocomplete="list"` })}</td>
  <td class="num amount">${editable({ value:"100", cls:"amt", attrs:`disabled aria-hidden="true" tabindex="-1"`, label:"" })}</td>
  <td><select disabled aria-hidden="true" tabindex="-1">${opts(UNITS, "g")}</select></td>
  <td><select disabled aria-hidden="true" tabindex="-1">${opts(PERIODS, "day")}</select></td>
  <td class="num gday fill">\u2013</td>
  <td class="actions"><button type="button" id="keybtn" class="quiet iconbtn" title="USDA API key" aria-label="USDA API key" aria-haspopup="dialog" aria-expanded="false" aria-controls="keypop">${icon("key")}</button><button class="quiet iconbtn" disabled aria-hidden="true" tabindex="-1">${icon("trash")}</button></td>`;
setAdderRow(adder);

/* ---------- API key: a popover under the key icon in the adder row ---------- */
const keyBox = $("apikey"), shareKey = $("sharekey"), keyBtn = adder.querySelector("#keybtn"), keyPop = $("keypop");
function useKey(k){
  keyBox.value = k; setApiKey(k); store.set("lady.fdckey", k);
  keyBtn.classList.toggle("has-key", !!k); keyBtn.title = k ? "USDA API key (set)" : "USDA API key";
  shareKey.disabled = !k;
  if(!k) shareKey.checked = false;
}
keyBox.addEventListener("change", ()=> useKey(keyBox.value.trim()));
shareKey.checked = !!store.get("lady.sharekey");
shareKey.addEventListener("change", ()=> store.set("lady.sharekey", shareKey.checked));
function placeKeyPop(){   // fixed, under the key icon and right-aligned to it
  const r = keyBtn.getBoundingClientRect(), rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  keyPop.style.top = (r.bottom + 6) + "px";
  keyPop.style.left = Math.max(rem, Math.min(r.right - keyPop.offsetWidth, window.innerWidth - keyPop.offsetWidth - rem)) + "px";
}
function toggleKeyPop(show = keyPop.hidden){
  keyPop.hidden = !show; keyBtn.setAttribute("aria-expanded", String(show));
  if(show){ closeResults(); placeKeyPop(); keyBox.focus(); }
}
window.addEventListener("resize", ()=>{ if(!keyPop.hidden) placeKeyPop(); });
window.addEventListener("scroll", ()=>{ if(!keyPop.hidden) placeKeyPop(); }, { passive:true });
keyBtn.addEventListener("click", ()=> toggleKeyPop());
document.addEventListener("click", e=>{ if(!e.target.closest("#keypop, #keybtn, [data-act=key]")) toggleKeyPop(false); });
document.addEventListener("keydown", e=>{ if(e.key==="Escape" && !keyPop.hidden){ toggleKeyPop(false); keyBtn.focus(); } });
/* ---------- URL <-> state ---------- */
let lastWritten = null;                 // encoded diet we last put in the address bar
let syncTimer = null;
function scheduleUrlSync(){
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async ()=>{
    const enc = await encodeRecipe(S);
    if(enc===lastWritten) return;
    lastWritten = enc;
    history.replaceState(null, "", buildHash(enc));
  }, 250);
}
async function loadFromHash(){
  const { recipe, key } = readHash();
  const qkey = new URLSearchParams(location.search).get("key");
  if(key || qkey) useKey(key || qkey);
  if(!recipe || recipe===lastWritten) return false;
  try{
    const next = sanitize(await decodeRecipe(recipe));
    if(!next) throw new Error("not a diet");
    backfill(next);                      // a link made before a nutrient was added gets it from the built-in table
    setState(next); lastWritten = recipe;
    return true;
  }catch(err){
    console.error("Could not read diet from link:", err);
    toast("That link did not contain a readable diet");
    return false;
  }
}
window.addEventListener("hashchange", async ()=>{ if(await loadFromHash()){ renderAll(); toast("Loaded diet from link"); } });

/* ---------- render + persist ---------- */
function renderAll(){ renderFoods(); renderAnalysis(); persist(); }
function persist(){ saveLocal(); scheduleUrlSync(); }

/* ---------- title ---------- */
const titleEl = $("title");
titleEl.addEventListener("input", ()=>{
  const v = titleEl.value.trim();
  if(v===S.title) return;
  S.title = v || EXAMPLE.title; document.title = S.title; persist();
});
titleEl.addEventListener("blur", ()=>{ if(titleEl.value !== S.title){ titleEl.value = S.title; fitAll(); } });

/* ---------- menu: share + reset (arrow keys move, Tab works natively, Escape closes) ---------- */
const moreBtn = $("more"), menu = $("menupop");
const menuItems = ()=> [...menu.querySelectorAll("[role=menuitem]:not([hidden])")];
function toggleMenu(show = menu.hidden, focusFirst = false){
  menu.hidden = !show; moreBtn.setAttribute("aria-expanded", String(show));
  if(show){ // keep the popover on screen when the button sits near the right edge
    menu.classList.remove("flip");
    const r = menu.getBoundingClientRect();
    if(r.right > window.innerWidth - 8) menu.classList.add("flip");
    if(focusFirst) menuItems()[0]?.focus();
  }
}
moreBtn.addEventListener("click", ()=> toggleMenu(menu.hidden, true));
moreBtn.addEventListener("keydown", e=>{ if(e.key==="ArrowDown"){ e.preventDefault(); toggleMenu(true, true); } });
menu.addEventListener("click", e=>{ if(e.target.closest("[role=menuitem]")) toggleMenu(false); });
menu.addEventListener("keydown", e=>{
  const items = menuItems(), i = items.indexOf(document.activeElement);
  if(e.key==="ArrowDown"){ e.preventDefault(); items[(i+1) % items.length]?.focus(); }
  else if(e.key==="ArrowUp"){ e.preventDefault(); items[(i-1+items.length) % items.length]?.focus(); }
  else if(e.key==="Home"){ e.preventDefault(); items[0]?.focus(); }
  else if(e.key==="End"){ e.preventDefault(); items.at(-1)?.focus(); }
  else if(e.key==="Escape"){ toggleMenu(false); moreBtn.focus(); }
});
menu.addEventListener("mousemove", e=>{ const it = e.target.closest("[role=menuitem]"); if(it && it!==document.activeElement) it.focus(); });
// close when focus moves to something else outside the menu. A null relatedTarget is *not* that:
// iOS Safari blurs the focused item when a tap lands on a button (buttons never take focus there),
// and closing on it would hide the item before its click arrives.
menu.addEventListener("focusout", e=>{ if(e.relatedTarget && !menu.contains(e.relatedTarget) && e.relatedTarget!==moreBtn) toggleMenu(false); });
document.addEventListener("click", e=>{ if(!e.target.closest(".menu")) toggleMenu(false); });
document.addEventListener("keydown", e=>{ if(e.key==="Escape") toggleMenu(false); });

async function shareUrl(){
  const withKey = shareKey.checked && keyBox.value.trim();
  const url = new URL(location.href);
  url.search = "";
  url.hash = buildHash(await encodeRecipe(S), withKey ? keyBox.value.trim() : "");
  return url.toString();
}
async function copyLink(){
  const url = await shareUrl();
  const withKey = url.includes("&key=");
  try{ await navigator.clipboard.writeText(url); toast(withKey ? "Link copied, with your API key included" : "Link copied — anyone with it sees this diet"); }
  catch(e){ window.prompt("Copy this link:", url); }
}
$("copylink").addEventListener("click", copyLink);
$("reset").addEventListener("click", ()=>{
  if(confirm("Replace this diet with the built-in example?")){
    setState(structuredClone(EXAMPLE)); openEditors.clear(); renderAll(); toast("Example diet loaded");
  }
});
$("new").addEventListener("click", ()=>{
  if(!S.foods.length || confirm("Start a new, empty diet? The current one stays in the address bar until you leave this page.")){
    setState(structuredClone(EMPTY)); openEditors.clear(); renderAll(); toast("Empty diet — add some foods");
  }
});

/* ---------- food table events ---------- */
const tbl = $("tbl-foods");
/* the amount field is text because it takes arithmetic ("400*2/10"), so restrict it to what the
   expression parser accepts: digits, a decimal point or comma, + - * / (also x × ÷), brackets, spaces */
const NOT_AMOUNT = /[^0-9.,+\-*/x×÷()\s]/gi;
tbl.addEventListener("beforeinput", e=>{
  if(e.target.dataset.f!=="amount" || e.data==null) return;
  const clean = e.data.replace(NOT_AMOUNT, "");
  if(clean===e.data) return;
  e.preventDefault();                                   // typed or pasted text with other characters: keep only the allowed ones
  if(clean){ e.target.setRangeText(clean, e.target.selectionStart, e.target.selectionEnd, "end"); e.target.dispatchEvent(new Event("input", { bubbles:true })); }
});
tbl.addEventListener("input", e=>{
  const tr = e.target.closest("tr[data-id]");
  if(!tr) return;
  const it = S.foods.find(x=>x.id===tr.dataset.id);
  if(!it) return;
  const fld = e.target.dataset.f;
  if(fld==="name"){                                       // typing a name: offer to rename, or to replace with a search result
    if(!e.isTrusted) return;                              // (the × restoring the old text is not a request)
    editing = it.id; anchor = e.target; showLocal(); return;
  }
  else if(fld==="src") it.src = e.target.value;
  else if(fld==="amount") it.amount = e.target.value;
  else if(fld==="unit") it.unit = e.target.value;
  else if(fld==="per") it.per = e.target.value;
  else if(fld==="n"){ // blank = not known (counts as 0 but is flagged); a number, 0 included, = known
    const v = e.target.value.trim();
    it.per100[+e.target.dataset.j] = v==="" ? null : Math.max(0, +v||0);
    e.target.closest("label").classList.toggle("unknown", v==="");
    const btn = tbl.querySelector(`tr[data-id="${it.id}"] button[data-f="edit"]`);
    if(btn){ btn.querySelector(".badge")?.remove(); btn.insertAdjacentHTML("beforeend", badgeHtml(it)); }
  }
  else return;
  if(fld==="amount" || fld==="unit" || fld==="per"){
    const gd = tr.querySelector(".gday"), amt = tr.querySelector('input[data-f="amount"]');
    const bad = gramsText(it)==="?";
    gd.textContent = gramsText(it); gd.classList.toggle("bad", bad); amt.classList.toggle("bad", bad);
  }
  renderAnalysis();
  persist();
});
tbl.addEventListener("click", e=>{
  const btn = e.target.closest("button[data-f]"); if(!btn) return;
  const id = btn.closest("tr").dataset.id;
  if(btn.dataset.f==="del"){
    openEditors.delete(id);
    S.foods = S.foods.filter(x=>x.id!==id); renderAll();
  } else if(btn.dataset.f==="edit"){
    if(!openEditors.delete(id)) openEditors.add(id);
    renderFoods();
  }
});
function addFood(it, msg){
  S.foods.unshift(it);
  return settle(it, msg);
}
/** Show a food that was just added or replaced: editor open if anything is unreported, focus on its amount. */
function settle(it, msg){
  // editor open when values need filling in; not for a hazardous food, where the warning is the point
  if((it.per100.some(v=>v==null) || it.src==="A manually added food item") && !hazardsOf(it).length) openEditors.add(it.id);
  renderAll();
  const row = tbl.querySelector(`tr[data-id="${it.id}"]`);
  if(row){ row.classList.add("flash"); row.scrollIntoView({block:"nearest", behavior:"smooth"}); const amt = row.querySelector('input[data-f="amount"]'); amt?.focus(); amt?.select(); }
  toast(msg);
  return row;
}
/** Apply a search result: as a new food from the adder row, or in place of the food being renamed. */
function place(name, src, per100, msg){
  const target = editing && S.foods.find(x=>x.id===editing);
  editing = null; close(); qBox.value = "";
  if(target){ target.name = name; target.src = src; target.per100 = per100; return settle(target, "Replaced \u2014 amount kept"); }
  return addFood(f(name, "100", "g", "day", src, per100), msg);
}
document.getElementById("tbl-in").addEventListener("input", e=>{
  if(e.target.id==="g-weightUnit"){
    const kg = weightKg();
    S.weightUnit = e.target.value;
    S.weight = Math.round(kg / WEIGHT_UNITS[S.weightUnit] * 10) / 10;
    renderAll(); return;
  }
  if(e.target.dataset.g){ S[e.target.dataset.g] = Math.max(0, +e.target.value||0); renderAll(); }
});
/* ---------- problems: a dismissable notice at the top of the search results ---------- */
function problemHtml(err){
  const link = txt => `<a href="${SIGNUP_URL}" target="_blank" rel="noopener">${txt} ${icon("external",12)}</a>`;
  const kind = err.kind || "http";
  const detail = {
    "demo-limit": `The public key allows about ${DEMO_LIMIT} requests an hour, shared by everyone on your network. Built-in ingredients and custom foods still work. A free personal key allows ${KEY_LIMIT} an hour.`,
    "key-limit":  `It allows ${KEY_LIMIT} requests an hour and resets on its own. Built-in ingredients and custom foods still work meanwhile.`,
    "bad-key":    "Check it for typos, or request a new one.",
    "offline":    "", "http": "Try again in a moment.", "data": "",
  }[kind] ?? "";
  const actions = kind==="demo-limit" ? `<button data-act="key">${icon("key",14)}Use a personal key</button>${link("get one free")}`
    : kind==="bad-key" ? `<button data-act="key">${icon("key",14)}Fix the key</button>${link("get a new one")}`
    : kind==="key-limit" ? link("manage keys") : "";
  return `<div class="notice ${["offline","http"].includes(kind)?"bad":""}">${icon("alert")}<div class="body"><p><strong>${esc(err.message)}</strong></p>
    ${detail?`<p>${detail}</p>`:""}${actions?`<div class="row">${actions}</div>`:""}</div>
    <button class="quiet iconbtn" data-act="close" aria-label="Dismiss">${icon("x",14)}</button></div>`;
}
/** Show a problem above whatever the results list holds (built-in matches stay usable). */
function problem(err, below=""){
  console.warn("USDA problem:", err);
  open(problemHtml(err) + below);
}

/* ---------- ingredient search: a floating listbox with keyboard navigation ---------- */
const resultsBox = $("results"), qBox = adder.querySelector("#q");   // the adder row is not in the document until the table first renders
let editing = null;     // id of the food whose name is being edited (the list then renames or replaces it), or null for the adder row
let anchor = qBox;      // the input the results list hangs from
const query = ()=> anchor.value.trim();
/** put the results list under the search box (it is position:fixed so the table's scroll box cannot clip it) */
function placeResults(){
  const r = anchor.getBoundingClientRect(), rem = parseFloat(getComputedStyle(document.documentElement).fontSize), vw = window.innerWidth;
  const width = Math.min(Math.max(r.width, 28*rem), vw - 2*rem);
  resultsBox.style.left = Math.max(rem, Math.min(r.left, vw - width - rem)) + "px";
  resultsBox.style.top = (r.bottom + 4) + "px"; resultsBox.style.width = width + "px";
  resultsBox.style.maxHeight = Math.max(8*rem, window.innerHeight - r.bottom - 2*rem) + "px";
}
window.addEventListener("scroll", ()=>{ if(!resultsBox.hidden) placeResults(); }, { passive:true });
window.addEventListener("resize", ()=>{ if(!resultsBox.hidden) placeResults(); });
const opt = (attrs, label, meta) => `<div class="opt" role="option" ${attrs}><span>${label}</span><span class="dt">${meta}</span>${icon("plus",14)}</div>`;
const localOpts = (q, exclude=new Set()) => searchBundled(q).filter(b=> !exclude.has(bundledFdcId(b)))
  .map(b=> opt(`data-local="${b.i}"`, esc(b.name), `built-in · ${esc(b.src)}`)).join("");
/** USDA hits remembered from earlier searches, minus any that are built in or already listed. */
let cachedHits = new Map();
function cachedOpts(q, exclude=new Set()){
  const bundledIds = new Set(searchBundled(q).map(bundledFdcId));
  const hits = searchCached(q).filter(x=> !exclude.has(x.fdcId) && !bundledIds.has(x.fdcId));
  cachedHits = new Map(hits.map(x=>[String(x.fdcId), x]));
  return hits.map(x=> opt(`data-cached="${esc(x.fdcId)}"`, `${esc(x.description)}${x.brandOwner?` — ${esc(x.brandOwner)}`:""}`, `remembered · USDA ${esc(x.fdcId)} (${esc(x.dataType)})`)).join("");
}
const usdaOpt = q => `<div class="opt usda" role="option" data-usda="1"><span>Search USDA for “${esc(q)}”</span><span class="dt">FoodData Central</span>${icon("search",14)}</div>`;
const customOpt = q => `<div class="opt" role="option" data-custom="1"><span>Add custom food “${esc(q)}”</span><span class="dt">type its nutrients yourself</span>${icon("plus",14)}</div>`;
const renameOpt = q => `<div class="opt" role="option" data-rename="1"><span>Rename to “${esc(q)}”</span><span class="dt">keep its nutrients</span>${icon("pencil",14)}</div>`;
/** the actions offered for the typed text: search always; add a custom food from the adder row, rename from a food's name */
const actions = q => (editing ? renameOpt(q) : "") + usdaOpt(q) + (editing ? "" : customOpt(q));
const sep = html => html ? `<div class="sep" role="separator"></div>` + html : "";
/** Footer row of a USDA result list when no personal key is set: says which key was used and offers the popover. */
const demoRow = ()=> keyBox.value.trim() ? "" :
  `<div class="msg keymsg"><span>Searched with USDA\u2019s shared demo key \u00b7 about ${DEMO_LIMIT} an hour for your whole network</span><button type="button" data-act="key">${icon("key",12)}Use your own key</button></div>`;
let usdaHits = new Map();   // fdcId -> search hit (with per100) for the list on screen
/** source note for a USDA food; a branded food's ingredient list is scanned for known hazards and any found are named here */
function usdaSrc(x){
  const found = HAZARDS.map(h => (x.ingredients||"").match(h.match)?.[0]).filter(Boolean);
  return `USDA FDC ${x.fdcId}${x.dataType?` (${x.dataType})`:""}${found.length ? ` \u00b7 ingredients include ${[...new Set(found.map(w=>w.toLowerCase()))].join(", ")}` : ""}`;
}
let active = -1;
const options = ()=> [...resultsBox.querySelectorAll(".opt")];
function setActive(i){
  const os = options(); if(!os.length){ active=-1; return; }
  active = (i + os.length) % os.length;
  os.forEach((o,k)=> o.classList.toggle("active", k===active));
  os[active].scrollIntoView({ block:"nearest" });
}
function open(html){ resultsBox.innerHTML = html; resultsBox.hidden = false; placeResults(); anchor.setAttribute("aria-expanded","true"); setActive(0); if(!keyPop.hidden) toggleKeyPop(false); }
function close(){ resultsBox.hidden = true; anchor.setAttribute("aria-expanded","false"); active = -1; }
function closeResults(){ close(); }
function showLocal(){
  const q = query();
  if(!q){ close(); return; }
  open(actions(q) + sep(localOpts(q) + cachedOpts(q)));   // actions first, then what is already known offline
}
async function doSearch(){
  const q=query(); if(!q) return;
  open(actions(q) + sep(localOpts(q) + `<div class="msg">searching USDA FoodData Central…</div>`));
  try{
    const foods = await search(q);
    usdaHits = new Map(foods.map(x=>[String(x.fdcId), x]));
    const usda = foods.map(x=> opt(`data-fdc="${esc(x.fdcId)}"`, `${esc(x.description)}${x.brandOwner?` — ${esc(x.brandOwner)}`:""}`, esc(x.dataType))).join("");
    const local = localOpts(q, new Set(foods.map(x=>x.fdcId)));
    open(demoRow() + actions(q) + sep(
         (usda ? `<div class="msg">USDA FoodData Central</div>${usda}` : `<div class="msg">No USDA results. Try simpler words (“sardine canned water”).</div>`)
       + (local ? `<div class="msg">built-in</div>${local}` : "")));
  }catch(err){ const local = localOpts(q); problem(err, local ? `<div class="msg">built-in</div>${local}` : ""); }
}
async function choose(el){
  if(!el) return;
  if(el.dataset.usda){ doSearch(); return; }
  if(el.dataset.rename){                                    // keep the food, change its name
    const it = S.foods.find(x=>x.id===editing); const name = query();
    editing = null; close();
    if(it && name){ it.name = name; renderAll(); }
    return;
  }
  if(el.dataset.custom){                                    // a food of the user's own, named as typed, nutrients to be filled in
    place(query() || "New food", "A manually added food item", NUTS.map(()=>0), "Set the amount, then type its nutrients per 100 g");
    return;
  }
  if(el.dataset.local!=null){
    const b = bundledAt(+el.dataset.local);
    place(b.name, b.src, b.per100.slice(), "Added at 100 g a day \u2014 adjust the amount"); return;
  }
  if(el.dataset.cached!=null){
    const x = cachedHits.get(el.dataset.cached); if(!x) return;
    place(x.description, usdaSrc(x), x.per100.slice(), "Added at 100 g a day \u2014 adjust the amount"); return;
  }
  const id = el.dataset.fdc; if(!id) return;
  const hit = usdaHits.get(id);
  el.classList.add("busy");
  try{
    let per100 = hit?.per100, dataType = hit?.dataType || "";
    if(!per100){ const rec = await nutrientsFor(id); per100 = rec.per100; dataType = rec.dataType || dataType; }
    if(!per100.some(v=>v>0)){
      const err = new Error(`“${hit?.description||id}” lists no usable nutrients in USDA’s data — try another entry for the same food, or add it as a custom food.`);
      err.kind = "data"; throw err;
    }
    place(hit?.description || `USDA ${id}`, usdaSrc({ fdcId:id, dataType, ingredients:hit?.ingredients }), per100, "Added at 100 g a day \u2014 adjust the amount");
  }catch(err){ el.classList.remove("busy"); problem(err, resultsBox.innerHTML.replace(/<div class="notice[\s\S]*?<\/div>\s*<\/div>/, "")); }
}
function searchKeys(e){
  if(e.key==="ArrowDown"){ e.preventDefault(); resultsBox.hidden ? showLocal() : setActive(active+1); }
  else if(e.key==="ArrowUp"){ e.preventDefault(); setActive(active-1); }
  else if(e.key==="Escape"){ if(!resultsBox.hidden){ e.stopPropagation(); close(); } }   // first Escape closes the list; a second clears the box
  else if(e.key==="Enter"){ e.preventDefault(); e.stopPropagation(); const os = options(); if(!resultsBox.hidden && os[active]) choose(os[active]); else doSearch(); }
}
qBox.addEventListener("input", ()=>{ editing = null; anchor = qBox; showLocal(); });
qBox.addEventListener("focus", ()=>{ editing = null; anchor = qBox; showLocal(); });
qBox.addEventListener("keydown", searchKeys);
tbl.addEventListener("keydown", e=>{ if(e.target.matches('input[data-f="name"]')) searchKeys(e); });
// leaving a food's name without choosing anything puts the old name back
tbl.addEventListener("focusout", e=>{
  if(!e.target.matches('input[data-f="name"]') || !editing) return;
  const it = S.foods.find(x=>x.id===editing); if(it && e.target.value!==it.name){ e.target.value = it.name; fitAll(); }
  editing = null; anchor = qBox; close();
});
resultsBox.addEventListener("mousemove", e=>{ const o = e.target.closest(".opt"); if(o){ const i = options().indexOf(o); if(i!==active) setActive(i); } });
resultsBox.addEventListener("mousedown", e=> e.preventDefault()); // keep focus in the search box
resultsBox.addEventListener("click", e=>{
  const act = e.target.closest("button[data-act]")?.dataset.act;
  if(act==="key"){ toggleKeyPop(true); keyBox.select(); return; }
  if(act==="close"){ e.target.closest(".notice").remove(); if(!options().length && !resultsBox.querySelector(".opt, .msg")) close(); return; }
  if(e.target.closest("a")) return;
  choose(e.target.closest(".opt"));
});
// a click whose target was removed by its own handler (the notice's ×) is not a click outside
document.addEventListener("click", e=>{ if(e.target.isConnected && !e.target.closest(".adder, #results, .edit.name")) close(); });

/* ---------- iOS Safari zooms into any focused control under 16px; maximum-scale=1 stops that
   and, since iOS 10, still leaves pinch zoom alone. Applied only on iOS because Android
   Chrome would honour it by disabling pinch zoom. ---------- */
if(/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1)){
  const vp = document.querySelector("meta[name=viewport]");
  if(vp && !/maximum-scale/.test(vp.content)) vp.content += ", maximum-scale=1";
}

/* ---------- installable: register the service worker (production build only) ---------- */
if("serviceWorker" in navigator && import.meta.env.PROD){
  window.addEventListener("load", ()=> navigator.serviceWorker.register("/sw.js").catch(e=> console.warn("service worker:", e)));
}

let colTimer = null;
window.addEventListener("resize", ()=>{ clearTimeout(colTimer); colTimer = setTimeout(syncColumns, 100); });

/* ---------- boot ---------- */
(async ()=>{
  useKey(store.get("lady.fdckey") || "");
  setState(loadLocal());
  const fromLink = await loadFromHash();
  renderAll();
  fitAll();
  if(fromLink) toast("Loaded diet from link — edits stay in this browser");
})();

/**
 * Recipe <-> URL.
 *
 * The recipe lives in the URL *hash* (never sent to the server or logged):
 *   https://puppersupper.theo.lol/#r=<base64url(deflate-raw(json))>&key=<optional FDC key>
 *
 * Encoding is a positional array so the payload stays small, versioned with a
 * leading integer so the format can change without breaking old links.
 *   v1: [1, weight, activity, batchCups, cupsPerDay, [[name,cat,mode,qty,unit,gPerUnit,src,per100]]]
 *   v2: [2, title, weight, activity, [[name,kind,amount,src,per100]] (kind is ignored now)]
 *   v3: [3, title, weight, activity, [[name,amount,unit,per,src,per100]], weightUnit?]
 *   v4: as v3, but per100 is null for a food whose values are exactly those of
 *       a built-in ingredient (matched by USDA id or name); backfill() restores
 *       them on load. Nutrients are two thirds of a link, and most are copies.
 * decodeRecipe returns the *raw* object shape; run it through sanitize(),
 * which also migrates v1 recipes.
 */
import { NUTS, usdaId } from "./data.js";
import { BUNDLED } from "./bundled.js";

const VERSION = 4;
const PARAM = "r";
const KEY_PARAM = "key";

/* ---- compact positional form ---- */
const r3 = v => v==null ? null : Math.round(v*1000)/1000; // 3 dp is plenty for nutrients; null = unknown
/** the built-in this food is a copy of, if its values match one exactly */
function asBundled(x){
  const id = usdaId(x.src), name = x.name.trim().toLowerCase();
  const b = BUNDLED.find(b=> (id && usdaId(b.src)===id) || b.name.toLowerCase()===name);
  return b && b.per100.every((v,j)=> r3(v)===r3(x.per100[j])) ? b : null;
}
function pack(S){
  return [VERSION, S.title, S.weight, S.activity,
    S.foods.map(x=>[x.name, x.amount, x.unit, x.per, x.src, asBundled(x) ? null : x.per100.map(r3)]), S.weightUnit];
}
function unpack(a){
  if(!Array.isArray(a)) throw new Error("unknown recipe format");
  const per100 = p => NUTS.map((_,j)=> p?.[j] ?? null); // absent = unknown, not zero
  if(a[0]===1 && Array.isArray(a[5])) return {
    weight:a[1], activity:a[2], batchCups:a[3], cupsPerDay:a[4],
    foods: a[5].map(x=>({ name:x[0], cat:x[1], mode:x[2], qty:x[3], unit:x[4], gPerUnit:x[5], src:x[6], per100:per100(x[7]) })),
  };
  if(a[0]===2 && Array.isArray(a[4])) return {
    title:a[1], weight:a[2], activity:a[3],
    foods: a[4].map(x=>({ name:x[0], amount:x[2], src:x[3], per100:per100(x[4]) })),
  };
  if((a[0]===3 || a[0]===4) && Array.isArray(a[4])) return {
    title:a[1], weight:a[2], activity:a[3], weightUnit:a[5],
    foods: a[4].map(x=>({ name:x[0], amount:x[1], unit:x[2], per:x[3], src:x[4], per100:per100(x[5]) })),
  };
  throw new Error("unknown recipe format");
}

/* ---- bytes <-> base64url ---- */
const b64u = {
  enc(bytes){
    let s=""; for(const b of bytes) s+=String.fromCharCode(b);
    return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  },
  dec(str){
    const s = atob(str.replace(/-/g,"+").replace(/_/g,"/") + "=".repeat((4 - str.length%4)%4));
    return Uint8Array.from(s, c=>c.charCodeAt(0));
  },
};

/* ---- deflate via the browser/Node built-in streams ---- */
async function pipe(bytes, stream){
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}
const deflate = bytes => pipe(bytes, new CompressionStream("deflate-raw"));
const inflate = bytes => pipe(bytes, new DecompressionStream("deflate-raw"));

/** Recipe state -> opaque string safe for a URL hash. */
export async function encodeRecipe(S){
  const json = new TextEncoder().encode(JSON.stringify(pack(S)));
  return b64u.enc(await deflate(json));
}
/** Inverse of encodeRecipe. Throws on garbage. Result is un-sanitised. */
export async function decodeRecipe(str){
  const json = new TextDecoder().decode(await inflate(b64u.dec(str)));
  return unpack(JSON.parse(json));
}

/* ---- hash helpers ---- */
export function readHash(hash = globalThis.location?.hash ?? ""){
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  return { recipe: p.get(PARAM), key: p.get(KEY_PARAM) };
}
export function buildHash(encoded, key){
  const p = new URLSearchParams();
  p.set(PARAM, encoded);
  if(key) p.set(KEY_PARAM, key);
  return "#" + p.toString(); // base64url chars are all left unescaped by URLSearchParams
}

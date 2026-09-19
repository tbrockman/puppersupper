import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeRecipe, decodeRecipe, readHash, buildHash } from "../src/share.js";
import { EXAMPLE, NUTS } from "../src/data.js";
import { sanitize, setState, totals, gramsPerDay, weightKg, backfill, S } from "../src/state.js";

const strip = s => ({ ...s, foods: s.foods.map(({ id, ...rest }) => rest) });

test("recipe survives a URL round trip", async () => {
  const enc = await encodeRecipe(EXAMPLE);
  assert.match(enc, /^[A-Za-z0-9_-]+$/, "base64url only");
  const hash = buildHash(enc, "abc=123");
  const { recipe, key } = readHash(hash);
  assert.equal(recipe, enc);
  assert.equal(key, "abc=123");
  const back = sanitize(await decodeRecipe(recipe)); backfill(back);
  assert.deepEqual(strip(back), strip(EXAMPLE));
});

test("a food whose values match a built-in travels without them; edited values still travel", async () => {
  const { BUNDLED } = await import("../src/bundled.js");
  const egg = BUNDLED.find(b => b.name === "Egg, whole, raw");
  const edited = egg.per100.slice(); edited[1] = 99;
  const d = sanitize({ foods: [
    { name: "Eggs", amount: "60", src: egg.src, per100: egg.per100.slice() },          // by USDA id
    { name: "Egg, whole, raw", amount: "50", src: "typed", per100: egg.per100.slice() }, // by name
    { name: "Eggs", amount: "60", src: egg.src, per100: edited },                       // edited: not a copy
  ]});
  const raw = await decodeRecipe(await encodeRecipe(d));
  assert.ok(raw.foods[0].per100.every(v => v === null) && raw.foods[1].per100.every(v => v === null), "copies travel without values");
  assert.equal(raw.foods[2].per100[1], 99, "an edited food keeps its values");
  const back = sanitize(raw); backfill(back);
  assert.deepEqual(back.foods[0].per100, egg.per100); assert.deepEqual(back.foods[1].per100, egg.per100); assert.equal(back.foods[2].per100[1], 99);
  const full = await encodeRecipe(sanitize({ foods: [{ name: "Eggs", amount: "60", src: egg.src, per100: edited }] }));
  const light = await encodeRecipe(sanitize({ foods: [{ name: "Eggs", amount: "60", src: egg.src, per100: egg.per100.slice() }] }));
  assert.ok(light.length < full.length * 0.6, `${light.length} vs ${full.length}`);
});

test("encoded example fits comfortably in a URL", async () => {
  const enc = await encodeRecipe(EXAMPLE);
  console.log(`  example recipe encodes to ${enc.length} characters`);
  assert.ok(enc.length < 4000);
});

test("garbage in the hash is rejected", async () => {
  await assert.rejects(() => decodeRecipe("not-a-recipe"));
  assert.equal(sanitize({ hello: "world" }), null);
  assert.equal(readHash("#foo=bar").recipe, null);
});

test("sanitize coerces a hostile recipe into a well-formed one", () => {
  const s = sanitize({ weight: "abc", title: 7, foods: [{ name: 42, unit: "stone", per: "fortnight", amount: { evil: 1 }, per100: "nope" }] });
  assert.equal(s.weight, EXAMPLE.weight);
  assert.equal(s.title, "pupper supper");
  assert.equal(s.foods[0].name, "Unnamed");
  assert.equal("kind" in s.foods[0], false);
  assert.equal(s.foods[0].amount, "0");
  assert.equal(s.foods[0].per100.length, NUTS.length);
});

test("old batch/day/week recipes migrate to expressions with the same grams per day", async () => {
  const v1 = { weight: 22, activity: 1.8, batchCups: 10, cupsPerDay: 2, foods: [
    { name: "Eggs", cat: "Meat", mode: "batch", qty: 6, unit: "egg", gPerUnit: 50, src: "USDA 171287", per100: [143] },
    { name: "Liver", cat: "Liver", mode: "batch", qty: 133, unit: "g", gPerUnit: 1, src: "", per100: [119] },
    { name: "Can", cat: "Wet", mode: "week", qty: 1, unit: "can", gPerUnit: 374, src: "x", per100: [110] },
    { name: "Sticks", cat: "Treat", mode: "week", qty: 2, unit: "stick", gPerUnit: 20, src: "", per100: [300] },
    { name: "Calcium", cat: "Supplement", mode: "day", qty: 1, unit: "g", gPerUnit: 1, src: "", per100: [0] },
  ]};
  const s = sanitize(structuredClone(v1));
  const g = s.foods.map(gramsPerDay);
  assert.deepEqual(g.map(v => +v.toFixed(3)), [60, 26.6, 53.429, 5.714, 1]);
  assert.ok(s.foods.every(x => !("kind" in x)));
  assert.equal(s.foods[0].amount, "6*50*2/10");
  assert.equal(s.foods[0].src, "USDA 171287 · 6 egg × 50 g per batch");
  assert.equal(s.title, "pupper supper");

  // a v1 share link still opens
  const packedV1 = [1, 22, 1.8, 10, 2, v1.foods.map(x => [x.name, x.cat, x.mode, x.qty, x.unit, x.gPerUnit, x.src, x.per100])];
  const enc = await encodeV1(packedV1);
  const back = sanitize(await decodeRecipe(enc));
  assert.equal(back.foods[2].amount, "1*374");
  assert.equal(back.foods[2].per, "week");
});

test("v2 share links (kind, no unit/per) still open", async () => {
  const packedV2 = [2, "Lady", 22, 1.8, [["Can", "treat", "374/7", "x", [110]]]];
  const back = sanitize(await decodeRecipe(await encodeV1(packedV2)));
  assert.equal(back.title, "Lady");
  assert.equal(back.foods[0].amount, "374/7");
  assert.equal(back.foods[0].unit, "g");
  assert.equal(back.foods[0].per, "day");
  assert.equal("kind" in back.foods[0], false);
});

test("the dog's weight unit round-trips and feeds the maths in kg", async () => {
  const lb = { ...EXAMPLE, weight: 50, weightUnit: "lb" };
  const back = sanitize(await decodeRecipe(await encodeRecipe(lb)));
  assert.equal(back.weightUnit, "lb"); assert.equal(back.weight, 50);
  setState(back); assert.equal(+weightKg().toFixed(2), 22.68);
  assert.equal(sanitize({ foods: [], weightUnit: "stone" }).weightUnit, "kg");
});

test("units and periods convert to grams per day", () => {
  setState(sanitize({ foods: [
    { name: "a", amount: "1", unit: "lb", per: "week", per100: [100] },
    { name: "b", amount: "2", unit: "oz", per: "day", per100: [100] },
    { name: "c", amount: "0.5", unit: "kg", per: "month", per100: [100] },
  ]}));
  const g = S.foods.map(gramsPerDay).map(v => +v.toFixed(3));
  assert.deepEqual(g, [+(453.592/7).toFixed(3), 56.699, +(500/30.4375).toFixed(3)]);
  assert.equal(+totals()[0].toFixed(3), +g.reduce((a, b) => a + b).toFixed(3));
});

test("unknown nutrient values survive a share link as null, not 0", async () => {
  const d = sanitize({ foods: [{ name: "x", amount: "10", per100: [100, null, 5] }] });
  const back = sanitize(await decodeRecipe(await encodeRecipe(d)));
  assert.deepEqual(back.foods[0].per100.slice(0, 4), [100, null, 5, null]);
});

test("totals ignore rows whose expression does not parse", () => {
  setState(sanitize({ foods: [
    { name: "a", amount: "100", per100: [200] },
    { name: "b", amount: "100/", per100: [200] },
  ]}));
  assert.equal(totals()[0], 200);
});

// encode an already-packed v1 array the same way share.js does, without exposing pack()
async function encodeV1(arr){
  const bytes = new TextEncoder().encode(JSON.stringify(arr));
  const out = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const buf = new Uint8Array(await new Response(out).arrayBuffer());
  let s = ""; for (const b of buf) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

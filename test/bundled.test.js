import { test } from "node:test";
import assert from "node:assert/strict";
import { BUNDLED } from "../src/bundled.js";
import { NUTS } from "../src/data.js";

// fdc.js touches localStorage through store; give Node a throwaway one
globalThis.localStorage ??= { getItem(){ return null; }, setItem(){}, key(){ return null; }, length: 0 };
const { searchBundled } = await import("../src/fdc.js");

test("every bundled food has 24 nutrient values (a number, or null when unreported) and a source", () => {
  assert.ok(BUNDLED.length >= 40);
  for (const b of BUNDLED) {
    assert.equal(b.per100.length, NUTS.length, b.name);
    assert.ok(b.per100.every(v => v === null || (Number.isFinite(v) && v >= 0)), b.name);
    assert.ok(Number.isFinite(b.per100[0]) && Number.isFinite(b.per100[1]), `${b.name} has energy and protein`);
    assert.ok(b.src, b.name);
  }
  const names = BUNDLED.map(b => b.name);
  assert.equal(new Set(names).size, names.length, "no duplicate names");
});

test("bundled search matches every word, case-insensitively", () => {
  assert.ok(searchBundled("chicken BREAST").some(b => b.name.startsWith("Chicken breast")));
  assert.ok(searchBundled("egg").length >= 2);          // egg + eggshell
  assert.equal(searchBundled("chicken zebra").length, 0);
  assert.equal(searchBundled("   ").length, 0);
  assert.ok(searchBundled("a").length <= 8);
});

test("spot-check values against USDA SR Legacy", () => {
  const egg = BUNDLED.find(b => b.name === "Egg, whole, raw");
  assert.equal(egg.per100[0], 143);   // kcal
  assert.equal(egg.per100[3], 56);    // calcium mg
  const sardine = BUNDLED.find(b => b.name.startsWith("Sardines"));
  assert.ok(sardine.per100[23] > 0.9, "sardines carry EPA+DHA");
});

test("unreported nutrients are null rather than a misleading zero", () => {
  const iodine = NUTS.findIndex(n => n[0] === "Iodine");
  for (const b of BUNDLED) if (b.src.includes("SR Legacy")) assert.equal(b.per100[iodine], null, `${b.name}: SR Legacy does not report iodine`);
  assert.equal(BUNDLED.find(b => b.name === "Egg, whole, raw (Foundation)").per100[iodine], 49.1, "some Foundation records do report it");
  assert.equal(BUNDLED.find(b => b.name === "Kelp powder").per100[iodine], 150000);
  assert.equal(BUNDLED.find(b => b.name === "Chicken heart, raw").per100[NUTS.findIndex(n => n[0] === "Choline")], null);
  assert.equal(BUNDLED.find(b => b.name === "Olive oil").per100[NUTS.findIndex(n => n[0] === "Vitamin D")], 0, "a reported zero stays zero");
});

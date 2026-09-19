import { test } from "node:test";
import assert from "node:assert/strict";
import { NUTS, UNITS, PERIODS, EXAMPLE, DISPLAY, NOTES, SOURCES, iKcal, iCa, iP, iVitE, iEPA, iLA, iALA, iAA, iPUFA } from "../src/data.js";
import { sanitize, setState, totals, totalGrams, gramsPerDay, weightKg, missing, unknownOf } from "../src/state.js";
import { isInfo as n_is_info } from "../src/data.js";
import { analyze, judge, caToP, ratio, rerFor, merFor, N6N3_MAX, E_PUFA_MIN } from "../src/analysis.js";
import { BUNDLED } from "../src/bundled.js";

const near = (a, b, rel = 1e-6, msg) => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), msg ?? `${a} ≈ ${b}`);
const idx = name => NUTS.findIndex(n => n[0] === name);
const bundled = name => BUNDLED.find(b => b.name === name);
const food = (name, amount, unit, per, per100) => ({ name, amount: String(amount), unit, per, per100 });
/** a diet for one dog; per100 arrays may be short (missing columns are 0) */
const diet = (foods, weight = 23, activity = 2.4, weightUnit = "kg") => sanitize({ weight, activity, weightUnit, foods });
/** a synthetic complete food: `mult` × every AAFCO minimum per 1,000 kcal, packed into `kcal` kcal per 100 g */
const completeFood = (kcal, mult = 1.5) => NUTS.map(([, , mn], j) => j === iKcal ? kcal : (mn ?? 0) * mult * kcal / 1000);

/* ---------- energy need ---------- */
test("resting and maintenance energy follow 70 × kg^0.75 × activity", () => {
  near(rerFor(23), 735.18, 1e-4);      // 70 × 23^0.75
  near(merFor(23, 2.4), 1764.43, 1e-4);
  near(merFor(10, 1), 393.6, 1e-3);
  assert.equal(rerFor(0), 0);
  assert.equal(rerFor(-5), 0);
  assert.equal(merFor(20, -1), 0);
  assert.equal(merFor(20, NaN), 0);
});

test("the dog's weight in lb feeds the same maths as in kg", () => {
  const kg = analyze(diet([], 23, 1.6, "kg")), lb = analyze(diet([], 23 / 0.453592, 1.6, "lb"));
  near(kg.mer, lb.mer, 1e-9);
  near(weightKg(diet([], 50, 1, "lb")), 22.6796, 1e-4);
});

/* ---------- grams per day ---------- */
test("every unit × period combination converts to grams per day", () => {
  for (const [u, gPerUnit] of Object.entries(UNITS))
    for (const [p, days] of Object.entries(PERIODS)) {
      const d = diet([food("x", 3, u, p, [100])]);
      near(gramsPerDay(d.foods[0]), 3 * gPerUnit / days, 1e-9, `3 ${u}/${p}`);
    }
  // spot values a person can check by hand
  near(gramsPerDay(food("x", 1, "lb", "week", [])), 64.7989, 1e-5);
  near(gramsPerDay(food("x", 8, "oz", "day", [])), 226.796, 1e-5);
  near(gramsPerDay(food("x", 1, "kg", "month", [])), 32.8542, 1e-5);
});

test("the same mass expressed in different units gives identical totals", () => {
  const per100 = bundled("Egg, whole, raw").per100;
  const same = [
    food("g", 1000, "g", "day", per100),
    food("kg", 1, "kg", "day", per100),
    food("oz", 1000 / 28.3495, "oz", "day", per100),
    food("lb", 1000 / 453.592, "lb", "day", per100),
    food("week", 7, "kg", "week", per100),
    food("month", 30.4375, "kg", "month", per100),
    food("expr", "2*500", "g", "day", per100),
    food("batch", "10000*2/20", "g", "day", per100),
  ];
  const ref = totals(diet([same[0]]));
  for (const f of same.slice(1)) {
    const t = totals(diet([f]));
    t.forEach((v, j) => near(v, ref[j], 1e-9, `${f.name} ${NUTS[j][0]}`));
  }
});

test("totals are linear: doubling an amount doubles every nutrient, and foods add up", () => {
  const egg = bundled("Egg, whole, raw").per100, rice = bundled("Rice, white, cooked").per100;
  const one = totals(diet([food("egg", 50, "g", "day", egg)]));
  const two = totals(diet([food("egg", 100, "g", "day", egg)]));
  one.forEach((v, j) => near(two[j], 2 * v, 1e-9));
  const both = totals(diet([food("egg", 50, "g", "day", egg), food("rice", 200, "g", "day", rice)]));
  const riceOnly = totals(diet([food("rice", 200, "g", "day", rice)]));
  both.forEach((v, j) => near(v, one[j] + riceOnly[j], 1e-9));
  // per-100 g values scale by grams/100 exactly
  near(one[idx("Protein")], 12.56 * 0.5); near(one[idx("Calcium")], 28); near(one[iKcal], 71.5);
});

test("unparseable, zero and negative amounts contribute nothing; negative nutrients are clamped", () => {
  const d = diet([
    food("ok", 100, "g", "day", [200, 10]),
    food("bad", "100/", "g", "day", [200, 10]),
    food("zero", 0, "g", "day", [200, 10]),
    food("neg", -100, "g", "day", [200, 10]),
    food("negnut", 100, "g", "day", [-50, -5]),
  ]);
  assert.deepEqual(totals(d).slice(0, 2), [200, 10]);
  assert.equal(totalGrams(d), 200);           // the clamped row still weighs something
  assert.deepEqual(d.foods[4].per100.slice(0, 2), [0, 0], "sanitize clamps negative nutrients");
  assert.equal(diet([], -10).weight, 0);
  assert.equal(diet([], 10, -2).activity, 0);
});

/* ---------- judging a nutrient ---------- */
test("judge scales the AAFCO per-1,000 kcal profile by the dog's energy need", () => {
  const mer = 2000; // so a per-1,000 kcal minimum doubles
  assert.deepEqual(judge(90, mer, 45, null), { dayMin: 90, dayMax: null, dayAdv: null, pct: 1, status: "marginal" });
  assert.equal(judge(89.9, mer, 45, null).status, "low");
  assert.equal(judge(108, mer, 45, null).status, "ok");        // 120 %
  assert.equal(judge(107, mer, 45, null).status, "marginal");
  assert.deepEqual(judge(3000, mer, 1250, 6250), { dayMin: 2500, dayMax: 12500, dayAdv: null, pct: 1.2, status: "ok" });
  assert.equal(judge(12500.1, mer, 1250, 6250).status, "high");
  assert.equal(judge(0, mer, 1250, 6250).status, "low");
  assert.equal(judge(5, mer, null, null).status, "ok");        // no minimum: nothing to fail
  assert.equal(judge(5, 0, 45, null).status, "unknown");
  assert.equal(judge(5, NaN, 45, null).status, "unknown");
});

test("calcium : phosphorus handles zeros", () => {
  assert.equal(caToP(1200, 1000), 1.2);
  assert.equal(caToP(0, 0), NaN);
  assert.equal(caToP(0, 500), 0);
  assert.equal(caToP(500, 0), Infinity);
});

/* ---------- the scenario that prompted this: 100 g of beef a day ---------- */
test("100 g of beef a day is short of protein for a 23 kg dog, whatever its nutrient density", () => {
  const beef = bundled("Beef, ground, 95% lean, raw").per100;
  const a = analyze(diet([food("beef", 100, "g", "day", beef)], 23, 2.4));
  const p = a.rows[idx("Protein")];
  near(p.day, 21.41);
  near(p.per1000, 21.41 / 137 * 1000, 1e-9);     // 156 g/1,000 kcal: dense in protein…
  assert.ok(p.per1000 > p.min);
  near(p.dayMin, 45 * a.mer / 1000, 1e-9);        // …but the dog needs ~79 g a day
  assert.ok(p.dayMin > 79 && p.dayMin < 80);
  assert.equal(p.status, "low");
  near(p.pct, 21.41 / p.dayMin, 1e-9);
  assert.equal(a.energy, "low");
  near(a.ePct, 137 / a.mer, 1e-9);
  // every nutrient with a minimum is short when the dog gets 8 % of its calories
  for (const r of a.rows) if (r.min != null) assert.equal(r.status, "low", r.name);
});

/* ---------- a complete food at, under and over the energy need ---------- */
test("a complete food fed to the energy need passes everything; the same food under- or over-fed does not", () => {
  const per100 = completeFood(400, 1.5), mer = merFor(23, 2.4);
  const gramsFor = frac => (mer * frac / 400) * 100;
  const at = analyze(diet([food("complete", gramsFor(1), "g", "day", per100)]));
  assert.equal(at.energy, "ok"); near(at.ePct, 1);
  for (const r of at.rows) if (r.j !== iKcal && r.status !== "info") {
    if (r.min != null) { near(r.pct, 1.5, 1e-9, r.name); near(r.per1000 / r.min, 1.5, 1e-9, r.name); }
    assert.equal(r.status, "ok", r.name);
  }
  // half the food: density is unchanged but the dog gets 75 % of every minimum
  const half = analyze(diet([food("complete", gramsFor(0.5), "g", "day", per100)]));
  assert.equal(half.energy, "low");
  for (const r of half.rows) if (r.min != null) { near(r.pct, 0.75, 1e-9, r.name); assert.equal(r.status, "low", r.name); near(r.per1000 / r.min, 1.5, 1e-9); }
  // 80 % of the food: still under-fed on calories, nutrients at exactly 120 % → marginal boundary
  const most = analyze(diet([food("complete", gramsFor(0.8), "g", "day", per100)]));
  assert.equal(most.energy, "low");
  for (const r of most.rows) if (r.min != null) near(r.pct, 1.2, 1e-9, r.name);
  // twice the food: calories flagged high, nutrients plentiful, but a maximum can now be crossed
  const twice = analyze(diet([food("complete", gramsFor(2), "g", "day", per100)]));
  assert.equal(twice.energy, "high");
  assert.equal(twice.rows[idx("Protein")].status, "ok");
  near(twice.rows[idx("Protein")].pct, 3, 1e-9);
});

test("a maximum is judged on the daily amount, so a supplement can push a nutrient over even in a small diet", () => {
  const mer = merFor(23, 2.4);
  const vitD = idx("Vitamin D"), supp = NUTS.map(() => 0); supp[vitD] = 1e6; // IU per 100 g
  const gramsOver = (750 * mer / 1000) / 1e6 * 100 * 1.01;
  const a = analyze(diet([food("D", gramsOver, "g", "day", supp)]));
  assert.equal(a.rows[vitD].status, "high");
  assert.equal(analyze(diet([food("D", gramsOver * 0.9, "g", "day", supp)])).rows[vitD].status, "ok");
  // a maximum wins over a low minimum elsewhere only for its own row
  assert.equal(a.rows[idx("Protein")].status, "low");
});

test("only calcium in the bowl: ratio is infinite and calcium is judged against its daily need", () => {
  const cc = bundled("Calcium carbonate powder").per100;
  const a = analyze(diet([food("CaCO3", 5, "g", "day", cc)]));
  assert.equal(a.caP, Infinity);
  assert.equal(a.kcal, 0);
  assert.ok(Number.isNaN(a.rows[iCa].per1000), "no density without calories");
  near(a.rows[iCa].day, 2000);
  assert.equal(a.rows[iCa].status, "low");          // needs ~2,200 mg
  assert.equal(analyze(diet([food("CaCO3", 6, "g", "day", cc)])).rows[iCa].status, "marginal");   // 2,400 mg ≈ 109 %
  assert.equal(analyze(diet([food("CaCO3", 7, "g", "day", cc)])).rows[iCa].status, "ok");
  const e = analyze(diet([]));
  assert.ok(Number.isNaN(e.caP)); assert.equal(e.energy, "low"); assert.equal(e.grams, 0);
});

test("without a weight nothing can be judged", () => {
  const a = analyze(diet([food("beef", 100, "g", "day", bundled("Beef, ground, 95% lean, raw").per100)], 0));
  assert.equal(a.mer, 0); assert.ok(Number.isNaN(a.ePct)); assert.equal(a.energy, "unknown");
  for (const r of a.rows) if (r.j !== iKcal && r.status !== "info") { assert.equal(r.status, "unknown"); assert.equal(r.dayMin, null); }
  near(a.rows[idx("Protein")].per1000, 156.277, 1e-4);   // density is still reported
});

test("the built-in example diet meets the profile for the dog it was written for", () => {
  setState(structuredClone(EXAMPLE));
  const a = analyze();
  assert.equal(a.energy, "ok");
  assert.ok(a.caP >= 1 && a.caP <= 2);
  for (const r of a.rows) if (r.j !== iKcal && r.status !== "info") assert.equal(r.status, "ok", `${r.name}: ${r.status} ${(100 * r.pct).toFixed(0)}%`);
  assert.equal(a.rows[NUTS.findIndex(n => n[0] === "Sugars")].status, "info");
});

test("the AAFCO table is the 2016 adult-maintenance profile per 1,000 kcal", () => {
  const byName = Object.fromEntries(NUTS.map(([n, u, mn, mx]) => [n, { u, mn, mx }]));
  assert.deepEqual(byName["Protein"], { u: "g", mn: 45, mx: null });
  assert.deepEqual(byName["Calcium"], { u: "mg", mn: 1250, mx: 6250 });
  assert.deepEqual(byName["Vitamin D"], { u: "IU", mn: 125, mx: 750 });
  assert.deepEqual(byName["Iodine"], { u: "µg", mn: 250, mx: 2750 });
  assert.deepEqual(byName["Vitamin B12"], { u: "µg", mn: 7, mx: null });
  assert.deepEqual(byName["Linoleic acid"], { u: "g", mn: 2.8, mx: null });
  assert.deepEqual(byName["Niacin B3"], { u: "mg", mn: 3.4, mx: null });
  assert.deepEqual(byName["Pantothenic acid B5"], { u: "mg", mn: 3, mx: null });
  assert.equal(NUTS.length, 32);
  assert.deepEqual(NUTS.filter(n => n[4] === "info").map(n => n[0]), ["Carbohydrate", "Sugars"]);
  assert.equal(NUTS[iKcal][0], "Energy"); assert.equal(NUTS[iCa][0], "Calcium"); assert.equal(NUTS[iP][0], "Phosphorus");
  assert.deepEqual([...DISPLAY].sort((a, b) => a - b), NUTS.map((_, j) => j), "DISPLAY is a permutation of the table");
  for (const f of EXAMPLE.foods) assert.equal(f.per100.length, NUTS.length, f.name);
});

/* ---------- unknown values ---------- */
test("a nutrient the source did not report is null, counts as 0, and is listed as missing", () => {
  const beef = bundled("Beef, ground, 95% lean, raw").per100;
  const iodine = idx("Iodine");
  assert.equal(beef[iodine], null, "USDA SR Legacy never reports iodine");
  const d = diet([food("beef", 100, "g", "day", beef), food("kelp", 1, "g", "day", bundled("Kelp powder").per100), food("none", 0, "g", "day", beef)]);
  const a = analyze(d);
  near(a.rows[iodine].day, 1500);                               // kelp only; beef's unknown adds nothing
  assert.deepEqual(a.rows[iodine].missing, [{ name: "beef", grams: 100 }]);   // a food fed at 0 g is not listed
  assert.deepEqual(a.rows[idx("Protein")].missing, []);
  assert.equal(a.rows[iodine].status, "ok"); near(a.rows[iodine].pct, 1500 / a.rows[iodine].dayMin, 1e-9);
  assert.deepEqual(missing(diet([])), NUTS.map(() => []));
});

test("sanitize keeps null for unknown values and treats blank or garbage the same way", () => {
  const s = sanitize({ foods: [{ name: "x", amount: "1", per100: [1, null, undefined, "", "abc", -3, "4"] }] });
  assert.deepEqual(s.foods[0].per100.slice(0, 7), [1, null, null, null, null, 0, 4]);
  assert.ok(s.foods[0].per100.slice(7).every(v => v === null), "missing columns are unknown, not zero");
  const consequential = NUTS.map((n, j) => j).filter(j => j >= 7 && n_is_info(j) === false);
  assert.deepEqual(unknownOf(s.foods[0]), [1, 2, 3, 4, ...consequential], "informational blanks (carbohydrate, sugars) are not counted");
  assert.deepEqual(unknownOf({ per100: NUTS.map(() => 0) }), []);
});

/* ---------- advisory upper levels ---------- */
test("advisory levels exist only for nutrients AAFCO leaves open-ended, sit above the minimum, and cite a source", async () => {
  const { ADVISORY, SOURCES } = await import("../src/data.js");
  for (const [name, a] of Object.entries(ADVISORY)) {
    const row = NUTS.find(n => n[0] === name);
    assert.ok(row, `${name} is a nutrient`);
    assert.equal(row[3], null, `${name} has no AAFCO maximum`);
    assert.ok(a.max > row[2], `${name} advisory ${a.max} is above the minimum ${row[2]}`);
    assert.ok(a.src.length && a.src.every(k => SOURCES[k]?.url.startsWith("https://")), `${name} has a linked source`);
    assert.ok(a.basis && a.why);
  }
  assert.deepEqual(Object.keys(ADVISORY).sort(), ["Copper", "Iron", "Magnesium", "Manganese", "Sodium", "Zinc"]);
});

test("a diet over an advisory level is 'watch'; an AAFCO maximum still wins as 'high'", () => {
  const mer = 2000;
  assert.equal(judge(13, mer, 1.83, null, 7).status, "ok");        // copper 6.5 mg/1,000 kcal
  assert.equal(judge(14.1, mer, 1.83, null, 7).status, "watch");   // 7.05 mg/1,000 kcal
  assert.equal(judge(14.1, mer, 1.83, null, 7).dayAdv, 14);
  assert.equal(judge(3000, mer, 125, 750, 800).status, "high");    // vitamin D: AAFCO max applies, advisory ignored
  assert.equal(judge(3000, mer, 125, 750, 800).dayAdv, null);
  assert.equal(judge(5, 0, 1.83, null, 7).status, "unknown");
  // through analyze(): copper-heavy diet from beef liver
  const liver = bundled("Beef liver, raw").per100, cu = idx("Copper");
  const heavy = analyze(diet([food("liver", 900, "g", "day", liver)]));   // ≈ 88 mg copper/day for a ~1,764 kcal need
  assert.equal(heavy.rows[cu].status, "watch");
  near(heavy.rows[cu].dayAdv, 7 * heavy.mer / 1000, 1e-9);
  assert.equal(heavy.rows[idx("Vitamin A")].status, "high");             // liver's vitamin A trips the real AAFCO max
  const light = analyze(diet([food("liver", 50, "g", "day", liver)]));
  assert.notEqual(light.rows[cu].status, "watch");
});

/* ---------- the two fatty-acid balances ---------- */
test("omega-6 : omega-3 and vitamin E : PUFA follow AAFCO's rules", () => {
  assert.equal(ratio(0, 0), NaN); assert.equal(ratio(3, 0), Infinity); assert.equal(ratio(3, 1.5), 2);
  const per = NUTS.map(() => 0); per[0] = 400; per[iLA] = 6; per[iAA] = 0.1; per[iALA] = 0.1; per[iEPA] = 0.05; per[iVitE] = 0.5; per[iPUFA] = 7;
  const a = analyze(diet([food("oil-heavy", 441, "g", "day", per)]));
  near(a.n6n3.value, 6.1 / 0.15, 1e-9); assert.equal(a.n6n3.status, "high");           // 40.7 : 1
  near(a.ePufa.value, 0.5 / 7, 1e-9); assert.equal(a.ePufa.status, "low");             // 0.07 IU/g
  per[iEPA] = 1; per[iVitE] = 5;
  const b = analyze(diet([food("with fish oil", 441, "g", "day", per)]));
  assert.equal(b.n6n3.status, "ok"); near(b.n6n3.value, 6.1 / 1.1, 1e-9);
  assert.equal(b.ePufa.status, "ok"); near(b.ePufa.value, 5 / 7, 1e-9);
  const e = analyze(diet([]));
  assert.equal(e.n6n3.status, "unknown"); assert.equal(e.ePufa.status, "unknown");
  // exactly at the limits is still fine
  assert.ok(N6N3_MAX === 30 && E_PUFA_MIN === 0.6);
  const edge = NUTS.map(() => 0); edge[0] = 100; edge[iLA] = 30; edge[iALA] = 1; edge[iVitE] = 0.6; edge[iPUFA] = 1;
  const c = analyze(diet([food("edge", 100, "g", "day", edge)]));
  assert.equal(c.n6n3.status, "ok"); assert.equal(c.ePufa.status, "ok");
  // unknown inputs are listed
  const unk = NUTS.map(() => 0); unk[0] = 100; unk[iPUFA] = null;
  const m = analyze(diet([food("mystery", 100, "g", "day", unk)])).ePufa;
  assert.deepEqual(m.missing.map(x => x.name), ["mystery"]);
  assert.equal(m.status, "unknown", "a balance with an unreported input is not judged");
});

test("the example diet holds all three balances and the symptom notes cite sources", () => {
  setState(structuredClone(EXAMPLE));
  const a = analyze();
  assert.equal(a.n6n3.status, "ok"); assert.equal(a.ePufa.status, "ok");
  for (const [name, n] of Object.entries(NOTES)) {
    assert.ok(NUTS.some(r => r[0] === name), `${name} is a nutrient`);
    assert.ok(n.excess || n.deficit || n.breeds, `${name} says something`);
    assert.ok(n.src.length && n.src.every(k => SOURCES[k]?.url.startsWith("https://")), `${name} cites a source`);
  }
  for (const name of ["Copper", "Zinc", "Fat", "Calcium"]) assert.ok(NOTES[name].breeds, `${name} has a breed note`);
});

/* ---------- backfilling blanks from the built-in table ---------- */
test("backfill fills only blanks, from a built-in matched by USDA id or by name, and never touches typed values", async () => {
  const { backfill } = await import("../src/state.js");
  const egg = bundled("Egg, whole, raw");
  const old24 = egg.per100.slice(0, 24).map((v, j) => j === 1 ? 99 : v);   // a diet saved before the table grew, protein edited by hand
  const st = diet([
    { name: "Eggs", amount: "60", unit: "g", per: "day", src: "USDA 171287 · 6 eggs per batch", per100: old24 },
    { name: "egg, whole, raw", amount: "50", unit: "g", per: "day", src: "typed in", per100: old24 },
    { name: "Mystery treat", amount: "10", unit: "g", per: "day", src: "~estimate", per100: old24 },
  ]);
  assert.ok(st.foods.every(f => f.per100.slice(24).every(v => v === null)), "the added nutrients start unknown");
  const n = backfill(st);
  assert.equal(n, 2 * (NUTS.length - 24), "every added value for each of the two matched foods");
  for (const f of st.foods.slice(0, 2)) {
    assert.deepEqual(f.per100.slice(24), egg.per100.slice(24));
    assert.equal(f.per100[1], 99, "the hand-edited protein is kept");
  }
  assert.ok(st.foods[2].per100.slice(24).every(v => v === null), "an unrecognised food is left alone");
  assert.equal(backfill(st), 0, "nothing left to fill");
});

/* ---------- known hazards ---------- */
test("known hazards are matched on a food's name or source note, and each cites a source", async () => {
  const { HAZARDS, hazardsOf, SOURCES } = await import("../src/data.js");
  for (const h of HAZARDS) assert.ok(h.what && h.why && SOURCES[h.src]?.url.startsWith("https://"), h.what);
  const hit = (name, src = "") => hazardsOf({ name, src }).map(h => h.what);
  assert.deepEqual(hit("Grapes, red, raw"), ["grapes, raisins, sultanas, currants and tamarind"]);
  assert.deepEqual(hit("Trail mix", "contains raisins and chocolate chips"), ["grapes, raisins, sultanas, currants and tamarind", "chocolate and cocoa"]);
  assert.deepEqual(hit("Peanut butter, sugar-free", "ingredients list: peanuts, xylitol"), ["xylitol"]);
  assert.deepEqual(hit("Garlic powder"), ["onion, garlic, leek, chive and shallot"]);
  assert.deepEqual(hit("Whipped cream"), []);
  assert.deepEqual(hit("Grapefruit"), [], "a word that merely contains a hazard's name is not a match");
  assert.deepEqual(hit("Doughnut"), []);
});

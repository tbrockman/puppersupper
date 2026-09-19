/**
 * Pure diet maths: no DOM, no storage. render.js draws what this returns and
 * test/analysis.test.js checks it.
 *
 * AAFCO expresses its profile per 1,000 kcal of metabolisable energy, on the
 * assumption that the food is fed in the amount that meets the dog's energy
 * need. So the daily requirement of a nutrient for *this* dog is
 *     AAFCO value per 1,000 kcal × (energy need in kcal / 1,000)
 * and that, not the nutrient density of whatever was entered, is what each
 * day's intake is judged against. Density alone would call 100 g of beef a
 * complete diet: its 21 g of protein is 156 g per 1,000 kcal, well over 45,
 * while the dog is short of both calories and protein.
 */
import { NUTS, ADVISORY, isInfo, iKcal, iCa, iP, iVitE, iEPA, iLA, iALA, iAA, iPUFA } from "./data.js";
import { S, totals, totalGrams, weightKg, missing } from "./state.js";

/** Resting energy requirement, kcal/day, for a body weight in kg. */
export const rerFor = kg => kg > 0 ? 70 * Math.pow(kg, 0.75) : 0;
/** Maintenance energy requirement: RER × activity multiplier. */
export const merFor = (kg, activity) => rerFor(kg) * (activity > 0 ? activity : 0);

/** Calories eaten within ±10 % of the need count as on target. */
export const ENERGY_TOLERANCE = 0.10;
/** Under 120 % of a minimum is flagged as marginal. */
export const MARGINAL = 1.2;

/**
 * Status of one nutrient.
 *   day      amount eaten per day
 *   mer      the dog's energy need, kcal/day
 *   mn / mx  AAFCO minimum / maximum per 1,000 kcal (null when there is none)
 *   adv      advisory upper level per 1,000 kcal for a nutrient with no AAFCO maximum (see ADVISORY)
 * Returns { dayMin, dayMax, dayAdv, pct, status } where status is one of
 * "unknown" (no energy need to scale by), "high" (over the AAFCO maximum),
 * "watch" (over the advisory level), "low", "marginal", "ok"; analyze() adds
 * "info" for rows shown for information only.
 */
export function judge(day, mer, mn, mx, adv = null){
  if(!(mer > 0)) return { dayMin: null, dayMax: null, dayAdv: null, pct: NaN, status: "unknown" };
  const scale = mer / 1000;
  const dayMin = mn != null ? mn * scale : null;
  const dayMax = mx != null ? mx * scale : null;
  const dayAdv = mx == null && adv != null ? adv * scale : null;   // an AAFCO maximum takes precedence
  const pct = dayMin ? day / dayMin : NaN;
  let status = "ok";
  if(dayMax != null && day > dayMax) status = "high";
  else if(dayAdv != null && day > dayAdv) status = "watch";
  else if(dayMin != null && pct < 1) status = "low";
  else if(dayMin != null && pct < MARGINAL) status = "marginal";
  return { dayMin, dayMax, dayAdv, pct, status };
}

/** A ratio of two amounts: NaN with neither, Infinity with a numerator but no denominator. */
export function ratio(num, den){
  if(den > 0) return num / den;
  return num > 0 ? Infinity : NaN;
}
/** Calcium : phosphorus by weight. */
export const caToP = ratio;
/** AAFCO caps (linoleic + arachidonic) : (alpha-linolenic + EPA + DHA) at 30:1 for adult dogs. */
export const N6N3_MAX = 30;
/** AAFCO: at least 0.6 IU of vitamin E per gram of polyunsaturated fat. */
export const E_PUFA_MIN = 0.6;

/**
 * Everything the analysis panel shows, for the current diet (or a given one).
 *   kcal, grams   energy and mass eaten per day
 *   rer, mer      the dog's resting / maintenance need, kcal/day
 *   ePct          kcal / mer (NaN when mer is 0)
 *   energy        "ok" | "low" | "high" | "unknown"
 *   caP           calcium : phosphorus ratio, see ratio()
 *   n6n3          (linoleic + arachidonic) : (alpha-linolenic + EPA + DHA), with status "ok" | "high" | "unknown"
 *   ePufa         vitamin E IU : PUFA g, with status "ok" | "low" | "unknown"
 *   each ratio carries `missing`: foods fed whose value for one of its inputs is unknown
 *   rows          one per NUTS entry: { j, name, unit, min, max, adv, day, per1000, dayMin, dayMax, dayAdv, pct, status, missing }
 *                 per1000 is the density of the diet as entered; min/max are AAFCO's per 1,000 kcal; adv the ADVISORY entry if any;
 *                 missing lists the foods fed whose value for this nutrient is unknown (day is then a lower bound).
 */
export function analyze(state = S){
  const t = totals(state), kcal = t[iKcal], miss = missing(state);
  const rer = rerFor(weightKg(state)), mer = merFor(weightKg(state), state.activity);
  const ePct = mer > 0 ? kcal / mer : NaN;
  const energy = !(mer > 0) ? "unknown" : ePct < 1 - ENERGY_TOLERANCE ? "low" : ePct > 1 + ENERGY_TOLERANCE ? "high" : "ok";
  const rows = NUTS.map(([name, unit, mn, mx], j) => {
    const day = t[j];
    const per1000 = kcal > 0 ? day / kcal * 1000 : NaN;
    const adv = ADVISORY[name] ?? null;
    const v = j === iKcal ? { dayMin: null, dayMax: null, dayAdv: null, pct: NaN, status: "energy" }
            : isInfo(j)   ? { dayMin: null, dayMax: null, dayAdv: null, pct: NaN, status: "info" }     // shown, never judged
            : judge(day, mer, mn, mx, adv?.max);
    return { j, name, unit, min: mn, max: mx, adv, day, per1000, ...v, missing: miss[j] };
  });
  const missingFor = idxs => { const seen = new Map(); idxs.forEach(i => miss[i].forEach(m => seen.set(m.name, m))); return [...seen.values()]; };
  // a balance is only judged when every input is reported: an unknown counted as 0 would pass or fail it for the wrong reason
  const n6n3v = ratio(t[iLA] + t[iAA], t[iALA] + t[iEPA]), n6n3m = missingFor([iLA, iAA, iALA, iEPA]);
  const n6n3 = { value: n6n3v, status: n6n3m.length || Number.isNaN(n6n3v) ? "unknown" : n6n3v > N6N3_MAX ? "high" : "ok", missing: n6n3m };
  const ePufav = ratio(t[iVitE], t[iPUFA]), ePufam = missingFor([iVitE, iPUFA]);
  const ePufa = { value: ePufav, status: ePufam.length || Number.isNaN(ePufav) ? "unknown" : ePufav < E_PUFA_MIN ? "low" : "ok", missing: ePufam };
  return { kcal, grams: totalGrams(state), rer, mer, ePct, energy, caP: caToP(t[iCa], t[iP]), caPMissing: missingFor([iCa, iP]), n6n3, ePufa, rows };
}

/* ---------- nutrient framework (AAFCO 2016 adult maintenance, per 1,000 kcal ME) ---------- */
export const NUTS = [
 ["Energy","kcal",null,null],["Protein","g",45,null],["Fat","g",13.8,null],
 ["Calcium","mg",1250,6250],["Phosphorus","mg",1000,4000],["Potassium","mg",1500,null],
 ["Sodium","mg",200,null],["Magnesium","mg",150,null],["Iron","mg",10,null],
 ["Zinc","mg",20,null],["Copper","mg",1.83,null],["Manganese","mg",1.25,null],
 ["Selenium","µg",80,500],["Iodine","µg",250,2750],["Vitamin A","IU",1250,62500],
 ["Vitamin D","IU",125,750],["Vitamin E","IU",12.5,null],["Thiamin B1","mg",0.56,null],
 ["Riboflavin B2","mg",1.3,null],["Vitamin B6","mg",0.375,null],["Vitamin B12","µg",7,null],
 ["Folate","µg",54,null],["Choline","mg",340,null],["EPA+DHA","g",0.3,null], // 0.3 = common target, not AAFCO
 // appended later (saved and shared diets are positional, so new nutrients go on the end):
 ["Linoleic acid","g",2.8,null],["Alpha-linolenic acid","g",null,null],["Arachidonic acid","g",null,null],
 ["Polyunsaturated fat","g",null,null],["Niacin B3","mg",3.4,null],["Pantothenic acid B5","mg",3,null],
 // for information only (5th element): no AAFCO requirement or maximum exists
 ["Carbohydrate","g",null,null,"info"],["Sugars","g",null,null,"info"]
];
/** true for a row shown for information only, with nothing to judge it against */
export const isInfo = j => NUTS[j][4]==="info";
export const iKcal=0, iCa=3, iP=4;
const at = name => NUTS.findIndex(n => n[0]===name);
export const iVitE=at("Vitamin E"), iEPA=at("EPA+DHA"), iLA=at("Linoleic acid"), iALA=at("Alpha-linolenic acid"),
  iAA=at("Arachidonic acid"), iPUFA=at("Polyunsaturated fat");
/** Row order for the analysis table: the familiar and important first, the obscure last, whatever the storage order. */
export const DISPLAY = ["Energy","Protein","Fat","Linoleic acid","EPA+DHA",
  "Calcium","Phosphorus","Sodium","Potassium","Magnesium","Iron","Zinc",
  "Vitamin A","Vitamin D","Vitamin E","Thiamin B1","Riboflavin B2","Niacin B3","Vitamin B6","Vitamin B12","Folate","Pantothenic acid B5","Choline",
  "Iodine","Selenium","Copper","Manganese",
  "Alpha-linolenic acid","Arachidonic acid","Polyunsaturated fat","Carbohydrate","Sugars"].map(at);
if(DISPLAY.length!==NUTS.length || DISPLAY.includes(-1)) throw new Error("DISPLAY does not match NUTS");

/* ---------- advisory upper levels for nutrients AAFCO leaves open-ended ---------- */
/**
 * AAFCO's 2016 profile keeps a maximum only where excess has documented harm
 * (Ca, P, I, Se, vitamins A and D). The 2014 rationale (SOURCES.aafco14) says
 * the absence of a maximum "should not be interpreted to mean that nutrients
 * without a specific maximum content are safe at any level". These are the
 * published upper figures that do exist, per 1,000 kcal ME, converting dry-
 * matter values at AAFCO's 4,000 kcal ME/kg DM convention. A diet above one
 * is marked "above advisory level", not "over max". Nutrients not listed
 * (vitamin E, potassium, the B vitamins, choline, protein, fat) have no
 * published upper figure for dogs at all.
 */
export const SOURCES = {
  fediaf:  { title: "FEDIAF Nutritional Guidelines 2024, Table III-3a, footnote c and section 3.3.1",
             url: "https://europeanpetfood.org/wp-content/uploads/2024/09/FEDIAF-Nutritional-Guidelines_2024.pdf" },
  aafco14: { title: "AAFCO 2014 Pet Food Report, Appendix A: rationale for the 2016 dog food nutrient profiles",
             url: "https://www.aafco.org/wp-content/uploads/2023/01/Pet_Food_Report_Annual_2014-Appendix_A-Revised_AAFCO_Nutrient_Profiles-Final_092214.pdf" },
  aafcoCu: { title: "AAFCO response (2022) to Center et al., JAVMA 258(4):357, on copper in dog food",
             url: "https://www.aafco.org/wp-content/uploads/2023/03/Response-from-AAFCO-to-JAVMA-Viewpoint-Article-of-February-15-2021.pdf" },
  merckNut:  { title: "Merck Veterinary Manual: Nutritional Requirements of Small Animals",
               url: "https://www.merckvetmanual.com/management-and-nutrition/nutrition-small-animals/nutritional-requirements-of-small-animals" },
  merckHep:  { title: "Merck Veterinary Manual: Canine Chronic Hepatitis",
               url: "https://www.merckvetmanual.com/digestive-system/hepatic-diseases-of-small-animals/canine-chronic-hepatitis" },
  merckSkin: { title: "Merck Veterinary Manual: Cutaneous Manifestations of Multisystemic and Metabolic Defects",
               url: "https://www.merckvetmanual.com/integumentary-system/congenital-and-inherited-anomalies-of-the-integumentary-system/cutaneous-manifestations-of-multisystemic-and-metabolic-defects-in-animals" },
  merckPanc: { title: "Merck Veterinary Manual: Pancreatitis in Dogs and Cats",
               url: "https://www.merckvetmanual.com/digestive-system/the-exocrine-pancreas/pancreatitis-in-dogs-and-cats" },
  merckSe:   { title: "Merck Veterinary Manual: Selenium Toxicosis in Animals",
               url: "https://www.merckvetmanual.com/toxicology/selenium-toxicosis/selenium-toxicosis-in-animals" },
  merckFOD:  { title: "Merck Veterinary Manual: Fibrous Osteodystrophy in Animals",
               url: "https://www.merckvetmanual.com/musculoskeletal-system/dystrophies-associated-with-calcium-phosphorus-and-vitamin-d/fibrous-osteodystrophy-in-animals" },
  merckFood: { title: "Merck Veterinary Manual: Food Hazards",
               url: "https://www.merckvetmanual.com/special-pet-topics/poisoning/food-hazards" },
  aspca:     { title: "ASPCA Animal Poison Control: People Foods to Avoid Feeding Your Pets",
               url: "https://www.aspca.org/pet-care/animal-poison-control/people-foods-avoid-feeding-your-pets" },
};

/**
 * Foods and ingredients known to harm dogs. `match` is tested against a food's
 * name, its source note and (for USDA branded foods, at the moment they are
 * added) the ingredient list. `why` is paraphrased from the linked source.
 */
export const HAZARDS = [
  { match: /\b(grapes?|raisins?|sultanas?|currants?|tamarinds?)\b/i, what: "grapes, raisins, sultanas, currants and tamarind",
    why: "Can cause kidney injury and failure in dogs; the cause is thought to be tartaric acid, and as little as one grape or raisin per 4.5 kg of body weight may be enough.", src: "merckFood" },
  { match: /\b(xylitol|birch sugar|E967)\b/i, what: "xylitol",
    why: "A sugar-free sweetener (gum, sweets, some peanut butters and baked goods). In dogs it causes a rapid, severe drop in blood sugar at low doses and liver failure at high doses.", src: "merckFood" },
  { match: /\b(chocolate|cocoa|cacao)\b/i, what: "chocolate and cocoa",
    why: "Theobromine and caffeine cause heart-rhythm and nervous-system disturbances; about 28 g of milk chocolate per kg of body weight can be fatal, and dark or baking chocolate is far stronger.", src: "merckFood" },
  { match: /\b(onions?|garlic|leeks?|chives?|shallots?|scallions?|spring onions?)\b/i, what: "onion, garlic, leek, chive and shallot",
    why: "Raw, cooked, dried or powdered, these damage red blood cells and can cause anaemia, as well as stomach upset.", src: "aspca" },
  { match: /\bmacadamia/i, what: "macadamia nuts",
    why: "Dogs are the only species known to be affected: within 12 hours they may vomit and become weak, depressed and uncoordinated, with tremors and fever.", src: "merckFood" },
  { match: /\b(alcohol|beer|wine|liquor|spirits|vodka|whisk(?:e)?y|rum|gin)\b/i, what: "alcohol",
    why: "Causes vomiting, diarrhoea, incoordination, depressed breathing, tremors and can be fatal.", src: "aspca" },
  { match: /\b(coffee|caffeine|espresso|energy drink)\b/i, what: "coffee and caffeine",
    why: "Causes vomiting, diarrhoea, panting, excessive thirst and urination, hyperactivity, abnormal heart rhythm and tremors.", src: "aspca" },
  { match: /\b(raw|unbaked|bread|pizza)\s+dough\b|\byeast dough\b/i, what: "raw yeast dough",
    why: "The dough rises in the warm stomach, distending it and producing alcohol as the yeast ferments.", src: "merckFood" },
  { match: /\bavocado/i, what: "avocado",
    why: "Contains persin; dogs are less sensitive than birds and rabbits, but it can still cause vomiting and diarrhoea, and the stone is a choking and obstruction risk.", src: "aspca" },
];

/**
 * What sustained excess or shortfall looks like, and which breeds a nutrient
 * matters more for. Shown in tooltips when a row is out of range (`excess`,
 * `deficit`) or always, beside the name (`breeds`). Every entry is paraphrased
 * from the linked source; these are signs vets associate with the condition,
 * not a diagnosis.
 */
export const NOTES = {
  "Vitamin A": { excess: "Sustained excess is associated with skeletal malformation, spontaneous fractures and internal haemorrhage; liver is the usual source.",
                 deficit: "Shortfall shows as night blindness, dry eyes, skin lesions and weight loss.", src: ["merckNut"] },
  "Vitamin D": { excess: "Excess raises blood calcium and phosphate, with irreversible soft-tissue calcification; excess thirst and urination and vomiting are early signs.",
                 deficit: "Shortfall causes rickets in the young and soft or brittle bone in adults.", src: ["merckNut"] },
  "Vitamin E": { deficit: "Shortfall shows as muscle weakness and degeneration, retinal degeneration and listlessness. Needs rise with the diet\u2019s polyunsaturated fat, e.g. fish oil.", src: ["merckNut"] },
  "Thiamin B1": { deficit: "Shortfall shows as unsteady gait and heart enlargement. Cooking can destroy up to 90% of thiamin, so cooked diets need a margin.", src: ["merckNut", "aafco14"] },
  "Calcium":  { excess: "In adults, excess mostly reduces zinc and copper absorption. In growing large-breed dogs it worsens osteochondrosis and slows skeletal remodelling.",
                deficit: "Meat-heavy diets short of calcium cause nutritional secondary hyperparathyroidism: bone demineralisation, pain, reluctance to walk, shifting lameness and fractures.",
                breeds: "Large-breed puppies (over about 32 kg as adults) are the group most harmed by too much calcium, and AAFCO caps their food at 4.5 g per 1,000 kcal rather than the adult 6.25 g. This page uses the adult profile.",
                src: ["merckNut", "merckFOD", "aafco14"] },
  "Phosphorus": { excess: "Excess phosphorus, especially with calcium below phosphorus, pulls calcium from bone (nutritional secondary hyperparathyroidism): pain, lameness, fractures.", src: ["merckFOD", "fediaf"] },
  "Iodine":   { excess: "A diet at about twice the AAFCO maximum disturbed thyroid function in the studies AAFCO cites.", src: ["aafco14"] },
  "Selenium": { excess: "Chronic selenium poisoning from food in dogs shows as loss of appetite, wasting, anaemia, a coarse loose coat and fluid in the abdomen.", src: ["merckSe"] },
  "Copper":   { excess: "Excess copper accumulates in the liver and is silent until damage is done: loss of appetite, lethargy, vomiting, weight loss, jaundice and later ascites. Liver is the usual dietary source.",
                deficit: "Shortfall shows as a microcytic, hypochromic anaemia.",
                breeds: "Bedlington Terriers, Labrador Retrievers, Doberman Pinschers, Dalmatians, West Highland White Terriers, Welsh Corgis and Keeshonds are predisposed to copper-associated liver disease (inherited defects in copper excretion), though no breed is free of it. For these breeds keep copper near the minimum and discuss it with your vet.",
                src: ["merckHep", "merckNut"] },
  "Zinc":     { excess: "High zinc reduces copper absorption.",
                deficit: "Shortfall shows as crusting, hair loss, keratitis, vomiting and poor growth.",
                breeds: "Alaskan Malamutes, Siberian Huskies and German Shorthaired Pointers can have a familial zinc-responsive dermatosis (crusting at the lips, eyes and feet) from poor zinc absorption; they may need more zinc than the profile gives, under a vet\u2019s guidance.",
                src: ["merckSkin", "merckNut", "fediaf"] },
  "Iron":     { deficit: "Shortfall shows as a microcytic, hypochromic anaemia.", src: ["merckNut"] },
  "Magnesium": { deficit: "Shortfall shows as listlessness, lethargy and muscle weakness.", src: ["merckNut"] },
  "Sodium":   { excess: "At 2% of dry matter, sodium produced a negative potassium balance in dogs. Dogs with heart or kidney disease are usually kept lower still.", src: ["fediaf"] },
  "Fat":      { breeds: "Miniature Schnauzers are dramatically over-represented among dogs with pancreatitis and often carry an inherited high blood-fat condition; Yorkshire Terriers, Cocker Spaniels, Dachshunds and Poodles are also over-represented. Severe hypertriglyceridaemia is a risk factor, and diets for affected dogs are kept under 20 g fat per 1,000 kcal.",
                src: ["merckPanc"] },
  "Linoleic acid": { deficit: "Shortfall shows as a dry, scaly, lustreless coat.", src: ["merckNut"] },
};
/** Why a nutrient with no AAFCO minimum is in the table at all. */
export const PURPOSE = {
  "Alpha-linolenic acid": "The plant omega-3. AAFCO sets no adult minimum for it, but it counts towards the omega-6 : omega-3 balance in the quick checks, which must stay at or under 30:1.",
  "Arachidonic acid": "An omega-6 from animal fat. No adult minimum, but it is added to linoleic acid on the omega-6 side of the omega-6 : omega-3 balance.",
  "Polyunsaturated fat": "Total polyunsaturated fat. No minimum of its own; the vitamin E : PUFA quick check needs it, since vitamin E is used up protecting these fats.",
  "Carbohydrate": "For information only. Dogs have no dietary requirement for carbohydrate, and AAFCO, the NRC and FEDIAF set neither a minimum nor a maximum. It is what is left of the calories after protein and fat.",
  "Sugars": "For information only. No published upper limit exists for sugar in dogs; the concerns are calories, teeth and loose stools, and with sugar-free products the sweetener xylitol, which is toxic to dogs.",
};
export const ADVISORY = {
  Copper:    { max: 7,    basis: "the EU legal maximum for complete dog food, 28 mg/kg dry matter",
               why: "AAFCO dropped its copper maximum in 2016 for lack of data on a safe upper limit and, after a 2021 JAVMA article linked rising copper-associated liver disease to food, declined in 2022 to restore one for the same reason. Liver is the usual source of excess; commercial foods average about 4.4 mg per 1,000 kcal.",
               src: ["fediaf", "aafcoCu"] },
  Zinc:      { max: 56.8, basis: "the EU legal maximum, 227 mg/kg dry matter",
               why: "No safe upper limit has been established for dogs; AAFCO's former maximum was taken from pig tolerance data and dropped in 2016. High zinc also reduces copper absorption.",
               src: ["fediaf", "aafco14"] },
  Iron:      { max: 170,  basis: "the EU legal maximum, 682 mg/kg dry matter",
               why: "AAFCO: iron is toxic at some amount above the recommended quantities, but the exact amount is unknown for dogs. Its former maximum was taken from pig tolerance data and dropped in 2016.",
               src: ["fediaf", "aafco14"] },
  Manganese: { max: 42.5, basis: "the EU legal maximum, 170 mg/kg dry matter",
               why: "No safe upper limit has been established for dogs.",
               src: ["fediaf"] },
  Magnesium: { max: 4250, basis: "the one figure the NRC (2006) gives: a safe upper limit somewhere above 1.7% of dry matter",
               why: "AAFCO dropped its magnesium maximum in 2016 for lack of dog-specific data.",
               src: ["aafco14"] },
  Sodium:    { max: 3750, basis: "the highest level shown safe for healthy dogs, 1.5% of dry matter",
               why: "Higher levels may be safe but have not been studied. AAFCO sets no maximum because dogs stop eating over-salted food before harm shows. Dogs with heart or kidney disease need less.",
               src: ["fediaf", "aafco14"] },
};

/** Source for the profile the analysis compares against. */
export const AAFCO_URL = "https://www.aafco.org/wp-content/uploads/2023/01/Model_Bills_and_Regulations_Agenda_Midyear_2015_Final_Attachment_A.__Proposed_revisions_to_AAFCO_Nutrient_Profiles_PFC_Final_070214.pdf";

/** Mass units: grams per unit. */
export const UNITS = { g:1, kg:1000, oz:28.3495, lb:453.592 };
/** Units the dog's own weight can be entered in (kg per unit). */
export const WEIGHT_UNITS = { kg:1, lb:0.453592 };
/** Feeding periods: days per period. */
export const PERIODS = { day:1, week:7, month:30.4375 };

export const DEFAULT_TITLE = "pupper supper";

/** FoodData Central id recorded in a food's source note ("USDA 171077 (SR Legacy)", "USDA FDC 171077"), or null. */
export const usdaId = src => +(/USDA (?:FDC )?(\d+)/.exec(src||"")||[])[1] || null;

export function newId(){ return Math.random().toString(36).slice(2); }

/** Hazards that a food's name or source note trips. */
export const hazardsOf = it => HAZARDS.filter(h => h.match.test(`${it.name} ${it.src||""}`));

/* ---------- built-in ingredients, for the example diet ---------- */
import { BUNDLED } from "./bundled.js";
/** a built-in by name; a missing one (e.g. mid-refresh) degrades to unknown values rather than breaking the page */
const bundled = name => BUNDLED.find(b=>b.name===name) ?? (console.warn(`no built-in named "${name}"`), { name, src:"not in the built-in table", per100: NUTS.map(()=>null) });
/** fill values the source does not report from `est` ({ nutrient name: value }), noting it in the source text */
const withEst = (per100, src, est={}) => {
  const filled = [];
  per100 = per100.map((v,j)=>{ const e = est[NUTS[j][0]]; if(v==null && e!=null){ filled.push(NUTS[j][0].toLowerCase()); return e; } return v; });
  return [filled.length ? `${src} · ~${filled.join(", ")} estimated` : src, per100];
};
/** [source note with an extra remark, per-100 g values] of a built-in, in the order f() takes them */
const fromBundle = (name, note, est) => withEst(bundled(name).per100.slice(), `${bundled(name).src} · ${note}`, est);
/** the mean of several built-ins (an unreported value in any of them makes the mean unreported) */
const meanOf = names => names.map(bundled).reduce((acc,b)=> acc.map((v,j)=> v==null || b.per100[j]==null ? null : v + b.per100[j]/names.length), NUTS.map(()=>0))
  .map(v=> v==null ? null : Math.round(v*1000)/1000);

/**
 * Build a food item.
 *  amount  = a number or small arithmetic expression, e.g. "400*2/10"
 *  unit    = key of UNITS; per = key of PERIODS
 *  per100  = NUTS.length values in NUTS order, per 100 g; null = not known
 */
export function f(name, amount, unit, per, src, per100){
  return {id:newId(), name, amount:String(amount), unit, per, src, per100};
}

/** Empty item for "Custom food": every nutrient starts at 0; clear a field to mark it unknown. */
export function blankFood(){
  return f("New food", "0", "g", "day", "A manually added food item", NUTS.map(()=>0));
}

export const EMPTY = { title: DEFAULT_TITLE, weight: 20, weightUnit: "kg", activity: 1.6, foods: [] };

/* ---------- example recipe: a 23 kg active dog on a mixed home-cooked / kibble diet ---------- */
/* Home-cooked items are cooked as a 10-cup batch of which 2 cups are fed a day (hence *2/10).
   USDA-sourced items take their values from the built-in table (src/bundled.js), so refreshing the bundle
   refreshes them; what USDA never reports (iodine, and a few others) is estimated and said so in the source
   note. The branded foods and treats are hand-typed estimates (marked ~). */
const MIXED_VEG = ["Carrots, raw", "Peas, green, cooked", "Green beans, raw", "Corn, sweet, raw"].filter(n=> BUNDLED.some(b=>b.name===n));
export const EXAMPLE = {
 title: DEFAULT_TITLE, weight:23, weightUnit:"kg", activity:2.4,
 foods:[
 f("Canned pumpkin","400*2/10","g","day",...fromBundle("Pumpkin, canned","400 g per batch",{Iodine:1})),
 f("Sweet potato, peeled","860*2/10","g","day",...fromBundle("Sweet potato, raw","860 g per batch",{Iodine:1})),
 f("Chicken liver","133*2/10","g","day",...fromBundle("Chicken liver, raw","133 g per batch",{Iodine:10})),
 f("Chicken hearts","133*2/10","g","day",...fromBundle("Chicken heart, raw","133 g per batch",{Iodine:4,"Vitamin D":0,"Vitamin E":1,Choline:194})),
 f("Extra-lean ground beef (95%)","454*2/10","g","day",...fromBundle("Beef, ground, 95% lean, raw","454 g per batch",{Iodine:3})),
 f("Large eggs","6*50*2/10","g","day",...fromBundle("Egg, whole, raw","6 eggs × 50 g per batch",{Iodine:50})),
 f("Jasmine rice, dry","139*2/10","g","day",...fromBundle("Rice, white, dry","¾ cup dry per batch",{Iodine:1})),
 f(`Mixed veg: ${MIXED_VEG.map(n=>n.split(",")[0].toLowerCase()).join(", ")}`,"500*2/10","g","day",...withEst(meanOf(MIXED_VEG), `~mean of ${MIXED_VEG.length} built-ins · 500 g per batch`, {Iodine:1})),
 f("Green beans","250*2/10","g","day",...fromBundle("Green beans, raw","250 g per batch",{Iodine:.5})),
 f("Calcium carbonate powder","1","g","day","40% elemental calcium",
   [0,0,0,40000,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]),
 f("Carna4 Chicken kibble","2*116","g","day","Carna4 guaranteed analysis · 2 cups × 116 g · 500 kcal/cup",
   [430,29,15,1300,1000,800,330,130,12,19,1.4,2.6,80,220,1600,110,34,.70,.61,.76,22,100,190,1.08,2.5,.3,.05,3,8,2,38,3]),
 f("Kirkland wet pâté","374","g","week","~complete food at AAFCO minimums · one 374 g can",
   [110,9,6,250,200,165,60,17,1.1,2.2,.2,.14,9,28,138,14,1.4,.06,.14,.04,.8,6,37,0,.6,.08,.03,.8,1.5,.5,3,.5]),
 f("Cesar wet tray","100","g","week","~complete food at AAFCO minimums · one 100 g tray",
   [90,8,4,200,160,135,50,14,.9,1.8,.16,.11,7,23,113,11,1.1,.05,.12,.03,.6,5,31,0,.5,.06,.02,.7,1.2,.4,3,.5]),
 f("Beef chew stick","2*20","g","week","~estimate · 2 sticks × 20 g",
   [300,65,4,50,150,100,200,10,2,3,.1,.02,20,5,0,0,.2,.02,.1,.1,1,5,30,0,.3,.05,.05,.4,5,.6,4,1]),
 f("Duck stick","2*8","g","week","~estimate · 2 sticks × 8 g",
   [330,55,10,30,300,300,300,20,4,3,.2,.05,20,5,100,10,.3,.1,.3,.4,1,10,80,0,1.5,.1,.1,2,6,1.5,5,1]),
 f("Freeze-dried beef liver bites","35","g","week","~freeze-dried beef liver · 35 × 1 g bites",
   [350,70,12,18,1300,1100,240,63,17,14,34,1.1,140,30,58000,170,2.5,.7,9.7,3.7,200,1000,1150,0,1,.05,.9,2,39,21,4,1]),
]};

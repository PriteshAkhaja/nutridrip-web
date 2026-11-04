/* NutriDrip site data. Every fact here comes from Dr. Manoj's brief or the
   NutriDrip x URLife proposal. Edit this one file to change contact details,
   prices or compositions; every page reads from it. */
(function (g) {
  "use strict";

  // ---- Contact. null = not supplied yet; the site shows a neutral line instead.
  var CONTACT = {
    phone: "+91 86869 66868",      // CONFIRM: from an earlier conversation
    whatsapp: "918686966868",       // digits only, country code first. CONFIRM
    address: null,                  // [ADDRESS]
    hours: null,                    // [HOURS]
    cities: null,                   // [CITIES]
    homeArea: null                  // [AREA]
  };

  // ---- Our own injectable range (shown to practitioners only).
  var RANGE = {
    vitc:      { name: "Vitamin C", full: "Vitamin C (ascorbic acid)", strength: "1,500 mg", per: "per 10 mL vial", pack: "10 mL vial", route: "For IV use only", tint: "#E8B90F", img: "vial-vitc", carton: "carton-vitc" },
    bcomplex:  { name: "Vitamin B-complex", full: "Vitamin B-complex (B1, B2, B3, B5, B6)", strength: "B1 100 mg · B2 20 mg · B3 100 mg · B5 50 mg · B6 100 mg", per: "per 10 mL ampoule, as printed on the label in mcg", pack: "10 mL ampoule", route: "For IV use only", tint: "#9C8BE0", img: "vial-bcomplex", carton: "carton-bcomplex" },
    magnesium: { name: "Magnesium sulfate 50%", full: "Magnesium sulfate 50% w/v", strength: "5,000 mg (500 mg/mL)", per: "per 10 mL ampoule", pack: "10 mL ampoule", route: "For IV use only", tint: "#7DB4E6", img: "vial-magnesium", carton: "carton-magnesium" },
    b12:       { name: "Methylcobalamin (B12)", full: "Methylcobalamin (vitamin B12)", strength: "2,500 mcg (2.5 mg)", per: "per 1 mL ampoule", pack: "1 mL ampoule", route: "For IV/IM use only", tint: "#E59AB8", img: "vial-b12", carton: "carton-b12" },
    calcium:   { name: "Calcium gluconate 10%", full: "Calcium gluconate 10% w/v", strength: "1,000 mg (100 mg/mL)", per: "per 10 mL vial", pack: "10 mL vial", route: "For IV use only", tint: "#5CC8B2", img: "vial-calcium", carton: "carton-calcium" }
  };

  // ---- What each ingredient is, at nutrient level. No outcome claims.
  var WHY = {
    "Vitamin C": "An antioxidant vitamin. The body also needs it to make collagen.",
    "Ascorbic acid 5 g": "Vitamin C at a high dose. Needs a G6PD test and kidney check first.",
    "Vitamin C 1.5 g": "Vitamin C, an antioxidant the body uses to make collagen.",
    "B-complex": "B1, B2, B3, B5 and B6, which help the body turn food into energy.",
    "Vitamin B12": "Needed to make red blood cells and for normal nerve function.",
    "Magnesium": "A mineral used in muscle and nerve function and energy metabolism.",
    "Calcium": "A mineral used in muscle contraction, nerve signalling and bone.",
    "Thiamine": "Vitamin B1, used in energy metabolism.",
    "Glutathione": "An antioxidant the body makes itself.",
    "Glutathione 2,000 mg": "An antioxidant the body makes itself, at the higher premium strength.",
    "Trace elements": "Small amounts of minerals such as zinc, copper, manganese and chromium.",
    "Trace elements (chromium, copper, manganese, zinc)": "Minerals the body needs in small amounts.",
    "Zinc": "A mineral involved in normal immune function and skin.",
    "NAC (N-acetyl cysteine)": "A building block the body uses to make its own glutathione.",
    "Amino acids (L-ornithine L-aspartate)": "Amino acids, the building blocks of protein.",
    "Amino acids": "Amino acids, the building blocks of protein.",
    "Crystalline amino acids": "Amino acids in an infusion-ready form.",
    "L-carnitine": "Carries fats into the cell's mitochondria to be used for energy.",
    "Multivitamin": "A balanced blend of vitamins in an injectable form.",
    "Vitamin D": "Works with calcium. Checked by blood test before it is given.",
    "Folinic acid": "An active form of folate (vitamin B9).",
    "Alpha-lipoic acid": "An antioxidant. It can lower blood sugar, so glucose is checked first.",
    "Kojic acid": "Included in the Glow formula.",
    "Collagen": "A structural protein of skin. Needs a fish and shellfish allergy screen.",
    "Selenium": "A trace mineral that forms part of the body's antioxidant enzymes."
  };

  // ---- The 13-drip formulary (proposal pp. 7-8), retail prices (p. 6).
  // bag: goes in the 500 mL bag. sep: given separately, with how.
  // vials: which ampoules from our own range drop into the bag in the build.
  var GLUT = "Glutathione";
  var SEP_GLUT = "slow IV push within 10 minutes, or in 100 mL saline over about 12 minutes";
  var DRIPS = [
    { id: "executive-energy", name: "Executive Energy", cat: "Energy and recovery", price: 6500, tint: "#D99A0B",
      for: "Long, demanding days. Nutrients the body uses for energy metabolism.",
      bag: ["Vitamin C", "B-complex", "Magnesium", "Calcium"],
      sep: [[GLUT, SEP_GLUT], ["Vitamin B12", "intramuscular injection"], ["Thiamine", "intramuscular injection"]],
      vials: ["vitc", "bcomplex", "magnesium", "calcium"], tests: ["g6pd", "b12"] },
    { id: "nutri-cleanse", name: "Nutri Cleanse", cat: "Immunity and antioxidant", price: 6500, tint: "#1F9E78",
      for: "After a period of illness or strain. Antioxidant and micronutrient support.",
      bag: ["Calcium", "Trace elements", "B-complex", "Magnesium", "Vitamin C"],
      sep: [[GLUT, SEP_GLUT], ["Vitamin B12", "intramuscular injection"]],
      vials: ["calcium", "bcomplex", "magnesium", "vitc"], tests: ["g6pd", "b12"] },
    { id: "nutri-immune", name: "Nutri-Immune", cat: "Immunity and antioxidant", price: 7000, tint: "#E2701A",
      for: "Nutrients the immune system relies on, led by vitamin C and zinc.",
      bag: ["Vitamin C", "Zinc", "NAC (N-acetyl cysteine)", "Vitamin B12", "B-complex", "Magnesium", "Calcium"],
      sep: [], vials: ["vitc", "b12", "bcomplex", "magnesium", "calcium"], tests: ["b12"] },
    { id: "high-dose-vitamin-c", name: "High Dose Vitamin C", cat: "Immunity and antioxidant", price: 8000, tint: "#E9B800",
      for: "High-dose vitamin C on a doctor's prescription, after G6PD screening.",
      bag: ["Ascorbic acid 5 g"], sep: [[GLUT, SEP_GLUT]],
      vials: ["vitc"], tests: ["g6pd"] },
    { id: "athletic-boost", name: "Athletic Boost", cat: "Performance and metabolic", price: 5000, tint: "#2776D1",
      for: "Training blocks and recovery days. Competing athletes: we check anti-doping rules with you.",
      bag: ["Amino acids (L-ornithine L-aspartate)", "B-complex", "Magnesium", "Vitamin C"],
      sep: [], vials: ["bcomplex", "magnesium", "vitc"], tests: [] },
    { id: "metabolic-booster", name: "Metabolic Booster", cat: "Performance and metabolic", price: 5000, tint: "#13848C",
      for: "Nutrient support alongside a doctor-led metabolic and weight plan.",
      bag: ["L-carnitine", "Trace elements (chromium, copper, manganese, zinc)"],
      sep: [], vials: [], tests: ["tsh", "glucose"] },
    { id: "swift-beauty", name: "Swift Beauty Drip", cat: "Beauty and skin", price: 5500, tint: "#E2614D",
      for: "A gentle first drip. Vitamins for skin, suited to first-timers.",
      bag: ["Multivitamin", "Vitamin C"], sep: [], vials: ["vitc"], tests: [] },
    { id: "hair-therapy", name: "Hair Therapy", cat: "Beauty and skin", price: 6000, tint: "#94499C",
      for: "Nutrients involved in healthy hair, as a six-week alternating course.",
      bag: ["Vitamin B12", "B-complex", "Calcium", "Thiamine", "Amino acids"],
      alt: ["Vitamin D", "Zinc", "Folinic acid"],
      sep: [], vials: ["b12", "bcomplex", "calcium"], tests: ["b12", "vitd"] },
    { id: "sun-season", name: "Sun Season", was: "Sun Protection", cat: "Beauty and skin", price: 8000, tint: "#D9822B",
      for: "Antioxidant vitamins for skin through long, sunny months.",
      bag: ["Vitamin C 1.5 g", "Magnesium", "Multivitamin"],
      sep: [[GLUT, SEP_GLUT], ["Vitamin D", "intramuscular injection"]],
      vials: ["vitc", "magnesium"], tests: ["g6pd", "vitd"] },
    { id: "glow", name: "Glow", premium: true, cat: "Beauty and skin", price: 9999, tint: "#CF4C74",
      for: "Our premium skin drip: antioxidants and skin nutrients.",
      bag: ["Alpha-lipoic acid", "Kojic acid", "Collagen", "Selenium", "Multivitamin"],
      sep: [["Glutathione 2,000 mg", SEP_GLUT]], vials: [], tests: ["g6pd", "glucose", "allergy"] },
    { id: "cinderella", name: "Cinderella Drip", premium: true, cat: "Beauty and skin", price: 9999, tint: "#B23F8F",
      for: "Our premium collagen-tier skin drip, given under our highest-alert allergy protocol.",
      bag: ["Collagen", "Multivitamin"], sep: [[GLUT, SEP_GLUT]], vials: [], tests: ["g6pd", "allergy"] },
    { id: "womens-balance", name: "Women's Balance", was: "PCOD Basic", cat: "Women's health", price: 5500, tint: "#6E58CF",
      for: "Nutrient support through the cycle, alongside your gynaecologist's plan. Given as two bags.",
      bag: ["Vitamin C", "Trace elements", "Calcium"], bag2: ["Zinc", "Magnesium", "L-carnitine"],
      sep: [["Vitamin B12", "intramuscular injection"]], vials: ["vitc", "calcium", "magnesium"], tests: ["tsh", "b12"] },
    { id: "womens-balance-plus", name: "Women's Balance Plus", was: "PCOS Advanced", cat: "Women's health", price: 7000, tint: "#4639A8",
      for: "Women's Balance with added glutathione and crystalline amino acids.",
      bag: ["Vitamin C", "Trace elements", "Calcium", "Crystalline amino acids"], bag2: ["Zinc", "Magnesium", "L-carnitine"],
      sep: [[GLUT, SEP_GLUT], ["Vitamin B12", "intramuscular injection"]], vials: ["vitc", "calcium", "magnesium"], tests: ["tsh", "b12", "g6pd"] }
  ];

  // ---- Feelings -> drips (the picker on the home page).
  var FEELINGS = [
    ["Energised through long days", "executive-energy"],
    ["Recovered after hard training", "athletic-boost"],
    ["Back to myself after being unwell", "nutri-cleanse"],
    ["Stocked up on immune nutrients", "nutri-immune"],
    ["Fresh, nourished skin", "swift-beauty"],
    ["Looking after my hair", "hair-therapy"],
    ["In rhythm with my cycle", "womens-balance"],
    ["On track with my metabolic plan", "metabolic-booster"]
  ];

  // ---- Tests (proposal p. 9).
  var CORE_TESTS = [
    ["CBP", "Complete blood picture", "Haemoglobin, white cells, platelets", "Flags anaemia, infection or bleeding risk before the cannula goes in."],
    ["RFT", "Renal function test", "Urea, creatinine, eGFR, uric acid, electrolytes", "Confirms the kidneys can clear the infusion. Flags kidney risk for high-dose vitamin C."],
    ["LFT", "Liver function test", "Bilirubin, SGOT, SGPT, ALP, proteins", "A baseline before glutathione and antioxidant drips."]
  ];
  var COND_TESTS = {
    g6pd:    ["G6PD", "Before any drip with glutathione, and before high-dose vitamin C. A deficiency raises the risk of red cells breaking down."],
    b12:     ["Vitamin B12", "For B12-containing drips, or when a deficiency is suspected."],
    vitd:    ["Vitamin D (25-OH)", "Before drips with vitamin D, or when a deficiency is suspected."],
    tsh:     ["TSH (thyroid)", "Before Metabolic Booster and the Women's Balance drips. L-carnitine interacts with thyroid function."],
    glucose: ["HbA1c or fasting glucose", "For metabolic drips and anyone with diabetes. Alpha-lipoic acid can lower blood sugar."],
    iron:    ["Iron studies", "When the doctor needs to check iron stores."],
    allergy: ["Allergy history", "Including fish and shellfish, before any collagen drip."]
  };

  // ---- Real patient stories. Add only real ones, with written consent.
  // Shape: { name: "First name", city: "City", drip: "drip-id", text: "..." }
  var STORIES = [];

  function byId(id) { for (var i = 0; i < DRIPS.length; i++) if (DRIPS[i].id === id) return DRIPS[i]; return null; }
  function rupees(n) { return "₹" + n.toLocaleString("en-IN"); }

  g.ND = { CONTACT: CONTACT, RANGE: RANGE, WHY: WHY, DRIPS: DRIPS, FEELINGS: FEELINGS, CORE_TESTS: CORE_TESTS, COND_TESTS: COND_TESTS, STORIES: STORIES, byId: byId, rupees: rupees, SEP_GLUT: SEP_GLUT };
})(window);

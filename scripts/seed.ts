/**
 * Seeds the demo dataset used across the mockups: the nine-drip catalogue,
 * the product masters and batch lots behind it (including the deliberately
 * expiring and expired lots the Alerts view needs), and one account per role.
 *
 *   npm run seed
 */
import { config as loadEnv } from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

loadEnv({ path: [".env.local", ".env"], quiet: true });
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/nutridrip";

import {
  User,
  ProductMaster,
  BatchLot,
  SessionKit,
  Drip,
  Order,
  Booking,
  HealthQuiz,
  TreatmentPlan,
  Allocation,
  Consumption,
  StockTxn,
  LabReport,
  Notification,
  Lead,
  QuizQuestion,
  ContentBlock,
  AIModel,
  Zone,
} from "../src/lib/models";
import { ZONE_DEFAULTS } from "../src/lib/zones";
import { connectDB } from "../src/lib/db/mongoose";
import { blockedByVitals, CHECKLIST_STEPS } from "../src/lib/clinical/checklist";
import { planAllocation } from "../src/lib/inventory/dispatch";
import { componentsFromRecipe } from "../src/lib/clinical/plan-input";
import {
  componentsForConsent,
  CURRENT_CONSENT_VERSION,
  currentConsentDocument,
} from "../src/lib/clinical/consent";
import { seedQuizQuestions } from "../src/lib/clinical/quiz-store";

const DAY = 86_400_000;
const days = (n: number) => new Date(Date.now() + n * DAY);

const hash = (pw: string) => bcrypt.hashSync(pw, 12);

async function wipe() {
  await Promise.all(
    [
      User,
      ProductMaster,
      BatchLot,
      SessionKit,
      Drip,
      Order,
      Booking,
      HealthQuiz,
      TreatmentPlan,
      Allocation,
      Consumption,
      StockTxn,
      LabReport,
      Notification,
      Lead,
      QuizQuestion,
      ContentBlock,
      AIModel,
      Zone,
    ].map((m) => m.deleteMany({}))
  );
}

async function seedUsers() {
  const [superadmin, admin, doctor, doctor2, nurse, nurse2, clinic] = await User.create([
    {
      name: "Platform Owner",
      email: "admin@nutridrip.com",
      phone: "+919800000001",
      passwordHash: hash("admin123"),
      role: "superadmin",
      status: "active",
    },
    {
      name: "Ops Admin",
      email: "ops@nutridrip.com",
      phone: "+919800000002",
      passwordHash: hash("admin123"),
      role: "admin",
      status: "active",
    },
    {
      name: "Dr. Sarah Menon",
      email: "dr.sarah@nutridrip.com",
      phone: "+919800000003",
      passwordHash: hash("doctor123"),
      role: "doctor",
      status: "active",
      doctor: {
        specialization: "Integrative medicine",
        licenseNo: "KMC/2016/44219",
        registrationCouncil: "Karnataka Medical Council",
        // Dr. Menon has a letterhead of her own and Dr. Rao does not, so the
        // demo shows both: her prescriptions are headed by her practice, his by
        // NutriDrip's default. The registration above prints on both.
        letterhead: {
          practiceName: "Menon Integrative Medicine",
          qualifications: "MBBS, MD (Internal Medicine) · Fellowship in Integrative Medicine",
          address: "12 Church Street\nBengaluru 560001",
          phone: "080 4000 0142",
          email: "dr.sarah@nutridrip.com",
          footerNote: "Please keep this slip for your nurse to see at every session.",
        },
      },
    },
    {
      name: "Dr. Amit Rao",
      email: "dr.amit@nutridrip.com",
      passwordHash: hash("doctor123"),
      role: "doctor",
      status: "active",
      doctor: {
        specialization: "Internal medicine",
        licenseNo: "KMC/2012/31007",
        registrationCouncil: "Karnataka Medical Council",
      },
    },
    {
      name: "Emma Fernandes",
      email: "nurse.emma@nutridrip.com",
      phone: "+919800000004",
      passwordHash: hash("nurse123"),
      role: "nurse",
      status: "active",
      nurse: {
        licenseNo: "KNC/2019/8842",
        serviceAreas: ["HSR Layout", "Koramangala", "Ejipura"],
        latitude: 12.9352,
        longitude: 77.6245,
      },
    },
    {
      name: "Sunita Prakash",
      email: "nurse.sunita@nutridrip.com",
      passwordHash: hash("nurse123"),
      role: "nurse",
      status: "active",
      nurse: {
        licenseNo: "KNC/2021/9910",
        serviceAreas: ["Indiranagar", "Whitefield"],
        latitude: 12.9784,
        longitude: 77.6408,
      },
    },
    {
      name: "HealthFirst Clinic",
      email: "clinic@healthfirst.com",
      phone: "+919800000005",
      passwordHash: hash("clinic123"),
      role: "clinic",
      status: "active",
      clinic: {
        address: "24, 5th Main, Indiranagar",
        city: "Bengaluru",
        pincode: "560038",
        partnerSince: new Date("2025-03-14"),
        monthlyVolumeTarget: 120,
        // Check digit computed, not invented: a seeded GSTIN that failed its
        // own validation would show a warning on every visit to the form.
        gstin: "29AABCH1234K1ZN",
      },
    },
  ]);

  /**
   * Each nurse works under a physician. The link is what scopes the dispatch
   * list a physician is offered when approving a protocol — it is a convenience,
   * not a permission: any physician can still reassign, and automatic dispatch
   * draws from every nurse.
   */
  await Promise.all([
    User.updateOne({ _id: nurse._id }, { $set: { "nurse.doctorId": doctor._id } }),
    User.updateOne({ _id: nurse2._id }, { $set: { "nurse.doctorId": doctor2._id } }),
  ]);

  const patients = await User.create([
    {
      name: "Riya Mehta",
      email: "patient@example.com",
      phone: "+919844471234",
      passwordHash: hash("patient123"),
      role: "patient",
      status: "active",
      patient: {
        dob: new Date("1994-02-11"),
        gender: "female",
        bloodGroup: "O+",
        heightCm: 164,
        weightKg: 58,
        address: "Koramangala 8th Block",
        city: "Bengaluru",
        pincode: "560095",
        latitude: 12.9345,
        longitude: 77.627,
        emergencyContactName: "Neha Mehta",
        emergencyContactPhone: "+919844479911",
        allergies: "Sulfa drugs",
        chronicConditions: "None",
        vitalityScore: 62,
        lastQuizAt: days(-3),
      },
    },
    {
      name: "S. Krishnan",
      phone: "+919845550002",
      role: "patient",
      status: "active",
      patient: {
        dob: new Date("1986-07-22"),
        gender: "male",
        bloodGroup: "B+",
        address: "HSR Layout, sector 2",
        city: "Bengaluru",
        pincode: "560102",
        latitude: 12.9121,
        longitude: 77.6446,
        vitalityScore: 71,
      },
    },
    {
      name: "A. Bhatt",
      phone: "+919845550003",
      role: "patient",
      status: "active",
      patient: {
        dob: new Date("1991-11-03"),
        gender: "female",
        bloodGroup: "A+",
        address: "Ejipura, 12th cross",
        city: "Bengaluru",
        pincode: "560047",
        latitude: 12.9401,
        longitude: 77.6229,
        vitalityScore: 48,
      },
    },
    {
      name: "V. Iyer",
      phone: "+919845550004",
      role: "patient",
      status: "active",
      patient: { dob: new Date("1988-05-14"), gender: "male", city: "Bengaluru", pincode: "560103", vitalityScore: 55 },
    },
  ]);

  return { superadmin, admin, doctor, doctor2, nurse, nurse2, clinic, patients };
}

type MasterSeed = {
  key: string;
  name: string;
  molecule?: string;
  hsnCode: string;
  category: "DRUG" | "FLUID" | "CONSUMABLE" | "PREMED";
  canonicalUnit: "mg" | "mcg" | "g" | "ml" | "IU" | "unit";
  reorderLevel: number;
  isMultidose?: boolean;
  gstRate?: number;
  storageCondition?: string;
};

const MASTERS: MasterSeed[] = [
  { key: "vitc", name: "Ascorbic acid", molecule: "Vitamin C", hsnCode: "30045020", category: "DRUG", canonicalUnit: "mg", reorderLevel: 60, storageCondition: "2–8 °C, protect from light" },
  { key: "mgso4", name: "Magnesium sulphate", molecule: "Magnesium", hsnCode: "30049099", category: "DRUG", canonicalUnit: "mg", reorderLevel: 40 },
  { key: "bcomplex", name: "B-complex", hsnCode: "30045010", category: "DRUG", canonicalUnit: "ml", reorderLevel: 30, isMultidose: true },
  { key: "b12", name: "Cyanocobalamin", molecule: "Vitamin B12", hsnCode: "30045031", category: "DRUG", canonicalUnit: "mcg", reorderLevel: 25 },
  { key: "cagluc", name: "Calcium gluconate", hsnCode: "30049091", category: "DRUG", canonicalUnit: "mg", reorderLevel: 20 },
  { key: "b6", name: "Pyridoxine", molecule: "Vitamin B6", hsnCode: "30045012", category: "DRUG", canonicalUnit: "mg", reorderLevel: 20 },
  { key: "zinc", name: "Zinc sulphate", molecule: "Zinc", hsnCode: "30049085", category: "DRUG", canonicalUnit: "mg", reorderLevel: 25 },
  { key: "selenium", name: "Sodium selenite", molecule: "Selenium", hsnCode: "30049086", category: "DRUG", canonicalUnit: "mcg", reorderLevel: 20 },
  { key: "glutathione", name: "Glutathione", hsnCode: "30049087", category: "DRUG", canonicalUnit: "mg", reorderLevel: 30 },
  { key: "carnitine", name: "L-carnitine", hsnCode: "30049088", category: "DRUG", canonicalUnit: "mg", reorderLevel: 20 },
  { key: "taurine", name: "Taurine", hsnCode: "30049089", category: "DRUG", canonicalUnit: "mg", reorderLevel: 20 },
  { key: "iron", name: "Iron sucrose", molecule: "Iron", hsnCode: "30049031", category: "DRUG", canonicalUnit: "mg", reorderLevel: 15 },
  { key: "ala", name: "Alpha-lipoic acid", hsnCode: "30049090", category: "DRUG", canonicalUnit: "mg", reorderLevel: 15 },
  { key: "biotin", name: "Biotin", hsnCode: "30045013", category: "DRUG", canonicalUnit: "mcg", reorderLevel: 15 },
  { key: "ns", name: "Normal saline 0.9%", hsnCode: "30049011", category: "FLUID", canonicalUnit: "ml", reorderLevel: 80 },
  { key: "rl", name: "Ringer lactate", hsnCode: "30049012", category: "FLUID", canonicalUnit: "ml", reorderLevel: 50 },
  { key: "electrolyte", name: "Electrolyte concentrate", hsnCode: "30049013", category: "FLUID", canonicalUnit: "ml", reorderLevel: 30 },
  { key: "ondansetron", name: "Ondansetron", hsnCode: "30049061", category: "PREMED", canonicalUnit: "mg", reorderLevel: 20 },
  { key: "pheniramine", name: "Pheniramine maleate", hsnCode: "30049062", category: "PREMED", canonicalUnit: "mg", reorderLevel: 20 },
  { key: "ivset", name: "IV infusion set", hsnCode: "90183930", category: "CONSUMABLE", canonicalUnit: "unit", reorderLevel: 100 },
  { key: "cannula", name: "IV cannula 22G", hsnCode: "90183910", category: "CONSUMABLE", canonicalUnit: "unit", reorderLevel: 100 },
  { key: "swab", name: "Alcohol swab", hsnCode: "30059090", category: "CONSUMABLE", canonicalUnit: "unit", reorderLevel: 200 },
  { key: "gloves", name: "Nitrile gloves (pair)", hsnCode: "40151900", category: "CONSUMABLE", canonicalUnit: "unit", reorderLevel: 150 },
  { key: "tape", name: "Fixation tape", hsnCode: "30051090", category: "CONSUMABLE", canonicalUnit: "unit", reorderLevel: 80 },
  { key: "anaphylaxis", name: "Anaphylaxis kit", hsnCode: "30066000", category: "CONSUMABLE", canonicalUnit: "unit", reorderLevel: 10 },
];

type LotSeed = {
  key: string;
  batchNo: string;
  brand: string;
  manufacturer: string;
  expiryDays: number;
  content: number;
  contentUnit: "mg" | "mcg" | "g" | "ml" | "IU" | "unit";
  form: "Vial" | "Ampoule" | "Bottle" | "Bag" | "Piece" | "Sachet";
  qty: number;
  cost: number;
  mrp: number;
};

/** Batch numbers and expiries match the design system's worked example. */
const LOTS: LotSeed[] = [
  { key: "vitc", batchNo: "VC-B9", brand: "Ascorvit 7.5", manufacturer: "Neon Labs", expiryDays: 184, content: 7500, contentUnit: "mg", form: "Vial", qty: 240, cost: 310, mrp: 420 },
  { key: "vitc", batchNo: "VC-B7", brand: "Ascorvit 7.5", manufacturer: "Neon Labs", expiryDays: 12, content: 7500, contentUnit: "mg", form: "Vial", qty: 42, cost: 310, mrp: 420 },
  { key: "vitc", batchNo: "VC-B4", brand: "Ascorvit 7.5", manufacturer: "Neon Labs", expiryDays: -30, content: 7500, contentUnit: "mg", form: "Vial", qty: 18, cost: 310, mrp: 420 },
  { key: "vitc", batchNo: "VC-C1", brand: "Celin IV", manufacturer: "Alkem", expiryDays: 132, content: 5000, contentUnit: "mg", form: "Vial", qty: 26, cost: 240, mrp: 330 },
  { key: "mgso4", batchNo: "MG-A2", brand: "Magsafe", manufacturer: "Samarth", expiryDays: 240, content: 1000, contentUnit: "mg", form: "Ampoule", qty: 96, cost: 55, mrp: 90 },
  { key: "mgso4", batchNo: "MG-A5", brand: "Magsafe", manufacturer: "Samarth", expiryDays: 60, content: 1000, contentUnit: "mg", form: "Ampoule", qty: 22, cost: 55, mrp: 90 },
  { key: "bcomplex", batchNo: "BC-D8", brand: "Neurobion Forte", manufacturer: "Merck", expiryDays: 300, content: 10, contentUnit: "ml", form: "Vial", qty: 60, cost: 78, mrp: 120 },
  { key: "b12", batchNo: "B12-E3", brand: "Macbin", manufacturer: "Macleods", expiryDays: 420, content: 1500, contentUnit: "mcg", form: "Ampoule", qty: 84, cost: 42, mrp: 70 },
  { key: "cagluc", batchNo: "CA-F1", brand: "Calcigran", manufacturer: "Cipla", expiryDays: 365, content: 1000, contentUnit: "mg", form: "Ampoule", qty: 70, cost: 38, mrp: 60 },
  { key: "b6", batchNo: "B6-G2", brand: "Pyridox", manufacturer: "Zydus", expiryDays: 280, content: 100, contentUnit: "mg", form: "Ampoule", qty: 88, cost: 30, mrp: 50 },
  { key: "zinc", batchNo: "ZN-C4", brand: "Zincovit IV", manufacturer: "Apex", expiryDays: 210, content: 10, contentUnit: "mg", form: "Ampoule", qty: 64, cost: 45, mrp: 75 },
  { key: "selenium", batchNo: "SE-H7", brand: "Selovit", manufacturer: "Intas", expiryDays: 190, content: 100, contentUnit: "mcg", form: "Ampoule", qty: 52, cost: 68, mrp: 110 },
  { key: "glutathione", batchNo: "GL-D3", brand: "Glutone 600", manufacturer: "Cadila", expiryDays: 150, content: 600, contentUnit: "mg", form: "Vial", qty: 0, cost: 520, mrp: 760 },
  { key: "glutathione", batchNo: "GL-D6", brand: "Glutone 600", manufacturer: "Cadila", expiryDays: 320, content: 600, contentUnit: "mg", form: "Vial", qty: 34, cost: 520, mrp: 760 },
  { key: "carnitine", batchNo: "LC-J1", brand: "Carnisure", manufacturer: "Sun", expiryDays: 260, content: 1000, contentUnit: "mg", form: "Ampoule", qty: 46, cost: 145, mrp: 210 },
  { key: "taurine", batchNo: "TA-K2", brand: "Taurox", manufacturer: "Sun", expiryDays: 240, content: 500, contentUnit: "mg", form: "Ampoule", qty: 40, cost: 96, mrp: 150 },
  { key: "iron", batchNo: "FE-L4", brand: "Orofer S", manufacturer: "Emcure", expiryDays: 200, content: 100, contentUnit: "mg", form: "Ampoule", qty: 24, cost: 330, mrp: 480 },
  { key: "ala", batchNo: "AL-M8", brand: "Thiotacid", manufacturer: "Micro", expiryDays: 275, content: 300, contentUnit: "mg", form: "Ampoule", qty: 30, cost: 120, mrp: 190 },
  { key: "biotin", batchNo: "BT-N3", brand: "Biotop", manufacturer: "Sanofi", expiryDays: 310, content: 5000, contentUnit: "mcg", form: "Ampoule", qty: 26, cost: 88, mrp: 140 },
  { key: "ns", batchNo: "NS-P9", brand: "Normal saline", manufacturer: "Baxter", expiryDays: 400, content: 500, contentUnit: "ml", form: "Bag", qty: 180, cost: 42, mrp: 68 },
  { key: "ns", batchNo: "NS-P4", brand: "Normal saline", manufacturer: "Baxter", expiryDays: 55, content: 500, contentUnit: "ml", form: "Bag", qty: 40, cost: 42, mrp: 68 },
  { key: "rl", batchNo: "RL-Q2", brand: "Ringer lactate", manufacturer: "Baxter", expiryDays: 380, content: 500, contentUnit: "ml", form: "Bag", qty: 90, cost: 46, mrp: 72 },
  { key: "electrolyte", batchNo: "EL-B1", brand: "Electrolyte-P", manufacturer: "Fresenius", expiryDays: 170, content: 20, contentUnit: "ml", form: "Ampoule", qty: 58, cost: 52, mrp: 85 },
  { key: "ondansetron", batchNo: "ON-R6", brand: "Emeset", manufacturer: "Cipla", expiryDays: 330, content: 4, contentUnit: "mg", form: "Ampoule", qty: 72, cost: 18, mrp: 32 },
  { key: "pheniramine", batchNo: "PH-S1", brand: "Avil", manufacturer: "Sanofi", expiryDays: 290, content: 22.75, contentUnit: "mg", form: "Ampoule", qty: 66, cost: 16, mrp: 28 },
  { key: "ivset", batchNo: "IV-2026-A", brand: "Romsons IV set", manufacturer: "Romsons", expiryDays: 700, content: 1, contentUnit: "unit", form: "Piece", qty: 320, cost: 28, mrp: 45 },
  { key: "cannula", batchNo: "CN-2026-B", brand: "Venflon 22G", manufacturer: "BD", expiryDays: 640, content: 1, contentUnit: "unit", form: "Piece", qty: 280, cost: 32, mrp: 55 },
  { key: "swab", batchNo: "SW-2026-C", brand: "Sterisol", manufacturer: "3M", expiryDays: 520, content: 1, contentUnit: "unit", form: "Sachet", qty: 900, cost: 2, mrp: 4 },
  { key: "gloves", batchNo: "GL-2026-D", brand: "Nulife", manufacturer: "Nulife", expiryDays: 480, content: 1, contentUnit: "unit", form: "Piece", qty: 420, cost: 9, mrp: 15 },
  { key: "tape", batchNo: "TP-2026-E", brand: "Micropore", manufacturer: "3M", expiryDays: 560, content: 1, contentUnit: "unit", form: "Piece", qty: 200, cost: 12, mrp: 22 },
  { key: "anaphylaxis", batchNo: "AK-2026-04", brand: "Emergency kit", manufacturer: "NutriDrip", expiryDays: 580, content: 1, contentUnit: "unit", form: "Piece", qty: 14, cost: 1200, mrp: 1800 },
];

/**
 * How a drip is classified on a tax invoice, until an accountant says
 * otherwise.
 *
 * PLACEHOLDERS. 3004.90.99 is "other medicaments, put up in measured doses" at
 * 12%, which is where a made-up infusion most plausibly sits — but the
 * classification of a nutrient infusion supplied to a clinic is a question for
 * whoever files the returns, not for this file. Both are editable per drip at
 * /admin/inventory/drips, so a correction is a form field rather than a deploy.
 */
const DEFAULT_HSN = "30049099";
const DEFAULT_GST_RATE = 12;

type DripSeed = {
  slug: string;
  /** Overrides DEFAULT_HSN / DEFAULT_GST_RATE for a drip that is classed differently. */
  hsnCode?: string;
  gstRate?: number;
  name: string;
  category: string;
  tagline: string;
  description: string;
  infusionNotes: string;
  price: number;
  durationMin: number;
  /**
   * The upper end, when a session is honestly a range.
   *
   * The same protocol runs longer for somebody who flushes on magnesium, and
   * iron is titrated after a test dose. A patient reads this to know roughly
   * how long they are sitting there, and a single figure they then overrun
   * reads as something having gone wrong.
   */
  durationToMin?: number;
  requiresApproval?: boolean;
  bestFor: string[];
  goodToKnow: string[];
  ingredients: Array<[string, number, "mg" | "mcg" | "g" | "ml" | "IU" | "unit", "ACTIVE" | "FLUID" | "PREMED" | "ADDITIVE", string?]>;
  /** Catalogue chips and search. Ingredient names earn their place here: a
      patient who has read about glutathione will not search "Glow Protocol". */
  tags?: string[];
  /** One emoji. Never a colour — the palette keeps its hues for status. */
  icon?: string;
  /** Matches the carrier in the recipe, or the page contradicts itself. */
  volumeMl?: number;
  /**
   * What it helps with, explained.
   *
   * Written descriptively — what is in the bag and who it suits — rather than
   * as efficacy claims. Anything stronger than this belongs to a physician,
   * not to seed data.
   */
  benefits?: Array<{ title: string; description?: string }>;
};

/** The nine-drip catalogue from Block 1. */
const DRIPS: DripSeed[] = [
  {
    slug: "myers-revive",
    icon: "⚡",
    volumeMl: 500,
    tags: ["Energy", "B-complex", "Magnesium", "Fatigue"],
    benefits: [
      { title: "Energy metabolism", description: "B-complex and B12 are the cofactors the body burns through on high-workload weeks." },
      { title: "Muscle and sleep", description: "Magnesium is given slowly; a warm flush is expected and is not an adverse event." },
      { title: "Antioxidant load", description: "7,500 mg of ascorbic acid in a saline carrier." },
      { title: "A starting point", description: "The usual first drip, before anything more specific is considered." },
    ],
    name: "Myers' Revive",
    category: "Energy",
    tagline: "The default first drip",
    description: "Magnesium-forward Myers' cocktail. B-complex, magnesium and ascorbic acid in a saline carrier.",
    infusionNotes:
      "Run the carrier clear before the ascorbic acid is introduced. Magnesium is given slowly — a warm flush is expected and is not an adverse event.",
    price: 8400,
    durationMin: 45,
    durationToMin: 60,
    bestFor: ["Persistent fatigue", "Poor sleep", "High workload weeks"],
    goodToKnow: ["Most patients feel the lift within 24 hours", "Magnesium can cause a brief warm sensation"],
    ingredients: [
      ["ns", 500, "ml", "FLUID", "Carrier"],
      ["vitc", 7500, "mg", "ACTIVE", "Antioxidant load"],
      ["mgso4", 1000, "mg", "ACTIVE", "Muscle and sleep"],
      ["bcomplex", 2, "ml", "ACTIVE", "Energy metabolism"],
      ["b12", 1000, "mcg", "ACTIVE", "Nerve and blood"],
      ["cagluc", 500, "mg", "ADDITIVE", "Electrolyte balance"],
      ["b6", 100, "mg", "ADDITIVE", "Cofactor"],
    ],
  },
  {
    slug: "deep-recharge",
    icon: "🔋",
    volumeMl: 500,
    tags: ["Energy", "L-carnitine", "B12", "Burnout"],
    benefits: [
      { title: "For fatigue that has lasted", description: "Aimed at tiredness lasting over a month, not at one bad night." },
      { title: "Amino acid support", description: "L-carnitine and taurine, at higher doses than the standard Myers'." },
      { title: "Usually a course", description: "Normally prescribed as four sessions rather than one." },
    ],
    name: "Deep Recharge",
    category: "Energy",
    tagline: "For sustained fatigue",
    description: "Adds L-carnitine and taurine for sustained fatigue that a single session has not shifted.",
    infusionNotes: "Longer run at a lower rate. Check the site at the halfway mark.",
    price: 10600,
    durationMin: 60,
    durationToMin: 80,
    bestFor: ["Fatigue lasting over a month", "Athletic overtraining"],
    goodToKnow: ["Usually prescribed as a course of four"],
    ingredients: [
      ["ns", 500, "ml", "FLUID", "Carrier"],
      ["carnitine", 2000, "mg", "ACTIVE"],
      ["taurine", 1000, "mg", "ACTIVE"],
      ["b12", 1000, "mcg", "ACTIVE"],
      ["bcomplex", 2, "ml", "ACTIVE"],
    ],
  },
  {
    slug: "jetlag-reset",
    icon: "✈️",
    volumeMl: 500,
    tags: ["Travel", "Jet lag", "Electrolytes", "Shift work"],
    benefits: [
      { title: "Lighter than the energy drips", description: "A shorter, smaller session — for the day you land, not a full recharge." },
      { title: "Rehydration first", description: "Electrolytes in saline — cabin air and long flights take fluid out." },
      { title: "Timing matters", description: "Clearest effect within 24 hours of landing or a shift change." },
    ],
    name: "Jetlag Reset",
    category: "Energy",
    tagline: "Built around travel days",
    description: "Lower volume, faster run, built around travel days and time-zone shifts.",
    infusionNotes: "Can be run at 300 ml/hr in an otherwise healthy adult.",
    price: 6800,
    durationMin: 30,
    durationToMin: 40,
    bestFor: ["Long-haul travel", "Shift changes"],
    goodToKnow: ["Book within 24 hours of landing for the clearest effect"],
    ingredients: [
      ["ns", 500, "ml", "FLUID", "Carrier"],
      ["vitc", 5000, "mg", "ACTIVE"],
      ["electrolyte", 20, "ml", "ACTIVE"],
      ["b6", 100, "mg", "ADDITIVE"],
    ],
  },
  {
    slug: "iron-restore",
    icon: "🩸",
    volumeMl: 500,
    tags: ["Iron", "Anaemia", "Lab-confirmed", "Fatigue"],
    benefits: [
      { title: "Only with labs", description: "A physician cannot approve this without recent blood work. Iron is not given speculatively." },
      { title: "For confirmed deficiency", description: "Prescribed for iron deficiency anaemia, not for tiredness in general." },
      { title: "A longer sit", description: "90 minutes, and the observation period afterwards is longer than usual." },
    ],
    name: "Iron Restore",
    category: "Energy",
    tagline: "Requires recent labs",
    description: "Iron sucrose for confirmed deficiency. A ferritin result within 90 days is mandatory.",
    infusionNotes:
      "Give a test dose over the first 15 minutes and observe. Stop at the first sign of a reaction.",
    price: 9800,
    durationMin: 90,
    durationToMin: 120,
    bestFor: ["Confirmed iron deficiency anaemia"],
    goodToKnow: ["Labs required before the physician can approve", "Observation period is longer"],
    ingredients: [
      ["ns", 500, "ml", "FLUID", "Carrier"],
      ["iron", 200, "mg", "ACTIVE"],
      ["vitc", 1000, "mg", "ADDITIVE", "Aids absorption"],
      ["pheniramine", 22.75, "mg", "PREMED", "Reaction cover"],
    ],
  },
  {
    slug: "immune-shield",
    icon: "🛡️",
    volumeMl: 500,
    tags: ["Immunity", "Vitamin C", "Zinc", "Pre-travel"],
    benefits: [
      { title: "Three minerals, not one", description: "15,000 mg of ascorbic acid, with zinc and selenium alongside it." },
      { title: "Screening required", description: "G6PD screening is required before a dose this high." },
      { title: "Before you travel", description: "Often booked in the week before a trip or during a recovery stretch." },
    ],
    name: "Immune Shield",
    category: "Immunity",
    tagline: "High-dose vitamin C",
    description: "High-dose vitamin C with zinc and selenium.",
    infusionNotes: "High-dose ascorbic acid is contraindicated in G6PD deficiency — screen before approving.",
    price: 9200,
    durationMin: 60,
    durationToMin: 80,
    bestFor: ["Recurrent infections", "Pre-travel", "Recovery weeks"],
    goodToKnow: ["G6PD screening required at high doses"],
    ingredients: [
      ["ns", 500, "ml", "FLUID", "Carrier"],
      ["vitc", 15000, "mg", "ACTIVE"],
      ["zinc", 10, "mg", "ACTIVE"],
      ["selenium", 100, "mcg", "ACTIVE"],
    ],
  },
  {
    slug: "post-viral-rebuild",
    icon: "🌱",
    volumeMl: 500,
    tags: ["Post-viral", "Brain fog", "Alpha-lipoic acid", "Recovery"],
    benefits: [
      { title: "Seven days after the fever", description: "Started once a fever has resolved, never during the illness itself." },
      { title: "Antioxidant-forward", description: "Alpha-lipoic acid alongside ascorbic acid and B-complex." },
      { title: "For the tail end", description: "Aimed at the fatigue and fog that outlast the illness itself." },
    ],
    name: "Post-viral Rebuild",
    category: "Post-viral",
    tagline: "After the infection clears",
    description: "Antioxidant-forward protocol for the flat weeks that follow a viral illness.",
    infusionNotes: "Introduce alpha-lipoic acid last, after the carrier has run clear.",
    price: 9600,
    durationMin: 60,
    durationToMin: 80,
    bestFor: ["Post-viral fatigue", "Brain fog"],
    goodToKnow: ["Best started at least seven days after fever resolves"],
    ingredients: [
      ["ns", 500, "ml", "FLUID", "Carrier"],
      ["vitc", 10000, "mg", "ACTIVE"],
      ["ala", 300, "mg", "ACTIVE"],
      ["bcomplex", 2, "ml", "ACTIVE"],
      ["zinc", 10, "mg", "ADDITIVE"],
    ],
  },
  {
    slug: "glow-protocol",
    icon: "✨",
    volumeMl: 500,
    tags: ["Skin", "Glutathione", "Pigmentation", "Antioxidant"],
    benefits: [
      { title: "Given slowly", description: "Glutathione is a slow push at the end of the carrier, never a fast one." },
      { title: "With vitamin C", description: "Ascorbic acid alongside it, as the protocol is normally written." },
      { title: "A course, not a session", description: "Six sessions is the usual protocol; one is rarely the plan." },
    ],
    name: "Glow Protocol",
    category: "Skin",
    tagline: "Given as a slow push",
    description: "Glutathione with vitamin C, given as a slow push at the end of the carrier.",
    infusionNotes: "Glutathione is a slow IV push over no less than 10 minutes. Never mix into the bag.",
    price: 11000,
    durationMin: 50,
    durationToMin: 70,
    bestFor: ["Dull skin", "Pigmentation", "Pre-event"],
    goodToKnow: ["A course of six is the usual protocol"],
    ingredients: [
      ["ns", 500, "ml", "FLUID", "Carrier"],
      ["glutathione", 600, "mg", "ACTIVE", "Slow IV push"],
      ["vitc", 5000, "mg", "ACTIVE"],
      ["biotin", 5000, "mcg", "ADDITIVE"],
    ],
  },
  {
    slug: "hydrate-plus",
    icon: "💧",
    volumeMl: 500,
    tags: ["Hydration", "Electrolytes", "Hangover", "Heat"],
    benefits: [
      { title: "Ringer lactate, not saline", description: "A balanced electrolyte carrier rather than plain salt water." },
      { title: "For heat and exertion", description: "Dehydration, heat exhaustion, or after a long run." },
      { title: "Thirty minutes", description: "In and out, with no course to commit to." },
    ],
    name: "Hydrate Plus",
    category: "Hydration",
    tagline: "Fast rehydration",
    description: "Balanced electrolytes in Ringer lactate for dehydration, hangovers and heat exposure.",
    infusionNotes: "Run fast unless there is a cardiac or renal history.",
    price: 5400,
    durationMin: 30,
    durationToMin: 40,
    requiresApproval: true,
    bestFor: ["Dehydration", "Heat exhaustion", "After a long run"],
    goodToKnow: ["The shortest session on the menu"],
    ingredients: [
      ["rl", 500, "ml", "FLUID", "Carrier"],
      ["electrolyte", 20, "ml", "ACTIVE"],
      ["b6", 100, "mg", "ADDITIVE"],
      ["ondansetron", 4, "mg", "PREMED", "If nausea present"],
    ],
  },
  {
    slug: "athletic-recovery",
    icon: "🏃",
    volumeMl: 500,
    tags: ["Recovery", "Taurine", "Magnesium", "Post-event"],
    benefits: [
      { title: "After, not before", description: "Built for the 24 hours following a hard effort." },
      { title: "Amino acids and magnesium", description: "Taurine, L-carnitine and magnesium in Ringer lactate." },
      { title: "Check your federation", description: "Read your anti-doping list before booking — some bodies restrict IV volumes." },
    ],
    name: "Athletic Recovery",
    category: "Athletic recovery",
    tagline: "After the event, not before",
    description: "Amino-acid forward recovery protocol for the 24 hours after a hard effort.",
    infusionNotes: "Not to be given within 6 hours of competition under anti-doping rules.",
    price: 10200,
    durationMin: 55,
    durationToMin: 75,
    bestFor: ["Race recovery", "Heavy training blocks"],
    goodToKnow: ["Check your federation's anti-doping list before booking"],
    ingredients: [
      ["rl", 500, "ml", "FLUID", "Carrier"],
      ["taurine", 1000, "mg", "ACTIVE"],
      ["carnitine", 1000, "mg", "ACTIVE"],
      ["mgso4", 1000, "mg", "ACTIVE"],
      ["vitc", 5000, "mg", "ADDITIVE"],
    ],
  },
];

async function seedInventory() {
  const masters = await ProductMaster.create(
    MASTERS.map((m) => ({
      name: m.name,
      molecule: m.molecule,
      hsnCode: m.hsnCode,
      gstRate: m.gstRate ?? 12,
      category: m.category,
      canonicalUnit: m.canonicalUnit,
      reorderLevel: m.reorderLevel,
      isMultidose: m.isMultidose ?? false,
      storageCondition: m.storageCondition,
      isActive: true,
    }))
  );

  const byKey = new Map<string, (typeof masters)[number]>();
  MASTERS.forEach((m, i) => byKey.set(m.key, masters[i]));

  await BatchLot.create(
    LOTS.map((l) => ({
      masterId: byKey.get(l.key)!._id,
      brandName: l.brand,
      manufacturer: l.manufacturer,
      batchNo: l.batchNo,
      expiry: days(l.expiryDays),
      contentValue: l.content,
      contentUnit: l.contentUnit,
      unitForm: l.form,
      qtyReceived: l.qty,
      qtyOnHand: l.qty,
      qtyReserved: 0,
      costPerUnit: l.cost,
      mrp: l.mrp,
    }))
  );

  const kit = await SessionKit.create({
    name: "Standard session kit",
    description: "IV set, cannula, swabs, gloves and fixation tape — deducted per drip prepared.",
    items: [
      { masterId: byKey.get("ivset")!._id, qty: 1 },
      { masterId: byKey.get("cannula")!._id, qty: 1 },
      { masterId: byKey.get("swab")!._id, qty: 3 },
      { masterId: byKey.get("gloves")!._id, qty: 2 },
      { masterId: byKey.get("tape")!._id, qty: 1 },
    ],
    isDefault: true,
  });

  return { byKey, kit };
}

async function seedDrips(
  byKey: Map<string, { _id: unknown; name: string }>,
  kitId: unknown,
  createdBy: unknown
) {
  return Drip.create(
    DRIPS.map((d) => ({
      name: d.name,
      slug: d.slug,
      tagline: d.tagline,
      description: d.description,
      infusionNotes: d.infusionNotes,
      durationMin: d.durationMin,
      durationToMin: d.durationToMin,
      priceInr: d.price,
      // category was declared on the seed type but never written, so every
      // seeded drip came out with none and fell back to "Wellness".
      category: d.category,
      hsnCode: d.hsnCode ?? DEFAULT_HSN,
      gstRate: d.gstRate ?? DEFAULT_GST_RATE,
      tags: d.tags ?? [],
      icon: d.icon,
      volumeMl: d.volumeMl,
      benefits: d.benefits ?? [],
      bestFor: d.bestFor,
      goodToKnow: d.goodToKnow,
      isPublic: true,
      requiresApproval: d.requiresApproval ?? true,
      withKit: true,
      kitId,
      isActive: true,
      createdBy,
      ingredients: d.ingredients.map(([key, dose, unit, role, notes]) => ({
        masterId: byKey.get(key)!._id,
        name: byKey.get(key)!.name,
        dose,
        unit,
        role,
        notes,
      })),
    }))
  );
}

const QUIZ_RISKS = [
  { name: "Vitamin C", group: "Vitamins", pct: 68 },
  { name: "Vitamin D", group: "Vitamins", pct: 18 },
  { name: "Vitamin B12", group: "Vitamins", pct: 44 },
  { name: "Folate", group: "Vitamins", pct: 72 },
  { name: "Magnesium", group: "Minerals", pct: 51 },
  { name: "Zinc", group: "Minerals", pct: 63 },
  { name: "Iron", group: "Minerals", pct: 42 },
  { name: "Selenium", group: "Minerals", pct: 79 },
  { name: "Glutathione", group: "Amino acids", pct: 38 },
  { name: "Taurine", group: "Amino acids", pct: 66 },
  { name: "Electrolyte balance", group: "Hydration", pct: 57 },
  { name: "B-complex load", group: "Metabolic", pct: 49 },
  { name: "L-carnitine", group: "Metabolic", pct: 71 },
  { name: "Alpha-lipoic acid", group: "Antioxidants", pct: 33 },
  { name: "Vitamin A", group: "Immunity", pct: 74 },
  { name: "Copper", group: "Immunity", pct: 81 },
];

async function seedClinical(
  users: Awaited<ReturnType<typeof seedUsers>>,
  drips: Awaited<ReturnType<typeof seedDrips>>
) {
  const { admin, doctor, nurse, nurse2, clinic, patients } = users;
  const [riya, krishnan, bhatt, iyer] = patients;
  const myers = drips.find((d) => d.slug === "myers-revive")!;
  const immune = drips.find((d) => d.slug === "immune-shield")!;
  const jetlag = drips.find((d) => d.slug === "jetlag-reset")!;
  const iron = drips.find((d) => d.slug === "iron-restore")!;

  await HealthQuiz.create([
    {
      patientId: riya._id,
      vitalityScore: 62,
      nutrientRisks: QUIZ_RISKS,
      answers: [
        { questionId: "wake-tired", section: "Sleep & energy", question: "In the last two weeks, how often did you wake up still tired?", answer: "Most weekdays" },
        { questionId: "afternoon-crash", section: "Sleep & energy", question: "Do you get an afternoon energy crash?", answer: "Most days" },
        { questionId: "water", section: "Diet & hydration", question: "Roughly how much water do you drink a day?", answer: "1–2 L" },
        { questionId: "allergies", section: "Screening", question: "Any drug allergies?", answer: "Sulfa drugs" },
      ],
      suggestedDripIds: [myers._id, immune._id],
      reviewStatus: "pending",
      completedAt: days(-3),
    },
    {
      patientId: krishnan._id,
      vitalityScore: 71,
      nutrientRisks: QUIZ_RISKS.map((r) => ({ ...r, pct: Math.min(100, r.pct + 9) })),
      suggestedDripIds: [immune._id],
      reviewStatus: "approved",
      reviewedBy: doctor._id,
      reviewedAt: days(-9),
      completedAt: days(-10),
    },
    {
      patientId: bhatt._id,
      vitalityScore: 48,
      nutrientRisks: QUIZ_RISKS.map((r) => ({ ...r, pct: Math.max(4, r.pct - 14) })),
      suggestedDripIds: [myers._id, jetlag._id],
      reviewStatus: "pending",
      completedAt: days(-1),
    },
    {
      patientId: iyer._id,
      vitalityScore: 55,
      nutrientRisks: QUIZ_RISKS,
      suggestedDripIds: [jetlag._id],
      reviewStatus: "pending",
      completedAt: days(0),
    },
  ]);

  const checklist = CHECKLIST_STEPS.map((s) => ({ ...s, doneAt: undefined, stamp: undefined }));
  /**
   * Stopped before "Prime the line" (step 16), because that is where an
   * out-of-range baseline stops a nurse. Seeding a step the server refuses —
   * and an infusion already running on uncleared vitals — made a demo session
   * no real session could ever reach.
   */
  const firstBlocked = CHECKLIST_STEPS.findIndex((s) => blockedByVitals(s));
  const partial = CHECKLIST_STEPS.map((s, i) => ({
    ...s,
    doneAt: i < firstBlocked ? days(0) : undefined,
    stamp: i < firstBlocked ? "queued" : undefined,
  }));

  await Booking.create([
    {
      bookingNo: "ND-4417",
      patientId: riya._id,
      dripId: myers._id,
      dripName: myers.name,
      scheduledAt: new Date(new Date().setHours(10, 0, 0, 0)),
      durationMin: 58,
      location: "home",
      address: "Koramangala 8th Block",
      city: "Bengaluru",
      pincode: "560095",
      nurseId: nurse._id,
      doctorId: doctor._id,
      clinicId: clinic._id,
      status: "in_progress",
      approvedAt: days(-2),
      // Waiting on the physician: the baseline SpO₂ below is out of range and
      // uncleared, so the nurse is stopped at "Prime the line". Clearing it in
      // the doctor's Escalations queue is what lets the session go on.
      //
      // Every ticked step past the sixth needs the prescription open, so it was
      // unlocked with the patient's code on arrival, before consent at 10:09.
      rxUnlockedAt: new Date(new Date().setHours(10, 4, 0, 0)),
      rxUnlockedBy: nurse._id,
      rxUnlockMethod: "code",
      checklist: partial,
      vitals: [
        {
          takenAt: new Date(new Date().setHours(9, 58, 0, 0)),
          label: "baseline",
          systolic: 122,
          diastolic: 78,
          heartRate: 74,
          spo2: 91,
          temperatureF: 98.4,
          weightKg: 58,
          outOfRange: ["spo2"],
        },
      ],
      // The wording and the doses are copied onto the record, not referenced —
      // a seeded consent that only carried a version would be the very thing
      // the snapshot exists to prevent.
      consent: {
        givenAt: new Date(new Date().setHours(10, 9, 0, 0)),
        version: CURRENT_CONSENT_VERSION,
        viaOtp: "4471",
        affirmation: currentConsentDocument().affirmation,
        risks: currentConsentDocument().risks,
        components: componentsForConsent(myers.ingredients),
      },
      // The first tick starts a session, so this is when the doorstep checks
      // began. No bag, rate or observations: the infusion has not started, and
      // walking the checklist forward is what creates them.
      startedAt: new Date(new Date().setHours(9, 52, 0, 0)),
      amount: myers.priceInr,
      paymentStatus: "paid",
    },
    {
      bookingNo: "ND-4415",
      patientId: krishnan._id,
      dripId: immune._id,
      dripName: immune.name,
      scheduledAt: new Date(new Date().setHours(8, 0, 0, 0)),
      durationMin: 50,
      location: "home",
      address: "HSR Layout, sector 2",
      city: "Bengaluru",
      pincode: "560102",
      nurseId: nurse._id,
      doctorId: doctor._id,
      status: "completed",
      approvedAt: days(-4),
      // All 29 steps closed, so the prescription was open.
      rxUnlockedAt: new Date(new Date().setHours(8, 2, 0, 0)),
      rxUnlockedBy: nurse._id,
      rxUnlockMethod: "code",
      startedAt: new Date(new Date().setHours(8, 4, 0, 0)),
      completedAt: new Date(new Date().setHours(8, 50, 0, 0)),
      checklist: CHECKLIST_STEPS.map((s) => ({ ...s, doneAt: days(0), stamp: "synced" })),
      componentsGiven: [
        { name: "Ascorbic acid", dose: 15000, unit: "mg", batchNo: "VC-B9" },
        { name: "Zinc sulphate", dose: 10, unit: "mg", batchNo: "ZN-C4" },
      ],
      // A filed event on a session that completed: exactly the case a status
      // filter used to hide from the escalations queue.
      adverseEvents: [
        {
          at: new Date(new Date().setHours(8, 22, 0, 0)),
          symptoms: ["Flushing", "Light-headed"],
          severity: "mild",
          actionsTaken: ["Patient laid flat, legs raised"],
          infusionStopped: false,
          notes: "Settled within four minutes. Rate reduced for the remainder.",
          reportedBy: nurse._id,
          escalatedToDoctorId: doctor._id,
        },
      ],
      aftercareNotes: "Hydrate well today. Expect the lift within 24 hours.",
      amount: immune.priceInr,
      paymentStatus: "paid",
    },
    {
      bookingNo: "ND-4419",
      patientId: bhatt._id,
      dripId: jetlag._id,
      dripName: jetlag.name,
      scheduledAt: new Date(new Date().setHours(13, 30, 0, 0)),
      durationMin: 50,
      location: "home",
      address: "Ejipura, 12th cross",
      city: "Bengaluru",
      pincode: "560047",
      nurseId: nurse._id,
      doctorId: doctor._id,
      status: "nurse_assigned",
      approvedAt: days(-1),
      checklist,
      amount: jetlag.priceInr,
    },
    {
      bookingNo: "ND-4421",
      patientId: iyer._id,
      dripId: myers._id,
      dripName: myers.name,
      // On the slot grid (hourly), like any booking made through the app.
      scheduledAt: new Date(days(2).setHours(11, 0, 0, 0)),
      location: "clinic",
      city: "Bengaluru",
      pincode: "560103",
      nurseId: nurse2._id,
      clinicId: clinic._id,
      status: "awaiting_review",
      checklist,
      amount: myers.priceInr,
    },
  ]);

  /**
   * Built from the recipes rather than retyped, so every line carries the
   * product it is drawn from. A component that is only a name cannot be
   * checked against the shelf and cannot be found when a batch is recalled.
   *
   * B12 is then moved to an intramuscular injection, as a physician would: the
   * recipe says what is in the bag, the prescription says how it reaches the
   * patient, and the two are not the same decision.
   */
  const myersComponents = componentsFromRecipe(myers.ingredients).map((c) =>
    c.name.toLowerCase().includes("cyanocobalamin")
      ? { ...c, route: "IM Injection" as const, carrier: undefined }
      : c
  );
  const ironComponents = componentsFromRecipe(iron.ingredients);

  /**
   * A course is not the same drip on a metronome, and the demo dataset has to
   * say so — it is the whole reason a plan is written week by week rather than
   * generated. Riya's ferritin came back at 18 ng/mL on the lab report seeded
   * below, so the fatigue protocol runs for a fortnight and then steps across
   * to iron, with the reason written on the session the nurse will read.
   */
  const planWeeks = [1, 2, 3, 4].map((weekNum) => {
    const onIron = weekNum >= 3;
    const notes: Record<number, string> = {
      1: "Start at 140 ml/hr and titrate up if tolerated.",
      3: "Switching to iron on the back of the August ferritin. Test dose first, and stay for the full 30 minutes afterwards.",
    };
    return {
      weekNum,
      sessions: [
        {
          date: days(-7 + (weekNum - 1) * 7),
          dripId: onIron ? iron._id : myers._id,
          dripName: onIron ? iron.name : myers.name,
          sessionNotes: notes[weekNum] ?? "",
          components: onIron ? ironComponents : myersComponents,
        },
      ],
    };
  });

  await TreatmentPlan.create({
    patientId: riya._id,
    doctorId: doctor._id,
    nurseId: nurse._id,
    diagnosis: "Persistent fatigue with borderline B12 and magnesium markers",
    patientAge: "32",
    patientWeightKg: 58,
    patientHeightCm: 164,
    bloodGroup: "O+",
    startDate: days(-7),
    totalWeeks: 4,
    sharedWithNurse: true,
    status: "active",
    weeks: planWeeks,
  });

  await LabReport.create([
    {
      patientId: riya._id,
      fileName: "CBC-and-ferritin-Aug-2026.pdf",
      category: "Blood work",
      sizeBytes: 284_112,
      notes: "Ferritin 18 ng/mL — low end.",
      sharedWithDoctorId: doctor._id,
      uploadedAt: days(-5),
    },
    {
      patientId: riya._id,
      fileName: "Vitamin-D-25OH-Jul-2026.pdf",
      category: "Blood work",
      sizeBytes: 96_400,
      uploadedAt: days(-40),
    },
  ]);

  await Notification.create([
    {
      userId: doctor._id,
      title: "New assessment to review",
      body: "Vitality 48/100 · A. Bhatt",
      type: "warning",
      link: "/doctor",
      createdAt: days(-1),
    },
    {
      userId: nurse._id,
      title: "New session assigned · ND-4419",
      body: "A. Bhatt · Ejipura, 12th cross. The checklist is ready.",
      type: "info",
      link: "/nurse",
      createdAt: days(-1),
    },
    {
      userId: riya._id,
      title: "Your protocol was approved",
      body: "Emma Fernandes will attend your session.",
      type: "success",
      link: "/app",
      isRead: true,
      createdAt: days(-2),
    },
    {
      userId: clinic._id,
      title: "Order confirmed",
      body: "PO-2026-0112 · stock is reserved against it.",
      type: "success",
      link: "/clinic/orders",
      createdAt: days(-1),
    },
    {
      userId: users.superadmin._id,
      title: "7 batches expiring within 90 days",
      body: "VC-B7 has 12 days left. Use it first under FEFO.",
      type: "warning",
      link: "/admin/inventory/alerts",
      createdAt: days(0),
    },
  ]);

  await Lead.create([
    {
      kind: "clinic",
      name: "Dr. Meera Suresh",
      organisation: "Suresh Wellness, Jayanagar",
      email: "meera@sureshwellness.in",
      phone: "+919845551122",
      city: "Bengaluru",
      rooms: 2,
      monthlyVolume: 45,
      message: "We already run vitamin infusions but have no way to trace batches. That is the part we need.",
      status: "new",
    },
    {
      kind: "clinic",
      name: "Anand Rao",
      organisation: "Whitefield Family Practice",
      email: "anand@wffp.in",
      city: "Bengaluru",
      rooms: 1,
      monthlyVolume: 20,
      status: "contacted",
    },
    {
      // What the Ask a clinician form writes: the ticked topics and the best
      // time to call go into the message, in the shape composeConsultMessage
      // gives them.
      kind: "consult",
      name: "Priya Nair",
      phone: "+919845553344",
      pincode: "560034",
      message:
        "Topics: Energy, Immunity\nBest time to call: Evening\n\nI take thyroid tablets — is that a reason not to have a Myers' drip?",
      status: "new",
    },
  ]);

  // One draft in AI Studio, in Test, so the screen shows what a configuration
  // looks like. Nothing reads it: no model is called anywhere in the app.
  await AIModel.create({
    name: "Treatment recommendations (draft)",
    description: "First draft of the recommendation prompt. Not connected to anything yet.",
    model: "claude-sonnet-5",
    temperature: 0.2,
    maxTokens: 1024,
    systemPrompt:
      "You assist a registered physician reviewing a health quiz. Summarise the risks the answers point to and suggest which protocols to consider. You never diagnose and you never approve a protocol: the physician decides.",
    userPromptTemplate:
      "Patient aged {{age}}, {{gender}}. Quiz score {{quizScore}}. Reported: {{symptoms}}. Allergies: {{allergies}}.",
    status: "test",
  });

  await Order.create([
    {
      orderNo: "PO-2026-0112",
      patientRef: "HF-CL-0042",
      patientName: "S. Krishnan",
      clinicId: clinic._id,
      orderedBy: clinic._id,
      status: "DRAFT",
      includeKits: true,
      lines: [
        { dripId: myers._id, dripName: myers.name, quantity: 5, withKit: true, unitPrice: myers.priceInr },
        { dripId: immune._id, dripName: immune.name, quantity: 3, withKit: true, unitPrice: immune.priceInr },
      ],
      amount: myers.priceInr * 5 + immune.priceInr * 3,
      scheduledDelivery: days(3),
    },
    {
      orderNo: "PO-2026-0111",
      patientRef: "HF-CL-0039",
      clinicId: clinic._id,
      orderedBy: clinic._id,
      status: "DRAFT",
      includeKits: true,
      lines: [{ dripId: jetlag._id, dripName: jetlag.name, quantity: 4, withKit: true, unitPrice: jetlag.priceInr }],
      amount: jetlag.priceInr * 4,
      scheduledDelivery: days(1),
    },
  ]);

  /**
   * One order that has actually been supplied.
   *
   * Without it nothing downstream of dispatch can be seen at all — the batch
   * numbers a clinic keeps for a recall, the consumption ledger, and the tax
   * invoice all begin the moment stock leaves the shelf. And dispatch itself
   * cannot be run here to produce one: it is transactional, so it needs a
   * replica set, and a developer's standalone mongod has none.
   *
   * So the ledger is written the way dispatch writes it, from the same FEFO
   * planner — the lots below are the ones the real code would have drawn, not
   * a plausible-looking invention, and the stock they came from is decremented
   * so the shelf still adds up afterwards.
   */
  const [supplied] = await Order.create([
    {
      orderNo: "PO-2026-0110",
      patientRef: "HF-CL-0037",
      clinicId: clinic._id,
      orderedBy: clinic._id,
      status: "DISPATCHED",
      includeKits: true,
      lines: [
        { dripId: myers._id, dripName: myers.name, quantity: 2, withKit: true, unitPrice: myers.priceInr },
        { dripId: immune._id, dripName: immune.name, quantity: 1, withKit: true, unitPrice: immune.priceInr },
      ],
      amount: myers.priceInr * 2 + immune.priceInr,
      confirmedAt: days(-6),
      dispatchedAt: days(-5),
    },
  ]);

  /**
   * And one that is confirmed but not yet gone.
   *
   * The clinic's order page has a "Reserved for you" table, and the invoice
   * refuses with "stock is reserved but has not left the pharmacy" — neither
   * could be seen, because no seeded order ever sat at CONFIRMED. Confirm is
   * transactional for the same reason dispatch is, so the reservation is
   * written here the way confirm writes it: units counted against the same
   * FEFO plan, and qtyReserved raised so they stop counting as available
   * without leaving the shelf.
   */
  const [reserved] = await Order.create([
    {
      orderNo: "PO-2026-0113",
      patientRef: "HF-CL-0041",
      clinicId: clinic._id,
      orderedBy: clinic._id,
      status: "CONFIRMED",
      includeKits: true,
      lines: [
        { dripId: immune._id, dripName: immune.name, quantity: 2, withKit: true, unitPrice: immune.priceInr },
      ],
      amount: immune.priceInr * 2,
      confirmedAt: days(-1),
      scheduledDelivery: days(2),
    },
  ]);

  for (const draw of (await planAllocation(String(reserved._id))).draws) {
    await BatchLot.updateOne({ _id: draw.lotId }, { $inc: { qtyReserved: draw.units } });
    await Allocation.create({
      orderId: reserved._id,
      lotId: draw.lotId,
      masterId: draw.masterId,
      unitsReserved: draw.units,
    });
  }

  const plan = await planAllocation(String(supplied._id));
  for (const draw of plan.draws) {
    const lot = await BatchLot.findById(draw.lotId);
    if (!lot) continue;
    lot.qtyOnHand = Math.max(0, lot.qtyOnHand - draw.units);
    await lot.save();

    await Consumption.create({
      orderId: supplied._id,
      lotId: draw.lotId,
      masterId: draw.masterId,
      batchNo: draw.batchNo,
      drugName: draw.drugName,
      unitsConsumed: draw.units,
      activeUsed: Math.round(draw.activeUsed * 100) / 100,
      wasted: Math.round(draw.wasted * 100) / 100,
      contentUnit: draw.contentUnit,
      dispatchedAt: days(-5),
      dispatchedBy: admin._id,
    });

    await StockTxn.create({
      type: "CONSUME",
      lotId: draw.lotId,
      masterId: draw.masterId,
      delta: -draw.units,
      balanceAfter: lot.qtyOnHand,
      orderId: supplied._id,
      reason: `Dispatched on ${supplied.orderNo}`,
      actorId: admin._id,
    });
  }
}

async function main() {
  await connectDB();

  /**
   * Say which database is about to be emptied, before emptying it.
   *
   * MONGODB_URI often points at another machine on the LAN rather than
   * localhost, and this script deletes every collection it finds. Naming the
   * host and database first means pointing at the wrong one is visible in the
   * terminal rather than discovered afterwards.
   */
  const target = (() => {
    try {
      const u = new URL((process.env.MONGODB_URI ?? "").replace(/^mongodb(\+srv)?:\/\//, "http://"));
      return `${u.hostname}:${u.port || "27017"}/${u.pathname.slice(1) || "?"}`;
    } catch {
      return "(unreadable MONGODB_URI)";
    }
  })();
  console.log(`Connected to ${target}`);
  console.log("Clearing existing data…");
  await wipe();

  console.log("Seeding users…");
  const users = await seedUsers();

  console.log("Seeding inventory…");
  const { byKey, kit } = await seedInventory();

  console.log("Seeding drips…");
  const drips = await seedDrips(
    byKey as Map<string, { _id: unknown; name: string }>,
    kit._id,
    users.superadmin._id
  );

  console.log("Seeding service zones…");
  // On an empty database the unique indexes (name, pincode) do not exist yet;
  // build them first so the launch zones go in under the same rules as edits.
  await Zone.init();
  await Zone.insertMany(
    ZONE_DEFAULTS.map(({ name, pincodes, opensAt, closesAt, slotMinutes, status }, position) => ({ name, pincodes, opensAt, closesAt, slotMinutes, status, position }))
  );
  console.log(`  ${ZONE_DEFAULTS.length} zones — editable at /admin/zones`);

  console.log("Seeding the questionnaire…");
  const questionCount = await seedQuizQuestions(true);
  console.log(`  ${questionCount} questions — editable at /admin/quiz`);

  console.log("Seeding clinical records…");
  await seedClinical(users, drips);

  console.log("\nDone. Sign in with:");
  // Said here rather than left to be discovered: GST is off on a fresh
  // database on purpose, because there is no GSTIN to seed that would not be
  // a fabricated registration number.
  console.log("\nGST is off. Clinics download a bill of supply until a real GSTIN");
  console.log("is entered at /admin/billing — nothing here invents one.\n");

  console.table([
    { role: "superadmin", email: "admin@nutridrip.com", password: "admin123" },
    { role: "admin", email: "ops@nutridrip.com", password: "admin123" },
    { role: "doctor", email: "dr.sarah@nutridrip.com", password: "doctor123" },
    { role: "nurse", email: "nurse.emma@nutridrip.com", password: "nurse123" },
    { role: "clinic", email: "clinic@healthfirst.com", password: "clinic123" },
    { role: "patient", email: "patient@example.com", password: "patient123" },
  ]);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});

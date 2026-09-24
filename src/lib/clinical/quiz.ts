import type { NutrientGroup } from "@/lib/models/types";
import { visibleQuestions } from "./quiz-rules";

export type QuizOption = {
  value: string;
  label: string;
  /** 0–100. Higher is better; it raises the markers this question feeds. */
  score: number;
  /**
   * Multiple choice only: an answer that stands alone, like "None of these".
   * Ticking it clears the others, and ticking another clears it.
   */
  exclusive?: boolean;
};

export type QuizType = "single" | "multi" | "text" | "number";

/**
 * How a condition compares an earlier answer. Which of these a condition may use
 * depends on the type of the question it looks at -- see OPS_FOR_TYPE.
 */
export type CondOp = "is" | "isNot" | "answered" | "gt" | "gte" | "lt" | "lte";

export type Condition = {
  /** The earlier question this looks at. */
  qid: string;
  op: CondOp;
  /** For "is" / "isNot": the answers that count. */
  values?: string[];
  /** For the number comparisons. */
  value?: number;
};

/** "Show this question only when…" -- all of the conditions, or any one of them. */
export type ShowIf = { match: "all" | "any"; conditions: Condition[] };

export type QuizQuestion = {
  id: string;
  section: string;
  question: string;
  help?: string;
  type: QuizType;
  options?: QuizOption[];
  /** Markers this answer moves, and how strongly (0–1). Choice questions only. */
  affects: Partial<Record<string, number>>;
  optional?: boolean;
  /** Answering this way is a hard stop a physician must see. */
  contraindicationIf?: string[];
  /** Number questions: the range a real answer falls in, and what it is counted in. */
  min?: number;
  max?: number;
  unit?: string;
  /** Number questions: whether 7.5 is an answer, or only 7 and 8. */
  decimals?: boolean;
  /** Absent: everybody is asked. Present: only patients whose earlier answers match. */
  showIf?: ShowIf;
  /** Only the editor sees retired questions, and needs to know they are retired. */
  isActive?: boolean;
};

/** The sixteen markers the results screen reports, in their display groups. */
export const MARKERS: Array<{ name: string; group: NutrientGroup }> = [
  { name: "Vitamin C", group: "Vitamins" },
  { name: "Vitamin D", group: "Vitamins" },
  { name: "Vitamin B12", group: "Vitamins" },
  { name: "Folate", group: "Vitamins" },
  { name: "Magnesium", group: "Minerals" },
  { name: "Zinc", group: "Minerals" },
  { name: "Iron", group: "Minerals" },
  { name: "Selenium", group: "Minerals" },
  { name: "Glutathione", group: "Amino acids" },
  { name: "Taurine", group: "Amino acids" },
  { name: "Electrolyte balance", group: "Hydration" },
  { name: "B-complex load", group: "Metabolic" },
  { name: "L-carnitine", group: "Metabolic" },
  { name: "Alpha-lipoic acid", group: "Antioxidants" },
  { name: "Vitamin A", group: "Immunity" },
  { name: "Copper", group: "Immunity" },
];

const scale = (labels: Array<[string, number]>): QuizOption[] =>
  labels.map(([label, score]) => ({ value: label, label, score }));

/**
 * Sixteen scored questions across five sections, plus the screening questions
 * a physician needs. Three minutes is the target, so nothing here is optional
 * that could be inferred.
 */
export const QUESTIONS: QuizQuestion[] = [
  /* ---------------- Sleep & energy ---------------- */
  {
    id: "wake-tired",
    section: "Sleep & energy",
    question: "In the last two weeks, how often did you wake up still tired?",
    type: "single",
    options: scale([
      ["Never", 100],
      ["Once or twice", 75],
      ["Most weekdays", 40],
      ["Every single day", 10],
      ["I'd rather not say", 50],
    ]),
    affects: { "Vitamin B12": 1, "B-complex load": 0.8, Magnesium: 0.6, "L-carnitine": 0.5 },
  },
  {
    id: "afternoon-crash",
    section: "Sleep & energy",
    question: "Do you get an afternoon energy crash?",
    type: "single",
    options: scale([
      ["Never", 100],
      ["Occasionally", 70],
      ["Most days", 35],
      ["Every day", 10],
    ]),
    affects: { "L-carnitine": 1, "B-complex load": 0.7, Iron: 0.5 },
  },
  {
    id: "sleep-hours",
    section: "Sleep & energy",
    question: "How many hours do you usually sleep?",
    type: "single",
    options: scale([
      ["Under 5", 15],
      ["5–6", 40],
      ["6–7", 70],
      ["7–8", 95],
      ["Over 8", 80],
    ]),
    affects: { Magnesium: 1, Glutathione: 0.6, "Vitamin D": 0.3 },
  },

  /* ---------------- Diet & hydration ---------------- */
  {
    id: "water",
    section: "Diet & hydration",
    question: "Roughly how much water do you drink a day?",
    type: "single",
    options: scale([
      ["Under 1 L", 15],
      ["1–2 L", 45],
      ["2–3 L", 85],
      ["Over 3 L", 95],
    ]),
    affects: { "Electrolyte balance": 1, Magnesium: 0.4 },
  },
  {
    id: "vegetables",
    section: "Diet & hydration",
    question: "How many portions of vegetables or fruit on a normal day?",
    type: "single",
    options: scale([
      ["None", 10],
      ["One or two", 40],
      ["Three or four", 75],
      ["Five or more", 95],
    ]),
    affects: { "Vitamin C": 1, Folate: 0.9, "Vitamin A": 0.8, "Alpha-lipoic acid": 0.5 },
  },
  {
    id: "red-meat",
    section: "Diet & hydration",
    question: "How often do you eat red meat, fish or eggs?",
    type: "single",
    options: scale([
      ["Never — I'm vegan", 20],
      ["Rarely", 40],
      ["A few times a week", 80],
      ["Most days", 95],
    ]),
    affects: { Iron: 1, "Vitamin B12": 0.9, Zinc: 0.7, Taurine: 0.8, Copper: 0.5 },
  },
  {
    id: "processed",
    section: "Diet & hydration",
    question: "How much of what you eat is processed or takeaway?",
    type: "single",
    options: scale([
      ["Almost none", 95],
      ["About a quarter", 75],
      ["About half", 45],
      ["Most of it", 15],
    ]),
    affects: { Selenium: 0.8, Zinc: 0.6, Folate: 0.6, "Alpha-lipoic acid": 0.5 },
  },

  /* ---------------- Lifestyle ---------------- */
  {
    id: "sunlight",
    section: "Lifestyle",
    question: "How much time do you spend outdoors in daylight?",
    type: "single",
    options: scale([
      ["Almost none", 10],
      ["Under 30 minutes", 35],
      ["30–60 minutes", 70],
      ["Over an hour", 95],
    ]),
    affects: { "Vitamin D": 1 },
  },
  {
    id: "exercise",
    section: "Lifestyle",
    question: "How often do you exercise hard enough to sweat?",
    type: "single",
    options: scale([
      ["Never", 20],
      ["Once a week", 50],
      ["Two or three times", 80],
      ["Four or more", 95],
    ]),
    affects: { "L-carnitine": 0.8, Taurine: 0.7, "Electrolyte balance": 0.6, Magnesium: 0.5 },
  },
  {
    id: "stress",
    section: "Lifestyle",
    question: "How would you describe your stress over the last month?",
    type: "single",
    options: scale([
      ["Low", 95],
      ["Manageable", 75],
      ["High", 35],
      ["Overwhelming", 10],
    ]),
    affects: { Magnesium: 1, "Vitamin C": 0.7, Glutathione: 0.8, "B-complex load": 0.6 },
  },
  {
    id: "alcohol",
    section: "Lifestyle",
    question: "How much alcohol in a normal week?",
    type: "single",
    options: scale([
      ["None", 95],
      ["One or two drinks", 80],
      ["Three to six", 50],
      ["Seven or more", 20],
    ]),
    affects: { Glutathione: 1, "B-complex load": 0.8, Folate: 0.7, Magnesium: 0.5 },
  },
  {
    id: "smoking",
    section: "Lifestyle",
    question: "Do you smoke or vape?",
    type: "single",
    options: scale([
      ["No, never", 95],
      ["I used to", 70],
      ["Occasionally", 40],
      ["Daily", 15],
    ]),
    affects: { "Vitamin C": 1, Glutathione: 0.9, "Alpha-lipoic acid": 0.7, "Vitamin A": 0.5 },
  },

  /* ---------------- How you feel ---------------- */
  {
    id: "infections",
    section: "How you feel",
    question: "How often have you been ill in the last six months?",
    type: "single",
    options: scale([
      ["Not once", 95],
      ["Once", 75],
      ["Two or three times", 40],
      ["More than three", 15],
    ]),
    affects: { Zinc: 1, "Vitamin C": 0.8, "Vitamin D": 0.7, Selenium: 0.6, Copper: 0.5 },
  },
  {
    id: "skin-hair",
    section: "How you feel",
    question: "How is your skin and hair at the moment?",
    type: "single",
    options: scale([
      ["Good", 90],
      ["A bit dull", 65],
      ["Noticeably worse than usual", 35],
      ["A real problem", 15],
    ]),
    affects: { Glutathione: 1, "Vitamin A": 0.8, Zinc: 0.7, "Vitamin C": 0.5 },
  },
  {
    id: "concentration",
    section: "How you feel",
    question: "How is your concentration?",
    type: "single",
    options: scale([
      ["Sharp", 95],
      ["Fine most of the time", 75],
      ["Foggy some days", 40],
      ["Foggy most days", 15],
    ]),
    affects: { "Vitamin B12": 1, Folate: 0.8, Iron: 0.7, Taurine: 0.5 },
  },
  {
    id: "breathless",
    section: "How you feel",
    question: "Do you get breathless on stairs you used to manage easily?",
    type: "single",
    options: scale([
      ["No", 95],
      ["Sometimes", 55],
      ["Often", 25],
      ["Always", 10],
    ]),
    affects: { Iron: 1, "Vitamin B12": 0.6, Copper: 0.4 },
  },

  /* ---------------- Screening — not scored ---------------- */
  {
    id: "pregnancy",
    section: "Screening",
    question: "Are you pregnant, breastfeeding, or trying to conceive?",
    help: "IV therapy is not suitable during pregnancy. A physician will decline if so.",
    type: "single",
    options: [
      { value: "No", label: "No", score: 0 },
      { value: "Yes", label: "Yes", score: 0 },
      { value: "Prefer not to say", label: "Prefer not to say", score: 0 },
    ],
    affects: {},
    contraindicationIf: ["Yes"],
  },
  {
    id: "kidney-heart",
    section: "Screening",
    question: "Have you been told you have kidney or heart disease?",
    help: "Fluid load matters. A physician needs to know before approving anything.",
    type: "single",
    options: [
      { value: "No", label: "No", score: 0 },
      { value: "Yes", label: "Yes", score: 0 },
      { value: "Not sure", label: "Not sure", score: 0 },
    ],
    affects: {},
    contraindicationIf: ["Yes"],
  },
  {
    id: "allergies",
    section: "Screening",
    question: "Any drug allergies?",
    help: "Write them exactly as you were told. This is the field a nurse reads aloud.",
    type: "text",
    affects: {},
  },
  {
    id: "medications",
    section: "Screening",
    question: "What medication are you taking?",
    help: "Including anything over the counter or herbal.",
    type: "text",
    affects: {},
    optional: true,
  },
  {
    id: "conditions",
    section: "Screening",
    question: "Any ongoing conditions we should know about?",
    type: "text",
    affects: {},
    optional: true,
  },
];

export const SECTIONS = [...new Set(QUESTIONS.map((q) => q.section))];

/** A choice or typed answer is one string; a multiple-choice answer is the list ticked. */
export type Answer = string | string[];
export type Answers = Record<string, Answer | undefined>;

export type ScoredQuiz = {
  vitalityScore: number;
  nutrientRisks: Array<{ name: string; group: NutrientGroup; pct: number }>;
  categoryScores: Record<string, number>;
  contraindications: string[];
};

/**
 * The score one question contributes, or null when it contributes nothing.
 *
 * A multiple-choice answer scores as the LOWEST option ticked. An average would
 * let a patient improve their result by ticking one more mild symptom next to a
 * serious one; the lowest cannot go up by ticking more, which is the only
 * direction a screening answer should ever move.
 */
export function answerScore(q: QuizQuestion, raw: Answer | undefined): number | null {
  if (q.type !== "single" && q.type !== "multi") return null;
  const picked = (Array.isArray(raw) ? raw : raw ? [raw] : [])
    .map((v) => q.options?.find((o) => o.value === v))
    .filter((o): o is QuizOption => Boolean(o));
  if (picked.length === 0) return null;
  return Math.min(...picked.map((o) => o.score));
}

/**
 * Each marker is a weighted average of the answers that feed it. An unanswered
 * question contributes nothing rather than counting as a zero, so a partially
 * finished quiz is not punished for the questions it has not reached.
 *
 * Only the questions this patient was actually shown are counted. An answer to a
 * question their other answers hid -- one given, then made irrelevant by going
 * back and changing an earlier answer -- is not evidence of anything.
 */
export function scoreQuiz(answers: Answers, questions: QuizQuestion[] = QUESTIONS): ScoredQuiz {
  const totals = new Map<string, { sum: number; weight: number }>();

  const contraindications: string[] = [];

  for (const q of visibleQuestions(questions, answers)) {
    const raw = answers[q.id];
    if (raw === undefined || raw === "" || (Array.isArray(raw) && raw.length === 0)) continue;

    const picked = Array.isArray(raw) ? raw : [raw];
    if (picked.some((v) => q.contraindicationIf?.includes(v))) {
      contraindications.push(q.question);
    }

    const score = answerScore(q, raw);
    if (score === null) continue;

    for (const [marker, weight] of Object.entries(q.affects)) {
      const cur = totals.get(marker) ?? { sum: 0, weight: 0 };
      cur.sum += score * (weight ?? 0);
      cur.weight += weight ?? 0;
      totals.set(marker, cur);
    }
  }

  const nutrientRisks = MARKERS.map(({ name, group }) => {
    const t = totals.get(name);
    // A marker nothing has spoken to sits mid-band rather than pretending to know.
    const pct = t && t.weight > 0 ? Math.round(t.sum / t.weight) : 50;
    return { name, group, pct: Math.max(0, Math.min(100, pct)) };
  });

  const byGroup = new Map<string, number[]>();
  for (const r of nutrientRisks) {
    byGroup.set(r.group, [...(byGroup.get(r.group) ?? []), r.pct]);
  }
  const categoryScores = Object.fromEntries(
    [...byGroup].map(([g, vals]) => [g, Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)])
  );

  const vitalityScore = Math.round(
    nutrientRisks.reduce((s, r) => s + r.pct, 0) / nutrientRisks.length
  );

  return { vitalityScore, nutrientRisks, categoryScores, contraindications };
}

/** The drips whose active ingredients target the weakest markers. */
export const DRIP_FOR_MARKER: Record<string, string[]> = {
  "Vitamin C": ["immune-shield", "myers-revive"],
  "Vitamin D": ["myers-revive"],
  "Vitamin B12": ["deep-recharge", "myers-revive"],
  Folate: ["myers-revive"],
  Magnesium: ["myers-revive", "athletic-recovery"],
  Zinc: ["immune-shield"],
  Iron: ["iron-restore"],
  Selenium: ["immune-shield"],
  Glutathione: ["glow-protocol"],
  Taurine: ["athletic-recovery", "deep-recharge"],
  "Electrolyte balance": ["hydrate-plus", "jetlag-reset"],
  "B-complex load": ["myers-revive", "deep-recharge"],
  "L-carnitine": ["deep-recharge", "athletic-recovery"],
  "Alpha-lipoic acid": ["post-viral-rebuild"],
  "Vitamin A": ["immune-shield"],
  Copper: ["immune-shield"],
};

export function suggestDripSlugs(risks: Array<{ name: string; pct: number }>, limit = 2): string[] {
  const weakest = [...risks].sort((a, b) => a.pct - b.pct).slice(0, 5);
  const votes = new Map<string, number>();

  weakest.forEach((r, i) => {
    for (const slug of DRIP_FOR_MARKER[r.name] ?? []) {
      // Earlier (weaker) markers carry more weight.
      votes.set(slug, (votes.get(slug) ?? 0) + (5 - i));
    }
  });

  return [...votes]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([slug]) => slug);
}

import { connectDB } from "@/lib/db/mongoose";
import { QuizQuestion } from "@/lib/models";
import { QUESTIONS, type QuizQuestion as QuizQuestionDef, type ShowIf } from "./quiz";
import { groupBySection, tidyShowIf } from "./quiz-rules";

/**
 * The questionnaire is edited in the database, but the bundled defaults in
 * `quiz.ts` stay the safety net: an empty collection seeds itself, and any
 * failure serves the defaults rather than showing a patient a blank quiz.
 */

type LeanQuestion = {
  qid: string;
  section: string;
  order: number;
  question: string;
  help?: string;
  type: "single" | "multi" | "text" | "number";
  options: Array<{ value: string; label: string; score: number; order: number; exclusive?: boolean }>;
  affects: Map<string, number> | Record<string, number>;
  optional?: boolean;
  contraindicationIf?: string[];
  min?: number | null;
  max?: number | null;
  unit?: string | null;
  decimals?: boolean;
  showIf?: ShowIf | null;
  isActive: boolean;
};

function toDef(q: LeanQuestion): QuizQuestionDef {
  const affects =
    q.affects instanceof Map ? Object.fromEntries(q.affects) : (q.affects ?? {});
  return {
    id: q.qid,
    section: q.section,
    question: q.question,
    help: q.help,
    type: q.type,
    options: [...(q.options ?? [])]
      .sort((a, b) => a.order - b.order)
      .map(({ value, label, score, exclusive }) => ({ value, label, score, ...(exclusive ? { exclusive: true } : {}) })),
    affects,
    optional: q.optional,
    contraindicationIf: q.contraindicationIf?.length ? q.contraindicationIf : undefined,
    // Only what is set, so the props sent to the browser stay plain and small.
    ...(typeof q.min === "number" ? { min: q.min } : {}),
    ...(typeof q.max === "number" ? { max: q.max } : {}),
    ...(q.unit ? { unit: q.unit } : {}),
    ...(q.decimals ? { decimals: true } : {}),
    ...(tidyShowIf(q.showIf) ? { showIf: tidyShowIf(q.showIf) } : {}),
    isActive: q.isActive !== false,
  };
}

/**
 * Store the order the editor and the patient both see: sections in the order
 * they first appear, questions within them in their own order. Only the rows
 * whose position actually changed are written.
 */
export async function applyOrder(qidsInOrder: string[]): Promise<number> {
  await connectDB();
  const current = await QuizQuestion.find({}).select("qid order").lean<Array<{ qid: string; order: number }>>();
  const was = new Map(current.map((r) => [r.qid, r.order]));
  const writes = qidsInOrder
    .map((qid, order) => ({ qid, order }))
    .filter(({ qid, order }) => was.get(qid) !== order)
    .map(({ qid, order }) => ({ updateOne: { filter: { qid }, update: { $set: { order } } } }));
  if (writes.length) await QuizQuestion.bulkWrite(writes);
  return writes.length;
}

/** The whole questionnaire in its stored order, grouped as the editor shows it. */
export function orderedIds(questions: QuizQuestionDef[]): string[] {
  return groupBySection(questions).map((q) => q.id);
}

/** Writes the bundled defaults in, once, so the database becomes the source. */
export async function seedQuizQuestions(force = false): Promise<number> {
  await connectDB();
  const existing = await QuizQuestion.countDocuments();
  if (existing > 0 && !force) return existing;
  if (force) await QuizQuestion.deleteMany({});

  await QuizQuestion.insertMany(
    QUESTIONS.map((q, i) => ({
      qid: q.id,
      section: q.section,
      order: i,
      question: q.question,
      help: q.help,
      type: q.type,
      options: (q.options ?? []).map((o, n) => ({ ...o, order: n })),
      affects: q.affects,
      optional: q.optional ?? false,
      contraindicationIf: q.contraindicationIf ?? [],
      isActive: true,
    }))
  );
  return QUESTIONS.length;
}

/**
 * The live questionnaire. Patients get active questions only; the editor asks
 * for all of them.
 */
export async function loadQuestions(includeInactive = false): Promise<QuizQuestionDef[]> {
  try {
    await connectDB();

    if ((await QuizQuestion.countDocuments()) === 0) {
      await seedQuizQuestions().catch(() => {});
    }

    const rows = await QuizQuestion.find(includeInactive ? {} : { isActive: true })
      .sort({ order: 1 })
      .lean<LeanQuestion[]>();

    if (rows.length === 0) throw new Error("no questions");
    return rows.map(toDef);
  } catch (err) {
    // Never leave a patient staring at an empty quiz because of a bad edit.
    console.error("loadQuestions() fell back to bundled defaults:", err);
    return QUESTIONS;
  }
}

/** One question by its answer key, for scoring a submission. */
export async function loadQuestionMap(): Promise<Map<string, QuizQuestionDef>> {
  const list = await loadQuestions(false);
  return new Map(list.map((q) => [q.id, q]));
}

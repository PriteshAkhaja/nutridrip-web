import { connectDB } from "@/lib/db/mongoose";
import { QuizQuestion } from "@/lib/models";
import { QUESTIONS, type QuizQuestion as QuizQuestionDef } from "./quiz";

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
  options: Array<{ value: string; label: string; score: number; order: number }>;
  affects: Map<string, number> | Record<string, number>;
  optional?: boolean;
  contraindicationIf?: string[];
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
      .map(({ value, label, score }) => ({ value, label, score })),
    affects,
    optional: q.optional,
    contraindicationIf: q.contraindicationIf?.length ? q.contraindicationIf : undefined,
  };
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

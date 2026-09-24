import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, QuizQuestion } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { applyOrder, loadQuestions, orderedIds, seedQuizQuestions } from "@/lib/clinical/quiz-store";
import { MARKERS, type QuizQuestion as QuestionDef } from "@/lib/clinical/quiz";
import { describeShowIf, groupBySection, newProblems, tidyShowIf } from "@/lib/clinical/quiz-rules";
import { ok, fail, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

const MARKER_NAMES = MARKERS.map((m) => m.name);

const UpsertQuestion = z.object({
  qid: z.string().regex(/^[a-z0-9-]+$/i, "Use letters, numbers and hyphens only").max(40),
  section: z.string().min(1).max(60),
  order: z.number().int().min(0).max(500).optional(),
  question: z.string().min(1).max(300),
  help: z.string().max(300).optional(),
  type: z.enum(["single", "multi", "text", "number"]).default("single"),
  options: z
    .array(
      z.object({
        value: z.string().min(1).max(80),
        label: z.string().min(1).max(120),
        score: z.number().min(0).max(100),
        exclusive: z.boolean().optional(),
      })
    )
    .default([]),
  affects: z.record(z.string(), z.number().min(0).max(1)).default({}),
  optional: z.boolean().default(false),
  contraindicationIf: z.array(z.string().max(80)).default([]),
  min: z.number().nullable().optional(),
  max: z.number().nullable().optional(),
  unit: z.string().max(20).optional(),
  decimals: z.boolean().optional(),
  showIf: z
    .object({
      match: z.enum(["all", "any"]),
      conditions: z
        .array(
          z.object({
            qid: z.string().max(40),
            op: z.enum(["is", "isNot", "answered", "gt", "gte", "lt", "lte"]),
            values: z.array(z.string().max(80)).max(30).optional(),
            value: z.number().nullable().optional(),
          })
        )
        .max(10, "Ten conditions at most on one question"),
    })
    .nullable()
    .optional(),
  isActive: z.boolean().default(true),
  /**
   * True when the editor is adding a question. Save is an upsert on the key, so
   * without this a new question given an existing key would silently replace
   * that question and everything it had.
   */
  create: z.boolean().optional(),
});

/** A question as the audit trail should remember it: what a person would read. */
const summary = (q: QuestionDef | undefined, byId: Map<string, QuestionDef>) =>
  q
    ? {
        question: q.question,
        section: q.section,
        type: q.type,
        live: q.isActive !== false,
        ...(q.options?.length ? { options: q.options.map((o) => `${o.label} (${o.score})`).join(", ") } : {}),
        ...(q.type === "number"
          ? { range: `${q.min ?? ""}–${q.max ?? ""}${q.unit ? ` ${q.unit}` : ""}` }
          : {}),
        askedWhen: describeShowIf(q, byId) ?? "always",
      }
    : undefined;

export async function GET() {
  try {
    const session = await getSession();
    if (!can(session?.role, "quiz.review")) return fail("Not permitted", 403);
    // Editors see inactive questions too.
    return ok({ questions: await loadQuestions(true), markers: MARKER_NAMES });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "quiz.manage")) return fail("Not permitted", 403);

    const body = await req.json();

    // A one-shot restore, for when an edit has gone badly wrong.
    if (body?.reset === true) {
      const n = await seedQuizQuestions(true);
      await AuditLog.create({
        actorId: session!.sub,
        actorRole: session!.role,
        action: "quiz.reset",
        entity: "QuizQuestion",
        after: { restored: n },
      });
      return ok({ reset: true, questions: n });
    }

    const parsed = UpsertQuestion.parse(body);
    // Spaces at either end of an answer are typing, not meaning -- "Tired " and
    // "Tired" must be one answer, or a rule on one never matches the other.
    const input = {
      ...parsed,
      options: parsed.options.map((o) => ({ ...o, value: o.value.trim(), label: o.label.trim() })),
      contraindicationIf: parsed.contraindicationIf.map((v) => v.trim()),
    };
    const choice = input.type === "single" || input.type === "multi";
    if (choice && input.options.some((o) => !o.label)) {
      return fail("Every answer needs some text", 422);
    }

    for (const marker of Object.keys(input.affects)) {
      if (!MARKER_NAMES.includes(marker)) {
        return fail(`"${marker}" is not one of the sixteen markers`, 422);
      }
    }
    if (choice && input.options.length < 2) {
      return fail(
        `A ${input.type === "multi" ? "multiple-choice" : "single-choice"} question needs at least two answers to choose from`,
        422
      );
    }
    const values = input.options.map((o) => o.value);
    if (new Set(values).size !== values.length) {
      return fail("Two options share the same value — the answer would be ambiguous", 422);
    }
    if (input.type === "multi" && input.options.every((o) => o.exclusive)) {
      return fail("Every answer is marked \"only this\", so nobody could tick more than one", 422);
    }
    if (choice && input.contraindicationIf.some((v) => !values.includes(v))) {
      return fail("A screening answer is not one of this question\u2019s answers", 422);
    }
    if (
      input.type === "number" &&
      typeof input.min === "number" &&
      typeof input.max === "number" &&
      input.min >= input.max
    ) {
      return fail("The lowest answer must be below the highest", 422);
    }

    // Each type keeps only what it uses. A number or free-text answer is not
    // scored, so it moves no marker and cannot be a screening answer -- keeping
    // those fields would show an editor settings that silently do nothing.
    const clean = {
      qid: input.qid,
      section: input.section.trim(),
      question: input.question.trim(),
      help: input.help?.trim() || undefined,
      type: input.type,
      options: choice
        ? input.options.map((o, i) => ({ ...o, exclusive: input.type === "multi" && Boolean(o.exclusive), order: i }))
        : [],
      affects: choice ? input.affects : {},
      optional: input.optional,
      contraindicationIf: choice ? input.contraindicationIf : [],
      min: input.type === "number" && typeof input.min === "number" ? input.min : undefined,
      max: input.type === "number" && typeof input.max === "number" ? input.max : undefined,
      unit: input.type === "number" ? input.unit?.trim() || undefined : undefined,
      decimals: input.type === "number" ? Boolean(input.decimals) : false,
      showIf: tidyShowIf(
        input.showIf
          ? {
              match: input.showIf.match,
              conditions: input.showIf.conditions.map((c) => ({
                qid: c.qid,
                op: c.op,
                values: c.values?.map((v) => v.trim()),
                value: typeof c.value === "number" ? c.value : undefined,
              })),
            }
          : undefined
      ),
      isActive: input.isActive,
    };

    // The questionnaire as it would stand after this save, in the order a patient
    // meets it. Every rule is checked against that, and anything this change
    // would break is refused with the reason -- before a patient can meet it.
    const before = await loadQuestions(true);
    const existingDef = before.find((q) => q.id === clean.qid);
    if (input.create && existingDef) {
      return fail(`The key "${clean.qid}" is already used by “${existingDef.question}”. Choose another.`, 409);
    }
    const asDef: QuestionDef = {
      id: clean.qid,
      section: clean.section,
      question: clean.question,
      help: clean.help,
      type: clean.type,
      options: clean.options.map(({ value, label, score, exclusive }) => ({
        value,
        label,
        score,
        ...(exclusive ? { exclusive } : {}),
      })),
      affects: clean.affects,
      optional: clean.optional,
      contraindicationIf: clean.contraindicationIf,
      min: clean.min,
      max: clean.max,
      unit: clean.unit,
      decimals: clean.decimals,
      showIf: clean.showIf,
      isActive: clean.isActive,
    };
    const after = groupBySection(
      existingDef ? before.map((q) => (q.id === clean.qid ? asDef : q)) : [...before, asDef]
    );
    const broken = newProblems(before, after);
    if (broken.length) return fail(broken[0], 409, { problems: broken });

    await connectDB();
    const existing = await QuizQuestion.findOne({ qid: clean.qid });

    // What this type does not use is REMOVED, not left behind -- an old range or
    // rule on a question that no longer has one would come back to life later.
    const unset: Record<string, 1> = {};
    for (const key of ["min", "max", "unit", "showIf", "help"] as const) {
      if (clean[key] === undefined) unset[key] = 1;
    }
    const set = Object.fromEntries(Object.entries(clean).filter(([, v]) => v !== undefined));

    await QuizQuestion.findOneAndUpdate(
      { qid: clean.qid },
      { $set: { ...set, updatedBy: session!.sub }, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { upsert: true, new: true }
    );

    // A running dev server keeps the model it compiled at start-up, and a model
    // that predates a field silently drops it on save. Read the row back so a
    // rule or a range that did not stick is an error, never a quiet loss.
    const saved = await QuizQuestion.findOne({ qid: clean.qid }).lean<{
      showIf?: { conditions?: unknown[] } | null;
      min?: number;
      unit?: string;
    } | null>();
    const lost =
      (clean.showIf !== undefined && !(saved?.showIf?.conditions?.length)) ||
      (clean.min !== undefined && saved?.min !== clean.min) ||
      (clean.unit !== undefined && saved?.unit !== clean.unit);
    if (lost) {
      return fail(
        "The question was saved, but its rule or number range was not. The server is running an older copy of the questionnaire — restart it (stop it and run npm run dev again), then save once more.",
        500
      );
    }

    // Keep the stored order the same as the editor's, so a new question in an
    // early section is asked there, not after the last section.
    await applyOrder(orderedIds(after));

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: existing ? "quiz.question.update" : "quiz.question.create",
      entity: "QuizQuestion",
      entityId: clean.qid,
      before: summary(existingDef, new Map(before.map((q) => [q.id, q]))),
      after: summary(asDef, new Map(after.map((q) => [q.id, q]))),
    });

    return ok({ qid: clean.qid, created: !existing });
  } catch (err) {
    return handleError(err);
  }
}

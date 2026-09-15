import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, QuizQuestion } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { loadQuestions, seedQuizQuestions } from "@/lib/clinical/quiz-store";
import { MARKERS } from "@/lib/clinical/quiz";
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
      })
    )
    .default([]),
  affects: z.record(z.string(), z.number().min(0).max(1)).default({}),
  optional: z.boolean().default(false),
  contraindicationIf: z.array(z.string().max(80)).default([]),
  isActive: z.boolean().default(true),
});

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

    const input = UpsertQuestion.parse(body);

    for (const marker of Object.keys(input.affects)) {
      if (!MARKER_NAMES.includes(marker)) {
        return fail(`"${marker}" is not one of the sixteen markers`, 422);
      }
    }
    if (input.type === "single" && input.options.length < 2) {
      return fail("A single-choice question needs at least two options", 422);
    }
    const values = input.options.map((o) => o.value);
    if (new Set(values).size !== values.length) {
      return fail("Two options share the same value — the answer would be ambiguous", 422);
    }

    await connectDB();
    const existing = await QuizQuestion.findOne({ qid: input.qid });
    const order = input.order ?? existing?.order ?? (await QuizQuestion.countDocuments());

    await QuizQuestion.findOneAndUpdate(
      { qid: input.qid },
      {
        $set: {
          ...input,
          order,
          options: input.options.map((o, i) => ({ ...o, order: i })),
          updatedBy: session!.sub,
        },
      },
      { upsert: true, new: true }
    );

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: existing ? "quiz.question.update" : "quiz.question.create",
      entity: "QuizQuestion",
      entityId: input.qid,
      after: { question: input.question, isActive: input.isActive },
    });

    return ok({ qid: input.qid, created: !existing });
  } catch (err) {
    return handleError(err);
  }
}

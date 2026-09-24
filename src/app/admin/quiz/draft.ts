import type { CondOp, QuizQuestion, QuizType } from "@/lib/clinical/quiz";
import { isNumericOp, tidyShowIf } from "@/lib/clinical/quiz-rules";

/**
 * The editor's working copy of a question.
 *
 * Numbers the admin types are kept as text until save: an empty box is "no
 * limit", not zero, and a half-typed "1." is not yet a number.
 */
export type DraftCondition = { qid: string; op: CondOp; values: string[]; value: string };

export type Draft = {
  qid: string;
  section: string;
  question: string;
  help: string;
  type: QuizType;
  options: Array<{ value: string; label: string; score: number; exclusive: boolean }>;
  affects: Record<string, number>;
  optional: boolean;
  contraindicationIf: string[];
  isActive: boolean;
  min: string;
  max: string;
  unit: string;
  decimals: boolean;
  /** null: everybody is asked. */
  showIf: { match: "all" | "any"; conditions: DraftCondition[] } | null;
};

/** The id a question has while it is still being written and has no key yet. */
export const NEW_ID = "__new__";

export const blankDraft = (section = "Sleep & energy"): Draft => ({
  qid: "",
  section,
  question: "",
  help: "",
  type: "single",
  options: [
    { value: "Yes", label: "Yes", score: 80, exclusive: false },
    { value: "No", label: "No", score: 30, exclusive: false },
  ],
  affects: {},
  optional: false,
  contraindicationIf: [],
  isActive: true,
  min: "",
  max: "",
  unit: "",
  decimals: false,
  showIf: null,
});

export const toDraft = (q: QuizQuestion): Draft => ({
  qid: q.id,
  section: q.section,
  question: q.question,
  help: q.help ?? "",
  type: q.type,
  options: (q.options ?? []).map((o) => ({ ...o, exclusive: Boolean(o.exclusive) })),
  affects: Object.fromEntries(
    Object.entries(q.affects ?? {}).filter(([, v]) => v !== undefined) as Array<[string, number]>
  ),
  optional: q.optional ?? false,
  contraindicationIf: q.contraindicationIf ?? [],
  isActive: q.isActive !== false,
  min: typeof q.min === "number" ? String(q.min) : "",
  max: typeof q.max === "number" ? String(q.max) : "",
  unit: q.unit ?? "",
  decimals: Boolean(q.decimals),
  showIf: q.showIf?.conditions.length
    ? {
        match: q.showIf.match,
        conditions: q.showIf.conditions.map((c) => ({
          qid: c.qid,
          op: c.op,
          values: c.values ?? [],
          value: typeof c.value === "number" ? String(c.value) : "",
        })),
      }
    : null,
});

/** "" is no number; anything else must read as one. */
const num = (s: string): number | undefined => {
  if (s.trim() === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

const choiceType = (t: QuizType) => t === "single" || t === "multi";

/**
 * The draft as the questionnaire would hold it -- used to check rules and
 * describe them before anything is saved, with the same code the server uses.
 */
export function draftToDef(d: Draft): QuizQuestion {
  const choice = choiceType(d.type);
  return {
    id: d.qid || NEW_ID,
    section: d.section.trim(),
    question: d.question.trim() || "(this question)",
    help: d.help || undefined,
    type: d.type,
    options: choice
      ? d.options.map((o) => ({
          value: o.value,
          label: o.label,
          score: o.score,
          ...(d.type === "multi" && o.exclusive ? { exclusive: true } : {}),
        }))
      : [],
    affects: choice ? d.affects : {},
    optional: d.optional,
    contraindicationIf: choice ? d.contraindicationIf : [],
    min: d.type === "number" ? num(d.min) : undefined,
    max: d.type === "number" ? num(d.max) : undefined,
    unit: d.type === "number" ? d.unit.trim() || undefined : undefined,
    decimals: d.type === "number" ? d.decimals : undefined,
    showIf: tidyShowIf(
      d.showIf
        ? {
            match: d.showIf.match,
            conditions: d.showIf.conditions.map((c) => ({
              qid: c.qid,
              op: c.op,
              values: c.values,
              value: isNumericOp(c.op) ? num(c.value) : undefined,
            })),
          }
        : undefined
    ),
    isActive: d.isActive,
  };
}

/** What the save request carries. */
export function draftToPayload(d: Draft, isNew: boolean) {
  const def = draftToDef(d);
  return {
    qid: d.qid,
    create: isNew,
    section: def.section,
    question: d.question.trim(),
    help: d.help.trim() || undefined,
    type: d.type,
    options: def.options,
    affects: def.affects,
    optional: d.optional,
    contraindicationIf: def.contraindicationIf,
    min: def.min ?? null,
    max: def.max ?? null,
    unit: def.unit,
    decimals: def.decimals,
    showIf: def.showIf ?? null,
    isActive: d.isActive,
  };
}

/** Problems in the number settings that can be seen before saving. */
export function numberSettingsProblem(d: Draft): string | null {
  if (d.type !== "number") return null;
  if (d.min.trim() && num(d.min) === undefined) return "The lowest answer is not a number.";
  if (d.max.trim() && num(d.max) === undefined) return "The highest answer is not a number.";
  const lo = num(d.min);
  const hi = num(d.max);
  if (lo !== undefined && hi !== undefined && lo >= hi) return "The lowest answer must be below the highest.";
  return null;
}

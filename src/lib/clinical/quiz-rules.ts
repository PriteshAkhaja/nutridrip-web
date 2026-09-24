import type { Answer, Answers, CondOp, Condition, QuizQuestion, QuizType } from "./quiz";

/**
 * The questionnaire's rules: who is asked what, what counts as an answer, and
 * which rules an editor may write.
 *
 * Pure, with no database and no React, because the SAME answers must be reached
 * in three places -- the patient's screen deciding what to ask next, the server
 * deciding what to store and score, and the editor deciding whether a rule is
 * sound -- and three copies of the rules would be three different quizzes the
 * first time one of them was edited.
 *
 * A rule may only look at a question asked BEFORE it. That one restriction is
 * what keeps this simple and safe: a patient always meets a question after the
 * answers it depends on, so every question is decided in a single pass, and no
 * two questions can wait on each other.
 */

/** Which comparisons make sense against each kind of question. */
export const OPS_FOR_TYPE: Record<QuizType, CondOp[]> = {
  single: ["is", "isNot", "answered"],
  multi: ["is", "isNot", "answered"],
  number: ["gt", "gte", "lt", "lte", "answered"],
  text: ["answered"],
};

/** How a comparison reads, in words, against a question of the given type. */
export function opLabel(type: QuizType, op: CondOp): string {
  if (op === "answered") return "has been answered";
  if (type === "multi") return op === "is" ? "includes any of" : op === "isNot" ? "includes none of" : op;
  switch (op) {
    case "is":
      return "is";
    case "isNot":
      return "is not";
    case "gt":
      return "is more than";
    case "gte":
      return "is at least";
    case "lt":
      return "is less than";
    case "lte":
      return "is at most";
    default:
      return op;
  }
}

const NUMERIC: CondOp[] = ["gt", "gte", "lt", "lte"];
export const isNumericOp = (op: CondOp) => NUMERIC.includes(op);

/** Whether a patient gave anything at all. A blank, or nothing ticked, is no answer. */
export function hasAnswer(a: Answer | undefined): boolean {
  if (Array.isArray(a)) return a.length > 0;
  return typeof a === "string" && a.trim() !== "";
}

/**
 * One condition against the answer it looks at.
 *
 * No answer means the condition is not met -- whatever it asks. A question that
 * depends on a skipped or hidden question is therefore hidden too, and that is
 * the right way round: a follow-up to a question that was never asked is never
 * the right thing to ask.
 */
export function conditionMet(c: Condition, answer: Answer | undefined): boolean {
  if (!hasAnswer(answer)) return false;
  if (c.op === "answered") return true;

  if (isNumericOp(c.op)) {
    const n = Number(Array.isArray(answer) ? answer[0] : answer);
    if (!Number.isFinite(n) || typeof c.value !== "number") return false;
    if (c.op === "gt") return n > c.value;
    if (c.op === "gte") return n >= c.value;
    if (c.op === "lt") return n < c.value;
    return n <= c.value;
  }

  const picked = Array.isArray(answer) ? answer : [answer as string];
  const wanted = c.values ?? [];
  const any = picked.some((v) => wanted.includes(v));
  return c.op === "is" ? any : !any;
}

/** Whether a question is asked, given the answers that came before it. */
export function isShown(q: QuizQuestion, answers: Answers): boolean {
  const conditions = q.showIf?.conditions ?? [];
  if (conditions.length === 0) return true;
  const results = conditions.map((c) => conditionMet(c, answers[c.qid]));
  return q.showIf?.match === "any" ? results.some(Boolean) : results.every(Boolean);
}

/**
 * The questions this patient is asked, in order.
 *
 * One pass, front to back. Only answers to questions already SHOWN are visible
 * to later rules, so an answer left behind on a question that has since been
 * hidden -- given, then made irrelevant by going back and changing an earlier
 * answer -- cannot reach forward and open a follow-up.
 */
export function visibleQuestions(questions: QuizQuestion[], answers: Answers): QuizQuestion[] {
  const seen: Answers = {};
  const out: QuizQuestion[] = [];
  for (const q of questions) {
    if (!isShown(q, seen)) continue;
    out.push(q);
    if (answers[q.id] !== undefined) seen[q.id] = answers[q.id];
  }
  return out;
}

/** The answers worth keeping: those to questions this patient was actually asked. */
export function answersForVisible(questions: QuizQuestion[], answers: Answers): Answers {
  const out: Answers = {};
  for (const q of visibleQuestions(questions, answers)) {
    if (hasAnswer(answers[q.id])) out[q.id] = answers[q.id];
  }
  return out;
}

/* ------------------------------------------------------------ answers */

/** The same list, each value once, in the order the options are offered. */
export function tidyMulti(q: QuizQuestion, picked: string[]): string[] {
  const order = (q.options ?? []).map((o) => o.value);
  return [...new Set(picked)].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

/**
 * Ticking an option on a multiple-choice question, with "only this" answers
 * respected: ticking "None of these" clears the others, and ticking anything
 * else clears "None of these".
 */
export function toggleMulti(q: QuizQuestion, current: string[], value: string): string[] {
  const option = q.options?.find((o) => o.value === value);
  if (!option) return current;
  if (current.includes(value)) return current.filter((v) => v !== value);
  if (option.exclusive) return [value];
  const exclusive = new Set((q.options ?? []).filter((o) => o.exclusive).map((o) => o.value));
  return tidyMulti(q, [...current.filter((v) => !exclusive.has(v)), value]);
}

/** A number answer, read the same way everywhere: a real number or nothing. */
export function readNumber(a: Answer | undefined): number | null {
  if (typeof a !== "string" || a.trim() === "") return null;
  const n = Number(a.trim());
  return Number.isFinite(n) ? n : null;
}

/** "between 0 and 24 hours", "at least 30 kg", "" -- the range, in words. */
export function rangeWords(q: Pick<QuizQuestion, "min" | "max" | "unit">): string {
  const unit = q.unit ? ` ${q.unit}` : "";
  const hasMin = typeof q.min === "number";
  const hasMax = typeof q.max === "number";
  if (hasMin && hasMax) return `between ${q.min} and ${q.max}${unit}`;
  if (hasMin) return `at least ${q.min}${unit}`;
  if (hasMax) return `at most ${q.max}${unit}`;
  return "";
}

/**
 * What is wrong with an answer, in words a patient can act on -- or null.
 *
 * An empty answer is not an error here: whether a question must be answered is
 * a separate matter (it may be optional), so this only judges what was given.
 */
export function answerProblem(q: QuizQuestion, a: Answer | undefined): string | null {
  if (!hasAnswer(a)) return null;
  const offered = new Set((q.options ?? []).map((o) => o.value));

  switch (q.type) {
    case "single":
      if (typeof a !== "string" || !offered.has(a)) return "Choose one of the answers offered.";
      return null;

    case "multi": {
      if (!Array.isArray(a)) return "Tick one or more of the answers offered.";
      if (a.some((v) => typeof v !== "string" || !offered.has(v))) return "Tick only the answers offered.";
      if (new Set(a).size !== a.length) return "An answer was ticked twice.";
      const alone = (q.options ?? []).filter((o) => o.exclusive && a.includes(o.value));
      if (alone.length > 0 && a.length > 1) return `"${alone[0].label}" cannot be ticked together with other answers.`;
      return null;
    }

    case "number": {
      const n = readNumber(a);
      const range = rangeWords(q);
      if (n === null) return `Enter a number${range ? ` ${range}` : ""}.`;
      if (!q.decimals && !Number.isInteger(n)) return "Enter a whole number.";
      if (typeof q.min === "number" && n < q.min) return `Enter a number ${range}.`;
      if (typeof q.max === "number" && n > q.max) return `Enter a number ${range}.`;
      return null;
    }

    case "text":
      if (typeof a !== "string") return "Type your answer.";
      if (a.length > 2000) return "That answer is too long -- keep it under 2,000 characters.";
      return null;

    default:
      return null;
  }
}

/** Whether the patient may move on from this question. */
export function canContinue(q: QuizQuestion, a: Answer | undefined): boolean {
  if (answerProblem(q, a)) return false;
  // Free text has always been skippable -- a blank "Any drug allergies?" is how a
  // patient says "none" -- and optional questions are, by definition.
  if (q.optional || q.type === "text") return true;
  return hasAnswer(a);
}

/* ------------------------------------------------------------ describing rules */

const quote = (s: string) => `“${s}”`;
const orList = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`;

/** One condition, as a sentence fragment: "“Do you smoke?” is Daily or Occasionally". */
export function describeCondition(c: Condition, ref: QuizQuestion | undefined): string {
  if (!ref) return "a question that no longer exists";
  const q = quote(ref.question);
  if (c.op === "answered") return `${q} has been answered`;
  if (isNumericOp(c.op)) {
    return `${q} ${opLabel(ref.type, c.op)} ${c.value ?? "?"}${ref.unit ? ` ${ref.unit}` : ""}`;
  }
  const labels = (c.values ?? []).map((v) => ref.options?.find((o) => o.value === v)?.label ?? v);
  return `${q} ${opLabel(ref.type, c.op)} ${orList(labels) || "…"}`;
}

/** The whole rule in one sentence, or null for a question everybody is asked. */
export function describeShowIf(q: QuizQuestion, byId: Map<string, QuizQuestion>): string | null {
  const conditions = q.showIf?.conditions ?? [];
  if (conditions.length === 0) return null;
  const parts = conditions.map((c) => describeCondition(c, byId.get(c.qid)));
  if (parts.length === 1) return `Asked only when ${parts[0]}.`;
  return q.showIf?.match === "any"
    ? `Asked when any of these is true: ${parts.join("; ")}.`
    : `Asked only when ${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}.`;
}

/** The questions whose rules look at this one. */
export function dependentsOf(qid: string, questions: QuizQuestion[]): QuizQuestion[] {
  return questions.filter((q) => (q.showIf?.conditions ?? []).some((c) => c.qid === qid));
}

/* ------------------------------------------------------------ checking rules */

/**
 * Everything wrong with the rules in a questionnaire, as sentences an editor can
 * act on. An empty list means every rule can be followed.
 *
 * Checked on every save, reorder, retirement and delete, so a change that would
 * break a rule is refused with the reason rather than quietly hiding a question
 * from every patient.
 */
export function ruleProblems(questions: QuizQuestion[]): string[] {
  const problems: string[] = [];
  const index = new Map(questions.map((q, i) => [q.id, i]));
  const byId = new Map(questions.map((q) => [q.id, q]));

  questions.forEach((q, i) => {
    if (q.isActive === false) return; // a retired question is never asked, so its rule never runs
    const name = quote(q.question);

    for (const c of q.showIf?.conditions ?? []) {
      const ref = byId.get(c.qid);
      if (!ref) {
        problems.push(`${name} depends on a question that no longer exists. Remove that condition.`);
        continue;
      }
      const refName = quote(ref.question);
      if (ref.id === q.id) {
        problems.push(`${name} cannot depend on its own answer.`);
        continue;
      }
      if ((index.get(ref.id) ?? Infinity) > i) {
        problems.push(
          `${name} depends on ${refName}, which comes after it. A question can only depend on one asked before it.`
        );
        continue;
      }
      if (ref.isActive === false) {
        problems.push(`${name} depends on ${refName}, which is not live — so ${name} would never be asked.`);
        continue;
      }
      if (!OPS_FOR_TYPE[ref.type].includes(c.op)) {
        problems.push(`${name}: "${opLabel(ref.type, c.op)}" does not apply to ${refName}.`);
        continue;
      }
      if (isNumericOp(c.op) && typeof c.value !== "number") {
        problems.push(`${name}: enter the number to compare ${refName} with.`);
        continue;
      }
      if (c.op === "is" || c.op === "isNot") {
        const wanted = c.values ?? [];
        if (wanted.length === 0) {
          problems.push(`${name}: choose which answers to ${refName} count.`);
          continue;
        }
        const offered = new Set((ref.options ?? []).map((o) => o.value));
        const gone = wanted.find((v) => !offered.has(v));
        if (gone !== undefined) {
          problems.push(`${name} depends on the answer "${gone}", which ${refName} no longer offers.`);
        }
      }
    }
  });

  return problems;
}

/**
 * The problems a change CREATES -- present afterwards and not before.
 *
 * Judged as a difference so an unrelated, older problem can never block a save,
 * while anything this change breaks always does.
 */
export function newProblems(before: QuizQuestion[], after: QuizQuestion[]): string[] {
  const old = new Set(ruleProblems(before));
  return ruleProblems(after).filter((p) => !old.has(p));
}

/**
 * The editor's list, and the patient's, in one order: sections in the order
 * they first appear, and each question inside its section in its own order.
 * Without this, a new question in an early section was stored at the very end
 * and a patient met it after the Screening section while the editor showed it
 * inside its own.
 */
export function groupBySection<T extends { section: string }>(list: T[]): T[] {
  const sections: string[] = [];
  const bySection = new Map<string, T[]>();
  for (const q of list) {
    if (!bySection.has(q.section)) {
      bySection.set(q.section, []);
      sections.push(q.section);
    }
    bySection.get(q.section)!.push(q);
  }
  return sections.flatMap((s) => bySection.get(s)!);
}

/** A rule with nothing in it is no rule: stored as absent, so "everybody" is one shape. */
export function tidyShowIf(showIf: QuizQuestion["showIf"] | null | undefined): QuizQuestion["showIf"] {
  const conditions = (showIf?.conditions ?? []).map((c) =>
    isNumericOp(c.op)
      ? { qid: c.qid, op: c.op, value: c.value }
      : c.op === "answered"
        ? { qid: c.qid, op: c.op }
        : { qid: c.qid, op: c.op, values: [...new Set(c.values ?? [])] }
  );
  return conditions.length ? { match: showIf?.match === "any" ? "any" : "all", conditions } : undefined;
}

/* ------------------------------------------------------------ screening */

/**
 * The answers to a question that a physician must see before approving
 * anything -- "Yes" to "Are you pregnant?", a ticked "Chest pain" -- by their
 * labels. Empty when the answer is not a screening answer.
 */
export function screeningHit(q: QuizQuestion, a: Answer | undefined): string[] {
  if (!hasAnswer(a) || !q.contraindicationIf?.length) return [];
  const picked = Array.isArray(a) ? a : [a as string];
  return picked
    .filter((v) => q.contraindicationIf!.includes(v))
    .map((v) => q.options?.find((o) => o.value === v)?.label ?? v);
}

/** Every screening answer in a submission, in words: "Which of these apply? — Chest pain". */
export function screeningFlags(questions: QuizQuestion[], answers: Answers): string[] {
  return visibleQuestions(questions, answers)
    .map((q) => ({ q, hit: screeningHit(q, answers[q.id]) }))
    .filter(({ hit }) => hit.length > 0)
    .map(({ q, hit }) => `${q.question} — ${hit.join(", ")}`);
}

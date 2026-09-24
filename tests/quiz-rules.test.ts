import { describe, expect, it } from "vitest";
import type { QuizQuestion } from "@/lib/clinical/quiz";
import { QUESTIONS, answerScore, scoreQuiz } from "@/lib/clinical/quiz";
import {
  OPS_FOR_TYPE,
  answerProblem,
  answersForVisible,
  canContinue,
  conditionMet,
  dependentsOf,
  describeShowIf,
  groupBySection,
  isShown,
  newProblems,
  rangeWords,
  ruleProblems,
  screeningFlags,
  screeningHit,
  tidyShowIf,
  toggleMulti,
  visibleQuestions,
} from "@/lib/clinical/quiz-rules";

/* A small questionnaire that exercises every type and every kind of rule. */
const smoke: QuizQuestion = {
  id: "smoke",
  section: "Lifestyle",
  question: "Do you smoke?",
  type: "single",
  options: [
    { value: "No", label: "No", score: 95 },
    { value: "Occasionally", label: "Occasionally", score: 40 },
    { value: "Daily", label: "Daily", score: 15 },
  ],
  affects: { "Vitamin C": 1 },
  contraindicationIf: [],
};
const perDay: QuizQuestion = {
  id: "per-day",
  section: "Lifestyle",
  question: "How many a day?",
  type: "number",
  min: 0,
  max: 60,
  unit: "cigarettes",
  affects: {},
  showIf: { match: "all", conditions: [{ qid: "smoke", op: "is", values: ["Occasionally", "Daily"] }] },
};
const heavy: QuizQuestion = {
  id: "heavy",
  section: "Lifestyle",
  question: "Have you tried to stop?",
  type: "single",
  options: [
    { value: "Yes", label: "Yes", score: 50 },
    { value: "No", label: "No", score: 50 },
  ],
  affects: {},
  showIf: { match: "all", conditions: [{ qid: "per-day", op: "gte", value: 10 }] },
};
const symptoms: QuizQuestion = {
  id: "symptoms",
  section: "How you feel",
  question: "Which of these apply?",
  type: "multi",
  options: [
    { value: "Tired", label: "Tired", score: 40 },
    { value: "Dizzy", label: "Dizzy", score: 20 },
    { value: "Chest pain", label: "Chest pain", score: 5 },
    { value: "None", label: "None of these", score: 100, exclusive: true },
  ],
  affects: { Iron: 1 },
  contraindicationIf: ["Chest pain"],
};
const dizzyFollowUp: QuizQuestion = {
  id: "dizzy-when",
  section: "How you feel",
  question: "When does the dizziness happen?",
  type: "text",
  affects: {},
  showIf: { match: "any", conditions: [{ qid: "symptoms", op: "is", values: ["Dizzy"] }] },
};
const all = [smoke, perDay, heavy, symptoms, dizzyFollowUp];
const ids = (qs: QuizQuestion[]) => qs.map((q) => q.id);

describe("conditions", () => {
  it("never holds for a question that was not answered, whatever it asks", () => {
    for (const op of ["is", "isNot", "answered", "gt", "lt"] as const) {
      expect(conditionMet({ qid: "x", op, values: ["a"], value: 1 }, undefined)).toBe(false);
      expect(conditionMet({ qid: "x", op, values: ["a"], value: 1 }, "")).toBe(false);
      expect(conditionMet({ qid: "x", op, values: ["a"], value: 1 }, [])).toBe(false);
    }
  });

  it("reads a single answer as one of, or none of, the chosen answers", () => {
    const is = { qid: "smoke", op: "is" as const, values: ["Daily", "Occasionally"] };
    expect(conditionMet(is, "Daily")).toBe(true);
    expect(conditionMet(is, "No")).toBe(false);
    expect(conditionMet({ ...is, op: "isNot" }, "No")).toBe(true);
    expect(conditionMet({ ...is, op: "isNot" }, "Daily")).toBe(false);
  });

  it("reads a multiple-choice answer as including any of, or none of, the chosen answers", () => {
    const c = { qid: "symptoms", op: "is" as const, values: ["Dizzy"] };
    expect(conditionMet(c, ["Tired", "Dizzy"])).toBe(true);
    expect(conditionMet(c, ["Tired"])).toBe(false);
    expect(conditionMet({ ...c, op: "isNot" }, ["Tired"])).toBe(true);
    expect(conditionMet({ ...c, op: "isNot" }, ["Tired", "Dizzy"])).toBe(false);
  });

  it("compares numbers at the edges exactly", () => {
    const at = (op: "gt" | "gte" | "lt" | "lte", a: string) => conditionMet({ qid: "n", op, value: 10 }, a);
    expect([at("gt", "10"), at("gte", "10"), at("lt", "10"), at("lte", "10")]).toEqual([false, true, false, true]);
    expect(at("gt", "10.5")).toBe(true);
    expect(at("gt", "ten")).toBe(false);
  });

  it("holds 'answered' for anything given", () => {
    expect(conditionMet({ qid: "t", op: "answered" }, "shellfish")).toBe(true);
    expect(conditionMet({ qid: "t", op: "answered" }, ["Tired"])).toBe(true);
  });
});

describe("who is asked what", () => {
  it("asks everyone a question with no rule", () => {
    expect(isShown(smoke, {})).toBe(true);
  });

  it("asks the follow-up only when the earlier answer matches", () => {
    expect(ids(visibleQuestions(all, { smoke: "No" }))).toEqual(["smoke", "symptoms"]);
    expect(ids(visibleQuestions(all, { smoke: "Daily" }))).toEqual(["smoke", "per-day", "symptoms"]);
  });

  it("follows a chain: a follow-up to a follow-up needs both answers", () => {
    expect(ids(visibleQuestions(all, { smoke: "Daily", "per-day": "20" }))).toContain("heavy");
    expect(ids(visibleQuestions(all, { smoke: "Daily", "per-day": "3" }))).not.toContain("heavy");
  });

  it("does not let an answer left on a hidden question open a follow-up", () => {
    // Said Daily, answered 20, then went back and changed to No.
    const shown = ids(visibleQuestions(all, { smoke: "No", "per-day": "20" }));
    expect(shown).not.toContain("per-day");
    expect(shown).not.toContain("heavy");
  });

  it("drops answers to questions the patient was not asked", () => {
    expect(answersForVisible(all, { smoke: "No", "per-day": "20", heavy: "Yes" })).toEqual({ smoke: "No" });
  });

  it("combines conditions with 'all' or 'any'", () => {
    const q: QuizQuestion = {
      ...heavy,
      id: "both",
      showIf: {
        match: "all",
        conditions: [
          { qid: "smoke", op: "is", values: ["Daily"] },
          { qid: "symptoms", op: "is", values: ["Dizzy"] },
        ],
      },
    };
    expect(isShown(q, { smoke: "Daily", symptoms: ["Dizzy"] })).toBe(true);
    expect(isShown(q, { smoke: "Daily", symptoms: ["Tired"] })).toBe(false);
    const anyQ = { ...q, showIf: { ...q.showIf!, match: "any" as const } };
    expect(isShown(anyQ, { smoke: "Daily", symptoms: ["Tired"] })).toBe(true);
    expect(isShown(anyQ, { smoke: "No", symptoms: ["Tired"] })).toBe(false);
  });

  it("hides a question whose rule wrongly looks at a later one, rather than guessing", () => {
    const early: QuizQuestion = { ...heavy, id: "early", showIf: { match: "all", conditions: [{ qid: "later", op: "answered" }] } };
    const later: QuizQuestion = { ...smoke, id: "later" };
    expect(ids(visibleQuestions([early, later], { later: "No" }))).toEqual(["later"]);
  });
});

describe("answers", () => {
  it("accepts only an offered answer to a single-choice question", () => {
    expect(answerProblem(smoke, "Daily")).toBeNull();
    expect(answerProblem(smoke, "banana")).toMatch(/answers offered/);
    expect(answerProblem(smoke, ["Daily"])).toMatch(/answers offered/);
  });

  it("accepts ticked lists of offered answers, each once", () => {
    expect(answerProblem(symptoms, ["Tired", "Dizzy"])).toBeNull();
    expect(answerProblem(symptoms, ["Tired", "Banana"])).toMatch(/only the answers offered/);
    expect(answerProblem(symptoms, ["Tired", "Tired"])).toMatch(/twice/);
    expect(answerProblem(symptoms, "Tired")).toMatch(/Tick/);
  });

  it("refuses 'None of these' ticked together with a symptom", () => {
    expect(answerProblem(symptoms, ["None"])).toBeNull();
    expect(answerProblem(symptoms, ["None", "Tired"])).toMatch(/None of these.*together/);
  });

  it("holds a number to its range, and to whole numbers unless decimals are allowed", () => {
    expect(answerProblem(perDay, "12")).toBeNull();
    expect(answerProblem(perDay, "0")).toBeNull();
    expect(answerProblem(perDay, "61")).toBe("Enter a number between 0 and 60 cigarettes.");
    expect(answerProblem(perDay, "-1")).toMatch(/between 0 and 60/);
    expect(answerProblem(perDay, "twelve")).toMatch(/Enter a number/);
    expect(answerProblem(perDay, "2.5")).toBe("Enter a whole number.");
    expect(answerProblem({ ...perDay, decimals: true }, "2.5")).toBeNull();
  });

  it("says the range in words, whichever ends are set", () => {
    expect(rangeWords({ min: 0, max: 24, unit: "hours" })).toBe("between 0 and 24 hours");
    expect(rangeWords({ min: 30 })).toBe("at least 30");
    expect(rangeWords({ max: 200, unit: "kg" })).toBe("at most 200 kg");
    expect(rangeWords({})).toBe("");
  });

  it("lets a patient move on only with a usable answer", () => {
    expect(canContinue(smoke, undefined)).toBe(false);
    expect(canContinue(smoke, "No")).toBe(true);
    expect(canContinue(symptoms, [])).toBe(false);
    expect(canContinue(symptoms, ["Tired"])).toBe(true);
    expect(canContinue(perDay, "")).toBe(false);
    expect(canContinue(perDay, "999")).toBe(false);
    expect(canContinue(perDay, "5")).toBe(true);
    expect(canContinue({ ...perDay, optional: true }, "")).toBe(true);
    // ...but an optional question with a bad answer still cannot be passed.
    expect(canContinue({ ...perDay, optional: true }, "999")).toBe(false);
    expect(canContinue(dizzyFollowUp, "")).toBe(true);
  });
});

describe("ticking a multiple-choice answer", () => {
  it("adds and removes, keeping the order the options are offered in", () => {
    expect(toggleMulti(symptoms, [], "Dizzy")).toEqual(["Dizzy"]);
    expect(toggleMulti(symptoms, ["Dizzy"], "Tired")).toEqual(["Tired", "Dizzy"]);
    expect(toggleMulti(symptoms, ["Tired", "Dizzy"], "Tired")).toEqual(["Dizzy"]);
  });

  it("clears the others when 'None of these' is ticked, and clears it when anything else is", () => {
    expect(toggleMulti(symptoms, ["Tired", "Dizzy"], "None")).toEqual(["None"]);
    expect(toggleMulti(symptoms, ["None"], "Tired")).toEqual(["Tired"]);
  });

  it("ignores a value that is not offered", () => {
    expect(toggleMulti(symptoms, ["Tired"], "Banana")).toEqual(["Tired"]);
  });
});

describe("scoring", () => {
  it("scores a multiple-choice answer as its lowest option, so ticking more never looks better", () => {
    expect(answerScore(symptoms, ["Tired"])).toBe(40);
    expect(answerScore(symptoms, ["Tired", "Dizzy"])).toBe(20);
    expect(answerScore(symptoms, ["None"])).toBe(100);
    const one = scoreQuiz({ symptoms: ["Tired"] }, all).nutrientRisks.find((r) => r.name === "Iron")!.pct;
    const two = scoreQuiz({ symptoms: ["Tired", "Dizzy"] }, all).nutrientRisks.find((r) => r.name === "Iron")!.pct;
    expect(two).toBeLessThanOrEqual(one);
  });

  it("does not score number or free-text answers", () => {
    expect(answerScore(perDay, "12")).toBeNull();
    expect(answerScore(dizzyFollowUp, "mornings")).toBeNull();
  });

  it("raises a screening flag if any ticked answer is one", () => {
    expect(scoreQuiz({ symptoms: ["Tired", "Chest pain"] }, all).contraindications).toEqual([symptoms.question]);
    expect(scoreQuiz({ symptoms: ["Tired"] }, all).contraindications).toEqual([]);
  });

  it("ignores answers to questions the patient was not asked", () => {
    const hiddenFlag: QuizQuestion = {
      ...symptoms,
      id: "hidden-flag",
      showIf: { match: "all", conditions: [{ qid: "smoke", op: "is", values: ["Daily"] }] },
    };
    const qs = [smoke, hiddenFlag];
    expect(scoreQuiz({ smoke: "No", "hidden-flag": ["Chest pain"] }, qs).contraindications).toEqual([]);
    expect(scoreQuiz({ smoke: "Daily", "hidden-flag": ["Chest pain"] }, qs).contraindications.length).toBe(1);
  });

  it("scores the bundled questionnaire exactly as before -- none of its questions has a rule", () => {
    expect(QUESTIONS.every((q) => !q.showIf)).toBe(true);
    const answers = Object.fromEntries(QUESTIONS.filter((q) => q.options?.length).map((q) => [q.id, q.options![0].value]));
    expect(visibleQuestions(QUESTIONS, answers).length).toBe(QUESTIONS.length);
  });
});

describe("checking rules", () => {
  it("finds nothing wrong with sound rules", () => {
    expect(ruleProblems(all)).toEqual([]);
  });

  it("refuses a rule that looks at a later question, or at itself", () => {
    expect(ruleProblems([perDay, smoke])[0]).toMatch(/comes after it/);
    const self = { ...smoke, showIf: { match: "all" as const, conditions: [{ qid: "smoke", op: "answered" as const }] } };
    expect(ruleProblems([self])[0]).toMatch(/its own answer/);
  });

  it("refuses a rule that looks at a question that is gone or not live", () => {
    expect(ruleProblems([perDay])[0]).toMatch(/no longer exists/);
    expect(ruleProblems([{ ...smoke, isActive: false }, perDay])[0]).toMatch(/not live.*never be asked/);
  });

  it("does not check the rules of a retired question, which never runs", () => {
    expect(ruleProblems([{ ...perDay, isActive: false }])).toEqual([]);
  });

  it("refuses a comparison that does not fit the question it looks at", () => {
    const bad = { ...perDay, showIf: { match: "all" as const, conditions: [{ qid: "smoke", op: "gt" as const, value: 3 }] } };
    expect(ruleProblems([smoke, bad])[0]).toMatch(/does not apply/);
    for (const [type, ops] of Object.entries(OPS_FOR_TYPE)) expect(ops.length, type).toBeGreaterThan(0);
  });

  it("refuses a rule that needs answers or a number and has none", () => {
    const noValues = { ...perDay, showIf: { match: "all" as const, conditions: [{ qid: "smoke", op: "is" as const, values: [] }] } };
    expect(ruleProblems([smoke, noValues])[0]).toMatch(/choose which answers/);
    const noNumber = { ...heavy, showIf: { match: "all" as const, conditions: [{ qid: "per-day", op: "gte" as const }] } };
    expect(ruleProblems([smoke, perDay, noNumber])[0]).toMatch(/enter the number/);
  });

  it("notices when an answer a rule depends on is removed from the earlier question", () => {
    const trimmed = { ...smoke, options: smoke.options!.filter((o) => o.value !== "Daily") };
    expect(ruleProblems([trimmed, perDay, heavy])[0]).toMatch(/"Daily", which .* no longer offers/);
  });

  it("reports only the problems a change creates, so an old one never blocks an unrelated save", () => {
    const broken = [perDay, smoke]; // already wrong: depends on a later question
    const unrelatedEdit = [{ ...perDay }, { ...smoke, question: smoke.question }];
    expect(newProblems(broken, unrelatedEdit)).toEqual([]);
    expect(newProblems(all, [{ ...smoke, isActive: false }, perDay, heavy, symptoms, dizzyFollowUp]).length).toBeGreaterThan(0);
  });

  it("finds the questions that depend on one", () => {
    expect(ids(dependentsOf("smoke", all))).toEqual(["per-day"]);
    expect(ids(dependentsOf("per-day", all))).toEqual(["heavy"]);
    expect(dependentsOf("heavy", all)).toEqual([]);
  });
});

describe("describing rules", () => {
  const byId = new Map(all.map((q) => [q.id, q]));

  it("says a rule as a sentence, with answers by their labels", () => {
    expect(describeShowIf(perDay, byId)).toBe("Asked only when “Do you smoke?” is Occasionally or Daily.");
    expect(describeShowIf(heavy, byId)).toBe("Asked only when “How many a day?” is at least 10 cigarettes.");
    expect(describeShowIf(dizzyFollowUp, byId)).toBe("Asked only when “Which of these apply?” includes any of Dizzy.");
    expect(describeShowIf(smoke, byId)).toBeNull();
  });

  it("says 'any' and 'all' differently", () => {
    const two = [
      { qid: "smoke", op: "is" as const, values: ["Daily"] },
      { qid: "symptoms", op: "is" as const, values: ["Dizzy"] },
    ];
    expect(describeShowIf({ ...heavy, showIf: { match: "all", conditions: two } }, byId)).toMatch(/^Asked only when .* and /);
    expect(describeShowIf({ ...heavy, showIf: { match: "any", conditions: two } }, byId)).toMatch(/^Asked when any of these is true: /);
  });
});

describe("tidying", () => {
  it("stores an empty rule as no rule", () => {
    expect(tidyShowIf({ match: "all", conditions: [] })).toBeUndefined();
    expect(tidyShowIf(null)).toBeUndefined();
  });

  it("keeps only the fields each comparison uses", () => {
    expect(tidyShowIf({ match: "any", conditions: [{ qid: "a", op: "gt", value: 3, values: ["x"] }] })).toEqual({
      match: "any",
      conditions: [{ qid: "a", op: "gt", value: 3 }],
    });
    expect(tidyShowIf({ match: "all", conditions: [{ qid: "a", op: "is", values: ["x", "x"], value: 3 }] })).toEqual({
      match: "all",
      conditions: [{ qid: "a", op: "is", values: ["x"] }],
    });
  });

  it("puts each question with its section, sections in the order they first appear", () => {
    const list = [
      { id: "a", section: "One" },
      { id: "b", section: "Two" },
      { id: "c", section: "One" },
    ];
    expect(groupBySection(list).map((x) => x.id)).toEqual(["a", "c", "b"]);
  });
});

describe("screening flags", () => {
  const pregnancy: QuizQuestion = {
    id: "pregnancy",
    section: "Screening",
    question: "Are you pregnant?",
    type: "single",
    options: [
      { value: "No", label: "No", score: 0 },
      { value: "Yes", label: "Yes", score: 0 },
    ],
    affects: {},
    contraindicationIf: ["Yes"],
  };

  it("names the question and the answer that must stop a booking", () => {
    expect(screeningFlags([pregnancy], { pregnancy: "Yes" })).toEqual(["Are you pregnant? — Yes"]);
    expect(screeningFlags([pregnancy], { pregnancy: "No" })).toEqual([]);
  });

  it("names only the ticked answers that are screening answers, by their labels", () => {
    expect(screeningFlags(all, { symptoms: ["Tired", "Chest pain"] })).toEqual(["Which of these apply? — Chest pain"]);
    expect(screeningHit(symptoms, ["Tired", "Dizzy"])).toEqual([]);
  });

  it("does not flag a question the patient was not asked", () => {
    const hidden: QuizQuestion = { ...pregnancy, showIf: { match: "all", conditions: [{ qid: "smoke", op: "is", values: ["Daily"] }] } };
    expect(screeningFlags([smoke, hidden], { smoke: "No", pregnancy: "Yes" })).toEqual([]);
    expect(screeningFlags([smoke, hidden], { smoke: "Daily", pregnancy: "Yes" })).toEqual(["Are you pregnant? — Yes"]);
  });
});

import { describe, expect, it } from "vitest";
import { MARKERS, QUESTIONS, scoreQuiz, suggestDripSlugs, DRIP_FOR_MARKER } from "@/lib/clinical/quiz";

describe("quiz scoring", () => {
  it("reports all sixteen markers however little was answered", () => {
    const { nutrientRisks } = scoreQuiz({});
    expect(nutrientRisks.length).toBe(16);
    expect(nutrientRisks.length).toBe(MARKERS.length);
  });

  it("sits an unspoken marker mid-band rather than pretending to know", () => {
    const { nutrientRisks, vitalityScore } = scoreQuiz({});
    expect(nutrientRisks.every((r) => r.pct === 50)).toBe(true);
    expect(vitalityScore).toBe(50);
  });

  it("does not punish a partly finished quiz for the questions it has not reached", () => {
    // One good answer must not drag every other marker down.
    const partial = scoreQuiz({ sunlight: "Over an hour" });
    expect(partial.nutrientRisks.find((r) => r.name === "Vitamin D")!.pct).toBeGreaterThan(90);
    expect(partial.nutrientRisks.find((r) => r.name === "Iron")!.pct).toBe(50);
  });

  it("moves a marker in the direction the answer implies", () => {
    const good = scoreQuiz({ sunlight: "Over an hour" }).nutrientRisks.find((r) => r.name === "Vitamin D")!.pct;
    const bad = scoreQuiz({ sunlight: "Almost none" }).nutrientRisks.find((r) => r.name === "Vitamin D")!.pct;
    expect(good).toBeGreaterThan(bad);
  });

  it("keeps every marker inside 0–100", () => {
    const worst = Object.fromEntries(
      QUESTIONS.filter((q) => q.options?.length).map((q) => [q.id, q.options![q.options!.length - 1].value])
    );
    for (const r of scoreQuiz(worst).nutrientRisks) {
      expect(r.pct).toBeGreaterThanOrEqual(0);
      expect(r.pct).toBeLessThanOrEqual(100);
    }
  });

  it("raises a contraindication the physician must see", () => {
    const { contraindications } = scoreQuiz({ pregnancy: "Yes" });
    expect(contraindications.length).toBe(1);
    expect(scoreQuiz({ pregnancy: "No" }).contraindications).toEqual([]);
  });

  it("ignores an answer that is not one of the offered options", () => {
    const { vitalityScore } = scoreQuiz({ sunlight: "banana" });
    expect(vitalityScore).toBe(50);
  });
});

describe("drip suggestions", () => {
  it("suggests drips targeting the weakest markers", () => {
    const risks = MARKERS.map((m) => ({ name: m.name, pct: m.name === "Iron" ? 5 : 90 }));
    expect(suggestDripSlugs(risks)).toContain("iron-restore");
  });

  it("returns at most the limit asked for", () => {
    const risks = MARKERS.map((m) => ({ name: m.name, pct: 10 }));
    expect(suggestDripSlugs(risks, 2).length).toBeLessThanOrEqual(2);
  });

  it("maps every marker to at least one drip, so no weakness is unanswerable", () => {
    for (const m of MARKERS) {
      expect(DRIP_FOR_MARKER[m.name]?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe("the bundled questionnaire", () => {
  it("gives every question a unique answer key", () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only weights markers that actually exist", () => {
    const names = new Set(MARKERS.map((m) => m.name));
    for (const q of QUESTIONS) {
      for (const marker of Object.keys(q.affects)) expect(names.has(marker)).toBe(true);
    }
  });

  it("gives every single-choice question at least two distinct options", () => {
    for (const q of QUESTIONS.filter((q) => q.type === "single")) {
      expect(q.options!.length).toBeGreaterThanOrEqual(2);
      const values = q.options!.map((o) => o.value);
      expect(new Set(values).size).toBe(values.length);
    }
  });
});

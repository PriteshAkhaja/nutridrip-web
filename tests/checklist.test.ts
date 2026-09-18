import { describe, expect, it } from "vitest";
import {
  CHECKLIST_STEPS,
  PHASE_ORDER,
  PRESCRIPTION_FROM,
  VITAL_RANGES,
  needsPrescription,
  outOfRange,
  phaseProgress,
} from "@/lib/clinical/checklist";

describe("the 29-step checklist", () => {
  it("has 29 steps across four phases", () => {
    expect(CHECKLIST_STEPS.length).toBe(29);
    expect(PHASE_ORDER.length).toBe(4);
    for (const phase of PHASE_ORDER) {
      expect(CHECKLIST_STEPS.some((s) => s.phase === phase)).toBe(true);
    }
  });

  it("gives every step a unique key, because keys address them over the wire", () => {
    const keys = CHECKLIST_STEPS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("opens the vitals screen before any cannulation step", () => {
    const vitals = CHECKLIST_STEPS.findIndex((s) => s.opens === "vitals");
    const cannulate = CHECKLIST_STEPS.findIndex((s) => s.key === "pr-07");
    expect(vitals).toBeGreaterThan(-1);
    expect(vitals).toBeLessThan(cannulate);
  });

  it("captures consent before cannulation", () => {
    const consent = CHECKLIST_STEPS.findIndex((s) => s.opens === "consent");
    const cannulate = CHECKLIST_STEPS.findIndex((s) => s.key === "pr-07");
    expect(consent).toBeLessThan(cannulate);
  });

  it("counts progress per phase", () => {
    const list = CHECKLIST_STEPS.map((s, i) => ({ phase: s.phase, doneAt: i < 11 ? new Date() : undefined }));
    const progress = phaseProgress(list);
    expect(progress[0].done).toBe(11);
    expect(progress[0].total).toBe(11);
    expect(progress[1].done).toBe(0);
    expect(progress.reduce((n, p) => n + p.total, 0)).toBe(29);
  });
});

describe("the prescription gate", () => {
  const keyAt = (i: number) => CHECKLIST_STEPS[i].key;

  it("leaves the six doorstep checks open without the patient's code", () => {
    for (let i = 0; i < 6; i++) expect(needsPrescription(keyAt(i))).toBe(false);
  });

  it("starts at the kit check", () => {
    expect(PRESCRIPTION_FROM).toBe("ps-07");
    expect(CHECKLIST_STEPS[6].key).toBe(PRESCRIPTION_FROM);
    expect(CHECKLIST_STEPS[6].opens).toBe("kit");
  });

  it("covers every step from the kit check to the end", () => {
    for (let i = 6; i < CHECKLIST_STEPS.length; i++) expect(needsPrescription(keyAt(i))).toBe(true);
  });

  it("covers the step that was ticked with the prescription still locked", () => {
    // Found in testing: "Select the cannulation site" closed on a session
    // whose prescription had never been opened.
    expect(needsPrescription("pr-06")).toBe(true);
  });

  it("covers the steps that cannot honestly be done without seeing the drugs", () => {
    for (const key of ["ps-07", "ps-11", "pr-02", "pr-03", "pr-04", "di-03"]) {
      expect(needsPrescription(key)).toBe(true);
    }
  });

  it("fails closed for a step it does not know", () => {
    // A step added to a session without being added to the list must not slip
    // through the gate.
    expect(needsPrescription("xx-99")).toBe(true);
    expect(needsPrescription("")).toBe(true);
  });
});

describe("vital reference ranges", () => {
  it("flags a reading below its band", () => {
    expect(outOfRange({ spo2: 91 })).toEqual(["spo2"]);
  });

  it("flags a reading above its band", () => {
    expect(outOfRange({ systolic: 180 })).toEqual(["systolic"]);
  });

  it("passes readings inside every band", () => {
    expect(outOfRange({ systolic: 122, diastolic: 78, heartRate: 74, spo2: 98, temperatureF: 98.4 })).toEqual([]);
  });

  it("accepts the boundaries themselves", () => {
    expect(outOfRange({ spo2: VITAL_RANGES.spo2.min })).toEqual([]);
    expect(outOfRange({ spo2: VITAL_RANGES.spo2.max })).toEqual([]);
  });

  it("ignores readings that were not taken rather than treating them as zero", () => {
    expect(outOfRange({})).toEqual([]);
    expect(outOfRange({ spo2: undefined })).toEqual([]);
    expect(outOfRange({ spo2: Number.NaN })).toEqual([]);
  });

  it("reports every breach, not just the first", () => {
    expect(outOfRange({ spo2: 88, heartRate: 130 }).sort()).toEqual(["heartRate", "spo2"]);
  });
});

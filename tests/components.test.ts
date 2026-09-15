import { describe, expect, it } from "vitest";
import { planDraw, type LotView } from "@/lib/clinical/components";
import type { Unit } from "@/lib/models/types";

const lot = (batchNo: string, contentValue: number, usable: number, contentUnit: Unit = "mg"): LotView => ({
  lotId: batchNo,
  batchNo,
  contentValue,
  contentUnit,
  usable,
});

const shelf = (...lots: LotView[]) => new Map([["m1", lots]]);
const single = () => "m1";

describe("recording which batch went into a session", () => {
  it("names the batch a one-vial dose comes from", () => {
    const rows = planDraw([{ name: "Ascorbic acid", dose: 7500, unit: "mg" }], shelf(lot("VC-B9", 7500, 10)), single);
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({ name: "Ascorbic acid", batchNo: "VC-B9", dose: 7500, unit: "mg" });
  });

  it("draws the earliest-expiring batch first", () => {
    // The shelf arrives already sorted by expiry, as the query returns it.
    const rows = planDraw([{ name: "Ascorbic acid", dose: 7500, unit: "mg" }],
      shelf(lot("VC-B7", 7500, 5), lot("VC-B9", 7500, 99)), single);
    expect(rows[0].batchNo).toBe("VC-B7");
  });

  it("names BOTH batches when one dose spans two lots", () => {
    // This is the case that used to be under-recorded: the last vial of a
    // short-dated lot plus the first of the next. A recall answered from a
    // report naming only one of them would miss this patient.
    const rows = planDraw([{ name: "Ascorbic acid", dose: 15000, unit: "mg" }],
      shelf(lot("VC-B7", 7500, 1), lot("VC-B9", 7500, 40)), single);
    expect(rows.map((r) => r.batchNo)).toEqual(["VC-B7", "VC-B9"]);
    expect(rows.reduce((s, r) => s + r.dose, 0)).toBeCloseTo(15000, 6);
  });

  it("splits across three lots when it has to", () => {
    const rows = planDraw([{ name: "Ascorbic acid", dose: 15000, unit: "mg" }],
      shelf(lot("A", 5000, 1), lot("B", 5000, 1), lot("C", 5000, 9)), single);
    expect(rows.map((r) => r.batchNo)).toEqual(["A", "B", "C"]);
  });

  it("converts within a unit family so a mg dose can draw from a g vial", () => {
    const rows = planDraw([{ name: "Ascorbic acid", dose: 7500, unit: "mg" }],
      shelf(lot("G-1", 10, 5, "g")), single);
    expect(rows[0].batchNo).toBe("G-1");
    expect(rows[0].dose).toBe(7500);
  });

  it("skips a lot it cannot convert rather than guessing across families", () => {
    const rows = planDraw([{ name: "Ascorbic acid", dose: 500, unit: "mg" }],
      shelf(lot("ML-1", 10, 5, "ml"), lot("MG-1", 500, 5)), single);
    expect(rows.length).toBe(1);
    expect(rows[0].batchNo).toBe("MG-1");
  });

  it("records the intended dose with no batch when nothing is in date", () => {
    const rows = planDraw([{ name: "Glutathione", dose: 600, unit: "mg" }], shelf(), single);
    expect(rows).toEqual([{ name: "Glutathione", dose: 600, unit: "mg" }]);
  });

  it("records the intent when every lot is unusable, rather than a silent zero", () => {
    const rows = planDraw([{ name: "Glutathione", dose: 600, unit: "mg" }], shelf(lot("X", 600, 0)), single);
    expect(rows.length).toBe(1);
    expect(rows[0].batchNo).toBeUndefined();
    expect(rows[0].dose).toBe(600);
  });

  it("never draws more content than the dose asked for", () => {
    // A 7,500 mg vial serving a 5,000 mg dose contributes 5,000 to the record;
    // the rest is wastage, which the dispatch ledger accounts for separately.
    const rows = planDraw([{ name: "Ascorbic acid", dose: 5000, unit: "mg" }], shelf(lot("VC-B9", 7500, 10)), single);
    expect(rows[0].dose).toBe(5000);
  });

  it("handles a multi-ingredient drip, one row per lot touched", () => {
    const lots = new Map([
      ["m1", [lot("VC-B7", 7500, 1), lot("VC-B9", 7500, 40)]],
      ["m2", [lot("MG-A2", 1000, 20)]],
    ]);
    const rows = planDraw(
      [
        { name: "Ascorbic acid", dose: 15000, unit: "mg" },
        { name: "Magnesium sulphate", dose: 1000, unit: "mg" },
      ],
      lots,
      (i) => (i === 0 ? "m1" : "m2")
    );
    expect(rows.map((r) => r.batchNo)).toEqual(["VC-B7", "VC-B9", "MG-A2"]);
  });
});

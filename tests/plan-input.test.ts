import { describe, expect, it } from "vitest";
import {
  addDays,
  carrierApplies,
  componentsFromRecipe,
  DEFAULT_CARRIER,
  routeForRole,
  scheduleDays,
  toDay,
} from "@/lib/clinical/plan-input";

describe("laying out a course", () => {
  it("puts one session a week when a week carries one", () => {
    const days = scheduleDays({ startDate: "2026-09-15", totalWeeks: 4, perWeek: 1 });
    expect(days.map((d) => d.day)).toEqual(["2026-09-15", "2026-09-22", "2026-09-29", "2026-10-06"]);
    expect(days.map((d) => d.weekNum)).toEqual([1, 2, 3, 4]);
  });

  it("spaces a week's sessions out rather than stacking them on one morning", () => {
    const days = scheduleDays({ startDate: "2026-09-15", totalWeeks: 2, perWeek: 2, spacingDays: 3 });
    expect(days.map((d) => d.day)).toEqual([
      "2026-09-15",
      "2026-09-18",
      "2026-09-22",
      "2026-09-25",
    ]);
  });

  it("crosses a month end without losing a day", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    // A leap year, where counting 28 + 1 by hand would be wrong.
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("holds a day at UTC midnight, so reading it back gives the same day", () => {
    expect(toDay("2026-09-15T00:00:00.000Z")).toBe("2026-09-15");
    expect(toDay(new Date("2026-09-15T00:00:00.000Z"))).toBe("2026-09-15");
  });
});

describe("a recipe opened out into prescription lines", () => {
  const recipe = [
    { masterId: "m-ns", name: "Normal Saline", dose: 500, unit: "ml", role: "FLUID" },
    { masterId: "m-asc", name: "Ascorbic Acid", dose: 7500, unit: "mg", role: "ACTIVE" },
  ];

  it("carries the product through, so a line can be traced in a recall", () => {
    const [fluid, active] = componentsFromRecipe(recipe);
    expect(fluid.masterId).toBe("m-ns");
    expect(active.masterId).toBe("m-asc");
  });

  it("makes the fluid the drip itself and adds everything else to that bag", () => {
    const [fluid, active] = componentsFromRecipe(recipe);
    expect(fluid.route).toBe("IV Drip in NS");
    expect(fluid.carrier).toBeUndefined();
    expect(active.route).toBe("Add to Drip Bag");
    expect(active.carrier).toBe(DEFAULT_CARRIER);
  });

  it("keeps the dose and unit exactly as the recipe wrote them", () => {
    const [, active] = componentsFromRecipe(recipe);
    expect(active.dose).toBe(7500);
    expect(active.unit).toBe("mg");
  });

  it("treats an unnamed role as something added rather than as the fluid", () => {
    expect(routeForRole(undefined)).toBe("Add to Drip Bag");
    expect(routeForRole("PREMED")).toBe("Add to Drip Bag");
  });
});

describe("naming a carrier", () => {
  it("only means something for a drug added to somebody else's bag", () => {
    expect(carrierApplies("Add to Drip Bag")).toBe(true);
  });

  it("means nothing when the route already names the fluid, or carries none", () => {
    expect(carrierApplies("IV Drip in NS")).toBe(false);
    expect(carrierApplies("IV Push/Bolus")).toBe(false);
    expect(carrierApplies("IM Injection")).toBe(false);
    expect(carrierApplies("Oral")).toBe(false);
  });
});

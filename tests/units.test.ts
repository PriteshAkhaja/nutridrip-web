import { describe, expect, it } from "vitest";
import { convert, sameFamily, formatInr, formatQty } from "@/lib/inventory/units";

describe("unit conversion", () => {
  it("converts within the mass family", () => {
    expect(convert(1, "g", "mg")).toBe(1000);
    expect(convert(1, "mg", "mcg")).toBe(1000);
    expect(convert(7500, "mg", "g")).toBe(7.5);
  });

  it("refuses to convert across families rather than guessing", () => {
    // This is the unit slip the engine must never paper over: 500 mg of a drug
    // is not 500 ml of it, and a wrong answer here reaches a patient.
    expect(convert(500, "mg", "ml")).toBeNull();
    expect(convert(1, "IU", "mg")).toBeNull();
    expect(convert(1, "unit", "ml")).toBeNull();
    expect(sameFamily("mg", "ml")).toBe(false);
    expect(sameFamily("mcg", "g")).toBe(true);
  });

  it("formats rupees in Indian grouping with no decimals", () => {
    expect(formatInr(8400)).toBe("₹8,400");
    expect(formatInr(1245000)).toBe("₹12,45,000");
    expect(formatInr(0)).toBe("₹0");
  });

  it("keeps two decimals on small quantities and rounds large ones", () => {
    expect(formatQty(2.456, "ml")).toBe("2.46 ml");
    expect(formatQty(7500.4, "mg")).toBe("7,500 mg");
  });
});

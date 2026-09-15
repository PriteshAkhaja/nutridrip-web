import { describe, expect, it } from "vitest";
import {
  checkGstin,
  documentTypeFor,
  gstinCheckDigit,
  hsnSummary,
  isInterState,
  PRICES_INCLUDE_GST,
  rateLabel,
  roundOffFor,
  splitTax,
  stateCodeFromGstin,
  stateName,
  taxBasisLabel,
} from "@/lib/billing/gst";

const KARNATAKA = "29AABCH1234K1Z5";
const MAHARASHTRA = "27AABCH1234K1Z5";

describe("reading the state off a GSTIN", () => {
  it("takes it from the first two digits", () => {
    expect(stateCodeFromGstin(KARNATAKA)).toBe("29");
    expect(stateName(stateCodeFromGstin(KARNATAKA))).toBe("Karnataka");
    expect(stateName(stateCodeFromGstin(MAHARASHTRA))).toBe("Maharashtra");
  });

  it("refuses anything that is not a state code", () => {
    expect(stateCodeFromGstin("")).toBeNull();
    expect(stateCodeFromGstin(undefined)).toBeNull();
    expect(stateCodeFromGstin("AB29ABCDE1Z5")).toBeNull();
    expect(stateCodeFromGstin("00AABCH1234K1Z5")).toBeNull();
  });

  it("names an unknown code rather than dropping it", () => {
    expect(stateName("99")).toBe("State 99");
  });
});

describe("which tax applies", () => {
  it("splits into CGST and SGST inside one state", () => {
    expect(isInterState(KARNATAKA, KARNATAKA)).toBe(false);
  });

  it("charges IGST across a state line", () => {
    expect(isInterState(KARNATAKA, MAHARASHTRA)).toBe(true);
  });

  it("treats an unregistered buyer as a sale in our own state", () => {
    // No GSTIN means no second state to compare against, so the place of
    // supply is where we are.
    expect(isInterState(KARNATAKA, undefined)).toBe(false);
    expect(isInterState(KARNATAKA, "")).toBe(false);
  });
});

describe("the tax on one line", () => {
  it("works the tax back out of a price that already contains it", () => {
    // The catalogue price is what the clinic pays, so this must be true or
    // the bill and the order disagree.
    expect(PRICES_INCLUDE_GST).toBe(true);

    const line = splitTax(42_000, 12, false);
    expect(line.total).toBe(42_000);
    expect(line.taxableValue).toBe(37_500);
    expect(round(line.cgst + line.sgst)).toBe(4_500);
  });

  it("halves the tax within a state and leaves nothing out", () => {
    const line = splitTax(42_000, 12, false);
    expect(line.cgst).toBe(2_250);
    expect(line.sgst).toBe(2_250);
    expect(line.igst).toBe(0);
  });

  it("charges the whole rate as IGST across a state line, for the same total", () => {
    const within = splitTax(42_000, 12, false);
    const across = splitTax(42_000, 12, true);
    expect(across.igst).toBe(4_500);
    expect(across.cgst).toBe(0);
    expect(across.sgst).toBe(0);
    // A clinic in Mumbai pays exactly what a clinic in Bengaluru pays; only
    // the heading on the tax changes.
    expect(across.total).toBe(within.total);
    expect(across.taxableValue).toBe(within.taxableValue);
  });

  it("keeps an odd paisa rather than losing it in the halving", () => {
    // 7,201 at 12% gives a tax that does not halve evenly.
    const line = splitTax(7_201, 12, false);
    expect(round(line.taxableValue + line.cgst + line.sgst)).toBe(7_201);
    expect(line.total).toBe(7_201);
  });

  it("handles a zero rate without dividing by nothing", () => {
    const line = splitTax(5_000, 0, false);
    expect(line.taxableValue).toBe(5_000);
    expect(line.cgst).toBe(0);
    expect(line.sgst).toBe(0);
    expect(line.total).toBe(5_000);
  });

  it("never lets the pieces disagree with the price charged", () => {
    for (const amount of [1, 99.99, 8_400, 21_600, 63_600, 1_234_567.89]) {
      for (const rate of [0, 5, 12, 18, 28]) {
        for (const inter of [true, false]) {
          const l = splitTax(amount, rate, inter);
          expect(round(l.taxableValue + l.cgst + l.sgst + l.igst)).toBe(round(l.total));
          expect(l.total).toBe(round(amount));
        }
      }
    }
  });
});

describe("rounding to whole rupees", () => {
  it("shows the difference on its own line", () => {
    expect(roundOffFor(63_600.4)).toEqual({ grandTotal: 63_600, roundOff: -0.4 });
    expect(roundOffFor(63_599.6)).toEqual({ grandTotal: 63_600, roundOff: 0.4 });
  });

  it("writes no round-off when the total is already whole", () => {
    expect(roundOffFor(63_600)).toEqual({ grandTotal: 63_600, roundOff: 0 });
  });
});

describe("how the rate is written on the slip", () => {
  it("gives the line just its figure", () => {
    // Whether it splits into CGST and SGST belongs to the whole supply, not to
    // one line, so it is said once at the head of the sheet instead.
    expect(rateLabel(12)).toBe("12%");
    expect(rateLabel(5)).toBe("5%");
  });

  it("names the split once, for the sheet", () => {
    expect(taxBasisLabel(false)).toBe("CGST + SGST — intra-state");
    expect(taxBasisLabel(true)).toBe("IGST — inter-state");
  });
});

const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

describe("GST is optional", () => {
  it("names the document a bill of supply when we are not registered", () => {
    expect(documentTypeFor(undefined, true)).toBe("bill_of_supply");
    expect(documentTypeFor("", true)).toBe("bill_of_supply");
    expect(documentTypeFor("   ", true)).toBe("bill_of_supply");
  });

  it("names it a bill of supply when nothing on it was taxed", () => {
    // Registered, but every line exempt or nil-rated.
    expect(documentTypeFor(KARNATAKA, false)).toBe("bill_of_supply");
  });

  it("calls it a tax invoice only when both are true", () => {
    expect(documentTypeFor(KARNATAKA, true)).toBe("tax_invoice");
  });

  it("charges the full price and no tax at a nil rate", () => {
    const line = splitTax(8_400, 0, false);
    expect(line.taxableValue).toBe(8_400);
    expect(line.cgst + line.sgst + line.igst).toBe(0);
    expect(line.total).toBe(8_400);
  });

  it("writes a nil rate as Nil, not as zero per cent", () => {
    // "0%" reads as tax that was charged and came to nothing.
    expect(rateLabel(0)).toBe("Nil");
  });

  it("still balances when some lines are taxed and others are not", () => {
    const taxed = splitTax(42_000, 12, false);
    const exempt = splitTax(8_400, 0, false);
    const total = taxed.total + exempt.total;
    const parts =
      taxed.taxableValue + taxed.cgst + taxed.sgst + exempt.taxableValue + exempt.cgst + exempt.sgst;
    expect(round(parts)).toBe(round(total));
    expect(round(total)).toBe(50_400);
  });
});

describe("the HSN tax summary", () => {
  const line = (hsnCode: string, gstRate: number, taxableValue: number, cgst: number, sgst: number) => ({
    hsnCode,
    gstRate,
    taxableValue,
    cgst,
    sgst,
    igst: 0,
  });

  it("puts two drips sharing a classification on one row", () => {
    // A return is filed by HSN and rate, not by product name.
    const rows = hsnSummary([
      line("30049099", 12, 15_000, 900, 900),
      line("30049099", 12, 8_214.29, 492.86, 492.85),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].taxableValue).toBe(23_214.29);
    expect(rows[0].cgst).toBe(1_392.86);
    expect(rows[0].sgst).toBe(1_392.85);
    expect(rows[0].totalTax).toBe(2_785.71);
  });

  it("keeps one classification apart when it is billed at two rates", () => {
    // Merging them would report a rate that was never charged.
    const rows = hsnSummary([line("30049099", 12, 15_000, 900, 900), line("30049099", 5, 10_000, 250, 250)]);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.gstRate)).toEqual([5, 12]);
  });

  it("declares an exempt supply rather than dropping it", () => {
    const rows = hsnSummary([line("30049099", 0, 16_800, 0, 0), line("30041000", 12, 8_214.29, 492.86, 492.85)]);
    expect(rows).toHaveLength(2);
    const exempt = rows.find((r) => r.gstRate === 0)!;
    expect(exempt.taxableValue).toBe(16_800);
    expect(exempt.totalTax).toBe(0);
  });

  it("does not lose a line that carries no HSN at all", () => {
    const rows = hsnSummary([line("", 12, 1_000, 60, 60)]);
    expect(rows).toHaveLength(1);
    expect(rows[0].hsnCode).toBe("—");
  });

  it("adds up to the same taxable value as the lines it came from", () => {
    const lines = [
      line("30049099", 12, 15_000, 900, 900),
      line("30041000", 5, 9_523.81, 238.1, 238.09),
      line("30049099", 0, 4_000, 0, 0),
    ];
    const rows = hsnSummary(lines);
    const fromLines = lines.reduce((n, l) => n + l.taxableValue, 0);
    const fromRows = rows.reduce((n, r) => n + r.taxableValue, 0);
    expect(Math.round(fromRows * 100) / 100).toBe(Math.round(fromLines * 100) / 100);
  });
});

describe("is that a GSTIN?", () => {
  // The one example in circulation that satisfies the published check-digit
  // algorithm, which is why it is the anchor for all of this.
  const REAL = "27AAPFU0939F1ZV";

  it("accepts a well-formed number whose check digit agrees", () => {
    expect(checkGstin(REAL)).toEqual({});
  });

  it("accepts an empty one — not being registered is allowed", () => {
    expect(checkGstin("")).toEqual({});
    expect(checkGstin("   ")).toEqual({});
  });

  it("catches one that was only half typed", () => {
    const v = checkGstin("29AABCH12");
    expect(v.error).toContain("15 characters");
    expect(v.error).toContain("unfinished");
  });

  it("catches one that is too long", () => {
    const v = checkGstin("29AABCH1234K1ZN99");
    expect(v.error).toContain("15 characters");
    expect(v.error).not.toContain("unfinished");
  });

  it("names the part that is wrong, not the specification", () => {
    // Every message is read by whoever is typing the number, so each one has
    // to say which part to look at.
    expect(checkGstin("AA" + REAL.slice(2)).error).toContain("starts with two numbers");
    expect(checkGstin("27123450939F1ZV").error).toContain("business PAN");
    expect(checkGstin("27AAPFU0939F1XV").error).toContain("14th character");
  });

  it("never explains the problem in words only a developer would use", () => {
    const jargon = /regex|pattern|checksum|check digit|validation|parse|base ?36|GSTIN_SHAPE/i;
    for (const bad of [
      "29AABCH12",
      "29AABCH1234K1ZN99",
      "AAAAPFU0939F1ZV",
      "27123450939F1ZV",
      "27AAPFU0939F1XV",
      "99AAPFU0939F1ZV",
      "27AAPFU0939F1ZX",
    ]) {
      const v = checkGstin(bad);
      const message = v.error ?? v.warning ?? "";
      expect(message, bad).not.toMatch(jargon);
      // And it says something, rather than failing silently.
      expect(message.length, bad).toBeGreaterThan(0);
    }
  });

  it("catches a state code that does not exist", () => {
    // 99 is well-formed and meaningless.
    expect(checkGstin("99AAPFU0939F1ZV").error).toContain("99");
  });

  it("warns rather than refuses when only the check digit is wrong", () => {
    // The whole point of the digit: one character mistyped.
    const v = checkGstin("27AAPFU0939F1ZX");
    expect(v.error).toBeUndefined();
    expect(v.warning).toContain("does not match the rest");
    expect(v.warning).toContain("GST certificate");
  });

  it("computes a check digit that agrees with the published example", () => {
    expect(gstinCheckDigit(REAL.slice(0, 14))).toBe("V");
  });

  it("is not fooled by case or surrounding space", () => {
    expect(checkGstin(`  ${REAL.toLowerCase()}  `)).toEqual({});
  });
});

import { describe, expect, it } from "vitest";
import { formatInr } from "@/lib/inventory/units";
import {
  isFutureMonth,
  monthBounds,
  monthKeyOf,
  monthLabel,
  parseMonth,
  roundToRupees,
  shiftMonth,
  sortRows,
  summarise,
  toRow,
  uninvoiced,
} from "@/lib/billing/statement";

const NOW = new Date(2026, 8, 17, 11, 0); // 17 September 2026

describe("parseMonth", () => {
  it("reads a well-formed month", () => {
    expect(parseMonth("2026-03", NOW)).toBe("2026-03");
    expect(parseMonth(" 2025-12 ", NOW)).toBe("2025-12");
  });

  it("falls back to the current month for anything else, rather than failing", () => {
    for (const bad of [undefined, null, "", "september", "2026-13", "2026-00", "2026-9", "26-09", "2026/09", "2026-09-01"]) {
      expect(parseMonth(bad, NOW), String(bad)).toBe("2026-09");
    }
  });

  it("refuses a year no invoice here could carry", () => {
    expect(parseMonth("1999-12", NOW)).toBe("2026-09");
  });
});

describe("month arithmetic", () => {
  it("bounds a month as [start, next month's start)", () => {
    const { start, end } = monthBounds("2026-09");
    expect(start).toEqual(new Date(2026, 8, 1, 0, 0, 0, 0));
    expect(end).toEqual(new Date(2026, 9, 1, 0, 0, 0, 0));
  });

  it("puts the last instant of a month inside it and the first of the next outside", () => {
    const { start, end } = monthBounds("2026-09");
    const lastInstant = new Date(2026, 8, 30, 23, 59, 59, 999);
    const firstOfNext = new Date(2026, 9, 1, 0, 0, 0, 0);
    expect(lastInstant >= start && lastInstant < end).toBe(true);
    // Half-open: an invoice at exactly midnight belongs to October, once.
    expect(firstOfNext >= start && firstOfNext < end).toBe(false);
  });

  it("gets the length of February right, in a leap year and not", () => {
    const days = (k: string) => {
      const { start, end } = monthBounds(k);
      return Math.round((end.getTime() - start.getTime()) / 86_400_000);
    };
    expect(days("2026-02")).toBe(28);
    expect(days("2028-02")).toBe(29);
    expect(days("2026-12")).toBe(31);
  });

  it("steps across a year boundary in both directions", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-09", 0)).toBe("2026-09");
    expect(shiftMonth("2026-09", 14)).toBe("2027-11");
  });

  it("labels a month in words", () => {
    expect(monthLabel("2026-09")).toBe("September 2026");
    expect(monthLabel("2027-01")).toBe("January 2027");
  });

  it("keys a date by its own local month", () => {
    expect(monthKeyOf(new Date(2026, 0, 31, 23, 59))).toBe("2026-01");
    expect(monthKeyOf(new Date(2026, 1, 1, 0, 0))).toBe("2026-02");
  });

  it("knows a future month from this one and a past one", () => {
    expect(isFutureMonth("2026-10", NOW)).toBe(true);
    expect(isFutureMonth("2026-09", NOW)).toBe(false);
    expect(isFutureMonth("2026-08", NOW)).toBe(false);
  });
});

describe("toRow", () => {
  it("adds the three taxes into one GST figure", () => {
    const r = toRow({ cgstTotal: 450, sgstTotal: 450, igstTotal: 0, taxableTotal: 10000, grandTotal: 10900 });
    expect(r.gst).toBe(900);
    expect(r.taxable).toBe(10000);
    expect(r.total).toBe(10900);
  });

  it("reads an inter-state invoice's IGST", () => {
    expect(toRow({ igstTotal: 1800 }).gst).toBe(1800);
  });

  it("dates the row by the supply, and falls back to the day it was issued", () => {
    const supplied = new Date(2026, 8, 10);
    const issued = new Date(2026, 8, 12);
    expect(toRow({ suppliedAt: supplied, issuedAt: issued }).date).toEqual(supplied);
    expect(toRow({ issuedAt: issued }).date).toEqual(issued);
    expect(toRow({}).date).toBeNull();
  });

  it("survives an invoice from an older version of the model", () => {
    // Missing fields become dashes and zeros — never a crash, never NaN.
    const r = toRow({});
    expect(r.invoiceNo).toBe("—");
    expect(r.orderNo).toBe("—");
    expect(r.taxable).toBe(0);
    expect(r.gst).toBe(0);
    expect(r.total).toBe(0);
    expect(Number.isNaN(r.total)).toBe(false);
  });

  it("names the document as it names itself, defaulting to a tax invoice", () => {
    expect(toRow({ documentType: "bill_of_supply" }).documentType).toBe("bill_of_supply");
    expect(toRow({ documentType: "tax_invoice" }).documentType).toBe("tax_invoice");
    expect(toRow({}).documentType).toBe("tax_invoice");
    expect(toRow({ documentType: "nonsense" }).documentType).toBe("tax_invoice");
  });
});

describe("summarise", () => {
  const row = (o: Partial<Parameters<typeof toRow>[0]>) => toRow(o);

  it("adds up, and counts each kind of document", () => {
    const s = summarise([
      row({ documentType: "tax_invoice", taxableTotal: 8474.58, cgstTotal: 762.71, sgstTotal: 762.71, grandTotal: 10000 }),
      row({ documentType: "bill_of_supply", taxableTotal: 26000, grandTotal: 26000 }),
    ]);
    expect(s.count).toBe(2);
    expect(s.taxInvoices).toBe(1);
    expect(s.billsOfSupply).toBe(1);
    expect(s.taxable).toBe(34474.58);
    expect(s.gst).toBe(1525.42);
    expect(s.total).toBe(36000);
  });

  it("does not let floating point leak into a total", () => {
    // 0.1 + 0.2 === 0.30000000000000004. Summed as paise it is exactly 0.3.
    const s = summarise([row({ grandTotal: 0.1 }), row({ grandTotal: 0.2 })]);
    expect(s.total).toBe(0.3);
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it("stays exact across many small amounts", () => {
    const rows = Array.from({ length: 1000 }, () => row({ grandTotal: 0.01 }));
    expect(summarise(rows).total).toBe(10);
  });

  it("is zero, not NaN, for an empty month", () => {
    const s = summarise([]);
    expect(s).toEqual({ count: 0, taxInvoices: 0, billsOfSupply: 0, taxable: 0, gst: 0, roundOff: 0, total: 0 });
  });

  it("carries round-off, so the columns can be reconciled with the invoices", () => {
    expect(summarise([row({ roundOff: -0.42, grandTotal: 1000 }), row({ roundOff: 0.3, grandTotal: 2000 })]).roundOff).toBe(-0.12);
  });
});

describe("sortRows", () => {
  it("reads oldest supply first, then by invoice number", () => {
    const a = toRow({ invoiceNo: "INV-2026-0003", suppliedAt: new Date(2026, 8, 20) });
    const b = toRow({ invoiceNo: "INV-2026-0002", suppliedAt: new Date(2026, 8, 5) });
    const c = toRow({ invoiceNo: "INV-2026-0001", suppliedAt: new Date(2026, 8, 5) });
    expect(sortRows([a, b, c]).map((r) => r.invoiceNo)).toEqual(["INV-2026-0001", "INV-2026-0002", "INV-2026-0003"]);
  });

  it("does not reorder the list it was given", () => {
    const rows = [toRow({ invoiceNo: "B", suppliedAt: new Date(2026, 8, 2) }), toRow({ invoiceNo: "A", suppliedAt: new Date(2026, 8, 1) })];
    sortRows(rows);
    expect(rows[0].invoiceNo).toBe("B");
  });
});

describe("uninvoiced", () => {
  it("names the dispatched orders that have no invoice", () => {
    const dispatched = [{ _id: "o1" }, { _id: "o2" }, { _id: "o3" }];
    expect(uninvoiced(dispatched, ["o2"]).map((o) => o._id)).toEqual(["o1", "o3"]);
  });

  it("compares ids as strings, because an ObjectId is not === another ObjectId", () => {
    const oid = (s: string) => ({ toString: () => s });
    expect(uninvoiced([{ _id: oid("abc") }], [oid("abc")])).toEqual([]);
  });

  it("is empty when everything was invoiced, and full when nothing was", () => {
    expect(uninvoiced([{ _id: "o1" }], ["o1"])).toEqual([]);
    expect(uninvoiced([{ _id: "o1" }], [])).toHaveLength(1);
  });
});

describe("roundToRupees — the statement shows what the invoice shows", () => {
  const row = (o: Parameters<typeof toRow>[0]) => toRow(o);

  it("rounds each figure to the rupee, as the invoice does", () => {
    const r = roundToRupees(
      row({ taxableTotal: 23214.29, cgstTotal: 1392.86, sgstTotal: 1392.85, grandTotal: 26000 })
    );
    expect(r.taxable).toBe(23214);
    expect(r.gst).toBe(2786);
    expect(r.total).toBe(26000);
  });

  it("prints the same text as the invoice page for the same amount", () => {
    // The invoice page prints every amount through formatInr. If this row's
    // figures go through it too, the two screens cannot disagree.
    const exact = row({ taxableTotal: 23214.29, grandTotal: 26000 });
    const shown = roundToRupees(exact);
    expect(formatInr(shown.taxable)).toBe(formatInr(exact.taxable));
    expect(formatInr(shown.taxable)).toBe("₹23,214");
    expect(formatInr(shown.total)).toBe(formatInr(exact.total));
  });

  it("rounds half a rupee up, like formatInr", () => {
    expect(roundToRupees(row({ taxableTotal: 100.5 })).taxable).toBe(101);
    expect(roundToRupees(row({ taxableTotal: 100.49 })).taxable).toBe(100);
    expect(formatInr(100.5)).toBe("₹101");
  });

  it("leaves everything that is not an amount alone", () => {
    const d = new Date(2026, 8, 12);
    const r = roundToRupees(row({ invoiceNo: "INV-2026-0002", orderNo: "PO-2026-0110", orderId: "abc", suppliedAt: d }));
    expect(r.invoiceNo).toBe("INV-2026-0002");
    expect(r.orderNo).toBe("PO-2026-0110");
    expect(r.orderId).toBe("abc");
    expect(r.date).toEqual(d);
    expect(r.documentType).toBe("tax_invoice");
  });

  it("does not mutate the row it was given", () => {
    const exact = row({ taxableTotal: 23214.29 });
    roundToRupees(exact);
    expect(exact.taxable).toBe(23214.29);
  });

  it("makes the totals the sum of the figures on the page", () => {
    // Three rows of 10.40 show as 10 each. Total them from the exact amounts and
    // the footer says 31 under three 10s; total them as shown and it says 30.
    const rows = [1, 2, 3].map(() => roundToRupees(row({ taxableTotal: 10.4, grandTotal: 10 })));
    expect(rows.map((r) => r.taxable)).toEqual([10, 10, 10]);
    expect(summarise(rows).taxable).toBe(30);
    expect(summarise([1, 2, 3].map(() => row({ taxableTotal: 10.4 }))).taxable).toBe(31.2);
  });

  it("keeps the tax column adding up on the page", () => {
    const rows = [
      roundToRupees(row({ cgstTotal: 0.4, sgstTotal: 0.4 })),
      roundToRupees(row({ cgstTotal: 0.4, sgstTotal: 0.4 })),
    ];
    // 0.80 shows as 1 on each row, so the two rows read 1 + 1 and the footer 2.
    expect(rows.map((r) => r.gst)).toEqual([1, 1]);
    expect(summarise(rows).gst).toBe(2);
  });

  it("does not turn a tiny negative into a minus zero on the page", () => {
    expect(Object.is(roundToRupees(row({ roundOff: -0.42 })).roundOff, -0.42)).toBe(true);
  });
});

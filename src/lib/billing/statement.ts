/**
 * A clinic's monthly statement: the invoices raised to it in one calendar
 * month, and what they add up to.
 *
 * It is a listing of invoices, not a ledger. The app records what was invoiced;
 * it does not record what was paid, because there is no payment gateway and no
 * payment state on an invoice. So every figure here is "invoiced", never "due"
 * or "outstanding", and the page says so — a statement that implied a balance
 * the software cannot know would be worse than no statement.
 *
 * Pure: no model, no clock of its own (callers pass `now`), so the month
 * arithmetic and the money can be tested exactly.
 *
 * Months are the server's local calendar, the same convention the audit trail
 * uses, and for the same reason — a row that displays as 30 September must be
 * a row the September statement contains.
 */

export type MonthKey = string; // "YYYY-MM"

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

const pad = (n: number) => String(n).padStart(2, "0");

export const monthKeyOf = (d: Date): MonthKey => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

/**
 * The month asked for, or the current one. A hand-edited URL — `?month=2026-13`,
 * `?month=september` — falls back rather than erroring: a statement page that
 * 404s on a typo teaches nobody anything.
 */
export function parseMonth(raw: string | null | undefined, now: Date = new Date()): MonthKey {
  const m = MONTH.exec((raw ?? "").trim());
  if (!m) return monthKeyOf(now);
  // Nothing earlier than the year 2000 is a real invoice from this system.
  return Number(m[1]) < 2000 ? monthKeyOf(now) : `${m[1]}-${m[2]}`;
}

const partsOf = (key: MonthKey) => {
  const m = MONTH.exec(key);
  if (!m) throw new Error(`Not a month key: ${key}`);
  return { year: Number(m[1]), month: Number(m[2]) };
};

/** [start, end) — the end is the first instant of the NEXT month, so nothing is counted twice. */
export function monthBounds(key: MonthKey): { start: Date; end: Date } {
  const { year, month } = partsOf(key);
  return { start: new Date(year, month - 1, 1, 0, 0, 0, 0), end: new Date(year, month, 1, 0, 0, 0, 0) };
}

export function shiftMonth(key: MonthKey, delta: number): MonthKey {
  const { year, month } = partsOf(key);
  // Date normalises the overflow, so December + 1 is January of the next year.
  return monthKeyOf(new Date(year, month - 1 + delta, 1));
}

/** "September 2026" */
export function monthLabel(key: MonthKey): string {
  const { year, month } = partsOf(key);
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

/** Is this month after the current one? A future statement can only be empty. */
export function isFutureMonth(key: MonthKey, now: Date = new Date()): boolean {
  return key > monthKeyOf(now);
}

/* ---------------------------------------------------------------- money */

/**
 * Money is added as whole paise. 0.1 + 0.2 is 0.30000000000000004 in floating
 * point, and a statement whose total is a hair off the sum of its own rows is
 * the kind of thing an accountant finds and stops trusting.
 */
const paise = (n: number | null | undefined) => Math.round((Number(n) || 0) * 100);
const fromPaise = (p: number) => p / 100;

/* ----------------------------------------------------------------- rows */

export type InvoiceLike = {
  _id?: unknown;
  orderId?: unknown;
  invoiceNo?: string;
  orderNo?: string;
  documentType?: string;
  suppliedAt?: Date | null;
  issuedAt?: Date | null;
  taxableTotal?: number;
  cgstTotal?: number;
  sgstTotal?: number;
  igstTotal?: number;
  roundOff?: number;
  grandTotal?: number;
};

export type StatementRow = {
  orderId: string;
  invoiceNo: string;
  orderNo: string;
  documentType: "tax_invoice" | "bill_of_supply";
  /** The day the supply was made — the tax point — falling back to the day it was issued. */
  date: Date | null;
  taxable: number;
  gst: number;
  roundOff: number;
  total: number;
};

/**
 * One invoice, as a row. Every read tolerates a missing field: an invoice
 * written by an older version of the model must show as a row with a dash in
 * it, not take the whole statement down.
 */
export function toRow(inv: InvoiceLike): StatementRow {
  const gst = fromPaise(paise(inv.cgstTotal) + paise(inv.sgstTotal) + paise(inv.igstTotal));
  return {
    orderId: String(inv.orderId ?? ""),
    invoiceNo: inv.invoiceNo ?? "—",
    orderNo: inv.orderNo ?? "—",
    documentType: inv.documentType === "bill_of_supply" ? "bill_of_supply" : "tax_invoice",
    date: inv.suppliedAt ?? inv.issuedAt ?? null,
    taxable: Number(inv.taxableTotal) || 0,
    gst,
    roundOff: Number(inv.roundOff) || 0,
    total: Number(inv.grandTotal) || 0,
  };
}

/**
 * A row as the invoice itself shows it: whole rupees.
 *
 * The invoice page prints every amount through `formatInr`, which rounds to the
 * rupee, so ₹23,214.29 reads ₹23,214 there. A statement that showed the paise
 * would give the same invoice two different numbers on two screens. So the
 * statement is built from the rounded figures, and its totals are the sum of what
 * is on the page — the column adds up when somebody checks it, which a total
 * rounded once from the exact amounts would not always do.
 *
 * `Math.round`, the same rounding `formatInr` uses, so the two cannot disagree.
 * Round-off is left as it is: it is never displayed, and rounding -0.42 gives -0.
 */
export function roundToRupees(row: StatementRow): StatementRow {
  return {
    ...row,
    taxable: Math.round(row.taxable),
    gst: Math.round(row.gst),
    total: Math.round(row.total),
  };
}

/** Oldest supply first, and invoice number to break a tie — the order a ledger reads in. */
export function sortRows(rows: StatementRow[]): StatementRow[] {
  return [...rows].sort((a, b) => {
    const at = a.date ? a.date.getTime() : 0;
    const bt = b.date ? b.date.getTime() : 0;
    return at - bt || a.invoiceNo.localeCompare(b.invoiceNo);
  });
}

export type StatementTotals = {
  count: number;
  taxInvoices: number;
  billsOfSupply: number;
  taxable: number;
  gst: number;
  roundOff: number;
  total: number;
};

export function summarise(rows: StatementRow[]): StatementTotals {
  let taxable = 0;
  let gst = 0;
  let roundOff = 0;
  let total = 0;
  let taxInvoices = 0;
  let billsOfSupply = 0;

  for (const r of rows) {
    taxable += paise(r.taxable);
    gst += paise(r.gst);
    roundOff += paise(r.roundOff);
    total += paise(r.total);
    if (r.documentType === "bill_of_supply") billsOfSupply++;
    else taxInvoices++;
  }

  return {
    count: rows.length,
    taxInvoices,
    billsOfSupply,
    taxable: fromPaise(taxable),
    gst: fromPaise(gst),
    roundOff: fromPaise(roundOff),
    total: fromPaise(total),
  };
}

/**
 * Orders dispatched in the month that have no invoice.
 *
 * Invoices are raised the first time somebody opens one, not at dispatch, so a
 * dispatched order can be legitimately un-invoiced — and if the statement only
 * listed invoices, that order would vanish from it without a word. Naming them
 * keeps the statement honest about what it does and does not contain.
 */
export function uninvoiced<T extends { _id?: unknown }>(dispatched: T[], invoicedOrderIds: Iterable<unknown>): T[] {
  const have = new Set([...invoicedOrderIds].map((id) => String(id)));
  return dispatched.filter((o) => !have.has(String(o._id)));
}

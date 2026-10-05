import { connectDB } from "@/lib/db/mongoose";
import { Invoice, Order } from "@/lib/models";
import { invoiceDueAt, invoicePayState } from "./invoice-pay";
import {
  monthBounds,
  roundToRupees,
  sortRows,
  summarise,
  toRow,
  uninvoiced,
  type InvoiceLike,
  type MonthKey,
  type StatementRow,
  type StatementTotals,
} from "./statement";

export type MissingInvoice = { id: string; orderNo: string; dispatchedAt: Date | null; amount: number };

export type InvoicePay = { state: "paid" | "due" | "overdue"; dueAt: Date | null; paidAt: Date | null };

export type Statement = {
  month: MonthKey;
  rows: StatementRow[];
  totals: StatementTotals;
  /** Dispatched in the month, no invoice raised yet. */
  missing: MissingInvoice[];
  /** Paid, due or overdue, by order id. */
  pay: Record<string, InvoicePay>;
  /** Whole rupees across the month's invoices. */
  paidTotal: number;
  outstandingTotal: number;
  overdueCount: number;
};

/**
 * One clinic's statement for one month.
 *
 * Every query is scoped by `clinicId`, which callers take from the session and
 * never from the request. A clinic is a tenant: there is no parameter here that
 * could name another clinic's invoices, and the page has none either.
 *
 * An invoice belongs to the month its supply was made in — the tax point — and
 * to the month it was issued in only when no supply date was recorded.
 */
export async function loadStatement(clinicId: string, month: MonthKey): Promise<Statement> {
  await connectDB();
  const { start, end } = monthBounds(month);
  const range = { $gte: start, $lt: end };

  const [invoices, dispatched] = await Promise.all([
    Invoice.find({
      clinicId,
      $or: [{ suppliedAt: range }, { suppliedAt: null, issuedAt: range }],
    }).lean<Array<InvoiceLike & { payment?: { state?: string; paidAt?: Date } | null; terms?: string | null }>>(),
    Order.find({ clinicId, status: "DISPATCHED", dispatchedAt: range })
      .select("orderNo dispatchedAt amount")
      .lean<Array<{ _id: unknown; orderNo: string; dispatchedAt?: Date; amount?: number }>>(),
  ]);

  // Whether an order has been invoiced is a question about ALL time, not this
  // month: an invoice whose supply date fell in another month must not make its
  // order look un-invoiced here.
  const invoiced = dispatched.length
    ? await Invoice.find({ orderId: { $in: dispatched.map((o) => o._id) } })
        .select("orderId")
        .lean<Array<{ orderId: unknown }>>()
    : [];

  // Whole rupees, as the invoice shows them — see roundToRupees.
  const rows = sortRows(invoices.map(toRow)).map(roundToRupees);

  const now = new Date();
  const pay: Record<string, InvoicePay> = {};
  let paidTotal = 0;
  let outstandingTotal = 0;
  let overdueCount = 0;
  for (const inv of invoices) {
    const state = invoicePayState(inv, now);
    const key = String(inv.orderId ?? "");
    const total = Math.round(Number(inv.grandTotal) || 0);
    pay[key] = {
      state,
      dueAt: inv.issuedAt ? invoiceDueAt(inv.issuedAt) : null,
      paidAt: inv.payment?.paidAt ?? null,
    };
    if (state === "paid") paidTotal += total;
    else outstandingTotal += total;
    if (state === "overdue") overdueCount++;
  }

  return {
    month,
    rows,
    totals: summarise(rows),
    missing: uninvoiced(
      dispatched,
      invoiced.map((i) => i.orderId)
    ).map((o) => ({
      id: String(o._id),
      orderNo: o.orderNo,
      dispatchedAt: o.dispatchedAt ?? null,
      amount: Number(o.amount) || 0,
    })),
    pay,
    paidTotal,
    outstandingTotal,
    overdueCount,
  };
}

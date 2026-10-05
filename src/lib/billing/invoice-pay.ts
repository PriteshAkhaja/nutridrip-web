/**
 * Whether an invoice is paid, due or overdue. Pure, so it can be tested and
 * used anywhere; lib/billing/invoice re-exports it.
 */

/** Credit terms: an invoice is due 30 days after it is issued. */
export const CREDIT_DAYS = 30;

export function invoiceDueAt(issuedAt: Date | string): Date {
  return new Date(new Date(issuedAt).getTime() + CREDIT_DAYS * 86_400_000);
}

/**
 * Paid, due or overdue. An invoice raised before invoices had a paid state,
 * for an order paid in advance, counts as paid: its terms line already said
 * "nothing further is due".
 */
export function invoicePayState(
  inv: { issuedAt?: Date | string | null; payment?: { state?: string } | null; terms?: string | null },
  now: Date = new Date()
): "paid" | "due" | "overdue" {
  if (inv.payment?.state === "paid") return "paid";
  if (inv.terms?.startsWith("Paid in advance")) return "paid";
  if (!inv.issuedAt) return "due";
  return invoiceDueAt(inv.issuedAt).getTime() < now.getTime() ? "overdue" : "due";
}

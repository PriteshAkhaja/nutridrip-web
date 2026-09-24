/**
 * A clinic pays for an order before it is prepared.
 *
 * The clinic places the order, pays NutriDrip outside the app (UPI, bank
 * transfer, cheque), and records it -- method, reference, date. The team checks
 * the money has arrived and marks it received; only then can the order be
 * confirmed and its stock reserved. A clinic the team has put "on credit" skips
 * all of this and pays within 30 days of the invoice, as before.
 *
 * Nothing here takes money: there is no payment gateway. It records a payment
 * made elsewhere, and makes sure the pharmacy never prepares an order that has
 * not been paid for.
 */
export type OrderPayState = "awaiting" | "submitted" | "received";
export const PAY_METHODS = ["upi", "bank_transfer", "cheque"] as const;
export type PayMethod = (typeof PAY_METHODS)[number];

export const PAY_METHOD_LABEL: Record<PayMethod, string> = {
  upi: "UPI",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
};

export type OrderPayment = {
  state: OrderPayState;
  method?: PayMethod | null;
  reference?: string | null;
  paidOn?: Date | string | null;
  submittedAt?: Date | string | null;
  verifiedAt?: Date | string | null;
  /** Why the team could not find it, when they sent it back. */
  note?: string | null;
  /** The order was cancelled after the money arrived: it is owed back. */
  refundDue?: boolean | null;
};

type OrderLike = {
  status: string;
  clinicId?: unknown;
  /** Decided when the order was placed, from the clinic's terms then. */
  onCredit?: boolean | null;
  payment?: OrderPayment | null;
};

/**
 * Must this order be paid before it is confirmed?
 *
 * Only a clinic's order, and only when the clinic was not on credit when it was
 * placed. An order placed before this rule existed carries no decision: a
 * draft follows the clinic's terms today; anything further along was already
 * under the old terms and is left there.
 */
export function needsPayment(order: OrderLike, clinicOnCredit = false): boolean {
  if (!order.clinicId) return false;
  if (typeof order.onCredit === "boolean") return !order.onCredit;
  return order.status === "DRAFT" && !clinicOnCredit;
}

/** Where the payment stands; "credit" for an order that does not need paying first. */
export function payState(order: OrderLike, clinicOnCredit = false): OrderPayState | "credit" {
  if (!needsPayment(order, clinicOnCredit)) return "credit";
  return order.payment?.state ?? "awaiting";
}

/** Why the order cannot be confirmed yet, in words -- or null when it can. */
export function confirmBlockedBy(order: OrderLike, clinicOnCredit = false): string | null {
  const state = payState(order, clinicOnCredit);
  if (state === "credit" || state === "received") return null;
  return state === "submitted"
    ? "The clinic says it has paid. Check the money has arrived and mark it received before confirming."
    : "Not paid yet. The clinic pays first; the order can be confirmed once the payment is received.";
}

/** A payment reference as a bank or UPI app shows it: letters, digits, dashes. */
export function referenceProblem(ref: string | null | undefined): string | null {
  const r = (ref ?? "").trim();
  if (r.length < 4) return "Enter the payment reference (UTR / UPI reference / cheque number)";
  if (r.length > 40) return "That reference is too long";
  if (!/^[A-Za-z0-9][A-Za-z0-9 /-]*$/.test(r)) return "Use only letters, numbers, spaces, / and -";
  return null;
}

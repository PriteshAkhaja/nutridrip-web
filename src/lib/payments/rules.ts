/**
 * The money rules, with no database and no gateway in them, so every one of
 * them can be tested exactly. Amounts are paise throughout: rupees as floats
 * are how a statement ends up a paisa off its own rows.
 */

export const toPaise = (inr: number | null | undefined): number => Math.round((Number(inr) || 0) * 100);
export const fromPaise = (paise: number | null | undefined): number => Math.round(Number(paise) || 0) / 100;

/** "₹8,000" / "₹1,234.50" -- whole rupees without a trailing .00. */
export function inrFromPaise(paise: number): string {
  const rupees = fromPaise(paise);
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/* -------------------------------------------------------------- refunds */

type RefundLike = { amount: number; status: "pending" | "processed" | "failed" | string };

/** Paise gone back or on the way. A failed refund returned nothing. */
export function refundedOf(refunds: RefundLike[] | undefined): number {
  return (refunds ?? []).filter((r) => r.status !== "failed").reduce((n, r) => n + r.amount, 0);
}

/** Paise of refunds the bank has not confirmed yet. */
export function pendingOf(refunds: RefundLike[] | undefined): number {
  return (refunds ?? []).filter((r) => r.status === "pending").reduce((n, r) => n + r.amount, 0);
}

/**
 * Paise given back by hand as goodwill -- a complaint, a late nurse -- and not
 * failed. Goodwill never changes what a session costs: it must not turn into a
 * balance the patient is asked to pay back, nor be taken out of a refund the
 * rules owe them later.
 */
export function goodwillOf(refunds: Array<RefundLike & { kind?: string }> | undefined): number {
  return (refunds ?? []).filter((r) => r.kind === "manual" && r.status !== "failed").reduce((n, r) => n + r.amount, 0);
}

export function statusAfterRefunds(amount: number, refunded: number): "paid" | "partially_refunded" | "refunded" {
  if (refunded <= 0) return "paid";
  return refunded >= amount ? "refunded" : "partially_refunded";
}

/* ------------------------------------------------------------- sessions */

export type BookingPhase = "active" | "ran" | "ended";

/** A session still to happen, one that ran (or is running), or one that will not happen. */
export function bookingPhase(status: string): BookingPhase {
  if (status === "cancelled" || status === "rejected") return "ended";
  if (status === "completed" || status === "in_progress") return "ran";
  return "active";
}

export type HeldPayment = {
  id: string;
  purpose: "booking" | "booking_balance" | "reschedule_fee" | "late_fee" | string;
  /** Paise captured. */
  amount: number;
  /** Paise already refunded or on the way, every kind. */
  refunded: number;
  /** Of `refunded`, paise given back by hand as goodwill (see goodwillOf). */
  goodwill?: number;
  /** Newest last: refunds come off the newest payment first. */
  paidAt: number;
};

/** A stored payment as the money rules read it. */
export function heldOf(p: {
  _id: unknown;
  purpose: string;
  amount: number;
  paidAt?: Date | null;
  createdAt?: Date | null;
  refunds?: Array<RefundLike & { kind?: string }>;
}): HeldPayment {
  return {
    id: String(p._id),
    purpose: p.purpose,
    amount: p.amount,
    refunded: refundedOf(p.refunds),
    goodwill: goodwillOf(p.refunds),
    paidAt: new Date(p.paidAt ?? p.createdAt ?? 0).getTime(),
  };
}

const CORE = new Set(["booking", "booking_balance"]);
const FEES = new Set(["reschedule_fee", "late_fee"]);

export type BookingMoney = {
  /** Captured for the session itself, net of every refund: what is still held. */
  corePaid: number;
  /** Captured for late fees, net of refunds. */
  feesPaid: number;
  /** What the session costs now, in paise. */
  price: number;
  /** Still to pay for the session (a dearer drip), 0 otherwise. */
  balanceDue: number;
  /** Late-cancel fee kept back from the refund. */
  kept: number;
  /** What should go back now. */
  refundDue: number;
  /** The payments that refund comes out of, newest first, with how much from each. */
  refundFrom: Array<{ id: string; amount: number }>;
};

/**
 * What a session's money should look like now, from what it costs, what has
 * been paid for it, and how it stands.
 *
 *  - still to happen: anything above the price goes back (a physician switched
 *    to a cheaper drip); anything below it is a balance due. Goodwill given
 *    back by hand counts on neither side: it is not a balance to pay back, and
 *    it does not come out of the difference a cheaper drip returns.
 *  - ran: nothing goes back automatically -- the drip was given.
 *  - will not happen, ended by the patient: everything paid for the session
 *    goes back except the late-cancel fee; late fees already paid stay paid.
 *  - will not happen, ended by anyone else: everything goes back, fees too.
 *    The terms promise "if we cancel, you are charged nothing".
 */
export function bookingMoney(input: {
  status: string;
  /** Rupees. */
  amount: number;
  endedByPatient: boolean;
  /** Rupees of late-cancel fees recorded against the session. */
  lateCancelFees: number;
  payments: HeldPayment[];
}): BookingMoney {
  const phase = bookingPhase(input.status);
  const price = toPaise(input.amount);
  const core = input.payments.filter((p) => CORE.has(p.purpose));
  // Still held: captured less everything gone back.
  const net = (p: HeldPayment) => Math.max(0, p.amount - p.refunded);
  // Paid towards the price: captured less what went back for a rule's reason.
  const towardPrice = (p: HeldPayment) => Math.max(0, p.amount - (p.refunded - Math.min(p.goodwill ?? 0, p.refunded)));
  const corePaid = core.reduce((n, p) => n + net(p), 0);
  const corePaidTowardPrice = core.reduce((n, p) => n + towardPrice(p), 0);
  const feesPaid = input.payments.filter((p) => FEES.has(p.purpose)).reduce((n, p) => n + net(p), 0);

  let refundDue = 0;
  let kept = 0;
  let pool: HeldPayment[] = [];

  if (phase === "active") {
    refundDue = Math.min(corePaid, Math.max(0, corePaidTowardPrice - price));
    pool = core;
  } else if (phase === "ended") {
    if (input.endedByPatient) {
      kept = Math.min(corePaid, toPaise(input.lateCancelFees));
      refundDue = corePaid - kept;
      pool = core;
    } else {
      refundDue = corePaid + feesPaid;
      pool = input.payments;
    }
  }

  return {
    corePaid,
    feesPaid,
    price,
    balanceDue: phase === "ended" ? 0 : Math.max(0, price - corePaidTowardPrice),
    kept,
    refundDue,
    refundFrom: allocateRefund(pool, refundDue),
  };
}

/**
 * Split a refund across payments, newest first -- the newest is the one most
 * likely still inside the card network's refund window, and a balance payment
 * is the natural first thing to give back.
 */
export function allocateRefund(
  payments: Array<Pick<HeldPayment, "id" | "amount" | "refunded" | "paidAt">>,
  amount: number
): Array<{ id: string; amount: number }> {
  let left = Math.max(0, Math.round(amount));
  const out: Array<{ id: string; amount: number }> = [];
  for (const p of [...payments].sort((a, b) => b.paidAt - a.paidAt)) {
    if (left <= 0) break;
    const room = Math.max(0, p.amount - p.refunded);
    const take = Math.min(room, left);
    if (take > 0) {
      out.push({ id: p.id, amount: take });
      left -= take;
    }
  }
  return out;
}

export type BookingPaymentStatus =
  "unpaid" | "paid" | "balance_due" | "refund_pending" | "partially_refunded" | "refunded";

/** The one word a list shows about a session's money. */
export function bookingPaymentStatus(input: {
  status: string;
  /** Paise captured for the session (drip price and balance), gross. */
  corePaidGross: number;
  /** Paise of that refunded or on the way, every kind. */
  coreRefunded: number;
  /** Of `coreRefunded`, paise given back by hand as goodwill. */
  coreGoodwill?: number;
  /** Paise of refunds (any purpose) not yet confirmed by the bank. */
  refundPending: number;
  /** Paise that should go back but have not been sent -- a refund that failed and waits for a retry. */
  refundOwed: number;
  /** Paise the session costs now. */
  price: number;
}): BookingPaymentStatus {
  // Money on its way back is the thing a person wants to know about first.
  if (input.refundPending > 0 || input.refundOwed > 0) return "refund_pending";
  if (input.corePaidGross === 0) return "unpaid";
  const refunded = Math.min(input.coreRefunded, input.corePaidGross);
  const net = input.corePaidGross - refunded;
  if (bookingPhase(input.status) === "ended") return net > 0 ? "partially_refunded" : "refunded";
  // Goodwill does not make a paid session unpaid.
  const towardPrice = input.corePaidGross - (refunded - Math.min(input.coreGoodwill ?? 0, refunded));
  if (towardPrice >= input.price) return "paid";
  return towardPrice > 0 ? "balance_due" : "refunded";
}

/* ------------------------------------------------------------- display */

/** "UPI · name@okhdfc", "Visa •••• 1111", "Net banking · HDFC", "Wallet · Paytm". */
export function methodLabel(p: {
  method?: string | null;
  vpa?: string | null;
  bank?: string | null;
  wallet?: string | null;
  card?: { network?: string | null; last4?: string | null; type?: string | null } | null;
}): string {
  switch (p.method) {
    case "upi":
      return p.vpa ? `UPI · ${p.vpa}` : "UPI";
    case "card": {
      const network = p.card?.network && p.card.network !== "Unknown" ? p.card.network : "Card";
      return p.card?.last4 ? `${network} •••• ${p.card.last4}` : network;
    }
    case "netbanking":
      return p.bank ? `Net banking · ${p.bank}` : "Net banking";
    case "wallet":
      return p.wallet ? `Wallet · ${p.wallet[0].toUpperCase()}${p.wallet.slice(1)}` : "Wallet";
    case "emi":
      return "Card EMI";
    case "cardless_emi":
      return "Cardless EMI";
    case "paylater":
      return "Pay later";
    default:
      return p.method ? p.method : "Online";
  }
}

/**
 * What to tell somebody whose payment failed, from Razorpay's error.
 *
 * Razorpay's own description is written for customers and is used when it is
 * there. The one thing it never says, and people most need to hear, is what
 * happens to money that did leave the account -- so that is always added.
 */
export function failureMessage(
  error: {
    description?: string | null;
    reason?: string | null;
    source?: string | null;
  } | null
): string {
  const reason = error?.reason ?? "";
  const base =
    reason === "payment_cancelled"
      ? "The payment was cancelled."
      : reason === "insufficient_funds"
        ? "The bank declined it: not enough balance."
        : reason === "payment_timed_out"
          ? "The payment timed out before it was approved."
          : error?.description?.trim() || "The payment did not go through.";
  return `${base.replace(/\.?$/, ".")} No money was taken — if your bank shows a debit, it is returned automatically within 5–7 working days.`;
}

/**
 * How long a refund takes to show, as it is promised to people. "instant" is a
 * refund Razorpay sent instantly; "optimum" one it will try to (RAZORPAY_REFUND_SPEED),
 * falling back to the normal 5–7 working days where the bank cannot take it.
 */
export function refundEta(speed?: string | null): string {
  if (speed === "instant") return "usually within minutes";
  if (speed === "optimum")
    return "usually within minutes, or 5–7 working days where the bank cannot take an instant refund";
  return "within 5–7 working days";
}

export const PURPOSE_LABEL: Record<string, string> = {
  booking: "Session",
  booking_balance: "Session balance",
  reschedule_fee: "Late move fee",
  late_fee: "Late-change fees",
  order: "Clinic order",
  invoice: "Invoice",
};

export const REFUND_KIND_LABEL: Record<string, string> = {
  cancelled: "Cancelled",
  late_cancel: "Cancelled late, less the fee",
  declined: "Declined by the physician",
  price_change: "Switched to a cheaper drip",
  not_applied: "Could not be completed",
  duplicate: "Paid twice",
  manual: "Refunded by the team",
};

/**
 * The receipt Razorpay files a refund under: the payment's receipt, which
 * refund of it this is, and the tail of the payment's own id.
 *
 * Razorpay refuses a refund receipt it has already seen anywhere on the
 * account ("Duplicate receipt found"). Receipt numbers are unique only inside
 * one database -- restore one, or reseed in test mode, and RCPT-2026-0003
 * comes round again -- so the id tail keeps every refund's receipt new. At
 * most 40 characters, Razorpay's limit.
 */
export function refundReceipt(receiptNo: string, paymentId: string, n: number): string {
  return `${receiptNo}-R${n}-${paymentId.slice(-8)}`.slice(0, 40);
}

/**
 * What "Check" tells the team once the record matches Razorpay: the payment as
 * it now stands, money in and money back. Not the payer's "Paid." -- for a
 * payment since refunded, that said the opposite of what is true.
 */
export function checkSummary(p: {
  status: string;
  amount: number;
  refunds?: RefundLike[];
  apply?: { state?: string | null } | null;
}): string | null {
  if (p.status !== "paid" && p.status !== "refunded" && p.status !== "partially_refunded") return null;
  const back = refundedOf(p.refunds);
  const pending = pendingOf(p.refunds);
  const paid = `Up to date with Razorpay: ${inrFromPaise(p.amount)} paid`;
  if (back <= 0) return p.apply?.state === "pending" ? `${paid}, still being applied.` : `${paid}.`;
  const whole = back >= p.amount ? "all of it" : inrFromPaise(back);
  return pending > 0
    ? `${paid}; ${whole} being refunded (${inrFromPaise(pending)} not yet confirmed by the bank).`
    : `${paid}; ${whole} refunded.`;
}

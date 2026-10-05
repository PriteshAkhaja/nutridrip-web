import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Payment, User } from "@/lib/models";
import { notify, notifyRole } from "@/lib/notify";
import { createWithReference, nextReference } from "@/lib/sequence";
import { razorpayConfig } from "./config";
import { NotApplied, PaymentRefusal } from "./errors";
import { razorpay, RazorpayError, checkoutSignatureValid, type RzpPayment, type RzpRefund } from "./razorpay";
import { alreadyApplied, apply, prepare, type Actor, type CheckoutInput, type PaymentForApply } from "./purposes";
import {
  applyRefundEvent,
  pullRefunds,
  refundPayment,
  refundedOf,
  type RefundEntry,
  type RefundOutcome,
} from "./refunds";
import { syncBookingMoney, syncOrderMoney } from "./money";
import { failureMessage, inrFromPaise, methodLabel, PURPOSE_LABEL, refundEta, toPaise } from "./rules";

/**
 * Checkout, confirmation, the webhook and the reconcile step.
 *
 * The flow, end to end:
 *
 *  1. startCheckout -- checks the thing can be paid for (and by whom), works
 *     out the amount on the server, writes a Payment and a Razorpay order.
 *  2. The browser opens Razorpay Checkout on that order.
 *  3. confirmCheckout -- the browser's word that it paid: the signature is
 *     checked, then the payment is fetched from Razorpay, because a signature
 *     proves who sent the ids, not that the money was captured.
 *  4. settle -- claims the Payment (once, whoever gets there first: the
 *     browser, the webhook, or a later reconcile), then applies it. If what it
 *     paid for can no longer be done, the whole amount is refunded at once.
 *
 * The webhook is the safety net for a browser that closed at the wrong moment.
 * reconcile is the net under that: it asks Razorpay directly.
 */

const REUSE_MS = 30 * 60_000;
const APPLY_STALE_MS = 2 * 60_000;

export type CheckoutOptions = {
  paymentId: string;
  receiptNo: string;
  keyId: string;
  orderId: string;
  /** Paise. */
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name?: string; email?: string; contact?: string };
  notes: Record<string, string>;
  mode: "test" | "live";
  returnTo: string;
};

export type SettleResult = {
  status: "paid" | "processing" | "pending" | "failed" | "refunded";
  applied: boolean;
  message: string;
  receiptNo: string;
  bookingId?: string;
  returnTo?: string;
  /** What the success screen shows as a receipt. */
  receipt?: ReceiptLines;
};

export type ReceiptLines = {
  /** Paise. */
  amount: number;
  refunded: number;
  methodLabel: string | null;
  paidAt: string | null;
  purposeLabel: string;
  description: string | null;
};

/** The receipt lines for a result, from the payment as it now stands. */
async function withReceipt(result: SettleResult, paymentDocId: string): Promise<SettleResult> {
  const p = await Payment.findById(paymentDocId).lean<PaymentDoc | null>();
  if (!p) return result;
  return {
    ...result,
    receipt: {
      amount: p.amount,
      refunded: refundedOf(p.refunds),
      methodLabel: p.methodLabel ?? null,
      paidAt: p.paidAt ? new Date(p.paidAt).toISOString() : null,
      purposeLabel: PURPOSE_LABEL[p.purpose] ?? "Payment",
      description: p.description ?? null,
    },
  };
}

export type PaymentDoc = PaymentForApply & {
  status: string;
  currency: string;
  rzpOrderId?: string;
  apply?: { state?: string; lockAt?: Date; error?: string };
  refunds?: RefundEntry[];
  refundedAmount?: number;
  description?: string;
  events?: string[];
  failures?: Array<{ paymentId?: string; description?: string; reason?: string; source?: string }>;
  methodLabel?: string;
  paidAt?: Date;
  createdAt?: Date;
  intentKey?: string;
};

/* ============================================================ checkout */

function requireConfig() {
  const cfg = razorpayConfig();
  if (!cfg) {
    throw new PaymentRefusal(
      "Online payment is not set up yet. Nothing was charged. Please try again later or contact us.",
      503,
      { code: "payments_off" }
    );
  }
  return cfg;
}

export async function startCheckout(actor: Actor, input: CheckoutInput): Promise<CheckoutOptions> {
  const cfg = requireConfig();
  await connectDB();
  const prepared = await prepare(actor, input);
  const amount = toPaise(prepared.amountInr);
  if (amount < 100) throw new PaymentRefusal("The amount is too small to pay online.", 409);

  const payer = await User.findById(actor.sub)
    .select("name email phone")
    .lean<{ name?: string; email?: string; phone?: string } | null>();
  const options = (p: { _id: unknown; receiptNo: string; rzpOrderId: string; amount: number; description?: string }) =>
    ({
      paymentId: String(p._id),
      receiptNo: p.receiptNo,
      keyId: cfg.keyId,
      orderId: p.rzpOrderId,
      amount: p.amount,
      currency: "INR",
      name: "NutriDrip",
      description: p.description ?? prepared.description,
      prefill: {
        name: payer?.name || undefined,
        // Placeholder addresses made for phone-only patients are not theirs to be emailed at.
        email: payer?.email && !/@(phone|patients?)\.nutridrip/i.test(payer.email) ? payer.email : undefined,
        contact: payer?.phone || undefined,
      },
      notes: { receipt: p.receiptNo },
      mode: cfg.mode,
      returnTo: prepared.returnTo,
    }) satisfies CheckoutOptions;

  // A second press, a page reload, a retry after closing Checkout: the same
  // order, so nothing is left dangling and a late success still lands.
  const open = await Payment.findOne({
    payerId: actor.sub,
    purpose: prepared.purpose,
    intentKey: prepared.intentKey,
    amount,
    status: { $in: ["created", "failed"] },
    rzpOrderId: { $exists: true },
    createdAt: { $gt: new Date(Date.now() - REUSE_MS) },
  })
    .sort({ createdAt: -1 })
    .lean<{ _id: unknown; receiptNo: string; rzpOrderId: string; amount: number; description?: string } | null>();
  if (open) return options(open);

  const year = new Date().getFullYear();
  const payment = await createWithReference(
    (receiptNo) =>
      Payment.create({
        receiptNo,
        purpose: prepared.purpose,
        status: "created",
        amount,
        currency: "INR",
        description: prepared.description,
        payerId: actor.sub,
        payerRole: actor.role,
        bookingId: prepared.bookingId,
        orderId: prepared.orderId,
        invoiceId: prepared.invoiceId,
        intent: prepared.intent,
        intentKey: prepared.intentKey,
      }),
    (attempt) =>
      nextReference(
        Payment,
        "receiptNo",
        (n) => `RCPT-${year}-${String(n).padStart(4, "0")}`,
        (ref) => (ref.startsWith(`RCPT-${year}-`) ? Number(ref.split("-")[2] ?? 0) : 0),
        attempt
      )
  );

  let order;
  try {
    order = await razorpay.createOrder({
      amount,
      receipt: payment.receiptNo,
      notes: { ...prepared.notes, receipt: payment.receiptNo, paymentId: String(payment._id) },
    });
  } catch (err) {
    // Nothing exists at Razorpay, so nothing to keep.
    await Payment.deleteOne({ _id: payment._id });
    if (err instanceof RazorpayError) {
      throw new PaymentRefusal(
        err.unreachable
          ? "Could not reach the payment service. Nothing was charged — try again in a moment."
          : `The payment could not be started: ${err.message}. Nothing was charged.`,
        502
      );
    }
    throw err;
  }
  await Payment.updateOne({ _id: payment._id }, { $set: { rzpOrderId: order.id } });

  return options({
    _id: payment._id,
    receiptNo: payment.receiptNo,
    rzpOrderId: order.id,
    amount,
    description: prepared.description,
  });
}

/* =========================================================== confirming */

export async function confirmCheckout(
  actor: Actor,
  body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
): Promise<SettleResult> {
  const cfg = requireConfig();
  await connectDB();
  const payment = await Payment.findOne({ rzpOrderId: body.razorpay_order_id }).lean<PaymentDoc | null>();
  if (!payment) throw new PaymentRefusal("That payment is not one of ours.", 404);
  if (String(payment.payerId) !== actor.sub && !["admin", "superadmin"].includes(actor.role)) {
    throw new PaymentRefusal("That payment is not yours.", 403);
  }
  const valid = checkoutSignatureValid(
    { orderId: body.razorpay_order_id, paymentId: body.razorpay_payment_id, signature: body.razorpay_signature },
    cfg.keySecret
  );
  if (!valid) {
    await AuditLog.create({
      actorId: actor.sub,
      actorRole: actor.role,
      action: "payment.signature_rejected",
      entity: "Payment",
      entityId: String(payment._id),
      after: { receiptNo: payment.receiptNo, rzpPaymentId: body.razorpay_payment_id },
    }).catch(() => {});
    // Not a failure of the payment: the webhook or a reconcile will still find the truth.
    throw new PaymentRefusal(
      "That confirmation could not be verified. If money left your account, it is checked with Razorpay and applied or refunded automatically.",
      400
    );
  }
  return withReceipt(await settle(String(payment._id), body.razorpay_payment_id, "checkout"), String(payment._id));
}

/**
 * The browser's report of a failed attempt -- shown to the payer, kept for the
 * team. Nothing trusts it: a payment is only ever marked failed or paid from
 * what Razorpay says when asked.
 */
export async function recordFailure(
  actor: Actor | null,
  rzpOrderId: string,
  error: { code?: string; description?: string; reason?: string; source?: string; step?: string; paymentId?: string }
): Promise<string> {
  await connectDB();
  const payment = await Payment.findOne({ rzpOrderId }).lean<PaymentDoc | null>();
  if (!payment) return failureMessage(error);
  if (actor && String(payment.payerId) !== actor.sub) return failureMessage(error);
  const already = (payment.failures ?? []).some((f) => error.paymentId && f.paymentId === error.paymentId);
  if (!already) {
    await Payment.updateOne(
      { _id: payment._id },
      {
        $push: {
          failures: {
            $each: [
              {
                at: new Date(),
                paymentId: error.paymentId,
                code: error.code,
                reason: error.reason,
                description: error.description,
                source: error.source,
                step: error.step,
              },
            ],
            $slice: -10,
          },
        },
      }
    );
    // Still payable: a failed attempt leaves the order open for another try.
    await Payment.updateOne({ _id: payment._id, status: "created" }, { $set: { status: "failed" } });
  }
  return failureMessage(error);
}

/* ============================================================== settling */

function whatHappened(p: PaymentDoc): SettleResult {
  const state = p.apply?.state;
  const refunded = refundedOf(p.refunds);
  if (state === "failed") {
    const speed = (p.refunds ?? []).filter((r) => r.status !== "failed").at(-1)?.speed;
    return {
      status: "refunded",
      applied: false,
      message: `${p.apply?.error ?? "It could not be completed."} ${
        refunded > 0
          ? `Your ${inrFromPaise(refunded)} is being refunded — ${refundEta(speed)}.`
          : "The team has been told and will refund it."
      }`,
      receiptNo: p.receiptNo,
    };
  }
  if (state === "applied") {
    return {
      status: "paid",
      applied: true,
      message: "Paid.",
      receiptNo: p.receiptNo,
      bookingId: p.bookingId ? String(p.bookingId) : undefined,
    };
  }
  return { status: "processing", applied: false, message: "Your payment is being confirmed.", receiptNo: p.receiptNo };
}

/**
 * Take a payment Razorpay says exists, and -- if it is captured -- apply it.
 * Safe to call any number of times, from anywhere.
 */
export async function settle(
  paymentDocId: string,
  rzpPaymentId: string,
  via: "checkout" | "webhook" | "reconcile"
): Promise<SettleResult> {
  await connectDB();
  const payment = await Payment.findById(paymentDocId).lean<PaymentDoc | null>();
  if (!payment) throw new PaymentRefusal("That payment does not exist.", 404);

  // What Razorpay says, not what the browser said.
  let rp: RzpPayment;
  try {
    rp = await razorpay.fetchPayment(rzpPaymentId);
  } catch (err) {
    if (err instanceof RazorpayError && err.unreachable) {
      return {
        status: "pending",
        applied: false,
        message: "Your payment is being confirmed.",
        receiptNo: payment.receiptNo,
      };
    }
    throw err;
  }
  if (rp.order_id !== payment.rzpOrderId) throw new PaymentRefusal("That payment belongs to a different order.", 400);

  if (rp.status === "authorized") {
    // With automatic capture on (Razorpay → Payment Capture) this is a moment's
    // gap before Razorpay captures it; with it off, the app captures it here.
    try {
      rp = await razorpay.capture(rp.id, rp.amount, rp.currency);
    } catch (err) {
      // Razorpay may have captured it itself in that moment: look again before giving up.
      const again = await razorpay.fetchPayment(rp.id).catch(() => null);
      if (again?.status === "captured") {
        rp = again;
      } else {
        console.error("[payments] capture:", err);
        return {
          status: "pending",
          applied: false,
          message: "Your payment is being confirmed.",
          receiptNo: payment.receiptNo,
        };
      }
    }
  }
  // Approved by the bank after the capture window, and returned by Razorpay
  // without ever being taken (Payment Capture → "Refund automatically"). It was
  // never paid, so it is recorded as a failed attempt and nothing is applied.
  if (rp.status === "refunded" && !rp.captured) {
    const message = await recordFailure(null, payment.rzpOrderId!, {
      reason: "late_authorization",
      description: "Your bank approved this payment too late, so Razorpay returned it without taking any money",
      source: "bank",
      paymentId: rp.id,
    });
    return { status: "failed", applied: false, message, receiptNo: payment.receiptNo };
  }
  if (rp.status === "failed") {
    const message = await recordFailure(null, payment.rzpOrderId!, {
      code: rp.error_code ?? undefined,
      description: rp.error_description ?? undefined,
      reason: rp.error_reason ?? undefined,
      source: rp.error_source ?? undefined,
      step: rp.error_step ?? undefined,
      paymentId: rp.id,
    });
    return { status: "failed", applied: false, message, receiptNo: payment.receiptNo };
  }
  if (rp.status !== "captured" && rp.status !== "refunded") {
    return {
      status: "pending",
      applied: false,
      message: "Your payment is being confirmed.",
      receiptNo: payment.receiptNo,
    };
  }

  // A second capture against an order already paid by another payment: give it back.
  if (payment.rzpPaymentId && payment.rzpPaymentId !== rp.id) {
    await refundDuplicate(payment, rp);
    return whatHappened((await Payment.findById(paymentDocId).lean<PaymentDoc>())!);
  }

  const now = new Date();
  const claimed = await Payment.findOneAndUpdate(
    { _id: paymentDocId, status: { $in: ["created", "failed"] } },
    {
      $set: {
        status: "paid",
        rzpPaymentId: rp.id,
        method: rp.method,
        methodLabel: methodLabel(rp),
        paidAt: new Date((rp.created_at ?? Math.floor(now.getTime() / 1000)) * 1000),
        confirmedVia: via,
        fee: rp.fee ?? undefined,
        tax: rp.tax ?? undefined,
        "apply.state": "pending",
        "apply.lockAt": now,
      },
    },
    { new: true }
  ).lean<PaymentDoc | null>();

  if (!claimed) {
    // Somebody else got here first -- or a crash left it half-done.
    const current = (await Payment.findById(paymentDocId).lean<PaymentDoc>())!;
    // ...with a different payment on the same order, at the same instant: this one is a duplicate.
    if (current.rzpPaymentId && current.rzpPaymentId !== rp.id) {
      await refundDuplicate(current, rp);
      return whatHappened((await Payment.findById(paymentDocId).lean<PaymentDoc>())!);
    }
    const stale =
      current.apply?.state === "pending" && (current.apply?.lockAt?.getTime() ?? 0) < now.getTime() - APPLY_STALE_MS;
    if (!stale) return whatHappened(current);
    const retaken = await Payment.findOneAndUpdate(
      { _id: paymentDocId, "apply.state": "pending", "apply.lockAt": current.apply?.lockAt },
      { $set: { "apply.lockAt": now } },
      { new: true }
    ).lean<PaymentDoc | null>();
    if (!retaken) return whatHappened(current);
    return runApply(retaken, via);
  }

  // Refunded at Razorpay before we ever saw it (from its dashboard): the money
  // is already back, so there is nothing to apply and nothing to refund.
  if (rp.status === "refunded") {
    await Payment.updateOne(
      { _id: paymentDocId },
      {
        $set: { "apply.state": "failed", "apply.at": new Date(), "apply.error": "Refunded before it was confirmed." },
        $unset: { "apply.lockAt": 1 },
      }
    );
    await pullRefunds(paymentDocId);
    return whatHappened((await Payment.findById(paymentDocId).lean<PaymentDoc>())!);
  }

  // The amount Razorpay took must be the amount asked for. If not, nothing is
  // applied and what was actually taken goes back.
  if (rp.amount !== claimed.amount || rp.currency !== claimed.currency) {
    await Payment.updateOne({ _id: paymentDocId }, { $set: { amount: rp.amount, expectedAmount: claimed.amount } });
    return failApply({ ...claimed, amount: rp.amount }, "The amount paid did not match the amount due.");
  }
  return runApply(claimed, via);
}

async function runApply(p: PaymentDoc, via: string): Promise<SettleResult> {
  try {
    const done = await apply(p);
    await Payment.updateOne(
      { _id: p._id },
      {
        $set: {
          "apply.state": "applied",
          "apply.at": new Date(),
          ...(done.bookingId ? { bookingId: done.bookingId } : {}),
        },
        $unset: { "apply.lockAt": 1, "apply.error": 1 },
      }
    );
    await AuditLog.create({
      actorId: p.payerId,
      actorRole: p.payerRole,
      action: "payment.paid",
      entity: "Payment",
      entityId: String(p._id),
      after: {
        receiptNo: p.receiptNo,
        purpose: PURPOSE_LABEL[p.purpose] ?? p.purpose,
        amount: inrFromPaise(p.amount),
        method: p.methodLabel ?? null,
        rzpPaymentId: p.rzpPaymentId ?? null,
        confirmedVia: via,
      },
    }).catch(() => {});
    return {
      status: "paid",
      applied: true,
      message: done.message,
      receiptNo: p.receiptNo,
      bookingId: done.bookingId,
      returnTo: done.returnTo,
    };
  } catch (err) {
    // Half-applied is applied: a booking that exists is never refunded as though it did not.
    const evidence = await alreadyApplied(p).catch(() => null);
    if (evidence) {
      await Payment.updateOne(
        { _id: p._id },
        { $set: { "apply.state": "applied", "apply.at": new Date() }, $unset: { "apply.lockAt": 1 } }
      );
      console.error("[payments] applied with an error after:", err);
      return {
        status: "paid",
        applied: true,
        message: evidence.message,
        receiptNo: p.receiptNo,
        bookingId: evidence.bookingId,
        returnTo: evidence.returnTo,
      };
    }
    const reason = err instanceof NotApplied ? err.message : "Something went wrong completing it on our side.";
    if (!(err instanceof NotApplied)) console.error("[payments] apply:", err);
    return failApply(p, reason);
  }
}

/** Paid, but it cannot be done: refund it all, and say so. */
async function failApply(p: PaymentDoc, reason: string): Promise<SettleResult> {
  await Payment.updateOne(
    { _id: p._id },
    { $set: { "apply.state": "failed", "apply.at": new Date(), "apply.error": reason }, $unset: { "apply.lockAt": 1 } }
  );
  const out: RefundOutcome = await refundPayment(String(p._id), { kind: "not_applied", reason }).catch((err) => {
    console.error("[payments] refund after failed apply:", err);
    return { status: "failed" as const, amount: 0 };
  });
  // "none": nothing left to send -- it had all gone back already (the
  // session's own refund got there first). That is back, not a failure.
  const already = out.status === "none";
  const fresh = already
    ? await Payment.findById(p._id).select("refunds").lean<{ refunds?: RefundEntry[] } | null>()
    : null;
  const amount = already ? refundedOf(fresh?.refunds) : out.amount;
  const back = out.status === "pending" || out.status === "processed" || (already && amount > 0);
  await notify(
    String(p.payerId),
    back ? `Refunded · ${p.receiptNo}` : `Refund being arranged · ${p.receiptNo}`,
    back
      ? `${reason} Your ${inrFromPaise(amount)} is on its way back — ${refundEta(out.speed)}.`
      : `${reason} The team has been told and will refund your ${inrFromPaise(p.amount)}.`,
    back ? "warning" : "error",
    p.payerRole === "clinic" ? "/clinic" : "/app"
  );
  await AuditLog.create({
    actorRole: "system",
    action: "payment.not_applied",
    entity: "Payment",
    entityId: String(p._id),
    after: { receiptNo: p.receiptNo, reason, refund: out.status },
  }).catch(() => {});
  return {
    status: "refunded",
    applied: false,
    message: back
      ? `${reason} Your ${inrFromPaise(amount)} is being refunded — ${refundEta(out.speed)}.`
      : `${reason} Your payment will be refunded; the team has been told.`,
    receiptNo: p.receiptNo,
  };
}

async function refundDuplicate(p: PaymentDoc, rp: RzpPayment) {
  // Claimed before anything is sent: the browser and the webhook meeting the
  // same second payment at once must not both refund it.
  const claimed = await Payment.updateOne(
    { _id: p._id, "duplicates.rzpPaymentId": { $ne: rp.id } },
    { $push: { duplicates: { rzpPaymentId: rp.id, amount: rp.amount, status: "pending", at: new Date() } } }
  );
  if (!claimed.modifiedCount) return;
  const left = rp.amount - (rp.amount_refunded ?? 0);
  try {
    if (left <= 0) {
      // Already given back at Razorpay (its dashboard, or its own late-authorisation refund).
      await Payment.updateOne(
        { _id: p._id, "duplicates.rzpPaymentId": rp.id },
        { $set: { "duplicates.$.status": "processed" } }
      );
      return;
    }
    const r = await razorpay.refund(rp.id, {
      amount: left,
      notes: { receipt: p.receiptNo, kind: "duplicate" },
    });
    await Payment.updateOne(
      { _id: p._id, "duplicates.rzpPaymentId": rp.id },
      {
        $set: {
          "duplicates.$.amount": r.amount,
          "duplicates.$.refundId": r.id,
          "duplicates.$.status": r.status === "processed" ? "processed" : r.status === "failed" ? "failed" : "pending",
        },
      }
    );
    await AuditLog.create({
      actorRole: "system",
      action: "payment.duplicate_refunded",
      entity: "Payment",
      entityId: String(p._id),
      after: { receiptNo: p.receiptNo, rzpPaymentId: rp.id, amount: inrFromPaise(r.amount) },
    }).catch(() => {});
    await notify(
      String(p.payerId),
      `Paid twice — refunded · ${p.receiptNo}`,
      `A second payment of ${inrFromPaise(rp.amount)} was taken for something already paid. It is on its way back — ${refundEta(r.speed_processed ?? r.speed_requested)}.`,
      "warning",
      p.payerRole === "clinic" ? "/clinic" : "/app"
    );
  } catch (err) {
    console.error("[payments] duplicate refund:", err);
    await Payment.updateOne(
      { _id: p._id, "duplicates.rzpPaymentId": rp.id },
      {
        $set: {
          "duplicates.$.status": "failed",
          "duplicates.$.error": err instanceof Error ? err.message : "Could not refund",
          attention: "duplicate_unrefunded",
        },
      }
    );
    await notifyRole(
      ["admin", "superadmin"],
      `Duplicate payment to refund · ${p.receiptNo}`,
      `Razorpay payment ${rp.id} (${inrFromPaise(rp.amount)}) was a second payment against the same order and could not be refunded automatically. Refund it in the Razorpay dashboard.`,
      "error",
      "/admin/payments?view=attention"
    );
  }
}

/* ============================================================ reconcile */

/**
 * Ask Razorpay what is true, and make the record say it: a payment the
 * browser never confirmed, refunds still pending, an apply a crash left
 * half-done. What the "check" buttons and the payer's waiting screen call.
 */
export async function reconcile(paymentDocId: string): Promise<SettleResult> {
  requireConfig();
  await connectDB();
  const p = await Payment.findById(paymentDocId).lean<PaymentDoc | null>();
  if (!p) throw new PaymentRefusal("That payment does not exist.", 404);

  if ((p.status === "created" || p.status === "failed") && p.rzpOrderId) {
    const attempts = await razorpay.fetchOrderPayments(p.rzpOrderId);
    const good = attempts.find((a) => a.status === "captured" || a.status === "authorized");
    if (good) return settle(paymentDocId, good.id, "reconcile");
    for (const a of attempts.filter((x) => x.status === "failed")) {
      await recordFailure(null, p.rzpOrderId, {
        code: a.error_code ?? undefined,
        description: a.error_description ?? undefined,
        reason: a.error_reason ?? undefined,
        source: a.error_source ?? undefined,
        step: a.error_step ?? undefined,
        paymentId: a.id,
      });
    }
    const fresh = (await Payment.findById(paymentDocId).lean<PaymentDoc>())!;
    return fresh.status === "failed"
      ? {
          status: "failed",
          applied: false,
          message: "The last attempt did not go through. You can try again.",
          receiptNo: fresh.receiptNo,
        }
      : { status: "pending", applied: false, message: "No payment has been made yet.", receiptNo: fresh.receiptNo };
  }

  if (p.rzpPaymentId) {
    await pullRefunds(paymentDocId);
    if (p.apply?.state === "pending") return settle(paymentDocId, p.rzpPaymentId, "reconcile");
    if (p.bookingId) await syncBookingMoney(String(p.bookingId), { refund: false });
    if (p.orderId && p.purpose === "order") await syncOrderMoney(String(p.orderId), { refund: false });
  }
  return whatHappened((await Payment.findById(paymentDocId).lean<PaymentDoc>())!);
}

/* ============================================================== webhook */

type WebhookEvent = {
  event: string;
  payload?: {
    payment?: { entity?: RzpPayment };
    refund?: { entity?: RzpRefund };
    order?: { entity?: { id?: string } };
  };
};

/**
 * One Razorpay event, already verified. Returns what was done, for the log.
 * Throws only for something worth Razorpay retrying (the database was down).
 */
export async function handleWebhookEvent(eventId: string | null, event: WebhookEvent): Promise<string> {
  await connectDB();
  const payment = event.payload?.payment?.entity;
  const refund = event.payload?.refund?.entity;
  const orderId = payment?.order_id ?? event.payload?.order?.entity?.id ?? null;

  const doc = orderId
    ? await Payment.findOne({ rzpOrderId: orderId }).lean<PaymentDoc | null>()
    : refund
      ? await Payment.findOne({
          $or: [
            { "refunds.refundId": refund.id },
            { rzpPaymentId: refund.payment_id },
            { "duplicates.rzpPaymentId": refund.payment_id },
          ],
        }).lean<PaymentDoc | null>()
      : null;
  if (!doc) return "not ours";
  if (eventId && (doc.events ?? []).includes(eventId)) return "already handled";

  let outcome = "ignored";
  switch (event.event) {
    case "payment.authorized":
    case "payment.captured":
    case "order.paid":
      if (payment) {
        const r = await settle(String(doc._id), payment.id, "webhook");
        outcome = `settled: ${r.status}`;
      }
      break;
    case "payment.failed":
      if (payment) {
        await recordFailure(null, doc.rzpOrderId!, {
          code: payment.error_code ?? undefined,
          description: payment.error_description ?? undefined,
          reason: payment.error_reason ?? undefined,
          source: payment.error_source ?? undefined,
          step: payment.error_step ?? undefined,
          paymentId: payment.id,
        });
        outcome = "failure recorded";
      }
      break;
    case "refund.created":
    case "refund.processed":
    case "refund.failed":
      if (refund && refund.payment_id !== doc.rzpPaymentId) {
        // A refund of a duplicate payment: its own list, its own status.
        await Payment.updateOne(
          { _id: doc._id, "duplicates.rzpPaymentId": refund.payment_id },
          {
            $set: {
              "duplicates.$.status":
                refund.status === "processed" ? "processed" : refund.status === "failed" ? "failed" : "pending",
              "duplicates.$.refundId": refund.id,
            },
          }
        );
        outcome = `duplicate refund ${refund.status}`;
      } else if (refund) {
        const r = await applyRefundEvent(refund);
        outcome = `refund ${refund.status}`;
        if (r) {
          if (doc.bookingId) await syncBookingMoney(String(doc.bookingId), { refund: false });
          if (doc.orderId && doc.purpose === "order") await syncOrderMoney(String(doc.orderId), { refund: false });
          if (r.changedTo === "processed") {
            await notify(
              String(doc.payerId),
              `Refund processed · ${doc.receiptNo}`,
              `${inrFromPaise(r.amount)} has been sent back to the account you paid from.${
                r.arn ? ` If your bank asks, the reference is ${r.arn}.` : ""
              } ${
                r.speed === "instant"
                  ? "It was an instant refund, so it should already be there."
                  : "It can take a few days to show on your statement."
              }`,
              "success",
              doc.payerRole === "clinic" ? "/clinic" : "/app/sessions"
            );
          } else if (r.changedTo === "failed") {
            await notifyRole(
              ["admin", "superadmin"],
              `Refund failed at the bank · ${doc.receiptNo}`,
              `${inrFromPaise(r.amount)} could not be returned to the payer's account. Retry it from Payments or contact Razorpay.`,
              "error",
              "/admin/payments?view=attention"
            );
          }
        }
      }
      break;
  }

  if (eventId) await Payment.updateOne({ _id: doc._id }, { $push: { events: { $each: [eventId], $slice: -30 } } });
  return outcome;
}

/* ================================================================ views */

export type PaymentView = {
  id: string;
  receiptNo: string;
  purpose: string;
  purposeLabel: string;
  status: string;
  /** Paise. */
  amount: number;
  refunded: number;
  refundPending: number;
  methodLabel: string | null;
  paidAt: string | null;
  createdAt: string | null;
  applyState: string | null;
  applyError: string | null;
  lastFailure: string | null;
  refunds: Array<{
    id: string;
    amount: number;
    status: string;
    kind: string;
    reason: string | null;
    at: string;
    processedAt: string | null;
    arn: string | null;
    error: string | null;
  }>;
};

export function toView(p: PaymentDoc): PaymentView {
  const refunds = p.refunds ?? [];
  const last = p.failures?.at(-1);
  return {
    id: String(p._id),
    receiptNo: p.receiptNo,
    purpose: p.purpose,
    purposeLabel: PURPOSE_LABEL[p.purpose] ?? p.purpose,
    status: p.status,
    amount: p.amount,
    refunded: refundedOf(refunds),
    refundPending: refunds.filter((r) => r.status === "pending").reduce((n, r) => n + r.amount, 0),
    methodLabel: p.methodLabel ?? null,
    paidAt: p.paidAt ? new Date(p.paidAt).toISOString() : null,
    createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
    applyState: p.apply?.state ?? null,
    applyError: p.apply?.error ?? null,
    lastFailure: last ? failureMessage(last) : null,
    refunds: refunds.map((r) => ({
      id: String(r._id ?? r.refundId ?? r.at),
      amount: r.amount,
      status: r.status,
      kind: r.kind,
      reason: r.reason ?? null,
      at: new Date(r.at).toISOString(),
      processedAt: r.processedAt ? new Date(r.processedAt).toISOString() : null,
      arn: r.arn ?? null,
      error: r.error ?? null,
    })),
  };
}

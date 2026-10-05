import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Payment, User } from "@/lib/models";
import type { RefundKind } from "@/lib/models/Payment";
import { notifyRole } from "@/lib/notify";
import { razorpay, RazorpayError, type RzpRefund } from "./razorpay";
import { PaymentRefusal } from "./errors";
import { inrFromPaise, refundReceipt, refundedOf, statusAfterRefunds } from "./rules";

/**
 * Money going back. The one place in the app that asks Razorpay for a refund.
 *
 * Three rules keep it from ever refunding twice:
 *  - one refund decision per payment at a time (a short lock on the record);
 *  - before deciding how much is left, ask Razorpay what it has already
 *    refunded -- a request whose answer was lost may still have gone through;
 *  - never more than what was captured less what has gone back, which Razorpay
 *    enforces too.
 */

export type RefundEntry = {
  _id?: unknown;
  refundId?: string;
  rzpPaymentId?: string;
  amount: number;
  status: "pending" | "processed" | "failed";
  kind: RefundKind;
  reason?: string;
  byId?: unknown;
  at: Date;
  processedAt?: Date;
  failedAt?: Date;
  error?: string;
  uncertain?: boolean;
  arn?: string;
  speed?: string;
};

export type RefundOutcome = {
  status: "pending" | "processed" | "failed" | "none";
  /** Paise. */
  amount: number;
  error?: string;
  /** "instant", "optimum" (instant where the bank allows) or "normal": what to promise. */
  speed?: string;
};

const LOCK_MS = 60_000;
/** How long a second refund on the same payment waits for the first to finish. */
const WAIT_MS = 20_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export { refundedOf, pendingOf, statusAfterRefunds } from "./rules";

const mapStatus = (s: RzpRefund["status"]): RefundEntry["status"] =>
  s === "processed" ? "processed" : s === "failed" ? "failed" : "pending";

/* A Mongoose Payment document, as far as refunds are concerned. */
type PaymentDocument = {
  _id: unknown;
  receiptNo: string;
  amount: number;
  status: string;
  purpose: string;
  payerId: unknown;
  rzpPaymentId?: string;
  refunds: RefundEntry[];
  refundedAmount: number;
  attention?: string;
  markModified: (path: string) => void;
  save: () => Promise<unknown>;
};

function recompute(doc: PaymentDocument) {
  doc.refundedAmount = refundedOf(doc.refunds);
  // A failed refund needs a person until something has gone back since, or nothing is left to send.
  const last = doc.refunds.at(-1);
  if (last?.status === "failed" && doc.refundedAmount < doc.amount) doc.attention = "refund_failed";
  else if (doc.attention === "refund_failed") doc.attention = undefined;
  if (["paid", "partially_refunded", "refunded"].includes(doc.status)) {
    doc.status = statusAfterRefunds(doc.amount, doc.refundedAmount);
  }
  doc.markModified("refunds");
}

/**
 * One refund decision per payment at a time. A second one -- a cancellation's
 * refund landing while an admin refunds the same payment by hand -- waits for
 * the first to finish and then decides on what is left, rather than being
 * turned away and the refund it was making dropped.
 */
async function withRefundLock<T>(paymentId: string, fn: () => Promise<T>): Promise<T> {
  const until = Date.now() + WAIT_MS;
  let now = new Date();
  for (;;) {
    now = new Date();
    const locked = await Payment.findOneAndUpdate(
      {
        _id: paymentId,
        $or: [{ refundLockAt: null }, { refundLockAt: { $lt: new Date(now.getTime() - LOCK_MS) } }],
      },
      { $set: { refundLockAt: now } },
      { new: true }
    )
      .select("_id")
      .lean();
    if (locked) break;
    if (!(await Payment.exists({ _id: paymentId }))) throw new PaymentRefusal("That payment does not exist.", 404);
    if (Date.now() > until) {
      throw new PaymentRefusal("A refund for this payment is already being made. Try again in a minute.", 409);
    }
    await sleep(150 + Math.random() * 150);
  }
  try {
    return await fn();
  } finally {
    await Payment.updateOne({ _id: paymentId, refundLockAt: now }, { $unset: { refundLockAt: 1 } });
  }
}

/**
 * Bring our record of a payment's refunds level with Razorpay's: the current
 * state of any still pending, a refund made in Razorpay's dashboard, and the
 * answer to a request that left without one coming back.
 */
export async function pullRefunds(paymentId: string): Promise<void> {
  await connectDB();
  const doc = (await Payment.findById(paymentId)) as PaymentDocument | null;
  if (!doc?.rzpPaymentId) return;
  let remote: RzpRefund[];
  try {
    remote = await razorpay.listRefunds(doc.rzpPaymentId);
  } catch {
    return; // Razorpay unreachable: what we have stands until the next look.
  }

  let changed = false;
  for (const r of remote) {
    const entry = doc.refunds.find((e) => e.refundId === r.id);
    if (entry) {
      const next = mapStatus(r.status);
      if (entry.status !== next) {
        entry.status = next;
        if (next === "processed") entry.processedAt = entry.processedAt ?? new Date();
        if (next === "failed") entry.failedAt = entry.failedAt ?? new Date();
        changed = true;
      }
      const arn = r.acquirer_data?.arn ?? undefined;
      if (arn && entry.arn !== arn) {
        entry.arn = arn;
        changed = true;
      }
      if (r.speed_processed && entry.speed !== r.speed_processed) {
        entry.speed = r.speed_processed;
        changed = true;
      }
      continue;
    }
    // A request that got no answer, and did go through after all.
    const lost = doc.refunds.find((e) => e.uncertain && !e.refundId && e.amount === r.amount);
    if (lost) {
      lost.refundId = r.id;
      lost.rzpPaymentId = r.payment_id;
      lost.status = mapStatus(r.status);
      lost.uncertain = false;
      lost.error = undefined;
      lost.failedAt = undefined;
      if (lost.status === "processed") lost.processedAt = new Date();
    } else {
      doc.refunds.push({
        refundId: r.id,
        rzpPaymentId: r.payment_id,
        amount: r.amount,
        status: mapStatus(r.status),
        kind: "manual",
        reason: "Refunded in the Razorpay dashboard",
        at: new Date(r.created_at * 1000),
        ...(r.status === "processed" ? { processedAt: new Date() } : {}),
        arn: r.acquirer_data?.arn ?? undefined,
      });
    }
    changed = true;
  }

  // An uncertain request Razorpay has no record of did not happen.
  for (const e of doc.refunds) {
    if (e.uncertain && !e.refundId) {
      e.uncertain = false;
      e.error = "Razorpay has no record of this refund, so it was not made.";
      changed = true;
    }
  }

  if (changed) {
    recompute(doc);
    await doc.save();
  }
}

/**
 * Refund part or all of one payment. `amount` is paise; left out, everything
 * not yet refunded goes back.
 *
 * Never throws for Razorpay's refusal: that is recorded as a failed refund,
 * the admins are told, and the caller carries on -- a cancellation is not
 * undone because the money could not go back this minute.
 */
export async function refundPayment(
  paymentId: string,
  input: { amount?: number; kind: RefundKind; reason: string; byId?: string | null }
): Promise<RefundOutcome> {
  await connectDB();
  return withRefundLock(paymentId, async () => {
    await pullRefunds(paymentId);
    const doc = (await Payment.findById(paymentId)) as PaymentDocument | null;
    if (!doc) throw new PaymentRefusal("That payment does not exist.", 404);
    if (!doc.rzpPaymentId || !["paid", "partially_refunded", "refunded"].includes(doc.status)) {
      throw new PaymentRefusal("Nothing was captured on this payment, so there is nothing to refund.", 409);
    }
    const room = doc.amount - refundedOf(doc.refunds);
    const amount = Math.min(Math.round(input.amount ?? room), room);
    if (amount <= 0) return { status: "none", amount: 0 };

    const at = new Date();
    let entry: RefundEntry;
    try {
      const r = await razorpay.refund(doc.rzpPaymentId, {
        amount,
        notes: { receipt: doc.receiptNo, kind: input.kind },
        // Razorpay refuses a refund receipt it has seen before, across the whole
        // account. Receipt numbers alone can repeat (a database restored, or
        // reseeded in test mode), so the payment's own id makes it unique.
        receipt: refundReceipt(doc.receiptNo, String(doc._id), doc.refunds.length + 1),
      });
      entry = {
        refundId: r.id,
        rzpPaymentId: doc.rzpPaymentId,
        amount,
        status: mapStatus(r.status),
        kind: input.kind,
        reason: input.reason,
        byId: input.byId ?? undefined,
        at,
        ...(r.status === "processed" ? { processedAt: at } : {}),
        ...(r.status === "failed" ? { failedAt: at, error: "Razorpay could not make the refund." } : {}),
        speed: r.speed_processed ?? r.speed_requested,
        arn: r.acquirer_data?.arn ?? undefined,
      };
    } catch (err) {
      const e = err instanceof RazorpayError ? err : null;
      entry = {
        rzpPaymentId: doc.rzpPaymentId,
        amount,
        status: "failed",
        kind: input.kind,
        reason: input.reason,
        byId: input.byId ?? undefined,
        at,
        failedAt: at,
        uncertain: Boolean(e?.unreachable),
        error: e?.unreachable
          ? "Razorpay could not be reached. The next check asks Razorpay whether it went through before anything is sent again."
          : (e?.message ?? (err instanceof Error ? err.message : "The refund could not be made.")),
      };
    }

    doc.refunds.push(entry);
    recompute(doc);
    await doc.save();

    await AuditLog.create({
      actorId: input.byId ?? undefined,
      actorRole: input.byId ? undefined : "system",
      action: entry.status === "failed" ? "payment.refund_failed" : "payment.refund",
      entity: "Payment",
      entityId: String(doc._id),
      after: {
        receiptNo: doc.receiptNo,
        amount: inrFromPaise(amount),
        kind: input.kind,
        reason: input.reason,
        status: entry.status,
        ...(entry.refundId ? { refundId: entry.refundId } : {}),
        ...(entry.error ? { error: entry.error } : {}),
      },
    }).catch(() => {});

    if (entry.status === "failed") {
      const payer = await User.findById(doc.payerId).select("name").lean<{ name?: string } | null>();
      await notifyRole(
        ["admin", "superadmin"],
        `Refund not made · ${doc.receiptNo}`,
        `${inrFromPaise(amount)} to ${payer?.name ?? "the payer"} could not be refunded: ${entry.error} Retry it from Payments.`,
        "error",
        "/admin/payments?view=attention"
      );
    }

    return {
      status: entry.status,
      amount,
      ...(entry.error ? { error: entry.error } : {}),
      ...(entry.speed ? { speed: entry.speed } : {}),
    };
  });
}

/**
 * A refund event from Razorpay (the webhook): update the refund it names, or
 * record one made in Razorpay's dashboard. Returns the refund's new status when
 * it changed, so the caller can tell the person it belongs to.
 */
export async function applyRefundEvent(r: RzpRefund): Promise<{
  paymentId: string;
  changedTo: RefundEntry["status"] | null;
  amount: number;
  arn?: string;
  speed?: string;
} | null> {
  await connectDB();
  const doc = (await Payment.findOne({
    $or: [{ "refunds.refundId": r.id }, { rzpPaymentId: r.payment_id }],
  })) as PaymentDocument | null;
  if (!doc) return null;

  const next = mapStatus(r.status);
  let entry = doc.refunds.find((e) => e.refundId === r.id);
  let changedTo: RefundEntry["status"] | null = null;
  if (entry) {
    if (entry.status !== next) {
      changedTo = next;
      entry.status = next;
    }
  } else {
    entry = doc.refunds.find((e) => e.uncertain && !e.refundId && e.amount === r.amount);
    if (entry) {
      entry.refundId = r.id;
      entry.uncertain = false;
      entry.error = undefined;
      entry.failedAt = undefined;
      entry.status = next;
    } else {
      entry = {
        refundId: r.id,
        rzpPaymentId: r.payment_id,
        amount: r.amount,
        status: next,
        kind: "manual",
        reason: "Refunded in the Razorpay dashboard",
        at: new Date(r.created_at * 1000),
      };
      doc.refunds.push(entry);
    }
    changedTo = next;
  }
  if (next === "processed") entry.processedAt = entry.processedAt ?? new Date();
  if (next === "failed") {
    entry.failedAt = entry.failedAt ?? new Date();
    entry.error = entry.error ?? "The bank did not accept the refund.";
  }
  if (r.acquirer_data?.arn) entry.arn = r.acquirer_data.arn;
  if (r.speed_processed) entry.speed = r.speed_processed;

  recompute(doc);
  await doc.save();
  return { paymentId: String(doc._id), changedTo, amount: entry.amount, arn: entry.arn, speed: entry.speed };
}

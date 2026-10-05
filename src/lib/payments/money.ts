import { connectDB } from "@/lib/db/mongoose";
import { Booking, Order, Payment } from "@/lib/models";
import type { RefundKind } from "@/lib/models/Payment";
import { notify } from "@/lib/notify";
import {
  bookingMoney,
  bookingPaymentStatus,
  bookingPhase,
  fromPaise,
  goodwillOf,
  heldOf,
  inrFromPaise,
  refundEta,
} from "./rules";
import { pendingOf, refundPayment, refundedOf, type RefundEntry } from "./refunds";

/**
 * Keep a session's money in line with the session.
 *
 * Called after anything that changes what a session costs or whether it will
 * happen -- a payment, a cancellation, a physician's decision, a switch of drip,
 * a held slot lapsing, a refund confirmed by the bank. It works out from the
 * session and its payments what should have gone back, sends whatever has not,
 * and writes the one-word status the lists show.
 *
 * Idempotent: run it twice and the second run finds nothing more to refund.
 * That is what lets every path that ends a session simply call it, rather than
 * each carrying its own idea of what the patient is owed.
 */

type LeanPayment = {
  _id: unknown;
  purpose: string;
  status: string;
  amount: number;
  paidAt?: Date;
  createdAt?: Date;
  refunds?: RefundEntry[];
};

type LeanBooking = {
  _id: unknown;
  bookingNo: string;
  patientId: unknown;
  status: string;
  amount?: number;
  cancelledByRole?: string;
  charges?: Array<{ kind: string; amount: number; settledAs?: string; paidMethod?: string }>;
};

const LOCK_MS = 60_000;
/** How long a caller waits for another money decision on the same session to finish. */
const WAIT_MS = 20_000;
/** An ask this old that nobody finished is picked up by sweepBookingMoney. */
const STALE_ASK_MS = 2 * 60_000;
const MAX_PASSES = 6;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const CORE = new Set(["booking", "booking_balance"]);
const BOOKING_PURPOSES = ["booking", "booking_balance", "reschedule_fee", "late_fee"];

async function capturedFor(bookingId: string): Promise<LeanPayment[]> {
  return Payment.find({
    bookingId,
    purpose: { $in: BOOKING_PURPOSES },
    status: { $in: ["paid", "partially_refunded", "refunded"] },
  })
    .select("purpose status amount paidAt createdAt refunds")
    .lean<LeanPayment[]>();
}

export type BookingMoneyResult = {
  /** Paise sent back by this run (pending or processed). */
  refunded: number;
  /** A refund this run tried and could not make. */
  refundFailed: boolean;
  status: string;
};

/**
 * `refund: false` refreshes the status without sending anything -- for a
 * refund webhook, say, where a retry of a failed refund on every event could
 * go round for ever. Money that does go back is always announced to the patient.
 */
type SyncOptions = { refund?: boolean; byId?: string | null };

/**
 * Every call first records that it asked, then waits its turn. Whoever holds
 * the lock checks, before letting go, whether anyone asked while it worked --
 * and if so goes round again. So an event landing mid-run (a cancellation
 * while a refund webhook is being handled) is never lost, even when its own
 * caller gives up waiting; and an ask nobody finished (the server stopped
 * half-way) is picked up by sweepBookingMoney.
 */
export async function syncBookingMoney(bookingId: string, opts: SyncOptions = {}): Promise<BookingMoneyResult | null> {
  await connectDB();
  const wantsRefund = opts.refund !== false;
  const asked = await Booking.updateOne(
    { _id: bookingId },
    { $inc: { moneyAsk: 1 }, $set: { moneyDirtyAt: new Date(), ...(wantsRefund ? { moneyAskRefund: true } : {}) } }
  );
  if (!asked.matchedCount) return null;

  const lockedAt = await takeMoneyLock(bookingId);
  // Busy all this time: the holder serves this ask before it lets go.
  if (!lockedAt) return null;

  let result: BookingMoneyResult | null = null;
  try {
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      const state = await Booking.findById(bookingId)
        .select("moneyAsk moneyAskRefund")
        .lean<{ moneyAsk?: number; moneyAskRefund?: boolean } | null>();
      if (!state) return result;
      const seen = state.moneyAsk ?? 0;
      // Somebody asked for a refund to be sent (a cancellation, say): this pass
      // sends it, whatever the caller that holds the lock came for.
      const refund = pass === 0 ? wantsRefund || Boolean(state.moneyAskRefund) : true;
      const run = await settleBookingMoney(bookingId, { refund, byId: pass === 0 ? opts.byId : null });
      if (pass === 0) result = run.result;

      // Let go only if nobody asked while this pass ran; otherwise go round again.
      // A refund that could not even be tried stays asked for, for the sweep.
      const done = await Booking.updateOne(
        { _id: bookingId, moneyLockAt: lockedAt, moneyAsk: seen },
        run.retry
          ? { $unset: { moneyLockAt: 1, moneyAskRefund: 1 }, $set: { moneyDirtyAt: new Date() } }
          : { $unset: { moneyLockAt: 1, moneyAskRefund: 1, moneyDirtyAt: 1 } }
      );
      if (done.modifiedCount) return result;
    }
    return result;
  } finally {
    // However it ended, the lock goes (a no-op when a pass already let it go).
    await Booking.updateOne({ _id: bookingId, moneyLockAt: lockedAt }, { $unset: { moneyLockAt: 1 } });
  }
}

/** The session's money lock, waiting up to WAIT_MS for another holder; null if it never came free. */
async function takeMoneyLock(bookingId: string): Promise<Date | null> {
  const until = Date.now() + WAIT_MS;
  for (;;) {
    const now = new Date();
    const got = await Booking.findOneAndUpdate(
      { _id: bookingId, $or: [{ moneyLockAt: null }, { moneyLockAt: { $lt: new Date(now.getTime() - LOCK_MS) } }] },
      { $set: { moneyLockAt: now } }
    )
      .select("_id")
      .lean();
    if (got) return now;
    if (Date.now() > until) return null;
    await sleep(150 + Math.random() * 150);
  }
}

/**
 * Money decisions asked for and never finished -- the server stopped part-way,
 * a refund could not be tried, a caller gave up waiting -- run now. Nothing in
 * the app runs on a timer, so the screens that show money call this, as they
 * call expireStaleHolds: the Payments ledger, and a patient's Home and Sessions.
 */
export async function sweepBookingMoney(filter: { patientId?: string } = {}): Promise<number> {
  await connectDB();
  const now = Date.now();
  const stale = await Booking.find({
    moneyDirtyAt: { $lt: new Date(now - STALE_ASK_MS) },
    $or: [{ moneyLockAt: null }, { moneyLockAt: { $lt: new Date(now - LOCK_MS) } }],
    ...(filter.patientId ? { patientId: filter.patientId } : {}),
  })
    .select("_id moneyAskRefund")
    .limit(20)
    .lean<Array<{ _id: unknown; moneyAskRefund?: boolean }>>();
  for (const b of stale) {
    await syncBookingMoney(String(b._id), { refund: Boolean(b.moneyAskRefund) }).catch((err) =>
      console.error("[payments] sweep:", err)
    );
  }
  return stale.length;
}

/** One pass: work out what should have gone back, send what has not, write the status. */
async function settleBookingMoney(
  bookingId: string,
  opts: SyncOptions
): Promise<{ result: BookingMoneyResult | null; retry: boolean }> {
  const booking = await Booking.findById(bookingId)
    .select("bookingNo patientId status amount cancelledByRole charges")
    .lean<LeanBooking | null>();
  if (!booking) return { result: null, retry: false };

  const lateCancelFees = (booking.charges ?? [])
    .filter((c) => c.kind === "late_cancel" && c.settledAs !== "waived")
    .reduce((n, c) => n + c.amount, 0);
  const endedByPatient = booking.status === "cancelled" && booking.cancelledByRole === "patient";
  const phase = bookingPhase(booking.status);

  let payments = await capturedFor(bookingId);
  const money = bookingMoney({
    status: booking.status,
    amount: booking.amount ?? 0,
    endedByPatient,
    lateCancelFees,
    payments: payments.map(heldOf),
  });

  let refunded = 0;
  let refundFailed = false;
  let retry = false;
  let speed: string | undefined;
  if (opts.refund !== false && money.refundDue > 0) {
    const { kind, reason } = refundReason(booking, money, phase, endedByPatient);
    for (const part of money.refundFrom) {
      try {
        const out = await refundPayment(part.id, { amount: part.amount, kind, reason, byId: opts.byId ?? null });
        if (out.status === "failed") refundFailed = true;
        else {
          refunded += out.amount;
          speed ??= out.speed;
        }
      } catch (err) {
        // Not even tried (another refund held the payment all this while):
        // owed still, and asked for again so the sweep sends it.
        console.error("[payments] refund during sync:", err);
        refundFailed = true;
        retry = true;
      }
    }
  }

  // A late cancellation's fee is paid out of the session's payment.
  if (endedByPatient && money.kept > 0) {
    await Booking.updateOne(
      { _id: bookingId },
      {
        $set: {
          "charges.$[c].settledAs": "paid",
          "charges.$[c].settledAt": new Date(),
          "charges.$[c].paidMethod": "deducted",
        },
      },
      { arrayFilters: [{ "c.kind": "late_cancel", "c.settledAs": { $exists: false } }] }
    );
  }

  // The status, from what is true after this pass.
  payments = await capturedFor(bookingId);
  const core = payments.filter((p) => CORE.has(p.purpose));
  const after = bookingMoney({
    status: booking.status,
    amount: booking.amount ?? 0,
    endedByPatient,
    lateCancelFees,
    payments: payments.map(heldOf),
  });
  const status = bookingPaymentStatus({
    status: booking.status,
    corePaidGross: core.reduce((n, p) => n + p.amount, 0),
    coreRefunded: core.reduce((n, p) => n + refundedOf(p.refunds), 0),
    coreGoodwill: core.reduce((n, p) => n + goodwillOf(p.refunds), 0),
    refundPending: payments.reduce((n, p) => n + pendingOf(p.refunds), 0),
    refundOwed: after.refundDue,
    price: after.price,
  });
  await Booking.updateOne(
    { _id: bookingId },
    {
      $set: {
        paymentStatus: status,
        paidAmount: fromPaise(core.reduce((n, p) => n + p.amount, 0)),
        refundedAmount: fromPaise(payments.reduce((n, p) => n + refundedOf(p.refunds), 0)),
      },
    }
  );

  if (refunded > 0) {
    await notify(
      String(booking.patientId),
      `Refund on its way · ${booking.bookingNo}`,
      `${inrFromPaise(refunded)} is going back to the account you paid from — ${refundEta(speed)}.`,
      "success",
      "/app/sessions"
    );
  } else if (refundFailed) {
    await notify(
      String(booking.patientId),
      `Your refund is being arranged · ${booking.bookingNo}`,
      "We could not send it back automatically this minute. The team has been told and will send it — you do not need to do anything.",
      "warning",
      "/app/sessions"
    );
  }

  return { result: { refunded, refundFailed, status }, retry };
}

/** Why money goes back, as the refund records it: the kind, and a line for the ledger. */
function refundReason(
  booking: LeanBooking,
  money: { kept: number },
  phase: ReturnType<typeof bookingPhase>,
  endedByPatient: boolean
): { kind: RefundKind; reason: string } {
  const kind: RefundKind =
    phase === "active"
      ? "price_change"
      : booking.status === "rejected"
        ? "declined"
        : endedByPatient && money.kept > 0
          ? "late_cancel"
          : "cancelled";
  const reason =
    kind === "price_change"
      ? `${booking.bookingNo}: paid more than the session now costs`
      : kind === "declined"
        ? `${booking.bookingNo}: declined by the physician`
        : kind === "late_cancel"
          ? `${booking.bookingNo}: cancelled late, less the ${inrFromPaise(money.kept)} late fee`
          : `${booking.bookingNo}: will not go ahead`;
  return { kind, reason };
}

/**
 * Of an admin's refund of `amount` paise on this payment, how much the rules
 * already owe back (an automatic refund that failed, say) -- and under which
 * kind. That part is a retry, recorded as what it is; only the rest is
 * goodwill. Recording a retry as goodwill would leave the rules thinking the
 * refund still owed, and send it a second time.
 */
export async function owedOnPayment(
  paymentId: string
): Promise<{ amount: number; kind: RefundKind; reason: string } | null> {
  await connectDB();
  const p = await Payment.findById(paymentId)
    .select("bookingId purpose")
    .lean<{ bookingId?: unknown; purpose: string } | null>();
  if (!p?.bookingId || !BOOKING_PURPOSES.includes(p.purpose)) return null;
  const booking = await Booking.findById(p.bookingId)
    .select("bookingNo patientId status amount cancelledByRole charges")
    .lean<LeanBooking | null>();
  if (!booking) return null;
  const lateCancelFees = (booking.charges ?? [])
    .filter((c) => c.kind === "late_cancel" && c.settledAs !== "waived")
    .reduce((n, c) => n + c.amount, 0);
  const endedByPatient = booking.status === "cancelled" && booking.cancelledByRole === "patient";
  const phase = bookingPhase(booking.status);
  const money = bookingMoney({
    status: booking.status,
    amount: booking.amount ?? 0,
    endedByPatient,
    lateCancelFees,
    payments: (await capturedFor(String(p.bookingId))).map(heldOf),
  });
  const here = money.refundFrom.find((r) => r.id === paymentId)?.amount ?? 0;
  if (here <= 0) return null;
  return { amount: here, ...refundReason(booking, money, phase, endedByPatient) };
}

/**
 * The same for a clinic order: an order paid online and then cancelled is
 * refunded in full, and the order says so. One paid by transfer keeps
 * "refund due" -- that money goes back the way it came, outside the app.
 */
export async function syncOrderMoney(
  orderId: string,
  opts: { refund?: boolean; byId?: string | null } = {}
): Promise<{ refunded: number; refundFailed: boolean } | null> {
  await connectDB();
  const order = await Order.findById(orderId).select("orderNo status clinicId amount payment").lean<{
    _id: unknown;
    orderNo: string;
    status: string;
    clinicId?: unknown;
    amount?: number;
    payment?: { state?: string; method?: string; refundDue?: boolean; refundedAt?: Date };
  } | null>();
  if (!order) return null;

  const payments = await Payment.find({
    orderId,
    purpose: "order",
    status: { $in: ["paid", "partially_refunded", "refunded"] },
  })
    .select("amount refunds")
    .lean<Array<{ _id: unknown; amount: number; refunds?: RefundEntry[] }>>();
  if (!payments.length) return { refunded: 0, refundFailed: false };

  let refunded = 0;
  let refundFailed = false;
  let speed: string | undefined;
  if (order.status === "CANCELLED" && opts.refund !== false) {
    for (const p of payments) {
      if (p.amount - refundedOf(p.refunds) <= 0) continue;
      try {
        const out = await refundPayment(String(p._id), {
          kind: "cancelled",
          reason: `${order.orderNo}: order cancelled`,
          byId: opts.byId ?? null,
        });
        if (out.status === "failed") refundFailed = true;
        else {
          refunded += out.amount;
          speed ??= out.speed;
        }
      } catch (err) {
        console.error("[payments] order refund:", err);
        refundFailed = true;
      }
    }
  }

  // Where the refund stands, on the order itself.
  const fresh = await Payment.find({ _id: { $in: payments.map((p) => p._id) } })
    .select("amount refunds")
    .lean<Array<{ amount: number; refunds?: RefundEntry[] }>>();
  const owed = fresh.reduce((n, p) => n + p.amount - refundedOf(p.refunds), 0);
  const pending = fresh.reduce((n, p) => n + pendingOf(p.refunds), 0);
  const anyRefund = fresh.some((p) => refundedOf(p.refunds) > 0);
  if (order.status === "CANCELLED" && order.payment?.method === "online") {
    await Order.updateOne(
      { _id: orderId },
      {
        $set: {
          "payment.refundDue": owed > 0 || pending > 0,
          ...(anyRefund && !order.payment?.refundedAt && owed === 0 && pending === 0
            ? { "payment.refundedAt": new Date() }
            : {}),
        },
        ...(anyRefund ? { $min: { "payment.refundStartedAt": new Date() } } : {}),
      }
    );
  }

  if (refunded > 0 && order.clinicId) {
    await notify(
      String(order.clinicId),
      `Refund on its way · ${order.orderNo}`,
      `${inrFromPaise(refunded)} is going back to the account you paid from — ${refundEta(speed)}.`,
      "success",
      `/clinic/orders/${orderId}`
    );
  }
  return { refunded, refundFailed };
}

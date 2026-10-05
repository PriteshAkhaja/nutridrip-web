import crypto from "node:crypto";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, Invoice, Order, User } from "@/lib/models";
import type { PaymentPurpose } from "@/lib/models/Payment";
import { CreateBooking, bookSlot, planBooking } from "@/lib/booking/create";
import { moveSlot, planMove } from "@/lib/booking/move";
import { needsPayment, payState, type OrderPayment } from "@/lib/billing/order-payment";
import { notify, notifyRole } from "@/lib/notify";
import { getClockFormat } from "@/lib/settings/clock";
import { shortDateClock } from "@/lib/time";
import { NotApplied, PaymentRefusal } from "./errors";
import { syncBookingMoney } from "./money";
import { bookingMoney, bookingPhase, fromPaise, heldOf, inrFromPaise, toPaise } from "./rules";
import { refundPayment, type RefundEntry } from "./refunds";
import { Payment } from "@/lib/models";

/**
 * What each kind of payment is for: how the amount is worked out and checked
 * before checkout opens (prepare), and what happens once the money is in
 * (apply). A prepare that refuses means nobody is charged; an apply that
 * refuses means the payment is refunded in full.
 */

export const CheckoutInput = z.discriminatedUnion("purpose", [
  z.object({ purpose: z.literal("booking"), booking: CreateBooking }),
  z.object({ purpose: z.literal("booking_balance"), bookingId: z.string() }),
  z.object({ purpose: z.literal("reschedule_fee"), bookingId: z.string(), scheduledAt: z.string().datetime() }),
  z.object({ purpose: z.literal("late_fee"), bookingId: z.string() }),
  z.object({ purpose: z.literal("order"), orderId: z.string() }),
  /** An invoice is named by its order, as its page is. */
  z.object({ purpose: z.literal("invoice"), orderId: z.string() }),
]);
export type CheckoutInput = z.infer<typeof CheckoutInput>;

export type Actor = { sub: string; role: string };

export type Prepared = {
  purpose: PaymentPurpose;
  /** Rupees. */
  amountInr: number;
  description: string;
  /** Where the person goes afterwards. */
  returnTo: string;
  bookingId?: string;
  orderId?: string;
  invoiceId?: string;
  intent?: Record<string, unknown>;
  /** "The same checkout": a second press within half an hour reuses it. */
  intentKey: string;
  notes: Record<string, string>;
};

const keyOf = (value: unknown) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32);

type PaymentLite = {
  _id: unknown;
  purpose: string;
  amount: number;
  paidAt?: Date;
  createdAt?: Date;
  refunds?: RefundEntry[];
};

async function heldForBooking(bookingId: string) {
  return Payment.find({
    bookingId,
    purpose: { $in: ["booking", "booking_balance", "reschedule_fee", "late_fee"] },
    status: { $in: ["paid", "partially_refunded", "refunded"] },
  })
    .select("purpose amount paidAt createdAt refunds")
    .lean<PaymentLite[]>();
}

async function ownBooking(actor: Actor, bookingId: string) {
  if (actor.role !== "patient") throw new PaymentRefusal("Only the patient pays for their session.", 403);
  const booking = await Booking.findById(bookingId);
  if (!booking || String(booking.patientId) !== actor.sub) throw new PaymentRefusal("Session not found.", 404);
  return booking;
}

/* ============================================================== prepare */

export async function prepare(actor: Actor, input: CheckoutInput): Promise<Prepared> {
  await connectDB();
  const clockFmt = await getClockFormat();

  switch (input.purpose) {
    case "booking": {
      if (actor.role !== "patient") throw new PaymentRefusal("Only a patient books a session.", 403);
      const planned = await planBooking(actor.sub, input.booking);
      if ("error" in planned) throw new PaymentRefusal(planned.error, planned.status);
      const { plan } = planned;
      if (plan.drip.priceInr < 1) {
        throw new PaymentRefusal(
          "This drip has no price set, so it cannot be paid for online. Contact us to book it.",
          409
        );
      }
      return {
        purpose: "booking",
        amountInr: plan.drip.priceInr,
        description: `${plan.drip.name} · ${shortDateClock(plan.when, clockFmt)}`,
        returnTo: "/app",
        intent: { booking: input.booking },
        intentKey: keyOf(["booking", input.booking]),
        notes: { purpose: "booking", drip: plan.drip.name },
      };
    }

    case "booking_balance": {
      const booking = await ownBooking(actor, input.bookingId);
      const held = await heldForBooking(input.bookingId);
      const money = bookingMoney({
        status: booking.status,
        amount: booking.amount ?? 0,
        endedByPatient: false,
        lateCancelFees: 0,
        payments: held.map(heldOf),
      });
      if (money.balanceDue <= 0) throw new PaymentRefusal("Nothing is owed on this session.", 409);
      return {
        purpose: "booking_balance",
        amountInr: fromPaise(money.balanceDue),
        description: `${booking.dripName ?? "Session"} · balance · ${booking.bookingNo}`,
        returnTo: "/app/sessions",
        bookingId: String(booking._id),
        intentKey: keyOf(["balance", input.bookingId, money.balanceDue]),
        notes: { purpose: "booking_balance", booking: booking.bookingNo },
      };
    }

    case "reschedule_fee": {
      const booking = await ownBooking(actor, input.bookingId);
      const planned = await planMove(actor, booking, new Date(input.scheduledAt));
      if ("error" in planned) throw new PaymentRefusal(planned.error, planned.status);
      if (planned.plan.fee <= 0) {
        throw new PaymentRefusal("Moving this session is free — move it without paying.", 409, { code: "no_fee" });
      }
      return {
        purpose: "reschedule_fee",
        amountInr: planned.plan.fee,
        description: `Late move · ${booking.bookingNo} to ${shortDateClock(planned.plan.next, clockFmt)}`,
        returnTo: "/app/sessions",
        bookingId: String(booking._id),
        intent: { scheduledAt: input.scheduledAt },
        intentKey: keyOf(["move", input.bookingId, input.scheduledAt]),
        notes: { purpose: "reschedule_fee", booking: booking.bookingNo },
      };
    }

    case "late_fee": {
      const booking = await ownBooking(actor, input.bookingId);
      const owed = (booking.charges ?? []).filter((c: { settledAs?: string }) => !c.settledAs) as Array<{
        at: Date;
        amount: number;
      }>;
      const total = owed.reduce((n, c) => n + c.amount, 0);
      if (total <= 0) throw new PaymentRefusal("No fees are owed on this session.", 409);
      const at = owed.map((c) => new Date(c.at).toISOString());
      return {
        purpose: "late_fee",
        amountInr: total,
        description: `Late-change fee${owed.length === 1 ? "" : "s"} · ${booking.bookingNo}`,
        returnTo: "/app/sessions",
        bookingId: String(booking._id),
        intent: { chargesAt: at },
        intentKey: keyOf(["late", input.bookingId, at]),
        notes: { purpose: "late_fee", booking: booking.bookingNo },
      };
    }

    case "order": {
      if (actor.role !== "clinic") throw new PaymentRefusal("Only the clinic pays for its order.", 403);
      const order = await Order.findById(input.orderId).lean<{
        _id: unknown;
        orderNo: string;
        status: string;
        clinicId?: unknown;
        amount?: number;
        onCredit?: boolean;
        payment?: OrderPayment | null;
      } | null>();
      if (!order || String(order.clinicId) !== actor.sub) throw new PaymentRefusal("Order not found.", 404);
      const clinic = await User.findById(actor.sub)
        .select("clinic.onCredit")
        .lean<{ clinic?: { onCredit?: boolean } } | null>();
      if (!needsPayment(order, clinic?.clinic?.onCredit ?? false)) {
        throw new PaymentRefusal(
          "This order is on credit — it is invoiced once dispatched, and paid from Billing.",
          409
        );
      }
      if (order.status !== "DRAFT") throw new PaymentRefusal("This order has moved on; it can no longer be paid.", 409);
      const state = payState(order, clinic?.clinic?.onCredit ?? false);
      if (state === "received") throw new PaymentRefusal("This order is already paid.", 409);
      if (state === "submitted") {
        throw new PaymentRefusal(
          "You have recorded a transfer for this order, which the team is checking. If it did not go through, ask them to send it back to you first — that way nothing is paid twice.",
          409
        );
      }
      if ((order.amount ?? 0) < 1) throw new PaymentRefusal("This order has no amount to pay.", 409);
      return {
        purpose: "order",
        amountInr: order.amount ?? 0,
        description: `Order ${order.orderNo}`,
        returnTo: `/clinic/orders/${String(order._id)}`,
        orderId: String(order._id),
        intentKey: keyOf(["order", String(order._id), order.amount]),
        notes: { purpose: "order", order: order.orderNo },
      };
    }

    case "invoice": {
      if (actor.role !== "clinic") throw new PaymentRefusal("Only the clinic pays its invoices.", 403);
      const invoice = await Invoice.findOne({ orderId: input.orderId }).lean<{
        _id: unknown;
        invoiceNo: string;
        orderId: unknown;
        clinicId?: unknown;
        grandTotal?: number;
        payment?: { state?: string };
      } | null>();
      if (!invoice || String(invoice.clinicId) !== actor.sub) {
        throw new PaymentRefusal("Open the invoice first — it is raised the first time it is opened.", 404);
      }
      if (invoice.payment?.state === "paid") throw new PaymentRefusal("This invoice is already paid.", 409);
      const order = await Order.findById(invoice.orderId)
        .select("payment.state")
        .lean<{ payment?: { state?: string } } | null>();
      if (order?.payment?.state === "received") throw new PaymentRefusal("This order was paid in advance.", 409);
      if ((invoice.grandTotal ?? 0) < 1) throw new PaymentRefusal("This invoice has nothing to pay.", 409);
      return {
        purpose: "invoice",
        amountInr: invoice.grandTotal ?? 0,
        description: `Invoice ${invoice.invoiceNo}`,
        returnTo: `/invoice/${input.orderId}`,
        invoiceId: String(invoice._id),
        orderId: String(invoice.orderId),
        intentKey: keyOf(["invoice", String(invoice._id), invoice.grandTotal]),
        notes: { purpose: "invoice", invoice: invoice.invoiceNo },
      };
    }
  }
}

/* ================================================================ apply */

export type PaymentForApply = {
  _id: unknown;
  receiptNo: string;
  purpose: PaymentPurpose;
  amount: number;
  payerId: unknown;
  payerRole: string;
  bookingId?: unknown;
  orderId?: unknown;
  invoiceId?: unknown;
  intent?: Record<string, unknown> | null;
  rzpPaymentId?: string;
  methodLabel?: string;
};

export type Applied = {
  /** Set when the payment created or belongs to a session. */
  bookingId?: string;
  /** What the person is told. */
  message: string;
  returnTo: string;
};

/**
 * Evidence that a payment has already been applied, for when applying it
 * threw half-way: a booking that exists must never be refunded as though it
 * did not.
 */
export async function alreadyApplied(p: PaymentForApply): Promise<Applied | null> {
  await connectDB();
  const id = p._id;
  switch (p.purpose) {
    case "booking": {
      const b = await Booking.findOne({ createdFromPaymentId: id })
        .select("bookingNo")
        .lean<{ _id: unknown; bookingNo: string } | null>();
      return b ? { bookingId: String(b._id), message: `${b.bookingNo} is booked.`, returnTo: "/app" } : null;
    }
    case "reschedule_fee":
    case "late_fee": {
      const b = await Booking.findOne({ _id: p.bookingId, "charges.paymentId": id }).select("_id").lean();
      return b ? { bookingId: String(p.bookingId), message: "Paid.", returnTo: "/app/sessions" } : null;
    }
    case "order": {
      const o = await Order.findOne({ _id: p.orderId, "payment.paymentId": id }).select("_id").lean();
      return o ? { message: "Paid.", returnTo: `/clinic/orders/${String(p.orderId)}` } : null;
    }
    case "invoice": {
      const i = await Invoice.findOne({ _id: p.invoiceId, "payment.paymentId": id }).select("_id").lean();
      return i ? { message: "Paid.", returnTo: `/invoice/${String(p.orderId)}` } : null;
    }
    default:
      return null;
  }
}

export async function apply(p: PaymentForApply): Promise<Applied> {
  await connectDB();
  const actor: Actor = { sub: String(p.payerId), role: p.payerRole };
  const clockFmt = await getClockFormat();
  const paid = inrFromPaise(p.amount);

  switch (p.purpose) {
    case "booking": {
      const done = await alreadyApplied(p);
      if (done) return done;
      const input = CreateBooking.parse((p.intent as { booking?: unknown } | null)?.booking);
      // Every rule again, and the booking written, in one step no other
      // booking can interleave with: if the slot went while the patient was
      // paying -- to another payment landing the same instant, even -- this is
      // refused and the payment refunded, never booked without a nurse.
      let made;
      try {
        made = await bookSlot(
          actor.sub,
          input,
          { id: actor.sub, role: "patient" },
          { paymentId: String(p._id), amountInr: fromPaise(p.amount) }
        );
      } catch (err) {
        // Confirmed twice at once (browser and webhook): the other one booked it.
        if ((err as { code?: number })?.code === 11000) {
          const again = await alreadyApplied(p);
          if (again) return again;
        }
        throw err;
      }
      if ("error" in made) throw new NotApplied(`Your slot could not be booked: ${made.error}`);
      const booking = made.booking;
      await Payment.updateOne({ _id: p._id }, { $set: { bookingId: booking._id } });
      await syncBookingMoney(String(booking._id));
      if (!made.made) {
        return {
          bookingId: String(booking._id),
          message: `${booking.bookingNo} is booked.`,
          returnTo: "/app",
        };
      }
      await notify(
        actor.sub,
        `Paid and booked · ${booking.bookingNo}`,
        `${paid} for ${booking.dripName ?? "your session"}, ${shortDateClock(booking.scheduledAt, clockFmt)}. Receipt ${p.receiptNo}.${
          booking.status === "awaiting_review"
            ? " Your slot is held for the physician; if they do not approve, this is refunded in full."
            : ""
        }`,
        "success",
        "/app"
      );
      return {
        bookingId: String(booking._id),
        message:
          booking.status === "awaiting_review"
            ? `${booking.bookingNo} is held for you. It is confirmed once a physician approves — and refunded in full if they do not.`
            : `${booking.bookingNo} is booked for ${shortDateClock(booking.scheduledAt, clockFmt)}.`,
        returnTo: "/app",
      };
    }

    case "booking_balance": {
      const bookingId = String(p.bookingId);
      const booking = await Booking.findById(bookingId)
        .select("status amount")
        .lean<{ status: string; amount?: number } | null>();
      if (!booking) throw new NotApplied("That session no longer exists.");
      // Called off while the balance was being paid: this payment goes back
      // whole, and the session's own refund covers the rest.
      if (bookingPhase(booking.status) === "ended") {
        throw new NotApplied("Your session was called off while you were paying, so this payment is going back.");
      }
      // Nothing owed any more without this payment (the physician switched
      // back, say): it was never needed, so it goes back whole.
      const others = (await heldForBooking(bookingId)).filter((x) => String(x._id) !== String(p._id));
      const owed = bookingMoney({
        status: booking.status,
        amount: booking.amount ?? 0,
        endedByPatient: false,
        lateCancelFees: 0,
        payments: others.map(heldOf),
      }).balanceDue;
      if (owed <= 0) throw new NotApplied("Nothing was owed on this session any more, so this payment is going back.");
      // More than is owed now (the price came down while paying): the rules send the difference back.
      await syncBookingMoney(bookingId);
      return { bookingId, message: "The balance is paid. Your session is fully paid for.", returnTo: "/app/sessions" };
    }

    case "reschedule_fee": {
      const done = await alreadyApplied(p);
      if (done) return done;
      const bookingId = String(p.bookingId);
      const when = new Date(String((p.intent as { scheduledAt?: string } | null)?.scheduledAt));
      // Checked again and moved in one step: a time taken while the fee was
      // being paid refunds the fee rather than moving onto a busy nurse.
      const moved = await moveSlot(actor, bookingId, when, {
        acceptedFee: fromPaise(p.amount),
        paidFee: { paymentId: String(p._id), amount: fromPaise(p.amount) },
      });
      if ("error" in moved) {
        throw new NotApplied(
          moved.status === 404 ? "That session no longer exists." : `The session could not be moved: ${moved.error}`
        );
      }
      const booking = await Booking.findById(bookingId).select("bookingNo").lean<{ bookingNo?: string } | null>();
      return {
        bookingId,
        message: `${booking?.bookingNo ?? "Your session"} is moved to ${shortDateClock(moved.scheduledAt, clockFmt)}. The late fee is paid.`,
        returnTo: "/app/sessions",
      };
    }

    case "late_fee": {
      const done = await alreadyApplied(p);
      if (done) return done;
      const wanted = new Set(
        ((p.intent as { chargesAt?: string[] } | null)?.chargesAt ?? []).map((a) => new Date(a).getTime())
      );
      const booking = await Booking.findById(p.bookingId);
      if (!booking) throw new NotApplied("That session no longer exists.");
      let settled = 0;
      for (const c of booking.charges ?? []) {
        if (c.settledAs || !wanted.has(new Date(c.at).getTime())) continue;
        c.settledAs = "paid";
        c.settledAt = new Date();
        c.settledById = actor.sub;
        c.paidMethod = "online";
        c.paymentId = p._id;
        settled += c.amount;
      }
      if (settled === 0) throw new NotApplied("Those fees had already been settled.");
      booking.markModified("charges");
      await booking.save();
      const surplus = p.amount - toPaise(settled);
      if (surplus > 0) {
        // A fee waived while the patient was paying: that part goes back.
        await refundPayment(String(p._id), {
          amount: surplus,
          kind: "not_applied",
          reason: "A fee was waived while it was being paid",
        });
      }
      return { bookingId: String(booking._id), message: "The late-change fees are paid.", returnTo: "/app/sessions" };
    }

    case "order": {
      const now = new Date();
      // Not over a bank transfer the clinic recorded while this was being paid:
      // that is the same order paid twice, so this one goes back.
      const updated = await Order.findOneAndUpdate(
        { _id: p.orderId, status: "DRAFT", "payment.state": { $nin: ["received", "submitted"] } },
        {
          $set: {
            payment: {
              state: "received",
              method: "online",
              reference: p.rzpPaymentId,
              paidOn: now,
              submittedAt: now,
              submittedBy: actor.sub,
              verifiedAt: now,
              paymentId: p._id,
            },
          },
        },
        { new: true }
      ).lean<{ _id: unknown; orderNo: string; amount?: number } | null>();
      if (!updated) {
        const again = await alreadyApplied(p);
        if (again) return again;
        const now = await Order.findById(p.orderId)
          .select("status payment.state")
          .lean<{ status?: string; payment?: { state?: string } } | null>();
        throw new NotApplied(
          now?.payment?.state === "submitted"
            ? "A bank transfer was recorded for this order while you were paying, so this payment is going back — nothing is paid twice."
            : now?.status && now.status !== "DRAFT"
              ? "This order moved on while you were paying, so it can no longer be paid for."
              : "This order was already paid."
        );
      }
      const clinic = await User.findById(actor.sub).select("name").lean<{ name?: string } | null>();
      await notifyRole(
        ["admin", "superadmin"],
        `Paid online · ${updated.orderNo}`,
        `${clinic?.name ?? "A clinic"} paid ${paid} through Razorpay (${p.methodLabel ?? "online"}). Nothing to check — confirm the order.`,
        "success",
        `/admin/inventory/orders/${String(updated._id)}`
      );
      await notify(
        actor.sub,
        `Payment received · ${updated.orderNo}`,
        `${paid}, receipt ${p.receiptNo}. Your order goes to the pharmacy to be confirmed.`,
        "success",
        `/clinic/orders/${String(updated._id)}`
      );
      return {
        message: "Paid. Your order goes to the pharmacy to be confirmed.",
        returnTo: `/clinic/orders/${String(updated._id)}`,
      };
    }

    case "invoice": {
      const updated = await Invoice.findOneAndUpdate(
        { _id: p.invoiceId, "payment.state": { $ne: "paid" } },
        {
          $set: {
            payment: {
              state: "paid",
              method: "online",
              reference: p.rzpPaymentId,
              paidAt: new Date(),
              paymentId: p._id,
            },
          },
        },
        { new: true }
      ).lean<{ _id: unknown; invoiceNo: string; orderId: unknown } | null>();
      if (!updated) {
        const again = await alreadyApplied(p);
        if (again) return again;
        throw new NotApplied("This invoice was already paid.");
      }
      const clinic = await User.findById(actor.sub).select("name").lean<{ name?: string } | null>();
      await notifyRole(
        ["admin", "superadmin"],
        `Invoice paid · ${updated.invoiceNo}`,
        `${clinic?.name ?? "A clinic"} paid ${paid} online.`,
        "success",
        `/invoice/${String(updated.orderId)}`
      );
      return { message: `Invoice ${updated.invoiceNo} is paid.`, returnTo: `/invoice/${String(updated.orderId)}` };
    }
  }
  throw new NotApplied("This payment is for something the app does not know how to complete.");
}

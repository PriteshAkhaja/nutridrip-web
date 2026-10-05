import { Schema, model, models } from "mongoose";

/**
 * What a payment is for. The amount is always worked out on the server from
 * the thing being paid for -- never taken from the browser.
 *
 *   booking          a session's drip price, paid to book it (or hold it)
 *   booking_balance  the difference after a physician switched to a dearer drip
 *   reschedule_fee   the late fee for moving a session inside the late window
 *   late_fee         late-change fees recorded before payment was online
 *   order            a clinic paying for an order before it is prepared
 *   invoice          a clinic on credit paying an invoice
 */
export const PAYMENT_PURPOSES = [
  "booking",
  "booking_balance",
  "reschedule_fee",
  "late_fee",
  "order",
  "invoice",
] as const;
export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number];

/**
 *   created             checkout started, no money yet (a failed attempt keeps it payable)
 *   failed              the last attempt failed; the same order can still be paid
 *   paid                captured
 *   partially_refunded  some of it has gone back (or is on its way)
 *   refunded            all of it has gone back (or is on its way)
 */
export const PAYMENT_STATUS = ["created", "failed", "paid", "partially_refunded", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

/** Why money went back. Kept, so the ledger explains itself. */
export const REFUND_KINDS = [
  "cancelled", // the session or order will not happen
  "late_cancel", // the patient cancelled late: refunded less the late fee
  "declined", // a physician declined
  "price_change", // a physician switched to a cheaper drip
  "not_applied", // paid, but what it paid for could no longer be done
  "duplicate", // a second payment against something already paid
  "manual", // an admin refunded it by hand
] as const;
export type RefundKind = (typeof REFUND_KINDS)[number];

const RefundSchema = new Schema(
  {
    /** Razorpay's refund id; absent when the request itself failed. */
    refundId: String,
    /** The Razorpay payment it came off -- nearly always ours, but a duplicate capture is refunded too. */
    rzpPaymentId: String,
    /** Paise. */
    amount: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ["pending", "processed", "failed"], required: true },
    kind: { type: String, enum: REFUND_KINDS, required: true },
    reason: String,
    byId: { type: Schema.Types.ObjectId, ref: "User" },
    at: { type: Date, required: true },
    processedAt: Date,
    failedAt: Date,
    /** Razorpay's words when it refused, or why the request could not be sent. */
    error: String,
    /**
     * The request left but no answer came back, so Razorpay may or may not have
     * made the refund. Settled by asking Razorpay (pullRefunds) before anything
     * is sent again -- never by simply retrying, which could refund twice.
     */
    uncertain: Boolean,
    /** The bank's reference once processed: what a customer quotes to their bank. */
    arn: String,
    speed: String,
  },
  { _id: true }
);

const FailureSchema = new Schema(
  {
    at: { type: Date, required: true },
    paymentId: String,
    code: String,
    reason: String,
    description: String,
    source: String,
    step: String,
  },
  { _id: false }
);

/**
 * One checkout: a Razorpay order, what it is for, and everything that happened
 * to the money afterwards.
 *
 * The Razorpay order id is unique, and the Razorpay payment id is unique once
 * known, so the browser's confirmation and the webhook -- which race each other
 * -- can only ever apply a payment once.
 */
const PaymentSchema = new Schema(
  {
    /** RCPT-2026-0001: the number on the receipt, and what support asks for. */
    receiptNo: { type: String, required: true, unique: true, index: true },
    purpose: { type: String, enum: PAYMENT_PURPOSES, required: true, index: true },
    status: { type: String, enum: PAYMENT_STATUS, default: "created", index: true },

    /** Paise, and INR: what Razorpay was asked to collect. */
    amount: { type: Number, required: true, min: 100 },
    currency: { type: String, default: "INR" },
    description: String,

    payerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    payerRole: { type: String, enum: ["patient", "clinic", "admin", "superadmin"], required: true },

    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", index: true },
    /** What to do once paid, where the thing does not exist yet (a booking) or needs a detail (a new time). */
    intent: { type: Schema.Types.Mixed },
    /** Identifies "the same checkout" so a second press reuses the order instead of opening another. */
    intentKey: { type: String, index: true },

    /** Set once Razorpay has created the order (the record is written first, so its receipt number is ours). */
    rzpOrderId: { type: String, unique: true, sparse: true },
    rzpPaymentId: { type: String, unique: true, sparse: true },
    /** "upi", "card", ... and a readable line: "UPI · name@okhdfc", "Visa •••• 1111". */
    method: String,
    methodLabel: String,
    paidAt: Date,
    /** How we learnt it was paid: the browser, Razorpay's webhook, or a later check. */
    confirmedVia: { type: String, enum: ["checkout", "webhook", "reconcile"] },
    /** Razorpay's fee and the GST on it, paise, for reconciling the settlement. */
    fee: Number,
    tax: Number,

    /**
     * Doing what the payment was for. pending while it runs (lockAt guards it),
     * applied once done, failed when it could not be done -- which refunds it.
     */
    apply: {
      state: { type: String, enum: ["pending", "applied", "failed"] },
      at: Date,
      lockAt: Date,
      error: String,
    },

    failures: { type: [FailureSchema], default: [] },
    /**
     * A second payment captured against the same Razorpay order (it happens:
     * a UPI approval arriving after a card succeeded). It is not this payment,
     * so it is kept apart from `refunds` -- it must never make this payment
     * look refunded -- and is refunded in full on sight.
     */
    duplicates: {
      type: [
        new Schema(
          {
            rzpPaymentId: { type: String, required: true },
            amount: { type: Number, required: true },
            refundId: String,
            status: { type: String, enum: ["pending", "processed", "failed"], required: true },
            at: { type: Date, required: true },
            error: String,
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    /** What was asked for, when Razorpay captured a different amount (never applied; refunded). */
    expectedAmount: Number,
    refunds: { type: [RefundSchema], default: [] },
    /** Paise gone back or on the way (processed + pending); failed refunds do not count. */
    refundedAmount: { type: Number, default: 0 },
    /** Only one refund decision at a time. */
    refundLockAt: Date,
    /**
     * Something a person must look at: a refund that failed (or whose outcome is
     * unknown), a second payment that could not be sent back. Cleared when it is
     * resolved. What the Payments page's "Needs attention" and the nav badge count.
     */
    attention: { type: String, enum: ["refund_failed", "duplicate_unrefunded"] },

    /** Webhook event ids already handled, newest last (capped), so a redelivery is a no-op. */
    events: { type: [String], default: [] },
  },
  { timestamps: true }
);

PaymentSchema.index({ status: 1, createdAt: -1, _id: -1 });
PaymentSchema.index({ payerId: 1, purpose: 1, intentKey: 1, status: 1, createdAt: -1 });
PaymentSchema.index({ "refunds.refundId": 1 }, { sparse: true });
PaymentSchema.index({ "apply.state": 1 });
PaymentSchema.index({ attention: 1 }, { sparse: true });

export const Payment = models.Payment || model("Payment", PaymentSchema);
export default Payment;

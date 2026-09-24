import { Schema, model, models } from "mongoose";
import { ORDER_STATUS } from "./types";

const OrderLineSchema = new Schema(
  {
    dripId: { type: Schema.Types.ObjectId, ref: "Drip", required: true },
    dripName: String,
    quantity: { type: Number, required: true, min: 1 },
    withKit: { type: Boolean, default: true },
    unitPrice: { type: Number, default: 0 },
  },
  { _id: true }
);

/**
 * A preparation request. DRAFT holds nothing; CONFIRMED soft-reserves the exact
 * units it will need; DISPATCHED consumes them FEFO and writes the ledger;
 * CANCELLED releases the reservation.
 */
const OrderSchema = new Schema(
  {
    orderNo: { type: String, required: true, unique: true, index: true },
    /** Clinic code preferred over patient name, per DPDP. */
    patientRef: String,
    patientName: String,
    patientId: { type: Schema.Types.ObjectId, ref: "User" },
    clinicId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    orderedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

    status: { type: String, enum: ORDER_STATUS, default: "DRAFT", index: true },
    lines: { type: [OrderLineSchema], default: [] },
    includeKits: { type: Boolean, default: true },

    amount: { type: Number, default: 0 },
    /**
     * The clinic's terms when the order was placed. Off (the default), the
     * clinic pays before the order is confirmed; on, it pays within 30 days of
     * the invoice, as before. Absent on orders placed before the rule existed.
     */
    onCredit: Boolean,
    /**
     * The clinic's payment for this order, made outside the app and recorded
     * here: awaiting → submitted (the clinic says it paid, with the reference)
     * → received (the team found the money). See lib/billing/order-payment.
     */
    payment: {
      state: { type: String, enum: ["awaiting", "submitted", "received"] },
      method: { type: String, enum: ["upi", "bank_transfer", "cheque"] },
      reference: String,
      paidOn: Date,
      submittedAt: Date,
      submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
      verifiedAt: Date,
      verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
      /** Why the team could not find it, when they sent it back to the clinic. */
      note: String,
      /** Cancelled after the money arrived: owed back to the clinic. */
      refundDue: Boolean,
    },
    scheduledDelivery: Date,
    notes: String,

    confirmedAt: Date,
    dispatchedAt: Date,
    cancelledAt: Date,
    cancelReason: String,
  },
  { timestamps: true }
);

OrderSchema.index({ status: 1, createdAt: -1, _id: -1 });

/** Serves the paged lists: the filter, then the sort, so a page is an index walk. */
OrderSchema.index({ clinicId: 1, createdAt: -1, _id: -1 });

export const Order = models.Order || model("Order", OrderSchema);
export default Order;

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
    scheduledDelivery: Date,
    notes: String,

    confirmedAt: Date,
    dispatchedAt: Date,
    cancelledAt: Date,
    cancelReason: String,
  },
  { timestamps: true }
);

OrderSchema.index({ status: 1, createdAt: -1 });

export const Order = models.Order || model("Order", OrderSchema);
export default Order;

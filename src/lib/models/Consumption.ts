import { Schema, model, models } from "mongoose";

/**
 * Immutable dispatch ledger — which batch fed which order. This is the recall
 * and traceability trail; rows are never updated or deleted.
 */
const ConsumptionSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    lotId: { type: Schema.Types.ObjectId, ref: "BatchLot", required: true, index: true },
    masterId: { type: Schema.Types.ObjectId, ref: "ProductMaster", required: true, index: true },
    batchNo: String,
    drugName: String,

    unitsConsumed: { type: Number, required: true },
    /** Active content actually delivered, in the lot's content unit. */
    activeUsed: { type: Number, default: 0 },
    /** Content discarded because single-use vials are indivisible. */
    wasted: { type: Number, default: 0 },
    contentUnit: String,

    dispatchedAt: { type: Date, default: Date.now, index: true },
    dispatchedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Consumption = models.Consumption || model("Consumption", ConsumptionSchema);
export default Consumption;

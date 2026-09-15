import { Schema, model, models } from "mongoose";

/**
 * Soft reservation written on order confirm. The units still physically exist
 * but stop counting as available, so two orders cannot promise the same vial.
 */
const AllocationSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    lotId: { type: Schema.Types.ObjectId, ref: "BatchLot", required: true, index: true },
    masterId: { type: Schema.Types.ObjectId, ref: "ProductMaster", required: true },
    unitsReserved: { type: Number, required: true, min: 0 },
    releasedAt: Date,
  },
  { timestamps: true }
);

export const Allocation = models.Allocation || model("Allocation", AllocationSchema);
export default Allocation;

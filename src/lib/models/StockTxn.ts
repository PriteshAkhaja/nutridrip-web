import { Schema, model, models } from "mongoose";
import { TXN_TYPES } from "./types";

/** Full audit trail of every stock movement. */
const StockTxnSchema = new Schema(
  {
    type: { type: String, enum: TXN_TYPES, required: true, index: true },
    lotId: { type: Schema.Types.ObjectId, ref: "BatchLot", required: true, index: true },
    masterId: { type: Schema.Types.ObjectId, ref: "ProductMaster", required: true },
    /** Signed: positive adds to hand, negative removes. */
    delta: { type: Number, required: true },
    balanceAfter: Number,
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    reason: String,
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

StockTxnSchema.index({ createdAt: -1 });

export const StockTxn = models.StockTxn || model("StockTxn", StockTxnSchema);
export default StockTxn;

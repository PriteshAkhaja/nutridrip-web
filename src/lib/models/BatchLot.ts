import { Schema, model, models } from "mongoose";
import { UNITS, UNIT_FORMS } from "./types";

/**
 * A physical lot received under a master. "Vitamin C" is one master; VC-B7
 * expiring soon and VC-B9 expiring later are two lots of it, possibly from
 * different brands at different strengths.
 */
const BatchLotSchema = new Schema(
  {
    masterId: { type: Schema.Types.ObjectId, ref: "ProductMaster", required: true, index: true },
    brandName: { type: String, required: true, trim: true },
    manufacturer: String,
    batchNo: { type: String, required: true, trim: true },
    expiry: { type: Date, required: true, index: true },

    /** Active content per physical unit, e.g. 500 mg per vial. */
    contentValue: { type: Number, required: true },
    contentUnit: { type: String, enum: UNITS, required: true },
    packVolumeMl: Number,
    unitForm: { type: String, enum: UNIT_FORMS, default: "Vial" },

    qtyReceived: { type: Number, required: true, min: 0 },
    qtyOnHand: { type: Number, required: true, min: 0 },
    /** Soft-reserved by CONFIRMED orders; still on the shelf, not available. */
    qtyReserved: { type: Number, default: 0, min: 0 },

    costPerUnit: Number,
    mrp: Number,

    /** Quarantined lots are excluded from availability without being deleted. */
    isQuarantined: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

BatchLotSchema.index({ masterId: 1, batchNo: 1 }, { unique: true });
/** FEFO reads: earliest expiry first, within a master. */
BatchLotSchema.index({ masterId: 1, expiry: 1 });

/** Serves the paged lists: the filter, then the sort, so a page is an index walk. */
BatchLotSchema.index({ isActive: 1, expiry: 1, _id: 1 });

export const BatchLot = models.BatchLot || model("BatchLot", BatchLotSchema);
export default BatchLot;

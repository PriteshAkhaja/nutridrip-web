import { Schema, model, models } from "mongoose";
import { CATEGORIES, UNITS } from "./types";

/**
 * The drug's identity — name, molecule, HSN, GST, category, expected dosing
 * unit. Physical stock never lives here; it lives in BatchLot.
 */
const ProductMasterSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    molecule: { type: String, trim: true },
    hsnCode: { type: String, required: true, trim: true, unique: true },
    gstRate: { type: Number, default: 12 },
    category: { type: String, enum: CATEGORIES, required: true, index: true },
    /** The unit doses are expected in. Mismatches raise a unit-slip warning. */
    canonicalUnit: { type: String, enum: UNITS, required: true },
    reorderLevel: { type: Number, default: 0 },
    /** Multidose vials carry remainder to the next drip; single-use wastes it. */
    isMultidose: { type: Boolean, default: false },
    storageCondition: String,
    notes: String,
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

ProductMasterSchema.index({ name: "text", molecule: "text", hsnCode: "text" });

export const ProductMaster = models.ProductMaster || model("ProductMaster", ProductMasterSchema);
export default ProductMaster;

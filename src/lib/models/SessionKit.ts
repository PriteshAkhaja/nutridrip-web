import { Schema, model, models } from "mongoose";

/** Consumables bundle deducted per drip prepared — IV set, cannula, swabs. */
const KitItemSchema = new Schema(
  {
    masterId: { type: Schema.Types.ObjectId, ref: "ProductMaster", required: true },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const SessionKitSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: String,
    items: { type: [KitItemSchema], default: [] },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const SessionKit = models.SessionKit || model("SessionKit", SessionKitSchema);
export default SessionKit;

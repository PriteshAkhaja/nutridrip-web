import { Schema, model, models } from "mongoose";

/**
 * Settings that shape the whole product, set by the super admin. One document,
 * ever. Kept apart from BillingSettings (invoices) and ContentBlock (copy).
 */
const PlatformSettingsSchema = new Schema(
  {
    /** Pins the collection to a single row. */
    singleton: { type: String, default: "platform", unique: true, immutable: true },
    /** How clock times are shown everywhere (lib/time). Stored times are always 24-hour. */
    clockFormat: { type: String, enum: ["12h", "24h"], default: "12h" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const PlatformSettings = models.PlatformSettings || model("PlatformSettings", PlatformSettingsSchema);
export default PlatformSettings;

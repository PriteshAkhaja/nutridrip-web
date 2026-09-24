import { Schema, model, models } from "mongoose";

/**
 * A service zone: the pincodes a nurse can be sent to, and the hours.
 * Edited by the super admin; see lib/zones.ts for the rules and lib/zones-store.ts
 * for how they are read.
 */
const ZoneSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    /**
     * Unique across every zone, enforced here as well as in the form: two zones
     * claiming one pincode would make "who covers this door" ambiguous.
     */
    pincodes: { type: [String], required: true, index: { unique: true } },
    opensAt: { type: String, required: true },
    closesAt: { type: String, required: true },
    /** A bookable time every this many minutes, from opening. */
    slotMinutes: { type: Number, default: 60 },
    status: { type: String, enum: ["open", "limited", "paused"], default: "open" },
    /** Display order on the public Zones page and in pickers. */
    position: { type: Number, default: 0 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Zone = models.Zone || model("Zone", ZoneSchema);
export default Zone;

import { Schema, model, models } from "mongoose";

/**
 * An enquiry from the public site — a clinic wanting a partnership, or a
 * patient asking for a consultation. Kept out of User so an enquiry never
 * becomes an account by accident.
 */
const LeadSchema = new Schema(
  {
    kind: { type: String, enum: ["clinic", "consult", "general"], default: "general", index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    organisation: String,
    city: String,
    pincode: String,
    /** Free text — what they actually asked for. */
    message: String,
    /** Clinic enquiries: rooms available, expected monthly sessions. */
    rooms: Number,
    monthlyVolume: Number,

    status: {
      type: String,
      enum: ["new", "contacted", "qualified", "converted", "closed"],
      default: "new",
      index: true,
    },
    ownerId: { type: Schema.Types.ObjectId, ref: "User" },
    notes: String,
  },
  { timestamps: true }
);

LeadSchema.index({ status: 1, createdAt: -1, _id: -1 });

/** Serves the paged lists: the filter, then the sort, so a page is an index walk. */
LeadSchema.index({ createdAt: -1, _id: -1 });

export const Lead = models.Lead || model("Lead", LeadSchema);
export default Lead;

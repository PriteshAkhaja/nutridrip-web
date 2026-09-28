import { Schema, model, models } from "mongoose";

/**
 * When a physician takes calls: weekly windows, how long a call is, and days
 * off. One document per physician, edited by the physician or the super admin
 * (see lib/clinical/calls for the rules). A physician with no document, or no
 * windows, is not offered to patients.
 */
const DoctorHoursSchema = new Schema(
  {
    doctorId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    weekly: {
      type: [
        new Schema(
          {
            /** 0 = Sunday … 6 = Saturday. */
            day: { type: Number, min: 0, max: 6, required: true },
            start: { type: String, required: true },
            end: { type: String, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    callMinutes: { type: Number, default: 15 },
    /** "YYYY-MM-DD", India time. */
    daysOff: { type: [String], default: [] },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const DoctorHours = models.DoctorHours || model("DoctorHours", DoctorHoursSchema);
export default DoctorHours;

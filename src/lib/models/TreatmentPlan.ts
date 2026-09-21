import { Schema, model, models } from "mongoose";
import { PLAN_STATUS, ROUTES, UNITS } from "./types";

const ComponentSchema = new Schema(
  {
    masterId: { type: Schema.Types.ObjectId, ref: "ProductMaster" },
    name: { type: String, required: true },
    dose: { type: Number, required: true },
    unit: { type: String, enum: UNITS, required: true },
    route: { type: String, enum: ROUTES, required: true },
    carrier: String,
  },
  { _id: true }
);

const PlanSessionSchema = new Schema(
  {
    date: { type: Date, required: true },
    dripId: { type: Schema.Types.ObjectId, ref: "Drip" },
    dripName: { type: String, required: true },
    components: { type: [ComponentSchema], default: [] },
    sessionNotes: String,
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking" },
  },
  { _id: true }
);

const WeekSchema = new Schema(
  {
    weekNum: { type: Number, required: true },
    sessions: { type: [PlanSessionSchema], default: [] },
  },
  { _id: false }
);

/** A doctor's multi-week protocol for one patient. */
const TreatmentPlanSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    doctorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    nurseId: { type: Schema.Types.ObjectId, ref: "User" },

    diagnosis: String,
    patientAge: String,
    patientWeightKg: Number,
    patientHeightCm: Number,
    bloodGroup: String,

    startDate: Date,
    totalWeeks: { type: Number, default: 4 },
    weeks: { type: [WeekSchema], default: [] },

    sharedWithNurse: { type: Boolean, default: false },
    status: { type: String, enum: PLAN_STATUS, default: "draft", index: true },
  },
  { timestamps: true }
);

/** Serves the paged lists: the filter, then the sort, so a page is an index walk. */
TreatmentPlanSchema.index({ doctorId: 1, createdAt: -1, _id: -1 });
TreatmentPlanSchema.index({ patientId: 1, createdAt: -1, _id: -1 });

export const TreatmentPlan = models.TreatmentPlan || model("TreatmentPlan", TreatmentPlanSchema);
export default TreatmentPlan;

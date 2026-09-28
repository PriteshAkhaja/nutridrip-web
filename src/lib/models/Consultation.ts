import { Schema, model, models } from "mongoose";

/**
 * A phone call between a patient and the physician they chose, booked before
 * the physician approves their answers. See lib/clinical/calls.
 */
const ConsultationSchema = new Schema(
  {
    /** "CL-5001": what the patient, the physician and the audit trail call it. */
    callNo: { type: String, required: true, unique: true },
    patientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    doctorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    /** The submission it was booked against. A retake keeps the call; the physician reads the newest answers. */
    quizId: { type: Schema.Types.ObjectId, ref: "HealthQuiz" },
    startAt: { type: Date, required: true },
    minutes: { type: Number, required: true },
    /** The number the physician rings. */
    phone: { type: String, required: true },
    status: { type: String, enum: ["booked", "done", "no_answer", "cancelled"], default: "booked", index: true },

    /** Called or no answer: who marked it, and when. "decided" when the physician decided without marking it. */
    outcomeAt: Date,
    outcomeBy: { type: Schema.Types.ObjectId, ref: "User" },
    outcomeNote: String,

    cancelledAt: Date,
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancelReason: String,

    /** Earlier times, oldest first, each time it was moved. */
    movedFrom: { type: [Date], default: [] },
    /** The physician it was booked with, when the super admin handed it to another. */
    handedOverFrom: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

/**
 * No double booking, enforced by the database as well as the screen: one
 * booked call per physician per start time, and one open call per patient.
 * Two people pressing "Book" at once cannot both get it.
 */
ConsultationSchema.index({ doctorId: 1, startAt: 1 }, { unique: true, partialFilterExpression: { status: "booked" } });
ConsultationSchema.index(
  { patientId: 1 },
  { unique: true, partialFilterExpression: { status: "booked" }, name: "one_open_call" }
);
ConsultationSchema.index({ doctorId: 1, status: 1, startAt: 1 });

export const Consultation = models.Consultation || model("Consultation", ConsultationSchema);
export default Consultation;

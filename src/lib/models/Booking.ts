import { Schema, model, models } from "mongoose";
import { BOOKING_STATUS, CHECKLIST_PHASES, LOCATIONS, SEVERITY } from "./types";

const ChecklistStepSchema = new Schema(
  {
    key: { type: String, required: true },
    phase: { type: String, enum: CHECKLIST_PHASES, required: true },
    label: { type: String, required: true },
    detail: String,
    mandatory: { type: Boolean, default: false },
    /** Steps that open a sub-screen: vitals, consent, kit scan. */
    opens: { type: String, enum: ["vitals", "consent", "kit", "observation", null], default: null },
    doneAt: Date,
    doneBy: { type: Schema.Types.ObjectId, ref: "User" },
    stamp: String,
  },
  { _id: false }
);

const VitalsSchema = new Schema(
  {
    takenAt: { type: Date, default: Date.now },
    label: { type: String, default: "baseline" },
    systolic: Number,
    diastolic: Number,
    heartRate: Number,
    spo2: Number,
    temperatureF: Number,
    weightKg: Number,
    /** Names of readings outside the safe band at capture time. */
    outOfRange: [String],
  },
  { _id: false }
);

const ObservationSchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    text: String,
    byId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false }
);

const AdverseEventSchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    symptoms: [String],
    severity: { type: String, enum: SEVERITY },
    actionsTaken: [String],
    infusionStopped: { type: Boolean, default: false },
    notes: String,
    escalatedToDoctorId: { type: Schema.Types.ObjectId, ref: "User" },
    reportedBy: { type: Schema.Types.ObjectId, ref: "User" },

    /**
     * The physician's determination closes the event. A nurse files; only a
     * physician can decide what it was and that it is finished — which is why
     * the escalations badge counts the ones without this.
     */
    determination: String,
    acknowledgedAt: Date,
    acknowledgedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { _id: true }
);

const GivenComponentSchema = new Schema(
  {
    name: String,
    dose: Number,
    unit: String,
    batchNo: String,
    lotId: { type: Schema.Types.ObjectId, ref: "BatchLot" },
  },
  { _id: false }
);

/**
 * One scheduled therapy session — the object the patient books, the doctor
 * approves, the nurse runs, and the report is written from.
 */
const BookingSchema = new Schema(
  {
    bookingNo: { type: String, required: true, unique: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    dripId: { type: Schema.Types.ObjectId, ref: "Drip", required: true },
    dripName: String,
    planId: { type: Schema.Types.ObjectId, ref: "TreatmentPlan" },

    scheduledAt: { type: Date, required: true, index: true },
    durationMin: { type: Number, default: 45 },
    location: { type: String, enum: LOCATIONS, default: "home" },
    address: String,
    city: String,
    pincode: String,

    clinicId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    nurseId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    doctorId: { type: Schema.Types.ObjectId, ref: "User" },

    status: { type: String, enum: BOOKING_STATUS, default: "awaiting_review", index: true },
    approvedAt: Date,
    approvalNotes: String,
    rejectionReason: String,

    /* Execution */
    checklist: { type: [ChecklistStepSchema], default: [] },
    vitals: { type: [VitalsSchema], default: [] },
    /**
     * What the patient agreed to, copied rather than referenced.
     *
     * `version` alone was not enough: the wording it names lived in a component
     * and the doses were read live from the Drip, so editing either rewrote
     * history. The affirmation, the risks and the doses are all snapshotted
     * here at the moment of capture, the way an Invoice snapshots its lines.
     *
     * Records captured before this existed carry only `version`; every reader
     * has to cope with the snapshot being absent.
     */
    consent: {
      givenAt: Date,
      signatureDataUrl: String,
      viaOtp: String,
      version: String,
      affirmation: String,
      risks: [String],
      components: {
        type: [
          new Schema(
            { name: String, dose: Number, unit: String },
            { _id: false }
          ),
        ],
        default: undefined,
      },
    },
    /**
     * When the nurse said they had set off, and how far away they were then.
     *
     * `etaMinutes` is a snapshot taken at that moment, not a live countdown —
     * nothing tracks the nurse afterwards, so a figure that kept decreasing on
     * its own would be a fiction. The patient's screen counts down from
     * `enRouteAt` instead, which is honest about what is actually known.
     */
    enRouteAt: Date,
    etaMinutes: Number,

    startedAt: Date,
    completedAt: Date,
    /** Infusion telemetry for the live-session screen. */
    bagVolumeMl: Number,
    remainingMl: Number,
    rateMlHr: Number,
    observations: { type: [ObservationSchema], default: [] },
    adverseEvents: { type: [AdverseEventSchema], default: [] },
    componentsGiven: { type: [GivenComponentSchema], default: [] },
    aftercareNotes: String,

    /**
     * The prescription stays shut until the patient reads a code to the nurse.
     * It is proof of presence: the drugs and doses are the patient's own
     * medical record, and a nurse holding a booking id is not, on its own,
     * a nurse standing in front of that patient.
     */
    rxUnlockedAt: Date,
    rxUnlockedBy: { type: Schema.Types.ObjectId, ref: "User" },
    /** How it was opened. Absent means the ordinary way: the patient's code. */
    rxUnlockMethod: { type: String, enum: ["code", "physician", "break_glass", null], default: null },

    /**
     * When the patient cannot give a code at all — flat battery, phone at home,
     * too unwell — care must not stop. The nurse asks a physician, and if no
     * physician answers they may proceed under their own name. That second
     * route is deliberately expensive: it needs a reason and how identity was
     * checked instead, and it tells the physician, the admins and the patient.
     */
    rxOverride: {
      /** The FIRST ask. Never moved by a nudge — it is how long the nurse has
          been standing there, and the physician's queue is ordered by it. */
      requestedAt: Date,
      requestedBy: { type: Schema.Types.ObjectId, ref: "User" },
      /** The most recent ask, when the nurse has chased it. */
      lastAskedAt: Date,
      reason: String,
      /** What the nurse did instead of the code, in their own words. */
      identityCheckedBy: String,
      grantedAt: Date,
      grantedBy: { type: Schema.Types.ObjectId, ref: "User" },
      deniedAt: Date,
      deniedBy: { type: Schema.Types.ObjectId, ref: "User" },
      denyReason: String,
    },

    /* Out-of-range baseline vitals block the infusion until a physician clears it. */
    vitalsClearedAt: Date,
    vitalsClearedBy: { type: Schema.Types.ObjectId, ref: "User" },
    vitalsClearanceNote: String,

    /* Commercials */
    amount: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "refund_pending", "refunded"],
      default: "unpaid",
    },
    cancelledAt: Date,
    cancelReason: String,
    rescheduledFrom: Date,
    rescheduleCount: { type: Number, default: 0 },

    feedback: {
      rating: { type: Number, min: 1, max: 5 },
      comment: String,
      givenAt: Date,
    },
  },
  { timestamps: true }
);

BookingSchema.index({ status: 1, scheduledAt: 1 });
BookingSchema.index({ nurseId: 1, scheduledAt: 1 });

export const Booking = models.Booking || model("Booking", BookingSchema);
export default Booking;

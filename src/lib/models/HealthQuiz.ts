import { Schema, model, models } from "mongoose";

const AnswerSchema = new Schema(
  {
    questionId: { type: String, required: true },
    section: String,
    question: String,
    /** Selected option label, free text, or a numeric scale value. */
    answer: Schema.Types.Mixed,
    /** 0–100 contribution this answer makes to its nutrient markers. */
    weight: Number,
  },
  { _id: false }
);

const NutrientRiskSchema = new Schema(
  {
    name: { type: String, required: true },
    group: String,
    /** 0–100. Under 35 is Critical, under 60 is Low, else Adequate. */
    pct: { type: Number, required: true },
  },
  { _id: false }
);

/** One completed vitality assessment. Patients may retake; each run is a doc. */
const HealthQuizSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    answers: { type: [AnswerSchema], default: [] },
    nutrientRisks: { type: [NutrientRiskSchema], default: [] },
    /** 0–100 composite shown in the FillRing. */
    vitalityScore: { type: Number, required: true },
    categoryScores: { type: Map, of: Number },
    suggestedDripIds: [{ type: Schema.Types.ObjectId, ref: "Drip" }],

    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    reviewStatus: {
      type: String,
      enum: ["pending", "approved", "modified", "rejected", "info_needed"],
      default: "pending",
      index: true,
    },
    /** For the NURSE: rate, order of additives, anything to do at the chair. */
    doctorNotes: String,

    /**
     * For the PATIENT, in their own words.
     *
     * Kept apart from doctorNotes on purpose. That field is labelled "notes for
     * the nurse" and reads like it — rates and additives — and it was the only
     * thing a physician could write, so "approved with changes" reached the
     * patient as a booking button and nothing else. Two audiences, two fields.
     */
    patientNote: String,

    /**
     * Why it was declined, as the physician picked it from the list.
     *
     * Held apart from doctorNotes, which on a decline was the reason and any
     * private remark concatenated together — so showing it to the patient
     * meant showing both, and showing neither meant they were told only that
     * "a physician declined this protocol" and left to guess.
     */
    declineReason: String,

    /**
     * What the physician actually recommends, which may not be what the quiz
     * suggested. `suggestedDripIds` stays exactly as the quiz computed it, so
     * the two can always be compared afterwards — an overwritten suggestion
     * would lose the fact that anything was changed at all.
     */
    recommendedDripIds: [{ type: Schema.Types.ObjectId, ref: "Drip" }],

    /** How firmly it is recommended. Set by the physician, not by a score. */
    recommendationStrength: {
      type: String,
      enum: ["strong", "recommended", "optional", null],
      default: null,
    },

    /**
     * The physician needs one more answer before deciding. The booking stays
     * held rather than cancelled, so the patient answers instead of starting
     * again — which is what declining for a missing detail forced them to do.
     */
    infoRequest: String,
    infoAnswer: String,
    infoAnsweredAt: Date,

    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const HealthQuiz = models.HealthQuiz || model("HealthQuiz", HealthQuizSchema);
export default HealthQuiz;

import mongoose, { Schema, model, models, type InferSchemaType } from "mongoose";
import { ROLES, USER_STATUS } from "./types";

/**
 * One collection for every role. Role-specific fields live in optional
 * sub-objects so a doctor record carries `doctor`, a clinic carries `clinic`,
 * and nothing has to be nulled out for the roles that do not use it.
 */
const UserSchema = new Schema(
  {
    email: { type: String, lowercase: true, trim: true, sparse: true, unique: true },
    phone: { type: String, trim: true, sparse: true, unique: true },
    passwordHash: { type: String, select: false },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ROLES, required: true, index: true },
    status: { type: String, enum: USER_STATUS, default: "active", index: true },
    permissions: { type: [String], default: [] },
    avatarUrl: String,

    doctor: {
      specialization: String,
      licenseNo: String,
      registrationCouncil: String,
      signatureUrl: String,
      /**
       * What the physician prints above their own prescriptions. Presentation
       * only, and edited by the physician; the registration above is edited by
       * an administrator and prints regardless. See lib/clinical/letterhead.ts.
       */
      letterhead: {
        practiceName: String,
        qualifications: String,
        address: String,
        phone: String,
        email: String,
        footerNote: String,
      },
    },

    nurse: {
      licenseNo: String,
      clinicId: { type: Schema.Types.ObjectId, ref: "User" },
      /**
       * The physician this nurse works under. It scopes the nurse list a
       * physician is offered when approving a protocol — they dispatch people
       * they know. It is NOT a permission: any physician can still reassign a
       * session, and automatic dispatch draws from every nurse, because a
       * patient must not go unattended just because one physician's own team
       * is busy.
       */
      doctorId: { type: Schema.Types.ObjectId, ref: "User", index: true },
      serviceAreas: [String],
      kitId: { type: Schema.Types.ObjectId, ref: "SessionKit" },
      /** Home base, used to dispatch the nearest nurse under capacity. */
      latitude: Number,
      longitude: Number,
    },

    clinic: {
      address: String,
      city: String,
      pincode: String,
      partnerSince: Date,
      monthlyVolumeTarget: Number,
      gstin: String,
      /**
       * On credit: orders go ahead unpaid and are invoiced, payable within 30
       * days, as before. Off (the default): the clinic pays for each order
       * before it is confirmed.
       */
      onCredit: { type: Boolean, default: false },
    },

    patient: {
      dob: Date,
      gender: { type: String, enum: ["male", "female", "other", "undisclosed"] },
      bloodGroup: String,
      heightCm: Number,
      weightKg: Number,
      address: String,
      city: String,
      pincode: String,
      latitude: Number,
      longitude: Number,
      emergencyContactName: String,
      emergencyContactPhone: String,
      allergies: String,
      chronicConditions: String,
      currentMedications: String,
      surgeries: String,
      familyHistory: String,
      /** Latest computed vitality score, denormalised for dashboard reads. */
      vitalityScore: Number,
      lastQuizAt: Date,
    },

    lastLoginAt: Date,
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: Date,

    /**
     * Bumped to invalidate every session this account already holds.
     *
     * Sessions are stateless JWTs, so until this existed there was no way to
     * log anybody out: a token held by somebody dismissed this morning stayed
     * valid until it expired on its own, and setting the account to inactive
     * did nothing about it. The number is signed into each token and compared
     * on every read, so raising it by one ends them all at once.
     *
     * Raised when the password changes and when the account stops being
     * active — the two moments where existing access should stop.
     */
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

UserSchema.index({ role: 1, status: 1 });
UserSchema.index({ name: "text", email: "text" });

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: mongoose.Types.ObjectId };

/** Serves the paged lists: the filter, then the sort, so a page is an index walk. */
UserSchema.index({ createdAt: -1, _id: -1 });
UserSchema.index({ role: 1, createdAt: -1, _id: -1 });

export const User = models.User || model("User", UserSchema);
export default User;

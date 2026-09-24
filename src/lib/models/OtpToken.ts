import { Schema, model, models } from "mongoose";

/**
 * Phone OTP for the patient app (Block 2.1). Codes are stored hashed and the
 * document self-destructs via a TTL index on `expiresAt`.
 *
 * Codes are SCOPED BY PURPOSE. A prescription code and a sign-in code both go
 * to the same phone, so without this a nurse holding a prescription code could
 * use it to sign in AS the patient, and a sign-in code would open a
 * prescription. The purpose is part of the lookup, never just a label.
 */
const OtpTokenSchema = new Schema(
  {
    phone: { type: String, required: true, index: true },
    /** What this code entitles the bearer to do. */
    purpose: { type: String, enum: ["login", "prescription", "consent"], default: "login", index: true },
    /** Prescription and consent codes are good for one session only. */
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking" },
    codeHash: { type: String, required: true },
    /**
     * The code, sealed (see lib/auth/code-box), so the patient's own screen can
     * show them what to read to the nurse. Session codes only; never sign-in codes.
     */
    sealed: String,
    attempts: { type: Number, default: 0 },
    consumedAt: Date,
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

OtpTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpToken = models.OtpToken || model("OtpToken", OtpTokenSchema);
export default OtpToken;

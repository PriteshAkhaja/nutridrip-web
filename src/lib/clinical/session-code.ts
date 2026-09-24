import bcrypt from "bcryptjs";
import { OtpToken } from "@/lib/models";
import { sealCode } from "@/lib/auth/code-box";
import { RX_OTP_MAX_ATTEMPTS, RX_OTP_TTL_MS } from "./prescription";

/**
 * A code the patient reads to the nurse at the chair: proof the patient is
 * there and agrees, which nobody standing elsewhere can produce.
 *
 * Each is for one purpose and one session: a consent code cannot open a
 * prescription, a prescription code cannot sign anybody in, and neither works
 * on another booking. It lasts ten minutes, allows a few tries, and is used up
 * once it matches.
 */
export type SessionCodePurpose = "prescription" | "consent";

/** What the patient is told the code is for, on their screen and in the bell. */
export const CODE_FOR: Record<SessionCodePurpose, string> = {
  prescription: "to open your prescription",
  consent: "to confirm your consent",
};

const RATE_WINDOW_MS = 10 * 60_000;
const RATE_LIMIT = 6;

/** Issue a code for this session. Returns it once, to be sent; it is stored only hashed and sealed. */
export async function issueSessionCode(opts: {
  bookingId: unknown;
  phone: string;
  purpose: SessionCodePurpose;
}): Promise<{ code: string } | { error: string; status: number }> {
  const recent = await OtpToken.countDocuments({
    phone: opts.phone,
    purpose: opts.purpose,
    createdAt: { $gt: new Date(Date.now() - RATE_WINDOW_MS) },
  });
  if (recent >= RATE_LIMIT) return { error: "Too many codes requested for this patient. Wait a few minutes.", status: 429 };

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await OtpToken.create({
    phone: opts.phone,
    purpose: opts.purpose,
    bookingId: opts.bookingId,
    codeHash: await bcrypt.hash(code, 10),
    sealed: sealCode(code),
    expiresAt: new Date(Date.now() + RX_OTP_TTL_MS),
  });
  return { code };
}

/**
 * Check a code the nurse typed. Every live code for this session and purpose is
 * accepted, not only the newest: after a Resend the patient may read out the
 * older one, which is still genuine. Tries are counted on the newest, so asking
 * for another code does not reset them.
 */
export async function checkSessionCode(opts: {
  bookingId: unknown;
  phone: string;
  purpose: SessionCodePurpose;
  code: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const live = await OtpToken.find({
    phone: opts.phone,
    purpose: opts.purpose,
    bookingId: opts.bookingId,
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (live.length === 0) return { ok: false, error: "That code has expired — send a new one", status: 400 };

  const newest = live[0];
  if (newest.attempts >= RX_OTP_MAX_ATTEMPTS) {
    return { ok: false, error: "Too many attempts. Send the patient a new code.", status: 429 };
  }

  for (const candidate of live) {
    if (await bcrypt.compare(opts.code, candidate.codeHash)) {
      // Used up -- every code for this session and purpose, so an older one
      // still sitting in the patient's app cannot be used a second time.
      await OtpToken.updateMany(
        { bookingId: opts.bookingId, purpose: opts.purpose, consumedAt: null },
        { $set: { consumedAt: new Date() } }
      );
      return { ok: true };
    }
  }

  newest.attempts += 1;
  await newest.save();
  const left = RX_OTP_MAX_ATTEMPTS - newest.attempts;
  return {
    ok: false,
    error: left > 0 ? `That code is not right — ${left} ${left === 1 ? "try" : "tries"} left` : "Too many attempts. Send the patient a new code.",
    status: left > 0 ? 400 : 429,
  };
}

/** Does the running server know about consent codes? One started before this change does not. */
export function sessionCodesReady(): boolean {
  const purpose = OtpToken.schema.path("purpose") as unknown as { enumValues?: string[] };
  return Boolean(purpose.enumValues?.includes("consent") && OtpToken.schema.path("sealed"));
}

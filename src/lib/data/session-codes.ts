import { connectDB } from "@/lib/db/mongoose";
import { Booking, OtpToken, User } from "@/lib/models";
import { openCode } from "@/lib/auth/code-box";
import { CODE_FOR, type SessionCodePurpose } from "@/lib/clinical/session-code";

/** A code the patient should read to their nurse right now. */
export type LiveCode = {
  id: string;
  purpose: SessionCodePurpose;
  /** "to confirm your consent" */
  forWhat: string;
  code: string;
  expiresAt: string;
  bookingNo: string;
};

/** Sessions a nurse can be at the door for. */
const LIVE_STATUSES = ["approved", "nurse_assigned", "en_route", "in_progress"];

/**
 * The codes a patient's nurse is waiting on: unused, unexpired, for one of the
 * patient's own sessions. The newest of each kind per session -- after a Resend
 * the older one still works, but showing two numbers invites reading the wrong
 * one out.
 *
 * Only ever for the patient themselves: a code is proof that the person reading
 * it out is the patient, so nobody else's screen may show it.
 */
export async function liveCodesFor(patientId: string): Promise<LiveCode[]> {
  await connectDB();
  const patient = await User.findById(patientId).select("phone role").lean<{ phone?: string; role: string } | null>();
  if (!patient?.phone || patient.role !== "patient") return [];

  const bookings = await Booking.find({ patientId, status: { $in: LIVE_STATUSES } })
    .select("bookingNo")
    .lean<Array<{ _id: unknown; bookingNo: string }>>();
  if (bookings.length === 0) return [];
  const bookingNo = new Map(bookings.map((b) => [String(b._id), b.bookingNo]));

  const tokens = await OtpToken.find({
    phone: patient.phone,
    purpose: { $in: ["prescription", "consent"] },
    bookingId: { $in: bookings.map((b) => b._id) },
    consumedAt: null,
    expiresAt: { $gt: new Date() },
    sealed: { $exists: true },
  })
    .sort({ createdAt: -1 })
    .lean<Array<{ _id: unknown; purpose: SessionCodePurpose; bookingId: unknown; sealed?: string; expiresAt: Date }>>();

  const seen = new Set<string>();
  const out: LiveCode[] = [];
  for (const t of tokens) {
    const key = `${String(t.bookingId)}:${t.purpose}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const code = openCode(t.sealed);
    if (!code) continue;
    out.push({
      id: String(t._id),
      purpose: t.purpose,
      forWhat: CODE_FOR[t.purpose] ?? "for your nurse",
      code,
      expiresAt: t.expiresAt.toISOString(),
      bookingNo: bookingNo.get(String(t.bookingId)) ?? "",
    });
  }
  return out;
}

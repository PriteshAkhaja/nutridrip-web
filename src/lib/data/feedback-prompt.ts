import { connectDB } from "@/lib/db/mongoose";
import { Booking, User } from "@/lib/models";

/** How long after a session its feedback is still asked for on Home. */
const ASK_FOR_DAYS = 14;

export type SessionToRate = {
  bookingId: string;
  bookingNo: string;
  dripName: string | null;
  completedAt: string;
  nurseName: string | null;
};

/**
 * The patient's most recent finished session they have not rated yet, if it
 * was in the last two weeks. One at a time, and never an old one: feedback is
 * asked for while the visit is fresh, not collected as a backlog.
 */
export async function sessionToRate(patientId: string): Promise<SessionToRate | null> {
  await connectDB();
  const b = await Booking.findOne({
    patientId,
    status: "completed",
    completedAt: { $gte: new Date(Date.now() - ASK_FOR_DAYS * 86_400_000) },
    "feedback.givenAt": { $exists: false },
  })
    .sort({ completedAt: -1 })
    .select("bookingNo dripName completedAt nurseId")
    .lean<{ _id: unknown; bookingNo: string; dripName?: string; completedAt: Date; nurseId?: unknown } | null>();
  if (!b) return null;
  const nurse = b.nurseId ? await User.findById(b.nurseId).select("name").lean<{ name: string } | null>() : null;
  return {
    bookingId: String(b._id),
    bookingNo: b.bookingNo,
    dripName: b.dripName ?? null,
    completedAt: b.completedAt.toISOString(),
    nurseName: nurse?.name ?? null,
  };
}

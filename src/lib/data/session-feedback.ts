import { connectDB } from "@/lib/db/mongoose";
import { Booking, User } from "@/lib/models";
import { isLow, readFeedback, type FeedbackView, type StoredFeedback } from "@/lib/clinical/feedback";

export type FeedbackRow = {
  bookingId: string;
  bookingNo: string;
  patientId: string;
  patientName: string;
  nurseName: string | null;
  dripName: string | null;
  feedback: FeedbackView;
  low: boolean;
};

/**
 * What patients said about the sessions a physician approved, newest first.
 *
 * The physician was told about low ratings in the bell and nowhere else, and
 * that link led to a schedule that does not show feedback. This is where it
 * can be read, next to the queue they work from.
 */
export async function recentFeedbackForDoctor(
  doctorId: string,
  limit = 5
): Promise<{ rows: FeedbackRow[]; lowLast30: number }> {
  await connectDB();
  const rated = { doctorId, "feedback.givenAt": { $exists: true } };
  const [bookings, lowLast30] = await Promise.all([
    Booking.find(rated)
      .sort({ "feedback.givenAt": -1 })
      .limit(limit)
      .select("bookingNo patientId nurseId dripName feedback")
      .lean<Array<{ _id: unknown; bookingNo: string; patientId: unknown; nurseId?: unknown; dripName?: string; feedback?: StoredFeedback }>>(),
    Booking.countDocuments({
      ...rated,
      "feedback.givenAt": { $gte: new Date(Date.now() - 30 * 86_400_000) },
      $or: [
        { "feedback.nurseRating": { $lte: 2 } },
        { "feedback.sessionRating": { $lte: 2 } },
        { "feedback.nurseRating": { $exists: false }, "feedback.rating": { $lte: 2 } },
      ],
    }),
  ]);

  const people = await User.find({ _id: { $in: bookings.flatMap((b) => [b.patientId, b.nurseId].filter(Boolean)) } })
    .select("name")
    .lean<Array<{ _id: unknown; name: string }>>();
  const nameOf = new Map(people.map((p) => [String(p._id), p.name]));

  const rows = bookings.flatMap((b) => {
    const feedback = readFeedback(b.feedback);
    if (!feedback) return [];
    return [
      {
        bookingId: String(b._id),
        bookingNo: b.bookingNo,
        patientId: String(b.patientId),
        patientName: nameOf.get(String(b.patientId)) ?? "A patient",
        nurseName: b.nurseId ? (nameOf.get(String(b.nurseId)) ?? null) : null,
        dripName: b.dripName ?? null,
        feedback,
        low: isLow(feedback),
      },
    ];
  });
  return { rows, lowLast30 };
}

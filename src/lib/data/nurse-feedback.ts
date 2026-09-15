import { Booking } from "@/lib/models";

/**
 * What patients said about a nurse's sessions.
 *
 * The patient is told, in as many words, that "your nurse sees this on their
 * record" when they rate a session. That promise was not kept anywhere — the
 * rating was written to the booking and read only back to the patient. This is
 * the record it refers to.
 *
 * Ratings are shown with their count, never as a bare average: "4.5" from two
 * sessions and "4.5" from two hundred are not the same claim, and a nurse
 * judged on the first would be judged on nothing.
 */
export type NurseFeedback = {
  count: number;
  /** Null until somebody has actually rated something. */
  average: number | null;
  /** Ratings of 2 or less, which the physician is also told about. */
  poor: number;
  recent: Array<{
    bookingId: string;
    bookingNo: string;
    rating: number;
    comment: string | null;
    givenAt: Date | null;
  }>;
};

type Row = {
  _id: unknown;
  bookingNo: string;
  feedback?: { rating?: number; comment?: string; givenAt?: Date };
};

export async function nurseFeedback(nurseId: string, limit = 5): Promise<NurseFeedback> {
  const rows = await Booking.find({
    nurseId,
    "feedback.rating": { $exists: true },
  })
    .sort({ "feedback.givenAt": -1 })
    .select("bookingNo feedback")
    .lean<Row[]>();

  const rated = rows.filter((r) => typeof r.feedback?.rating === "number");
  const total = rated.reduce((n, r) => n + (r.feedback!.rating as number), 0);

  return {
    count: rated.length,
    // Rounded to one place. A nurse's record is not improved by "4.333333".
    average: rated.length ? Math.round((total / rated.length) * 10) / 10 : null,
    poor: rated.filter((r) => (r.feedback!.rating as number) <= 2).length,
    recent: rated.slice(0, limit).map((r) => ({
      bookingId: String(r._id),
      bookingNo: r.bookingNo,
      rating: r.feedback!.rating as number,
      comment: r.feedback?.comment?.trim() || null,
      givenAt: r.feedback?.givenAt ?? null,
    })),
  };
}

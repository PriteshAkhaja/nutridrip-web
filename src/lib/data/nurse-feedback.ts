import { Booking } from "@/lib/models";
import { readFeedback, type StoredFeedback } from "@/lib/clinical/feedback";

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
  feedback?: StoredFeedback;
};

export async function nurseFeedback(nurseId: string, limit = 5): Promise<NurseFeedback> {
  // The rating must BE a number, not merely be present: a booking whose rating
  // was written as something else must not count towards an average.
  // The nurse's own rating, or -- for feedback given before it was asked
  // separately -- the single rating for the visit.
  const filter = {
    nurseId,
    $or: [{ "feedback.nurseRating": { $type: "number" } }, { "feedback.rating": { $type: "number" } }],
  };
  const value = { $ifNull: ["$feedback.nurseRating", "$feedback.rating"] };

  // The three figures are sums over a nurse's whole career, so the database
  // sums them, and only the few comments actually shown are fetched. This used
  // to read every rated session a nurse had ever run in order to show five of
  // them, and the `limit` argument never reached the query at all.
  const [totals, rows] = await Promise.all([
    Booking.aggregate<{ count: number; total: number; poor: number }>([
      { $match: filter },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          total: { $sum: value },
          poor: { $sum: { $cond: [{ $lte: [value, 2] }, 1, 0] } },
        },
      },
    ]),
    Booking.find(filter)
      .sort({ "feedback.givenAt": -1, _id: -1 })
      .limit(limit)
      .select("bookingNo feedback")
      .lean<Row[]>(),
  ]);

  const count = totals[0]?.count ?? 0;

  return {
    count,
    // Rounded to one place. A nurse's record is not improved by "4.333333".
    average: count ? Math.round(((totals[0]?.total ?? 0) / count) * 10) / 10 : null,
    poor: totals[0]?.poor ?? 0,
    recent: rows.map((r) => {
      const nurse = readFeedback(r.feedback)?.nurse;
      return {
        bookingId: String(r._id),
        bookingNo: r.bookingNo,
        rating: nurse?.rating as number,
        comment: nurse?.comment ?? null,
        givenAt: r.feedback?.givenAt ? new Date(r.feedback.givenAt) : null,
      };
    }),
  };
}

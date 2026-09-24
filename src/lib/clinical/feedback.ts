/**
 * What a patient said about a finished session, in two parts: the nurse who
 * looked after them, and the session itself (how they felt, how it went).
 *
 * Feedback given before the two parts existed is one rating and one comment
 * for the whole visit. It is read as both, so an older rating still counts on
 * the nurse's record and still reads as the session's.
 */
export type StoredFeedback = {
  /** The single rating from before the two parts existed. */
  rating?: number | null;
  comment?: string | null;
  nurseRating?: number | null;
  nurseComment?: string | null;
  sessionRating?: number | null;
  sessionComment?: string | null;
  givenAt?: Date | string | null;
};

export type Rated = { rating: number; comment: string | null };

export type FeedbackView = {
  /** Null when the session had no nurse to rate. */
  nurse: Rated | null;
  session: Rated | null;
  givenAt: string | null;
};

/** A rating this low goes to the physician as well as the nurse. */
export const LOW_RATING = 2;

const clean = (s: string | null | undefined) => s?.trim() || null;
const isRating = (n: unknown): n is number => typeof n === "number" && n >= 1 && n <= 5;

export function readFeedback(f: StoredFeedback | null | undefined): FeedbackView | null {
  if (!f) return null;
  const legacy = isRating(f.rating) ? { rating: f.rating, comment: clean(f.comment) } : null;
  const nurse = isRating(f.nurseRating) ? { rating: f.nurseRating, comment: clean(f.nurseComment) } : legacy;
  const session = isRating(f.sessionRating) ? { rating: f.sessionRating, comment: clean(f.sessionComment) } : legacy;
  if (!nurse && !session) return null;
  const at = f.givenAt ? new Date(f.givenAt) : null;
  return { nurse, session, givenAt: at && !Number.isNaN(at.getTime()) ? at.toISOString() : null };
}

/** Is anything in this feedback low enough to tell the physician? */
export function isLow(view: FeedbackView | null): boolean {
  return Boolean(view && ((view.nurse?.rating ?? 5) <= LOW_RATING || (view.session?.rating ?? 5) <= LOW_RATING));
}

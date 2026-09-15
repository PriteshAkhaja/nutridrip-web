/**
 * A physician's approval is a clinical judgement about the person in front of
 * them at that moment. It cannot authorise an infusion indefinitely — weight,
 * medication and kidney function all move. So an approval has a shelf life,
 * and after it the patient answers again.
 *
 * This is the reason a patient is asked to retake the quiz: not per booking,
 * but per review window.
 */
export const APPROVAL_VALID_DAYS = 90;

/** Inside this window the patient is nudged to refresh before it lapses. */
export const APPROVAL_WARN_DAYS = 14;

const DAY = 86_400_000;

export type ApprovalState = {
  /** Can this patient book right now? */
  canBook: boolean;
  status: "none" | "pending" | "rejected" | "valid" | "expiring" | "expired";
  daysLeft: number | null;
  reviewedAt: string | null;
  /** Plain-language explanation, shown to the patient verbatim. */
  message: string;
};

export function approvalState(
  quiz: { reviewStatus: string; reviewedAt?: Date | null; completedAt: Date } | null
): ApprovalState {
  if (!quiz) {
    return {
      canBook: false,
      status: "none",
      daysLeft: null,
      reviewedAt: null,
      message: "Take the health quiz once and a physician will review it. It takes about three minutes.",
    };
  }

  if (quiz.reviewStatus === "pending") {
    return {
      canBook: false,
      status: "pending",
      daysLeft: null,
      reviewedAt: null,
      message: "A physician is reading your answers now — usually within two hours. You can hold a slot meanwhile.",
    };
  }

  if (quiz.reviewStatus === "rejected") {
    return {
      canBook: false,
      status: "rejected",
      daysLeft: null,
      reviewedAt: quiz.reviewedAt?.toISOString() ?? null,
      message: "A physician decided IV therapy is not right for you at the moment. The reason is on your results.",
    };
  }

  const from = quiz.reviewedAt ?? quiz.completedAt;
  const daysLeft = Math.ceil((from.getTime() + APPROVAL_VALID_DAYS * DAY - Date.now()) / DAY);

  if (daysLeft <= 0) {
    return {
      canBook: false,
      status: "expired",
      daysLeft,
      reviewedAt: from.toISOString(),
      message: `Your approval has lapsed — it lasts ${APPROVAL_VALID_DAYS} days, because what a physician approved three months ago may not fit you now. Answering again takes about three minutes.`,
    };
  }

  if (daysLeft <= APPROVAL_WARN_DAYS) {
    return {
      canBook: true,
      status: "expiring",
      daysLeft,
      reviewedAt: from.toISOString(),
      message: `Your approval lapses in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Retake the quiz whenever suits — you can keep booking until then.`,
    };
  }

  return {
    canBook: true,
    status: "valid",
    daysLeft,
    reviewedAt: from.toISOString(),
    message: `Approved. You can book freely for the next ${daysLeft} days without answering anything again.`,
  };
}

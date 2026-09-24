import { ButtonLink, type ButtonLinkProps } from "@/components/ui/Button";
import { getSession } from "@/lib/auth/session";
import { quizCtaFor } from "@/lib/data/quiz-cta";

/**
 * A "Take the quiz" button that knows whether this visitor has already taken
 * it. Everyone else sees the button as written; a patient who has answered is
 * sent to booking, their results, or -- once their approval has lapsed -- a
 * retake, with the button saying which. See `quizCtaFor`.
 */
export async function QuizButton({
  drip,
  compact = false,
  children,
  ...button
}: Omit<ButtonLinkProps, "href"> & {
  /** The drip the visitor was reading about, carried into the quiz or the booking. */
  drip?: string;
  /** The short wording, for the header. */
  compact?: boolean;
}) {
  const cta = await quizCtaFor(await getSession(), drip);
  const href = cta?.href ?? (drip ? `/quiz?drip=${encodeURIComponent(drip)}` : "/quiz");

  return (
    <ButtonLink href={href} {...button}>
      {cta ? (compact ? cta.short : cta.label) : children}
    </ButtonLink>
  );
}

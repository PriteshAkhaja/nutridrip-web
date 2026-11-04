import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { quizCtaFor } from "@/lib/data/quiz-cta";

/** Where the quiz starts, carrying the drip the visitor was reading about. */
export function quizHref(drip?: string) {
  return drip ? `/quiz?drip=${encodeURIComponent(drip)}` : "/quiz";
}

/**
 * The quiz button alone: a visitor who has already answered is sent to
 * booking, their results or a retake, with the button saying which
 * (quizCtaFor), as QuizButton does for the old design. `data-quiz-link` lets
 * a page re-point it at the drip being read, only while it points at the quiz.
 */
export async function QuizLink({ label, drip, compact = false }: { label: string; drip?: string; compact?: boolean }) {
  const cta = await quizCtaFor(await getSession(), drip);
  return (
    <Link className="nd-btn" href={cta?.href ?? quizHref(drip)} prefetch={false} data-quiz-link="">
      {cta ? (compact ? cta.short : cta.label) : label}
    </Link>
  );
}

/** The site's quiz button with its note underneath ("A physician reads every answer"). */
export async function Cta({
  label = "Take the health quiz",
  note = "A physician reads every answer",
  drip,
  compact = false,
  className = "",
}: {
  label?: string;
  note?: string;
  drip?: string;
  /** The short wording a returning patient sees, for the header. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={`nd-cta ${className}`.trim()}>
      <QuizLink label={label} drip={drip} compact={compact} />
      {note ? <span className="nd-cta__free">{note}</span> : null}
    </div>
  );
}

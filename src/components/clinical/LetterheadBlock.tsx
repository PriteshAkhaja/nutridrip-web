import type { LetterheadView } from "@/lib/clinical/letterhead";

/**
 * The top of a prescription, in the physician's own words.
 *
 * One component for two places: the printed slip and the preview beside the
 * form that edits it. A preview that was a separate drawing would be the first
 * thing to drift from the paper, and "it looked different when I printed it" is
 * a complaint about the one thing this feature is for.
 *
 * No hooks, so the print page (a server component) can use it directly.
 */
export function LetterheadBlock({ view }: { view: LetterheadView }) {
  return (
    <div className="min-w-0">
      <div
        className="break-words"
        style={{ font: "600 20px/1.15 var(--font-display)", letterSpacing: "-0.01em" }}
      >
        {view.title}
      </div>
      {view.qualifications ? (
        <div className="t-small text-[var(--color-ink-2)] mt-1">{view.qualifications}</div>
      ) : null}
      {view.addressLines.length > 0 ? (
        <div className="t-small text-[var(--color-ink-3)] mt-2">
          {view.addressLines.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      ) : null}
      {view.contact ? (
        <div className="t-data text-[13px] text-[var(--color-ink-2)] mt-1 break-words">{view.contact}</div>
      ) : null}
    </div>
  );
}

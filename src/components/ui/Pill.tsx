import type { ReactNode } from "react";

/**
 * The controlled status vocabulary. Clinical hues appear only when something is
 * genuinely safe, cautionary, critical or informational — and never without a
 * word beside them, which is why the label is required.
 */
export type PillTone = "neutral" | "info" | "safe" | "caution" | "critical" | "primary";

/**
 * Three values per tone, because the label and the dot are doing different
 * jobs. The label is 11.5px text and needs 4.5:1, which the status hue does not
 * give on its own pale ground; the dot is a graphic and needs 3:1, which the
 * hue does give. So the text takes the darker tint and the dot keeps the true
 * status colour — the status still reads as itself, and the word is legible.
 */
const TONE: Record<PillTone, { fg: string; dot: string; bg: string; line: string }> = {
  neutral: { fg: "var(--color-ink-2)", dot: "var(--color-ink-3)", bg: "var(--color-surface-2)", line: "var(--color-line-2)" },
  info: { fg: "var(--color-info-text)", dot: "var(--color-info)", bg: "var(--color-info-soft)", line: "var(--color-info)" },
  safe: { fg: "var(--color-safe-text)", dot: "var(--color-safe)", bg: "var(--color-safe-soft)", line: "var(--color-safe)" },
  caution: { fg: "var(--color-caution-text)", dot: "var(--color-caution)", bg: "var(--color-caution-soft)", line: "var(--color-caution)" },
  critical: { fg: "var(--color-critical-text)", dot: "var(--color-critical)", bg: "var(--color-critical-soft)", line: "var(--color-critical)" },
  primary: { fg: "var(--color-primary-text)", dot: "var(--color-primary)", bg: "var(--color-primary-soft)", line: "var(--color-primary-line)" },
};

/** Status label → tone, transcribed from the design system's pill sheet. */
export const STATUS_TONE: Record<string, PillTone> = {
  draft: "neutral",
  DRAFT: "neutral",
  awaiting_review: "info",
  "Awaiting review": "info",
  approved: "safe",
  Approved: "safe",
  modified: "caution",
  Modified: "caution",
  rejected: "critical",
  Rejected: "critical",
  info_needed: "info",
  "Needs more information": "info",
  superseded: "neutral",
  nurse_assigned: "info",
  en_route: "info",
  in_progress: "primary",
  completed: "safe",
  cancelled: "neutral",
  refund_pending: "caution",
  adverse_event: "critical",
  CONFIRMED: "safe",
  DISPATCHED: "primary",
  CANCELLED: "neutral",
  quarantined: "critical",
  out_of_stock: "critical",
  active: "safe",
  inactive: "neutral",
  pending: "info",
  suspended: "critical",
};

const READABLE: Record<string, string> = {
  awaiting_review: "Awaiting review",
  // Without this the fallback capitalises the raw value and a patient is shown
  // "Info_needed", which is a database column, not a sentence.
  info_needed: "Needs more information",
  superseded: "Replaced by newer answers",
  nurse_assigned: "Nurse assigned",
  en_route: "En route",
  in_progress: "In progress",
  refund_pending: "Refund pending",
  adverse_event: "Adverse event",
  out_of_stock: "Out of stock",
};

/**
 * Statuses still in motion — someone is on the way, a session is running, a
 * physician has yet to decide. Their dot pulses; nothing else does.
 *
 * A pulse says "this is happening now", so it is kept off every settled state
 * (completed, cancelled, rejected, draft) and every standing fact (an allergy,
 * a stock level). Pulsing those would say something untrue, and a table where
 * every row throbs has no signal left in it.
 */
const LIVE_STATUSES = new Set([
  "en_route",
  "in_progress",
  "nurse_assigned",
  "awaiting_review",
  "Awaiting review",
  "info_needed",
  "Needs more information",
  "pending",
]);

export function isLiveStatus(status: string): boolean {
  return LIVE_STATUSES.has(status);
}

export function labelFor(status: string): string {
  if (READABLE[status]) return READABLE[status];
  if (status === status.toUpperCase()) return status.charAt(0) + status.slice(1).toLowerCase();
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function Pill({
  children,
  tone = "neutral",
  dot = false,
  pulse = false,
  className = "",
}: {
  children: ReactNode;
  tone?: PillTone;
  dot?: boolean;
  /**
   * A ring that leaves the dot every two seconds, for a state still in motion.
   * Needs `dot`. StatusPill sets it from the status; pass it directly only for
   * something that is genuinely live.
   */
  pulse?: boolean;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <span
      className={`inline-flex items-center gap-[6px] rounded-full px-[10px] py-[3px] whitespace-nowrap ${className}`}
      style={{
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.line}`,
        font: "500 11.5px/1.4 var(--font-sans)",
        letterSpacing: "0.02em",
      }}
    >
      {dot && (
        <span aria-hidden className="relative w-[6px] h-[6px] flex-none">
          {/* The ring grows by transform, so it never moves the label. It is
              transparent unless animating: with reduced motion the global rule
              in globals.css stops the animation and the ring simply is not
              there, rather than sitting frozen around the dot. */}
          {pulse && (
            <span
              className="absolute inset-0 rounded-full opacity-0"
              style={{ background: t.dot, animation: "ndDotPulse 2s cubic-bezier(0, 0, 0.2, 1) infinite" }}
            />
          )}
          <span className="absolute inset-0 rounded-full" style={{ background: t.dot }} />
        </span>
      )}
      {children}
    </span>
  );
}

/**
 * Convenience wrapper that maps a raw status string to tone and label. A
 * dotted pill for a live status pulses on its own; `pulse` overrides that.
 */
export function StatusPill({ status, dot, pulse }: { status: string; dot?: boolean; pulse?: boolean }) {
  return (
    <Pill tone={STATUS_TONE[status] ?? "neutral"} dot={dot} pulse={pulse ?? isLiveStatus(status)}>
      {labelFor(status)}
    </Pill>
  );
}

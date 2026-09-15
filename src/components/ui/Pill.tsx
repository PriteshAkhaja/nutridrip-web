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
  nurse_assigned: "Nurse assigned",
  en_route: "En route",
  in_progress: "In progress",
  refund_pending: "Refund pending",
  adverse_event: "Adverse event",
  out_of_stock: "Out of stock",
};

export function labelFor(status: string): string {
  if (READABLE[status]) return READABLE[status];
  if (status === status.toUpperCase()) return status.charAt(0) + status.slice(1).toLowerCase();
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function Pill({
  children,
  tone = "neutral",
  dot = false,
  className = "",
}: {
  children: ReactNode;
  tone?: PillTone;
  dot?: boolean;
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
      {dot && <span className="w-[6px] h-[6px] rounded-full flex-none" style={{ background: t.dot }} />}
      {children}
    </span>
  );
}

/** Convenience wrapper that maps a raw status string to tone and label. */
export function StatusPill({ status, dot }: { status: string; dot?: boolean }) {
  return (
    <Pill tone={STATUS_TONE[status] ?? "neutral"} dot={dot}>
      {labelFor(status)}
    </Pill>
  );
}

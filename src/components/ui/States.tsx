import type { ReactNode } from "react";
import { ButtonLink } from "./Button";

/**
 * Block 7. Skeletons match the shape of what is coming; empties do four
 * different jobs; failures never lose the user's work; offline is a normal
 * condition, not an error.
 */

export function Skeleton({ w = "100%", h = 12, className = "" }: { w?: string; h?: number; className?: string }) {
  return <div className={`skeleton ${className}`} style={{ width: w, height: h }} aria-hidden />;
}

/** A table skeleton whose column widths mirror the real rows. */
export function TableSkeleton({ rows = 5, cols = 3 }: { rows?: number; cols?: number }) {
  const widths = ["62%", "40%", "70%", "48%", "34%", "56%"];
  return (
    <div
      className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] overflow-hidden"
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-6 px-4 py-[18px] border-b border-[var(--color-line)] last:border-b-0">
          {Array.from({ length: cols }, (_, c) => (
            <div key={c} className="flex-1">
              <Skeleton w={widths[(r * cols + c) % widths.length]} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export type EmptyKind = "first-run" | "filtered" | "cleared" | "not-permitted";

const EMPTY_EYEBROW: Record<EmptyKind, string> = {
  "first-run": "First run",
  filtered: "Filtered to nothing",
  cleared: "Cleared queue",
  "not-permitted": "Not permitted",
};

/**
 * Four kinds of empty, four different jobs — a first run invites, a filtered
 * result reassures, a cleared queue confirms, a refusal explains.
 */
export function EmptyState({
  kind = "first-run",
  title,
  body,
  actionLabel,
  actionHref,
  action,
}: {
  kind?: EmptyKind;
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-8 flex flex-col gap-3 items-start">
      <span className="t-micro">{EMPTY_EYEBROW[kind]}</span>
      <h3 className="t-h3">{title}</h3>
      <p className="t-body text-[var(--color-ink-2)] max-w-[54ch]">{body}</p>
      {action ??
        (actionLabel && actionHref ? (
          <div className="mt-2">
            <ButtonLink href={actionHref} variant={kind === "first-run" ? "primary" : "secondary"}>
              {actionLabel}
            </ButtonLink>
          </div>
        ) : null)}
    </div>
  );
}

/** A failure that states plainly what was and was not lost. */
export function FailureState({
  title,
  body,
  code,
  reassurance,
  actions,
}: {
  title: string;
  body?: string;
  code?: string;
  /** What is safe — "Nothing was charged", "Your slot is held". */
  reassurance?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] p-6 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[var(--color-critical)] flex-none" />
        <h3 className="t-h3 text-[18px]">{title}</h3>
      </div>
      {body && <p className="t-body text-[var(--color-ink-2)] max-w-[60ch]">{body}</p>}
      {reassurance && <p className="t-body text-[var(--color-ink)]">{reassurance}</p>}
      {code && <span className="t-data text-[13px] text-[var(--color-ink-3)]">{code}</span>}
      {actions && <div className="flex flex-wrap gap-2 mt-1">{actions}</div>}
    </div>
  );
}

export function OfflineBanner({ since, queued }: { since: string; queued: number }) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap rounded-[var(--radius-md)] border border-[var(--color-caution)] bg-[var(--color-caution-soft)] px-4 py-3">
      <div className="flex flex-col gap-1">
        <span className="t-micro text-[var(--color-caution-text)]">Offline since {since}</span>
        <span className="t-body">You can keep working — everything is saved on this device.</span>
      </div>
      <span className="t-data text-[13px] text-[var(--color-ink-2)]">{queued} queued</span>
    </div>
  );
}

export function InlineNotice({
  tone = "info",
  children,
}: {
  tone?: "info" | "safe" | "caution" | "critical";
  children: ReactNode;
}) {
  const TONE = {
    info: "border-[var(--color-info)] bg-[var(--color-info-soft)] text-[var(--color-info-text)]",
    safe: "border-[var(--color-safe)] bg-[var(--color-safe-soft)] text-[var(--color-safe-text)]",
    caution: "border-[var(--color-caution)] bg-[var(--color-caution-soft)] text-[var(--color-caution-text)]",
    critical: "border-[var(--color-critical)] bg-[var(--color-critical-soft)] text-[var(--color-critical-text)]",
  }[tone];

  return (
    <div className={`rounded-[var(--radius-md)] border px-4 py-3 flex gap-3 items-start ${TONE}`}>
      <span className="w-[6px] h-[6px] rounded-full flex-none mt-[7px] bg-current" />
      <span className="t-body text-[var(--color-ink-2)]">{children}</span>
    </div>
  );
}

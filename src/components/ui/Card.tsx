import type { ReactNode } from "react";
import Link from "next/link";

/** Cards never lift. Only floating layers cast a shadow. */
export function Card({
  children,
  className = "",
  tone = "surface",
  padding = "p-6",
}: {
  children: ReactNode;
  className?: string;
  tone?: "surface" | "muted" | "primary" | "safe" | "caution" | "critical" | "info";
  padding?: string;
}) {
  const TONE = {
    surface: "bg-[var(--color-surface)] border-[var(--color-line)]",
    muted: "bg-[var(--color-surface-2)] border-[var(--color-line)]",
    primary: "bg-[var(--color-primary-soft)] border-[var(--color-primary-line)]",
    safe: "bg-[var(--color-safe-soft)] border-[var(--color-safe)]",
    caution: "bg-[var(--color-caution-soft)] border-[var(--color-caution)]",
    critical: "bg-[var(--color-critical-soft)] border-[var(--color-critical)]",
    info: "bg-[var(--color-info-soft)] border-[var(--color-info)]",
  }[tone];

  return (
    <div className={`rounded-[var(--radius-lg)] border ${TONE} ${padding} ${className}`}>{children}</div>
  );
}

export function SectionHead({
  eyebrow,
  title,
  sub,
  action,
}: {
  eyebrow?: string;
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 mb-5 flex-wrap">
      <div className="flex flex-col gap-2 min-w-0">
        {eyebrow && <span className="t-micro">{eyebrow}</span>}
        <h2 className="t-h2">{title}</h2>
        {sub && <p className="t-body text-[var(--color-ink-2)] max-w-[62ch]">{sub}</p>}
      </div>
      {action && <div className="flex gap-2 flex-none">{action}</div>}
    </div>
  );
}

/**
 * A stat with a Fill under it. The Fill encodes the figure's share of its
 * target — never a decorative flourish.
 */
export function StatCard({
  label,
  value,
  pct,
  color = "var(--color-primary)",
  note,
  href,
}: {
  label: string;
  value: string;
  pct?: number;
  color?: string;
  note?: ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <span className="t-micro">{label}</span>
      <span className="t-data block mt-2 text-[26px] leading-[1.15] text-[var(--color-ink)]">{value}</span>
      {pct !== undefined && (
        <div className="mt-3 h-[6px] rounded-full overflow-hidden bg-[var(--color-surface-2)]">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }}
          />
        </div>
      )}
      {note && <p className="t-small text-[var(--color-ink-2)] mt-3">{note}</p>}
    </>
  );

  const cls =
    "block rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 no-underline hover:no-underline";

  return href ? (
    <Link href={href} className={`${cls} hover:border-[var(--color-primary-line)] transition-colors duration-150`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

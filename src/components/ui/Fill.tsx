import type { CSSProperties, ReactNode } from "react";

/**
 * The Fill family — one primitive at five scales. A Fill never decorates; it
 * always encodes a real quantity, and a Fill without a number is forbidden.
 * If there is no quantity to show, use a hairline and whitespace instead.
 */

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/* -------------------------------------------------------------------------
   FillBar — horizontal, with an optional threshold marker
   ------------------------------------------------------------------------- */

export function FillBar({
  label,
  value,
  pct,
  threshold,
  thresholdLabel,
  color = "var(--color-primary)",
  track = "var(--color-surface-2)",
  height = 6,
}: {
  label: ReactNode;
  /** The number this Fill encodes. Required — a Fill without a number is forbidden. */
  value: string;
  pct: number;
  /** Position of the max-per-session line, 0–100. */
  threshold?: number;
  thresholdLabel?: string;
  color?: string;
  track?: string;
  height?: number;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 mb-[7px]">
        <span className="t-body text-[var(--color-ink-2)]">{label}</span>
        <span className="t-data text-[14.5px] leading-[1.55]">{value}</span>
      </div>
      <div
        className="relative rounded-full overflow-hidden"
        style={{ height, background: track }}
        role="img"
        aria-label={`${typeof label === "string" ? label : "value"}: ${value}`}
      >
        <div
          className="absolute top-0 bottom-0 left-0 rounded-full"
          style={{ width: `${clamp(pct)}%`, background: color }}
        />
        {threshold !== undefined && (
          <div
            className="absolute -top-1 -bottom-1 w-px"
            style={{ left: `${clamp(threshold)}%`, background: "var(--color-ink-2)" }}
          />
        )}
      </div>
      {thresholdLabel && (
        <div className="flex justify-end mt-[6px]">
          <span className="t-small text-[var(--color-ink-3)]">{thresholdLabel}</span>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
   FillRing — vitality score. The only place apricot appears.
   ------------------------------------------------------------------------- */

export function FillRing({
  score,
  size = 132,
  stroke = 12,
  caption = "Vitality",
}: {
  score: number;
  size?: number;
  stroke?: number;
  caption?: string | null;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (clamp(score) / 100) * c;

  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
        role="img"
        aria-label={`${caption ?? "Score"}: ${score} out of 100`}
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-[2px]">
        <span
          className="t-data"
          style={{ font: `500 ${Math.round(size * 0.26)}px/1 var(--font-mono)`, color: "var(--color-ink)" }}
        >
          {score}
        </span>
        {caption && <span className="t-micro">{caption}</span>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   FillColumn — an IV bag draining, vertical
   ------------------------------------------------------------------------- */

export function FillColumn({
  pct,
  width = 56,
  height = 132,
  color = "var(--color-primary)",
  ariaLabel,
}: {
  pct: number;
  width?: number;
  height?: number;
  color?: string;
  ariaLabel?: string;
}) {
  const filled = clamp(pct);
  return (
    <div
      className="relative overflow-hidden flex-none"
      style={{
        width,
        height,
        border: "1px solid var(--color-primary-line)",
        borderRadius: "10px 10px 16px 16px",
        background: "var(--color-surface-2)",
      }}
      role="img"
      aria-label={ariaLabel ?? `${Math.round(filled)} percent remaining`}
    >
      <div className="absolute left-0 right-0 bottom-0" style={{ height: `${filled}%`, background: color }} />
      {/* Graduation marks, as on a real bag */}
      <div className="absolute left-0 right-0 h-px" style={{ top: "29%", background: "var(--color-line-2)" }} />
      <div className="absolute left-0 right-0 h-px" style={{ top: "58%", background: "rgba(255,255,255,.35)" }} />
    </div>
  );
}

/* -------------------------------------------------------------------------
   FillSegments — discrete progress, e.g. a 29-step checklist by phase
   ------------------------------------------------------------------------- */

export function FillSegments({
  name,
  done,
  total,
  color = "var(--color-primary)",
}: {
  name: string;
  done: number;
  total: number;
  color?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-[7px]">
        <span className="t-body text-[var(--color-ink-2)]">{name}</span>
        <span className="t-data text-[13px] leading-[1.5] text-[var(--color-ink-3)]">
          {done} / {total}
        </span>
      </div>
      <div className="flex gap-[3px]" role="img" aria-label={`${name}: ${done} of ${total} complete`}>
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className="flex-1 h-2 rounded-[2px]"
            style={{ background: i < done ? color : "var(--color-surface-2)" }}
          />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   FillDepleting — stock on hand, or days left before expiry
   ------------------------------------------------------------------------- */

export function FillDepleting({
  label,
  value,
  pct,
  color,
  track,
  markerPct,
  note,
}: {
  label: string;
  value: string;
  pct: number;
  color: string;
  track?: string;
  /** Reorder level or similar, drawn as a hairline. */
  markerPct?: number;
  note?: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 mb-[7px]">
        <span className="t-body text-[var(--color-ink-2)]">{label}</span>
        <span className="t-data text-[14.5px] leading-[1.55]">{value}</span>
      </div>
      <div
        className="relative h-2 rounded-[2px] overflow-hidden"
        style={{ background: track ?? "var(--color-surface-2)" }}
        role="img"
        aria-label={`${label}: ${value}`}
      >
        <div className="absolute top-0 bottom-0 left-0" style={{ width: `${clamp(pct)}%`, background: color }} />
        {markerPct !== undefined && (
          <div
            className="absolute top-0 bottom-0 w-px"
            style={{ left: `${clamp(markerPct)}%`, background: "var(--color-line-2)" }}
          />
        )}
      </div>
      {note && (
        <div className="flex items-center gap-[6px] mt-[7px]">
          <span className="inline-block w-[6px] h-[6px] rounded-full flex-none" style={{ background: color }} />
          <span className="t-small text-[var(--color-ink-2)]">{note}</span>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Shared status colour lookup, used by every Fill above
   ------------------------------------------------------------------------- */

export type StockStatus = "healthy" | "expiring" | "low" | "expired" | "out";

export const STATUS_STYLE: Record<StockStatus, { color: string; soft: string; label: string }> = {
  healthy: { color: "var(--color-safe)", soft: "var(--color-safe-soft)", label: "Healthy" },
  expiring: { color: "var(--color-caution)", soft: "var(--color-caution-soft)", label: "Expiring" },
  low: { color: "var(--color-caution)", soft: "var(--color-caution-soft)", label: "Low" },
  expired: { color: "var(--color-critical)", soft: "var(--color-critical-soft)", label: "Expired" },
  out: { color: "var(--color-critical)", soft: "var(--color-critical-soft)", label: "Out of stock" },
};

export const cssVar = (v: string): CSSProperties => ({ color: v });

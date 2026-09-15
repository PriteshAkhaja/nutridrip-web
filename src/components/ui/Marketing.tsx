import type { ReactNode } from "react";
import { Card } from "./Card";
import type { Testimonial } from "@/lib/data/marketing";

/* -------------------------------------------------------------------------
   Stars. Half-steps matter on an aggregate — 4.9 must not round to 5.
   ------------------------------------------------------------------------- */
export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-[2px]" role="img" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, rating - n + 1));
        return (
          <span key={n} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} color="var(--color-line-2)" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star size={size} color="var(--color-primary)" />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function Star({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill={color} aria-hidden>
      <path d="M10 1.5l2.6 5.3 5.9.85-4.25 4.15 1 5.85L10 14.9l-5.25 2.75 1-5.85L1.5 7.65l5.9-.85L10 1.5Z" />
    </svg>
  );
}

/* -------------------------------------------------------------------------
   Section scaffolding — one shape reused, so every band reads as one system
   ------------------------------------------------------------------------- */
export function Section({
  children,
  tone = "paper",
  id,
  className = "",
}: {
  children: ReactNode;
  tone?: "paper" | "ink" | "soft";
  id?: string;
  className?: string;
}) {
  const bg = {
    paper: "bg-[var(--color-paper)]",
    soft: "bg-[var(--color-surface-2)]",
    ink: "bg-[var(--color-ink)]",
  }[tone];
  return (
    <section id={id} className={`${bg} ${className}`}>
      <div className="mx-auto max-w-[1240px] px-6 md:px-10 py-16 md:py-24">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  sub,
  center = false,
  onInk = false,
}: {
  eyebrow?: string;
  title: ReactNode;
  sub?: ReactNode;
  center?: boolean;
  onInk?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-3 mb-10 ${center ? "items-center text-center" : ""}`}>
      {eyebrow && (
        <span
          className="t-micro"
          style={{ color: onInk ? "var(--color-primary-on-dark)" : "var(--color-primary)" }}
        >
          {eyebrow}
        </span>
      )}
      <h2
        style={{
          font: "700 clamp(28px,3.6vw,42px)/1.08 var(--font-display)",
          letterSpacing: "-0.03em",
          textWrap: "balance",
          color: onInk ? "#FFFFFF" : "var(--color-ink)",
          maxWidth: center ? "22ch" : "20ch",
        }}
      >
        {title}
      </h2>
      {sub && (
        <p
          className="t-body-lg max-w-[58ch]"
          style={{ color: onInk ? "rgba(255,255,255,.72)" : "var(--color-ink-2)", textWrap: "pretty" }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Social proof
   ------------------------------------------------------------------------- */
export function RatingStrip({
  rating,
  count,
  className = "",
}: {
  rating: number;
  count: number;
  className?: string;
}) {
  return (
    <div className={`inline-flex items-center gap-3 flex-wrap ${className}`}>
      <Stars rating={rating} size={16} />
      <span className="t-data text-[14.5px]">{rating.toFixed(1)}</span>
      <span className="t-small text-[var(--color-ink-2)]">
        from <span className="t-data text-[13px]">{count.toLocaleString("en-IN")}</span> verified sessions
      </span>
    </div>
  );
}

export function TestimonialCard({ t, compact = false }: { t: Testimonial; compact?: boolean }) {
  return (
    <Card padding={compact ? "p-5" : "p-6"} className="flex flex-col gap-4 h-full">
      <Stars rating={t.rating} />
      <p
        className="flex-1"
        style={{
          font: `400 ${compact ? "14.5px/1.6" : "16px/1.62"} var(--font-sans)`,
          color: "var(--color-ink)",
          textWrap: "pretty",
        }}
      >
        {t.quote}
      </p>
      <div className="flex items-baseline justify-between gap-3 pt-4 border-t border-[var(--color-line)]">
        <div className="flex flex-col min-w-0">
          <span className="t-body font-semibold truncate">{t.name}</span>
          <span className="t-small text-[var(--color-ink-3)] truncate">{t.detail}</span>
        </div>
        <span className="t-data text-[13px] text-[var(--color-ink-3)] flex-none">{t.drip}</span>
      </div>
      {t.verified && (
        <span className="t-micro" style={{ color: "var(--color-primary)" }}>
          Verified session
        </span>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------
   Comparison — a claim per row, each one checkable elsewhere on the site
   ------------------------------------------------------------------------- */
export function ComparisonTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<{ label: string; values: boolean[] }>;
}) {
  return (
    <div
      tabIndex={0}
      role="group"
      aria-label="Comparison of NutriDrip, a drip bar and a hospital day-care"
      className="scroll-x rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)]"
    >
      <table className="w-full border-collapse min-w-[600px]">
        <thead>
          <tr>
            <th className="text-left t-micro px-5 py-4 border-b border-[var(--color-line)]" />
            {columns.map((c, i) => (
              <th
                key={c}
                className="px-5 py-4 border-b text-center"
                style={{
                  borderColor: "var(--color-line)",
                  background: i === 0 ? "var(--color-primary-soft)" : "transparent",
                  borderBottomColor: i === 0 ? "var(--color-primary)" : "var(--color-line)",
                }}
              >
                <span
                  style={{
                    font: `${i === 0 ? 700 : 500} 14.5px/1.3 var(--font-display)`,
                    color: i === 0 ? "var(--color-primary-dark)" : "var(--color-ink-2)",
                  }}
                >
                  {c}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-[var(--color-line)] last:border-b-0">
              <td className="t-body px-5 py-[14px]">{r.label}</td>
              {r.values.map((v, i) => (
                <td
                  key={i}
                  className="px-5 py-[14px] text-center"
                  style={{ background: i === 0 ? "var(--color-primary-soft)" : "transparent" }}
                >
                  <Mark on={v} emphasis={i === 0} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Mark({ on, emphasis }: { on: boolean; emphasis: boolean }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full"
      style={{
        width: 22,
        height: 22,
        background: on ? (emphasis ? "var(--color-primary)" : "var(--color-ink)") : "transparent",
        border: on ? "none" : "1.5px solid var(--color-line-2)",
        color: on ? "#FFFFFF" : "var(--color-ink-3)",
        font: "600 12px/1 var(--font-sans)",
      }}
      aria-label={on ? "Yes" : "No"}
    >
      {on ? "✓" : "✕"}
    </span>
  );
}

/* -------------------------------------------------------------------------
   FAQ — details/summary, so it works with JavaScript off
   ------------------------------------------------------------------------- */
export function FaqList({ items }: { items: Array<{ q: string; a: string }> }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] overflow-hidden">
      {items.map((f, i) => (
        <details key={f.q} open={i === 0} className="border-b border-[var(--color-line)] last:border-b-0 group">
          <summary className="flex items-start justify-between gap-4 px-5 md:px-6 py-5 cursor-pointer list-none min-h-[44px]">
            <span
              style={{
                font: "500 16px/1.5 var(--font-sans)",
                color: "var(--color-ink)",
              }}
              className="group-open:font-semibold"
            >
              {f.q}
            </span>
            <span
              className="flex-none inline-flex items-center justify-center rounded-full mt-[2px]"
              style={{
                width: 24,
                height: 24,
                border: "1px solid var(--color-line-2)",
                color: "var(--color-ink-2)",
                font: "400 15px/1 var(--font-mono)",
              }}
              aria-hidden
            >
              <span className="group-open:hidden">+</span>
              <span className="hidden group-open:inline">−</span>
            </span>
          </summary>
          <p className="t-body-lg text-[var(--color-ink-2)] px-5 md:px-6 pb-6 -mt-1 max-w-[70ch]">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------
   The "as recommended by" strip. Real logos drop in; until then, named
   partners as text, which is honest and still does the job.
   ------------------------------------------------------------------------- */
export function TrustStrip({ items }: { items: string[] }) {
  return (
    <div className="border-y border-[var(--color-line)] bg-[var(--color-surface-2)]">
      <div className="mx-auto max-w-[1240px] px-6 md:px-10 py-5 flex items-center gap-8 flex-wrap justify-center">
        <span className="t-micro">As practised at</span>
        {items.map((i) => (
          <span
            key={i}
            style={{
              font: "600 14px/1 var(--font-display)",
              color: "var(--color-ink-3)",
              letterSpacing: "-0.01em",
            }}
          >
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}

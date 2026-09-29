import type { ReactNode } from "react";
import type { Testimonial } from "@/lib/data/marketing";
import { Marquee } from "@/components/site/Marquee";
import { IconCheck } from "@/components/site/Icons";

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
   Section scaffolding — one shape reused, so every band reads as one system.
   Every band shares the header's 1280px width and the one section padding.
   The dark tones set `.on-dark`, which re-colours eyebrows, ledes and the
   second voice of a heading for the ground they sit on.
   ------------------------------------------------------------------------- */
export type SectionTone = "paper" | "soft" | "mist" | "ink" | "deep";

export function Section({
  children,
  tone = "paper",
  id,
  className = "",
  labelledBy,
}: {
  children: ReactNode;
  tone?: SectionTone;
  id?: string;
  className?: string;
  labelledBy?: string;
}) {
  const bg = {
    paper: "bg-[var(--color-paper)]",
    soft: "bg-[var(--color-surface-2)]",
    mist: "bg-[var(--color-mist)]",
    ink: "bg-[var(--color-ink)] text-white on-dark",
    deep: "bg-[var(--color-deep)] text-white on-dark",
  }[tone];
  return (
    <section id={id} aria-labelledby={labelledBy} className={`${bg} section-y ${className}`}>
      <div className="mx-auto w-full max-w-[1280px] px-6 md:px-10">{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------
   Social proof
   ------------------------------------------------------------------------- */
export function RatingStrip({
  rating,
  count,
  className = "",
  onDark = false,
}: {
  rating: number;
  count: number;
  className?: string;
  onDark?: boolean;
}) {
  return (
    <div className={`inline-flex items-center gap-3 flex-wrap ${className}`}>
      <Stars rating={rating} size={16} />
      <span className="t-data text-[14.5px]">{rating.toFixed(1)}</span>
      <span className={`t-small ${onDark ? "text-white/70" : "text-[var(--color-ink-2)]"}`}>
        from <span className="t-data text-[13px]">{count.toLocaleString("en-IN")}</span> verified sessions
      </span>
    </div>
  );
}

/** "Ananya R." -> "AR". Initials, never an invented face. */
function initials(name: string) {
  return name
    .replace(/^Dr\.?\s+/i, "")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TestimonialCard({ t, compact = false }: { t: Testimonial; compact?: boolean }) {
  return (
    <figure
      className={`@container m-0 h-full flex flex-col rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] ${
        compact ? "p-6" : "p-7 md:p-8"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <Stars rating={t.rating} />
        {t.verified && (
          <span className="inline-flex items-center gap-[6px] t-small font-medium text-[var(--color-primary-text)]">
            <IconCheck size={15} />
            Verified session
          </span>
        )}
      </div>
      <blockquote
        className="m-0 mt-5 flex-1"
        style={{
          font: `400 ${compact ? "15px/1.6" : "17px/1.62"} var(--font-sans)`,
          color: "var(--color-ink)",
          textWrap: "pretty",
        }}
      >
        &ldquo;{t.quote}&rdquo;
      </blockquote>
      {/* A narrow card (a phone) gives the drip its own line under the name,
          rather than cutting the name short to fit it beside. */}
      <figcaption className="mt-7 pt-5 border-t border-[var(--color-line)] grid grid-cols-[40px_minmax(0,1fr)] items-center gap-x-3 gap-y-3 @sm:flex @sm:items-center">
        <span
          aria-hidden
          className="w-10 h-10 rounded-full bg-[var(--color-mist)] text-[var(--color-primary-text)] inline-flex items-center justify-center flex-none text-[13px] font-semibold tracking-wide"
        >
          {initials(t.name)}
        </span>
        <span className="flex flex-col min-w-0">
          <span className="t-body font-semibold">{t.name}</span>
          <span className="t-small text-[var(--color-ink-3)]">{t.detail}</span>
        </span>
        <span className="col-start-2 justify-self-start t-small text-[var(--color-ink-2)] flex-none whitespace-nowrap rounded-full border border-[var(--color-line)] px-3 py-1 @sm:ml-auto">
          {t.drip}
        </span>
      </figcaption>
    </figure>
  );
}

/* -------------------------------------------------------------------------
   Comparison — a claim per row, each one checkable elsewhere on the site.
   On a phone the table scrolls sideways with the row labels pinned, so a
   tick is never read without the claim it answers.
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
      className="scroll-x rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)]"
      data-reveal
    >
      <table className="w-full border-collapse min-w-[620px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-[var(--color-surface)] text-left t-micro px-5 md:px-7 py-5 border-b border-[var(--color-line)]">
              <span className="sr-only">Claim</span>
            </th>
            {columns.map((c, i) => (
              <th
                key={c}
                scope="col"
                className="px-5 py-5 border-b text-center align-bottom"
                style={{
                  borderColor: i === 0 ? "var(--color-primary)" : "var(--color-line)",
                  background: i === 0 ? "var(--color-primary-soft)" : "transparent",
                }}
              >
                <span
                  style={{
                    font: `${i === 0 ? 700 : 500} 15px/1.3 var(--font-display)`,
                    color: i === 0 ? "var(--color-primary-text)" : "var(--color-ink-2)",
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
              <th
                scope="row"
                className="sticky left-0 z-10 bg-[var(--color-surface)] text-left t-body font-normal px-5 md:px-7 py-4"
              >
                {r.label}
              </th>
              {r.values.map((v, i) => (
                <td
                  key={i}
                  className="px-5 py-4 text-center"
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
        width: 24,
        height: 24,
        background: on ? (emphasis ? "var(--color-primary)" : "var(--color-ink)") : "transparent",
        border: on ? "none" : "1.5px solid var(--color-line-2)",
        color: on ? "#FFFFFF" : "var(--color-ink-3)",
      }}
      role="img"
      aria-label={on ? "Yes" : "No"}
    >
      {on ? (
        <IconCheck size={15} />
      ) : (
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden style={{ display: "block" }}>
          <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}

/* -------------------------------------------------------------------------
   FAQ — details/summary, so it works with JavaScript off. Where the browser
   can animate to `auto` it opens with a height transition (globals.css).
   ------------------------------------------------------------------------- */
export function FaqList({
  items,
  open = "first",
}: {
  items: Array<{ q: string; a: string }>;
  /**
   * Which answers start open. "first" is what the home page has always done;
   * a search opens every match, because somebody who typed a word wants to see
   * the sentence it is in, not a list of closed rows to click through.
   */
  open?: "first" | "all" | "none";
}) {
  return (
    <div className="faq rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] overflow-hidden">
      {items.map((f, i) => (
        <details
          key={f.q}
          open={open === "all" || (open === "first" && i === 0)}
          className="group border-b border-[var(--color-line)] last:border-b-0"
        >
          <summary className="flex items-start justify-between gap-5 px-6 md:px-7 py-5 md:py-6 cursor-pointer list-none min-h-[44px] [&::-webkit-details-marker]:hidden transition-colors duration-200 hover:bg-[var(--color-mist)]">
            <span className="text-[16px] md:text-[17px] leading-[1.45] font-medium text-[var(--color-ink)] group-open:font-semibold">
              {f.q}
            </span>
            <span
              aria-hidden
              className="flex-none mt-[1px] w-7 h-7 rounded-full border border-[var(--color-line-2)] text-[var(--color-ink-2)] inline-flex items-center justify-center transition-[transform,background-color,border-color,color] duration-300 group-open:rotate-45 group-open:bg-[var(--color-ink)] group-open:border-[var(--color-ink)] group-open:text-white"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" style={{ display: "block" }}>
                <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
          </summary>
          <p className="t-body-lg text-[var(--color-ink-2)] px-6 md:px-7 pb-6 -mt-1 max-w-[68ch]">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------
   The credentials strip. Named registrations as text rather than borrowed
   logos, which is honest and still does the job; real logos can drop in.
   ------------------------------------------------------------------------- */
export function TrustStrip({ items, label = "The service, on the record" }: { items: string[]; label?: string }) {
  return (
    <div className="border-y border-[var(--color-line)] bg-[var(--color-paper)]">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10 py-6 flex flex-col gap-4 md:flex-row md:items-center md:gap-10">
        <span className="t-micro flex-none">{label}</span>
        <Marquee
          label={label}
          className="flex-1 min-w-0"
          duration={42}
          gap={40}
          items={items.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-3 whitespace-nowrap"
              style={{ font: "600 15px/1 var(--font-display)", color: "var(--color-ink-2)", letterSpacing: "-0.01em" }}
            >
              <span aria-hidden className="w-[6px] h-[6px] rounded-full bg-[var(--color-primary)] opacity-70" />
              {item}
            </span>
          ))}
        />
      </div>
    </div>
  );
}

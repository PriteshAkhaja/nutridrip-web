import type { ReactNode } from "react";

export type TimelineState = "done" | "now" | "next";

export type TimelineItem = {
  label: string;
  time: string;
  state: TimelineState;
};

const STYLE: Record<TimelineState, { size: number; bg: string; ring: string; line: string; cls: string }> = {
  done: {
    size: 10,
    bg: "var(--color-primary)",
    ring: "var(--color-primary)",
    line: "var(--color-primary-line)",
    cls: "font-medium text-[14.5px] leading-[1.55] text-[var(--color-ink-2)]",
  },
  now: {
    size: 14,
    bg: "var(--color-accent)",
    ring: "var(--color-accent-soft)",
    line: "var(--color-line)",
    cls: "font-semibold text-[16px] leading-[1.4] text-[var(--color-ink)] font-[var(--font-display)]",
  },
  next: {
    size: 10,
    bg: "var(--color-surface)",
    ring: "var(--color-line-2)",
    line: "var(--color-line)",
    cls: "text-[14.5px] leading-[1.55] text-[var(--color-ink-3)]",
  },
};

/** The session's life, from booked to aftercare. */
export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="flex flex-col list-none m-0 p-0">
      {items.map((item, i) => {
        const s = STYLE[item.state];
        const last = i === items.length - 1;
        return (
          <li key={i} className="flex gap-4">
            <div className="flex flex-col items-center flex-none" style={{ width: 16 }}>
              <span
                className="rounded-full flex-none"
                style={{
                  width: s.size,
                  height: s.size,
                  background: s.bg,
                  boxShadow: `0 0 0 3px ${s.ring}`,
                  marginTop: 6,
                }}
              />
              {!last && <span className="w-px flex-1 min-h-[28px]" style={{ background: s.line }} />}
            </div>
            <div className={`${last ? "pb-0" : "pb-5"} flex flex-col gap-1 min-w-0`}>
              <span className={s.cls}>{item.label}</span>
              <span className="t-data text-[13px] text-[var(--color-ink-3)]">{item.time}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Key/value rows where the value is always clinical data. */
export function DataRows({ rows }: { rows: Array<{ label: ReactNode; value: ReactNode }> }) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <div key={i} className="flex justify-between gap-4 items-baseline">
          <span className="t-body text-[var(--color-ink-2)]">{r.label}</span>
          <span className="t-data text-[14.5px] leading-[1.55] text-right">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

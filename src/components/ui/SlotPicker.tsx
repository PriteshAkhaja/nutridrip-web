"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { SlotDay } from "@/lib/clinical/slots";

type Loaded = {
  /** The query these came from, so a stale answer is never shown as current. */
  query: string;
  served: boolean;
  zone: { name: string; window: string; every: string } | null;
  days: SlotDay[];
  error?: string;
};

const isFree = (days: SlotDay[], at: string | null) =>
  Boolean(at) && days.some((d) => d.slots.some((s) => s.at === at && s.state === "free"));

/**
 * Which day, and what time — only times a nurse can actually come.
 *
 * Asks the server (/api/bookings/slots) for the address's zone hours and which
 * times still have a free nurse, and shows the rest as taken rather than
 * hiding them, so a full morning reads as full and not as a shorter day.
 * `value` is the chosen moment as an ISO string; it is cleared if a reload
 * shows it has been taken since.
 */
export function SlotPicker({
  query,
  value,
  onChange,
  compact = false,
  idleMessage = "Enter the address first to see the times.",
  reloadKey = 0,
}: {
  /** The search for /api/bookings/slots, or null while there is nothing to ask about. */
  query: string | null;
  value: string | null;
  onChange: Dispatch<SetStateAction<string | null>>;
  /** Smaller cells, for the Move dialog. */
  compact?: boolean;
  idleMessage?: string;
  /** Bump to ask again, e.g. after the server refused a time as just taken. */
  reloadKey?: number;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!query) return;
    let live = true;
    fetch(`/api/bookings/slots?${query}`)
      .then((r) => r.json())
      .then((json) => {
        if (!live) return;
        if (!json.success) {
          setLoaded({ query, served: false, zone: null, days: [], error: json.error ?? "Could not load the times" });
          return;
        }
        const days: SlotDay[] = json.data.days ?? [];
        setLoaded({ query, served: json.data.served, zone: json.data.zone, days });
        // A time chosen before this answer may have gone in the meantime.
        onChange((cur) => (isFree(days, cur) ? cur : null));
      })
      .catch(() => {
        if (live) setLoaded({ query, served: false, zone: null, days: [], error: "Could not reach the server to load the times." });
      });
    return () => {
      live = false;
    };
  }, [query, attempt, reloadKey, onChange]);

  if (!query) return <p className="t-small text-[var(--color-ink-3)]">{idleMessage}</p>;

  const current = loaded?.query === query ? loaded : null;
  const loading = !current;
  const days = current?.days ?? loaded?.days ?? [];

  if (current?.error) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <span className="t-small text-[var(--color-critical-text)]">{current.error}</span>
        <button type="button" className="t-small font-semibold underline cursor-pointer" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </button>
      </div>
    );
  }
  if (current && !current.served) return null; // the pincode note already says we do not come there

  const chosenDay =
    days.find((d) => d.date === pickedDay) ??
    days.find((d) => d.slots.some((s) => s.at === value)) ??
    days.find((d) => d.freeCount > 0) ??
    days[0];

  const cell = compact ? "min-h-[40px] text-[13px]" : "min-h-[48px] text-[14.5px]";
  const radius = compact ? "rounded-[var(--radius-sm)]" : "rounded-[var(--radius-md)]";

  return (
    <div className="flex flex-col gap-5" style={{ opacity: loading ? 0.55 : 1 }} aria-busy={loading}>
      <div>
        <span className="t-micro block mb-3">Which day</span>
        {days.length === 0 ? (
          <p className="t-small text-[var(--color-ink-3)]">Checking which times a nurse is free…</p>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {days.map((d) => {
              const selected = d.date === chosenDay?.date;
              return (
                <button
                  key={d.date}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setPickedDay(d.date)}
                  className={`py-2 ${radius} border flex flex-col items-center gap-[2px] cursor-pointer ${compact ? "min-h-[60px]" : "min-h-[76px]"}`}
                  style={{
                    borderColor: selected ? "var(--color-primary)" : "var(--color-line)",
                    background: selected ? "var(--color-primary-soft)" : "var(--color-surface)",
                  }}
                >
                  <span className="t-micro" style={{ color: selected ? "var(--color-primary-dark)" : "var(--color-ink-3)" }}>
                    {d.weekday}
                  </span>
                  <span
                    className={`t-data ${compact ? "text-[16px]" : "text-[18px]"}`}
                    style={{ color: selected ? "var(--color-primary-dark)" : "var(--color-ink)" }}
                  >
                    {d.day}
                  </span>
                  <span className="text-[11px] leading-[1.3] text-[var(--color-ink-3)]">
                    {d.freeCount === 0 ? "full" : `${d.freeCount} free`}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {chosenDay && (
        <div>
          <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
            <span className="t-micro">What time</span>
            {current?.zone && (
              <span className="t-small text-[var(--color-ink-3)]">
                {current.zone.name} · {current.zone.every}
              </span>
            )}
          </div>
          {chosenDay.freeCount === 0 && (
            <p className="t-small text-[var(--color-ink-2)] mb-3">
              No nurse is free on {chosenDay.weekday} {chosenDay.day} {chosenDay.month}. Try another day.
            </p>
          )}
          <div className={`grid ${compact ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-4"} gap-2`}>
            {chosenDay.slots.map((s) => {
              const selected = s.at === value;
              const open = s.state === "free";
              return (
                <button
                  key={s.at}
                  type="button"
                  disabled={!open || loading}
                  aria-pressed={selected}
                  aria-label={open ? s.time : `${s.time}, ${s.state === "taken" ? "taken" : "too soon"}`}
                  onClick={() => onChange(s.at)}
                  className={`${cell} ${radius} border flex flex-col items-center justify-center t-data ${open ? "cursor-pointer" : "cursor-not-allowed"}`}
                  style={{
                    borderColor: selected ? "var(--color-primary)" : "var(--color-line)",
                    background: selected
                      ? "var(--color-primary-soft)"
                      : open
                        ? "var(--color-surface)"
                        : "var(--color-surface-2)",
                    color: selected ? "var(--color-primary-dark)" : open ? "var(--color-ink)" : "var(--color-ink-3)",
                  }}
                >
                  <span className={open ? "" : "line-through"}>{s.time}</span>
                  {!open && (
                    <span className="text-[10.5px] leading-[1.2] font-[var(--font-sans)] tracking-normal">
                      {s.state === "taken" ? "taken" : "too soon"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** "25 Sept · 10:00" for a chosen moment, in India time. */
export function slotLabel(at: string | null): string {
  if (!at) return "—";
  const d = new Date(at);
  const day = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
  return `${day} · ${time}`;
}

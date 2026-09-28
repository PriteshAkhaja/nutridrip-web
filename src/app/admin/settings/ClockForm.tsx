"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CLOCK_FORMATS, CLOCK_LABEL, clockOf, type ClockFormat } from "@/lib/time";

/** Times written both ways, so the choice is made from what people will read. */
const SAMPLES = ["09:30", "13:00", "17:45", "00:15"];

/**
 * The 12- or 24-hour clock, for every screen. Stored times do not change —
 * a session at 17:00 stays at 17:00 — only how it is written.
 */
export function ClockForm({ format }: { format: ClockFormat }) {
  const router = useRouter();
  const [choice, setChoice] = useState<ClockFormat>(format);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clockFormat: choice }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not save that");
      else {
        setSaved(true);
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="p-6">
      <h2 className="t-h3">Time format</h2>
      <p className="t-body text-[var(--color-ink-2)] mt-1 max-w-[62ch]">
        How times are written across the whole app — the site, the patient and nurse apps and every console — and in the
        time pickers.
      </p>

      <div
        role="radiogroup"
        aria-label="Time format"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 mt-5 max-w-[640px]"
      >
        {CLOCK_FORMATS.map((f) => {
          const on = choice === f;
          return (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setChoice(f);
                setSaved(false);
              }}
              className="text-left rounded-[var(--radius-md)] border px-4 py-3 cursor-pointer"
              style={{
                borderColor: on ? "var(--color-primary)" : "var(--color-line-2)",
                background: on ? "var(--color-primary-soft)" : "var(--color-surface)",
              }}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span
                  className="t-body font-semibold"
                  style={{ color: on ? "var(--color-primary-dark)" : "var(--color-ink)" }}
                >
                  {CLOCK_LABEL[f]}
                  {f === "12h" ? " (default)" : ""}
                </span>
                <span className="t-data text-[var(--color-ink-2)]">{clockOf("17:00", f)}</span>
              </span>
              <span className="t-small text-[var(--color-ink-3)] block mt-1">
                {SAMPLES.map((s) => clockOf(s, f)).join(" · ")}
              </span>
            </button>
          );
        })}
      </div>

      <p className="t-small text-[var(--color-ink-3)] mt-4 max-w-[62ch]" style={{ textWrap: "pretty" }}>
        Every time is India time (IST), whatever the server or a patient&apos;s phone is set to. Changing the format
        does not move any session, call or opening hour.
      </p>

      {error ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3 mt-5">
          <span className="t-body text-[var(--color-ink-2)]">{error}</span>
        </div>
      ) : null}

      <div className="flex items-center gap-4 mt-6">
        <Button size="md" loading={busy} disabled={choice === format} onClick={save}>
          Save
        </Button>
        {saved ? <span className="t-small text-[var(--color-safe-text)]">Saved</span> : null}
      </div>
    </Card>
  );
}

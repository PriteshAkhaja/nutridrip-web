"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { queuedPost } from "@/lib/offline/queue";
import type { StepView } from "./page";

const SUB_SCREEN: Record<string, { label: string; path: string }> = {
  vitals: { label: "Open vitals", path: "vitals" },
  consent: { label: "Capture consent", path: "consent" },
  kit: { label: "Check the kit", path: "kit" },
  observation: { label: "Open the infusion monitor", path: "monitor" },
};

/**
 * Steps are done in order. The current step is expanded and actionable;
 * completed steps collapse to a timestamped line; the rest stay dimmed, so the
 * nurse always has exactly one thing to do.
 */
export function Checklist({
  bookingId,
  steps,
  currentIndex,
  vitalsBlocked,
  clearance,
}: {
  bookingId: string;
  steps: StepView[];
  currentIndex: number;
  vitalsBlocked: boolean;
  /** Set when a physician has cleared out-of-range baseline vitals. */
  clearance: { at: string; note?: string } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const complete = async (key: string, label: string) => {
    setBusy(key);
    setError(null);
    // Offline is a normal condition, not an error — the step is kept on the
    // device and replayed, in order, when the connection returns.
    const result = await queuedPost(`/api/bookings/${bookingId}/checklist`, { key, done: true }, `Step: ${label}`);
    setBusy(null);
    if (result.queued) {
      setError("Offline — this step is queued and will sync when you reconnect.");
      return;
    }
    if (!result.json.success) setError(result.json.error ?? "That step did not save");
    else router.refresh();
  };

  if (currentIndex === -1) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-safe)] bg-[var(--color-safe-soft)] p-6 flex flex-col gap-3">
        <span className="t-h3">All 29 steps complete</span>
        <p className="t-body text-[var(--color-ink-2)]">
          The session report has been written with the vitals, doses, batch numbers and aftercare notes.
        </p>
        <Link href={`/nurse/session/${bookingId}/report`} className="no-underline hover:no-underline">
          <Button block>View the report</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-caution)] bg-[var(--color-caution-soft)] px-4 py-3 mb-2">
          <span className="t-body text-[var(--color-ink-2)]">{error}</span>
        </div>
      )}

      {steps.map((step, i) => {
        const done = Boolean(step.doneAt);
        const current = i === currentIndex;
        const sub = step.opens ? SUB_SCREEN[step.opens] : null;

        // Out-of-range vitals stop the infusion before it starts.
        const gated = current && vitalsBlocked && step.phase === "During infusion";

        return (
          <div
            key={step.key}
            className="rounded-[var(--radius-md)] flex gap-3 items-start"
            style={{
              border: current ? "1.5px solid var(--color-primary)" : "1px solid var(--color-line)",
              background: done ? "var(--color-paper)" : "var(--color-surface)",
              padding: current ? 18 : 14,
            }}
          >
            <span
              aria-hidden
              className="w-5 h-5 rounded-[6px] inline-flex items-center justify-center flex-none mt-[2px] text-[12px] font-semibold text-white"
              style={{
                background: done ? "var(--color-primary)" : "var(--color-surface)",
                border: done ? "none" : `1.5px solid ${current ? "var(--color-primary)" : "var(--color-line-2)"}`,
              }}
            >
              {done ? "✓" : ""}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <span
                  style={{
                    font: current
                      ? "600 18px/1.3 var(--font-display)"
                      : done
                        ? "500 14.5px/1.55 var(--font-sans)"
                        : "400 14.5px/1.55 var(--font-sans)",
                    color: current ? "var(--color-ink)" : done ? "var(--color-ink-2)" : "var(--color-ink-3)",
                    textDecoration: done ? "line-through" : "none",
                  }}
                >
                  {step.label}
                </span>
                {current && step.mandatory && (
                  <Pill tone="critical" className="flex-none">
                    Mandatory
                  </Pill>
                )}
              </div>

              {done && (
                <span className="t-data text-[13px] text-[var(--color-ink-3)] block mt-1">
                  {new Date(step.doneAt!).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  })}
                  {step.stamp ? ` · ${step.stamp}` : ""}
                </span>
              )}

              {current && (
                <>
                  {step.detail && <p className="t-body text-[var(--color-ink-2)] mt-2">{step.detail}</p>}

                  {gated && (
                    <div className="rounded-[var(--radius-sm)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-3 py-2 mt-3">
                      <span className="t-small text-[var(--color-ink-2)]">
                        A baseline reading is outside its reference range. The infusion cannot start until the
                        reviewing physician clears it — they have been notified, and this step unlocks the moment
                        they do.
                      </span>
                    </div>
                  )}

                  {!gated && clearance && step.phase === "During infusion" && (
                    <div className="rounded-[var(--radius-sm)] border border-[var(--color-safe)] bg-[var(--color-safe-soft)] px-3 py-2 mt-3">
                      <span className="t-small text-[var(--color-ink-2)]">
                        Physician cleared the baseline vitals at{" "}
                        <span className="t-data text-[13px]">
                          {new Date(clearance.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                        </span>
                        {clearance.note ? ` — ${clearance.note}` : "."}
                      </span>
                    </div>
                  )}

                  <div className="flex gap-2 mt-4 flex-wrap">
                    {sub && (
                      <Link
                        href={`/nurse/session/${bookingId}/${sub.path}`}
                        className="no-underline hover:no-underline"
                      >
                        <Button variant="secondary">{sub.label}</Button>
                      </Link>
                    )}
                    <Button
                      onClick={() => complete(step.key, step.label)}
                      loading={busy === step.key}
                      disabled={gated}
                      block={!sub}
                    >
                      Mark complete
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

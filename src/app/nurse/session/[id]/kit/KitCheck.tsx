"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { queuedPost } from "@/lib/offline/queue";

type Row = {
  key: string;
  name: string;
  detail: string;
  role: string;
  batchNo: string | null;
  expiry: string | null;
  storage: string | null;
  available: number;
};

const ROLE_TONE = {
  ACTIVE: "primary",
  FLUID: "info",
  PREMED: "caution",
  ADDITIVE: "neutral",
  KIT: "neutral",
} as const;

/**
 * Every item must be ticked individually before the checklist step will close.
 * A single "all checked" button would let a nurse confirm a seal they never
 * looked at, which is the failure this step exists to prevent.
 */
export function KitCheck({
  bookingId,
  rows,
  alreadyDone,
  infusionNotes,
}: {
  bookingId: string;
  rows: Row[];
  alreadyDone: boolean;
  infusionNotes?: string;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missing = rows.filter((r) => !r.batchNo || r.available <= 0);
  const allChecked = rows.length > 0 && rows.every((r) => checked.has(r.key));

  const toggle = (key: string) =>
    setChecked((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await queuedPost(
        `/api/bookings/${bookingId}/checklist`,
        { key: "ps-07", done: true },
        "Step: Inspect the sealed kit"
      );
      if (result.queued) {
        setError("Offline — this check is queued and will sync when you reconnect.");
      } else if (!result.json.success) {
        setError(result.json.error ?? "Could not record the check");
      } else {
        router.push(`/nurse/session/${bookingId}`);
      }
    } catch {
      setError("Could not record the check. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (alreadyDone) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-safe)] bg-[var(--color-safe-soft)] p-5 flex flex-col gap-3">
        <span className="t-body font-semibold">Kit already checked for this session</span>
        <p className="t-body text-[var(--color-ink-2)]">
          The seals were confirmed and the step is closed. Re-checking is fine, but it is already recorded.
        </p>
        <Button variant="secondary" block onClick={() => router.push(`/nurse/session/${bookingId}`)}>
          Back to checklist
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {missing.length > 0 && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3">
          <span className="t-body font-semibold">
            {missing.length} item{missing.length === 1 ? " has" : "s have"} no in-date stock
          </span>
          <p className="t-body text-[var(--color-ink-2)] mt-1">
            {missing.map((m) => m.name).join(", ")}. Do not improvise a substitute — call the pharmacy.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {rows.map((r) => {
          const on = checked.has(r.key);
          const short = !r.batchNo || r.available <= 0;
          return (
            <button
              key={r.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(r.key)}
              className="text-left rounded-[var(--radius-md)] border p-4 flex gap-3 items-start cursor-pointer transition-colors duration-150"
              style={{
                borderColor: short
                  ? "var(--color-critical)"
                  : on
                    ? "var(--color-primary)"
                    : "var(--color-line)",
                background: short
                  ? "var(--color-critical-soft)"
                  : on
                    ? "var(--color-primary-soft)"
                    : "var(--color-surface)",
              }}
            >
              <span
                aria-hidden
                className="w-5 h-5 rounded-[6px] inline-flex items-center justify-center flex-none mt-[2px] text-[12px] font-semibold text-white"
                style={{
                  background: on ? "var(--color-primary)" : "var(--color-surface)",
                  border: on ? "none" : "1.5px solid var(--color-line-2)",
                }}
              >
                {on ? "✓" : ""}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span className="t-body font-medium">{r.name}</span>
                  <span className="t-data text-[14.5px]">{r.detail}</span>
                </span>

                <span className="flex items-center gap-2 flex-wrap mt-2">
                  <Pill tone={ROLE_TONE[r.role as keyof typeof ROLE_TONE] ?? "neutral"}>{r.role}</Pill>
                  {r.batchNo ? (
                    <span className="t-data text-[13px] text-[var(--color-ink-2)]">
                      {r.batchNo} · expires {r.expiry}
                    </span>
                  ) : (
                    <span className="t-small text-[var(--color-critical-text)]">No in-date batch</span>
                  )}
                </span>

                {r.storage && (
                  <span className="t-small text-[var(--color-ink-3)] block mt-1">{r.storage}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {infusionNotes && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-primary-line)] bg-[var(--color-primary-soft)] px-4 py-3">
          <span className="t-micro text-[var(--color-primary-dark)] block mb-1">Before you start</span>
          <span className="t-body text-[var(--color-ink-2)]">{infusionNotes}</span>
        </div>
      )}

      {error && <span className="t-small text-[var(--color-caution-text)]">{error}</span>}

      <Button
        size="lg"
        block
        loading={busy}
        disabled={!allChecked || missing.length > 0}
        onClick={confirm}
      >
        {allChecked
          ? "All seals confirmed"
          : `${checked.size} of ${rows.length} checked`}
      </Button>

      <p className="t-small text-[var(--color-ink-3)] text-center">
        Tick each item as you physically inspect it. The step will not close until every one is ticked.
      </p>
    </div>
  );
}

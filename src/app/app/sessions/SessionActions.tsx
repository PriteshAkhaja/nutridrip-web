"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea, Select } from "@/components/ui/Field";
import { SLOTS, slotDate, LATE_CHANGE_HOURS, LATE_CANCEL_FEE_INR } from "@/lib/clinical/slots";

const REASONS = [
  "Something came up",
  "I am unwell",
  "The time no longer works",
  "I want a different drip",
  "I would rather not say",
];

/**
 * The window and the fee are the server's rules, imported rather than restated
 * so this dialog cannot quietly disagree with what the API will actually do.
 */

const hoursUntil = (iso: string) => (new Date(iso).getTime() - Date.now()) / 3_600_000;

export function CancelSession({
  bookingId,
  bookingNo,
  scheduledAt,
}: {
  bookingId: string;
  bookingNo: string;
  scheduledAt: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hoursOut = hoursUntil(scheduledAt);
  // Matches the server: a slot already past is the deepest part of the window.
  const late = hoursOut < LATE_CHANGE_HOURS;

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not cancel that session");
      else {
        setOpen(false);
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. The session is still booked.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Cancel this session
      </Button>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-4 flex flex-col gap-3 mt-3">
      <span className="t-body font-semibold">Cancel {bookingNo}?</span>

      <div
        className="rounded-[var(--radius-sm)] px-3 py-2"
        style={{
          background: late ? "var(--color-caution-soft)" : "var(--color-safe-soft)",
          border: `1px solid ${late ? "var(--color-caution)" : "var(--color-safe)"}`,
        }}
      >
        <span className="t-body text-[var(--color-ink-2)]">
          {late ? (
            <>
              Your slot is in under {LATE_CHANGE_HOURS} hours, so a{" "}
              <span className="t-data text-[14.5px]">₹{LATE_CANCEL_FEE_INR}</span> fee applies — the nurse is already dispatched
              with your batch drawn.
            </>
          ) : (
            "No fee. Your slot is far enough out that nothing has been drawn for it yet."
          )}
        </span>
      </div>

      <Select label="Why" value={reason} onChange={(e) => setReason(e.target.value)}>
        {REASONS.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </Select>

      {error && <span className="t-small text-[var(--color-critical-text)]">{error}</span>}

      <div className="flex gap-2">
        <Button variant="secondary" block onClick={() => setOpen(false)}>
          Keep it
        </Button>
        <Button variant="danger" block loading={busy} onClick={cancel}>
          Cancel the session
        </Button>
      </div>
    </div>
  );
}

/** Rating is asked for once, after the session, and never nagged. */
export function RateSession({
  bookingId,
  existing,
}: {
  bookingId: string;
  existing: { rating: number; comment?: string } | null;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(Boolean(existing));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating, comment: comment || undefined }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not save that");
      else {
        setSent(true);
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. Nothing was sent.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--color-safe)] bg-[var(--color-safe-soft)] px-4 py-3">
        <span className="t-body font-semibold">
          You rated this {rating}/5
        </span>
        <p className="t-body text-[var(--color-ink-2)] mt-1">
          {rating <= 2
            ? "Your physician has been told, and someone will follow up."
            : "Thank you — your nurse sees this on their record."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 flex flex-col gap-4">
      <div>
        <span className="t-micro block mb-1">How was it?</span>
        <span className="t-small text-[var(--color-ink-2)]">
          A rating of two or less goes straight to the physician who approved your protocol.
        </span>
      </div>

      <div className="flex gap-2" role="group" aria-label="Rating out of five">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = rating >= n;
          return (
            <button
              key={n}
              type="button"
              aria-label={`${n} out of 5`}
              aria-pressed={rating === n}
              onClick={() => setRating(n)}
              className="flex-1 min-h-[52px] rounded-[var(--radius-sm)] border cursor-pointer t-data text-[16px]"
              style={{
                borderColor: on ? "var(--color-primary)" : "var(--color-line-2)",
                background: on ? "var(--color-primary-soft)" : "var(--color-surface)",
                color: on ? "var(--color-primary-dark)" : "var(--color-ink-2)",
                fontWeight: on ? 600 : 400,
              }}
            >
              {n}
            </button>
          );
        })}
      </div>

      {rating > 0 && (
        <Textarea
          label="Anything to add"
          hint="optional"
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={rating <= 2 ? "What went wrong?" : "What went well?"}
        />
      )}

      {error && <span className="t-small text-[var(--color-critical-text)]">{error}</span>}

      <Button block loading={busy} disabled={rating === 0} onClick={submit}>
        Send
      </Button>
    </div>
  );
}

/**
 * Moving a session. Outside the four-hour window it is free; inside it the
 * server refuses and points at cancellation, because the nurse is already on
 * the way with the batch drawn.
 */
export function RescheduleSession({
  bookingId,
  bookingNo,
  scheduledAt,
  releasedDays,
}: {
  bookingId: string;
  bookingNo: string;
  scheduledAt: string;
  /** Decided on the server, so the list cannot differ after hydration. */
  releasedDays: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const days = releasedDays.map((iso) => new Date(iso));
  const [day, setDay] = useState(days[0]);
  const [slot, setSlot] = useState(SLOTS[1]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hoursOut = hoursUntil(scheduledAt);
  const locked = hoursOut > 0 && hoursOut < LATE_CHANGE_HOURS;

  const move = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/reschedule`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scheduledAt: slotDate(day, slot).toISOString() }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not move that session");
      else {
        setOpen(false);
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. The session is unchanged.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)} disabled={locked} title={locked ? `Inside the ${LATE_CHANGE_HOURS}-hour window` : undefined}>
        Move it
      </Button>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-4 flex flex-col gap-4 mt-3">
      <span className="t-body font-semibold">Move {bookingNo}</span>

      <div>
        <span className="t-micro block mb-2">Which day</span>
        <div className="grid grid-cols-5 gap-2">
          {days.map((d) => {
            const selected = d.getTime() === day.getTime();
            return (
              <button
                key={d.toISOString()}
                type="button"
                aria-pressed={selected}
                onClick={() => setDay(d)}
                className="py-2 rounded-[var(--radius-sm)] border flex flex-col items-center gap-[2px] cursor-pointer min-h-[56px]"
                style={{
                  borderColor: selected ? "var(--color-primary)" : "var(--color-line)",
                  background: selected ? "var(--color-primary-soft)" : "var(--color-surface)",
                }}
              >
                <span className="t-micro" style={{ color: selected ? "var(--color-primary-dark)" : "var(--color-ink-3)" }}>
                  {d.toLocaleDateString("en-IN", { weekday: "short" })}
                </span>
                <span className="t-data text-[16px]" style={{ color: selected ? "var(--color-primary-dark)" : "var(--color-ink)" }}>
                  {d.getDate()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className="t-micro block mb-2">What time</span>
        <div className="grid grid-cols-3 gap-2">
          {SLOTS.map((s) => {
            const selected = s === slot;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={selected}
                onClick={() => setSlot(s)}
                className="min-h-[40px] rounded-[var(--radius-sm)] border cursor-pointer t-data text-[13px]"
                style={{
                  borderColor: selected ? "var(--color-primary)" : "var(--color-line)",
                  background: selected ? "var(--color-primary-soft)" : "var(--color-surface)",
                  color: selected ? "var(--color-primary-dark)" : "var(--color-ink)",
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {error && <span className="t-small text-[var(--color-critical-text)]">{error}</span>}

      <div className="flex gap-2">
        <Button variant="secondary" block onClick={() => setOpen(false)}>
          Keep it
        </Button>
        <Button block loading={busy} onClick={move}>
          Move the session
        </Button>
      </div>
    </div>
  );
}

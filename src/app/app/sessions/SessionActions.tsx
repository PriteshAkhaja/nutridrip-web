"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea, Select } from "@/components/ui/Field";
import { SlotPicker } from "@/components/ui/SlotPicker";
import { inr, lateFee, type LatePolicy } from "@/lib/billing/late-policy";
import type { FeedbackView } from "@/lib/clinical/feedback";

const REASONS = [
  "Something came up",
  "I am unwell",
  "The time no longer works",
  "I want a different drip",
  "I would rather not say",
];

/**
 * The window and the fees are the Billing settings, handed down by the page --
 * the same values the server charges from -- so a dialog cannot quietly
 * disagree with what the API will actually do.
 */

const hoursUntil = (iso: string) => (new Date(iso).getTime() - Date.now()) / 3_600_000;

export function CancelSession({
  bookingId,
  bookingNo,
  scheduledAt,
  policy,
}: {
  bookingId: string;
  bookingNo: string;
  scheduledAt: string;
  policy: LatePolicy;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Matches the server: a slot already past is the deepest part of the window.
  const fee = lateFee(policy, hoursUntil(scheduledAt), "late_cancel");
  const late = fee > 0;

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
              Your slot is in under {policy.windowHours} hours, so a{" "}
              <span className="t-data text-[14.5px]">{inr(fee)}</span> fee applies — the nurse is already dispatched
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

/**
 * Feedback after a finished session, in two parts: the nurse who looked after
 * the patient, and the session itself. Asked for once, and never nagged.
 *
 * A rating of two or less on either goes to the physician as well; the nurse
 * hears their own rating whatever it is.
 */
export function RateSession({
  bookingId,
  nurseName,
  existing,
  onDone,
  bare = false,
  refresh = true,
}: {
  bookingId: string;
  /** Null when no nurse ran the session: then only the session is rated. */
  nurseName: string | null;
  existing: FeedbackView | null;
  /** Without its own card: for a place that already frames it (the Home card). */
  bare?: boolean;
  /** Reload the page's data once sent. Home keeps its thank-you on screen instead. */
  refresh?: boolean;
  /** Called once it is sent (the Home card uses it to say thank you and step aside). */
  onDone?: () => void;
}) {
  const router = useRouter();
  const [nurseRating, setNurseRating] = useState(existing?.nurse?.rating ?? 0);
  const [nurseComment, setNurseComment] = useState(existing?.nurse?.comment ?? "");
  const [sessionRating, setSessionRating] = useState(existing?.session?.rating ?? 0);
  const [sessionComment, setSessionComment] = useState(existing?.session?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(Boolean(existing));
  const first = nurseName?.split(" ")[0] ?? null;

  const ready = sessionRating > 0 && (!nurseName || nurseRating > 0);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(nurseName ? { nurseRating, nurseComment: nurseComment || undefined } : {}),
          sessionRating,
          sessionComment: sessionComment || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not save that");
      else {
        setSent(true);
        onDone?.();
        if (refresh) router.refresh();
      }
    } catch {
      setError("Could not reach the server. Nothing was sent.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    const low = (nurseName && nurseRating > 0 && nurseRating <= 2) || (sessionRating > 0 && sessionRating <= 2);
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--color-safe)] bg-[var(--color-safe-soft)] px-4 py-3">
        <span className="t-body font-semibold">
          {nurseName && nurseRating > 0
            ? `You rated ${first} ${nurseRating}/5 and the session ${sessionRating}/5`
            : `You rated this session ${sessionRating}/5`}
        </span>
        <p className="t-body text-[var(--color-ink-2)] mt-1">
          {low
            ? "Your physician has been told, and someone will follow up."
            : nurseName
              ? `Thank you — ${first} sees your rating on their record.`
              : "Thank you."}
        </p>
      </div>
    );
  }

  return (
    <div
      className={
        bare
          ? "flex flex-col gap-5"
          : "rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 flex flex-col gap-5"
      }
    >
      {nurseName && (
        <RatingPart
          title={`Your nurse, ${nurseName}`}
          question={`How was ${first}'s care?`}
          value={nurseRating}
          onValue={setNurseRating}
          comment={nurseComment}
          onComment={setNurseComment}
          placeholder={nurseRating <= 2 ? "What went wrong?" : `What did ${first} do well?`}
        />
      )}

      <RatingPart
        title="Your session"
        question="How do you feel after your drip?"
        value={sessionRating}
        onValue={setSessionRating}
        comment={sessionComment}
        onComment={setSessionComment}
        placeholder={sessionRating <= 2 ? "What went wrong?" : "Anything you noticed afterwards"}
      />

      <span className="t-small text-[var(--color-ink-2)]">
        A rating of two or less goes straight to the physician who approved your protocol.
      </span>

      {error && <span className="t-small text-[var(--color-critical-text)]">{error}</span>}

      <Button block loading={busy} disabled={!ready} onClick={submit}>
        Send
      </Button>
    </div>
  );
}

/** One half of the feedback: a question, five buttons, and a note once rated. */
function RatingPart({
  title,
  question,
  value,
  onValue,
  comment,
  onComment,
  placeholder,
}: {
  title: string;
  question: string;
  value: number;
  onValue: (n: number) => void;
  comment: string;
  onComment: (s: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <span className="t-micro block mb-1">{title}</span>
        <span className="t-body">{question}</span>
      </div>

      <div className="flex gap-2" role="group" aria-label={`${question} Rating out of five`}>
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value >= n;
          return (
            <button
              key={n}
              type="button"
              aria-label={`${n} out of 5`}
              aria-pressed={value === n}
              onClick={() => onValue(n)}
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

      {value > 0 && (
        <Textarea
          label="Anything to add"
          hint="optional"
          rows={2}
          value={comment}
          onChange={(e) => onComment(e.target.value)}
          placeholder={placeholder}
        />
      )}
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
  policy,
}: {
  bookingId: string;
  bookingNo: string;
  scheduledAt: string;
  policy: LatePolicy;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  /** The new time, from the slot picker: only times a nurse can come. */
  const [slotAt, setSlotAt] = useState<string | null>(null);
  const [slotReload, setSlotReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inside the late window it can still be moved -- for the fee, said up front
  // and agreed to on the button. The server says so too, with the amount, if
  // the window was crossed while this was open.
  const [serverFee, setServerFee] = useState<number | null>(null);
  const fee = serverFee ?? lateFee(policy, hoursUntil(scheduledAt), "late_reschedule");

  const move = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/reschedule`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scheduledAt: slotAt, ...(fee > 0 ? { acceptFee: true } : {}) }),
      });
      const json = await res.json();
      if (!json.success) {
        if (typeof json.fee === "number" && json.fee > 0 && fee === 0) setServerFee(json.fee);
        setError(json.error ?? "Could not move that session");
        if (res.status === 409 || res.status === 422) setSlotReload((n) => n + 1);
      } else {
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
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Move it
      </Button>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-4 flex flex-col gap-4 mt-3">
      <span className="t-body font-semibold">Move {bookingNo}</span>

      {fee > 0 && (
        <div className="rounded-[var(--radius-sm)] px-3 py-2 border border-[var(--color-caution)] bg-[var(--color-caution-soft)]">
          <span className="t-body text-[var(--color-ink-2)]">
            Your slot is less than {policy.windowHours} hours away, so moving it now costs{" "}
            <span className="t-data text-[14.5px]">{inr(fee)}</span>, added to this session. The nurse is already on
            their way with your batch drawn.
          </span>
        </div>
      )}

      <SlotPicker query={`booking=${bookingId}`} value={slotAt} onChange={setSlotAt} reloadKey={slotReload} compact />

      {error && <span className="t-small text-[var(--color-critical-text)]">{error}</span>}

      <div className="flex gap-2">
        <Button variant="secondary" block onClick={() => setOpen(false)}>
          Keep it
        </Button>
        <Button block loading={busy} disabled={!slotAt} onClick={move}>
          {fee > 0 ? `Move for ${inr(fee)}` : "Move the session"}
        </Button>
      </div>
    </div>
  );
}

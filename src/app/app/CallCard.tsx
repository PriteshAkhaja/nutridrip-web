"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { SlotPicker, slotLabel } from "@/components/ui/SlotPicker";
import { useClockFormat } from "@/components/ClockProvider";

export type HomeCall = {
  id: string;
  callNo: string;
  doctorName: string;
  startAt: string;
  minutes: number;
  phone: string;
  overdue: boolean;
};

/**
 * The patient's call with a physician on Home: who, when, on which number,
 * and Move / Cancel. With no call booked while one is needed, it says so and
 * links to booking — with why, when the last one was missed or cancelled.
 */
export function CallCard({
  call,
  needed,
  lastNote,
  heldDrip,
}: {
  call: HomeCall | null;
  /** No call booked, and the patient's answers still need one. */
  needed: boolean;
  /** Why the last call did not happen, if it did not. */
  lastNote: string | null;
  /** The drip held for the physician, so a later call can take it along. */
  heldDrip: { id: string; bookingNo: string; scheduledAt: string } | null;
}) {
  const clockFmt = useClockFormat();
  if (!call) {
    if (!needed) return null;
    return (
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-primary)] bg-[var(--color-primary-soft)] p-5 mb-4">
        <span className="t-micro block">Next step</span>
        <h2 className="t-h3 mt-1">Book your call with a physician</h2>
        <p className="t-body text-[var(--color-ink-2)] mt-1">
          {lastNote ?? "Choose a physician and a time. They read your answers, then phone you for a few minutes."}
          {heldDrip ? ` Your held drip ${heldDrip.bookingNo} waits for it.` : ""}
        </p>
        <div className="mt-4">
          <ButtonLink href="/app/book">Choose a time</ButtonLink>
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-5 mb-4"
      style={{ borderColor: call.overdue ? "var(--color-caution)" : "var(--color-line)" }}
      aria-label="Your call with a physician"
    >
      <span className="t-micro block">Your call with a physician</span>
      <h2 className="t-h3 mt-1">{call.doctorName}</h2>
      <span className="t-data text-[13px] text-[var(--color-ink-2)] block mt-1">
        {slotLabel(call.startAt, clockFmt)} · {call.minutes} min · {call.callNo}
      </span>
      <p className="t-body text-[var(--color-ink-2)] mt-2">
        They will call you on <span className="t-data text-[14px]">{call.phone}</span>. Keep your phone nearby.
      </p>
      {call.overdue && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-caution)] bg-[var(--color-caution-soft)] px-4 py-3 mt-3">
          <span className="t-body text-[var(--color-ink-2)]">
            Running late. Your physician will call shortly — if nobody has called within the hour, pick a new time.
          </span>
        </div>
      )}
      <CallActions call={call} heldDrip={heldDrip} />
    </section>
  );
}

function CallActions({
  call,
  heldDrip,
}: {
  call: HomeCall;
  heldDrip: { id: string; bookingNo: string; scheduledAt: string } | null;
}) {
  const clockFmt = useClockFormat();
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "move" | "cancel">("none");
  const [at, setAt] = useState<string | null>(null);
  /** Set when the new call would come too close to the held drip. */
  const [dripFrom, setDripFrom] = useState<string | null>(null);
  const [dripAt, setDripAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const send = async (body: object) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/calls/${call.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        setMode("none");
        router.refresh();
        return;
      }
      // The held drip has to move too: show its times, from 2 hours after the new call.
      if (json.needsDripMove && json.earliestDrip) {
        setDripFrom(json.earliestDrip);
        setDripAt(null);
      } else if (res.status === 409 || res.status === 422) {
        setReload((n) => n + 1);
      }
      setError(json.error ?? "That did not work");
    } catch {
      setError("Could not reach the server. Nothing changed.");
    } finally {
      setBusy(false);
    }
  };

  if (mode === "none") {
    return (
      <div className="mt-4 pt-3 border-t border-[var(--color-line)] flex justify-end gap-2 flex-wrap">
        <Button variant="ghost" onClick={() => setMode("move")}>
          Move it
        </Button>
        <Button variant="ghost" onClick={() => setMode("cancel")}>
          Cancel
        </Button>
      </div>
    );
  }

  if (mode === "cancel") {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-4 flex flex-col gap-3 mt-4">
        <span className="t-body">
          Cancel your call on {slotLabel(call.startAt, clockFmt)}?
          {heldDrip
            ? ` Your held drip ${heldDrip.bookingNo} stays, and is confirmed once you book a new call and the physician approves.`
            : ""}
        </span>
        {error && <span className="t-small text-[var(--color-critical-text)]">{error}</span>}
        <div className="flex gap-2">
          <Button variant="secondary" block onClick={() => setMode("none")}>
            Keep it
          </Button>
          <Button variant="danger" block loading={busy} onClick={() => send({ action: "cancel" })}>
            Cancel the call
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-[var(--color-line)] pt-4 sm:rounded-[var(--radius-md)] sm:border sm:bg-[var(--color-surface-2)] sm:p-4 flex flex-col gap-4 mt-4">
      {/* A section under a rule on a phone (a box inside the card cost the
          week of days ~34px); a box of its own from 640px. */}
      <span className="t-body font-semibold">Move {call.callNo}</span>
      <SlotPicker
        endpoint="/api/calls/slots"
        who="physician"
        query={`call=${call.id}`}
        value={at}
        onChange={(v) => {
          setAt(v);
          setDripFrom(null);
          setError(null);
        }}
        reloadKey={reload}
        compact
      />

      {dripFrom && heldDrip && (
        <div className="flex flex-col gap-3 pt-3 border-t border-[var(--color-line)]">
          <span className="t-body">
            Your held drip {heldDrip.bookingNo} ({slotLabel(heldDrip.scheduledAt, clockFmt)}) must be at least 2 hours
            after the call. Pick a new time for it:
          </span>
          <SlotPicker
            query={`booking=${heldDrip.id}&after=${encodeURIComponent(dripFrom)}`}
            value={dripAt}
            onChange={setDripAt}
            compact
          />
        </div>
      )}

      {error && !dripFrom && <span className="t-small text-[var(--color-critical-text)]">{error}</span>}

      <div className="flex gap-2">
        <Button variant="secondary" block onClick={() => setMode("none")}>
          Keep it
        </Button>
        <Button
          block
          loading={busy}
          disabled={!at || Boolean(dripFrom && !dripAt)}
          onClick={() => send({ action: "move", startAt: at, ...(dripFrom && dripAt ? { dripAt } : {}) })}
        >
          {dripFrom ? "Move the call and the drip" : "Move the call"}
        </Button>
      </div>
    </div>
  );
}

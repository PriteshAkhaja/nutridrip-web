"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { SlotPicker, slotLabel } from "@/components/ui/SlotPicker";
import type { BookableDoctor } from "@/lib/data/calls";
import { useClockFormat } from "@/components/ClockProvider";

type Booked = { callNo: string; doctorName: string; startAt: string; minutes: number; phone: string };

/**
 * Step 1 for a patient waiting for an approval: choose a physician and a time
 * for a short phone call. The physician reads the answers first, then calls.
 * The drip below is held from two hours after the call.
 */
export function CallStep({
  doctors,
  booked,
  spoken,
  hasPhone,
}: {
  doctors: BookableDoctor[];
  /** The call already booked, if there is one. */
  booked: Booked | null;
  /** The call already happened for these answers (the physician then asked a question). */
  spoken: boolean;
  /** Whether the account has a number on it; if not, one is asked for. */
  hasPhone: boolean;
}) {
  const clockFmt = useClockFormat();
  const router = useRouter();
  const [doctorId, setDoctorId] = useState<string | null>(doctors.find((d) => d.nextFree)?.id ?? null);
  const [at, setAt] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  if (booked) {
    return (
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-safe)] bg-[var(--color-safe-soft)] p-5 mb-6">
        <span className="t-micro block">Step 1 · Your call with a physician ✓</span>
        <p className="t-body mt-2">
          <span className="font-semibold">{booked.doctorName}</span> will call you on{" "}
          <span className="t-data text-[14px]">{booked.phone}</span> at{" "}
          <span className="t-data text-[14px]">{slotLabel(booked.startAt, clockFmt)}</span> ({booked.minutes}
          {"\u00a0"}min).
        </p>
        <p className="t-small text-[var(--color-ink-2)] mt-2">
          {booked.callNo} · To change it, use Move or Cancel on Home. Your drip below starts at least 2 hours after the
          call.
        </p>
      </section>
    );
  }

  if (spoken) {
    return (
      <section className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-3 mb-6">
        <span className="t-body text-[var(--color-ink-2)]">
          You have spoken with your physician. Hold a drip below; it is confirmed when they approve.
        </span>
      </section>
    );
  }

  const book = async () => {
    if (!doctorId || !at) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/calls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ doctorId, startAt: at, ...(hasPhone ? {} : { phone }) }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Could not book that call");
        if (res.status === 409) setReload((n) => n + 1);
      } else {
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. Nothing was booked.");
    } finally {
      setBusy(false);
    }
  };

  const doctor = doctors.find((d) => d.id === doctorId);

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-6 flex flex-col gap-5">
      <div>
        <span className="t-micro block">Step 1 · A call with a physician</span>
        <h2 className="t-h3 mt-1">Choose who calls you</h2>
        <p className="t-body text-[var(--color-ink-2)] mt-1">
          They read your answers first, then phone you for a few minutes. Your drip is held from two hours after the
          call and confirmed when they approve.
        </p>
      </div>

      {doctors.length === 0 ? (
        <p className="t-body text-[var(--color-ink-2)]">
          No physician is taking calls this week. Contact us from the Contact page and we will arrange one.
        </p>
      ) : (
        <div role="radiogroup" aria-label="Physician" className="flex flex-col gap-2">
          {doctors.map((d) => {
            const on = d.id === doctorId;
            return (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setDoctorId(d.id);
                  setAt(null);
                }}
                className="text-left p-4 rounded-[var(--radius-md)] border flex items-start justify-between gap-3 cursor-pointer"
                style={{
                  borderColor: on ? "var(--color-primary)" : "var(--color-line)",
                  background: on ? "var(--color-primary-soft)" : "var(--color-surface)",
                }}
              >
                <span className="min-w-0 flex flex-col gap-[3px]">
                  <span style={{ font: `${on ? 600 : 500} 16px/1.4 var(--font-sans)` }}>{d.name}</span>
                  {d.specialization && <span className="t-small text-[var(--color-ink-2)]">{d.specialization}</span>}
                  <span className="t-small text-[var(--color-ink-3)]">{d.callMinutes}-min phone call</span>
                </span>
                <span
                  className="t-small text-right flex-none"
                  style={{ color: d.nextFree ? "var(--color-safe-text)" : "var(--color-ink-3)" }}
                >
                  {d.nextFree ? (
                    <>
                      Next free
                      <br />
                      <span className="t-data text-[13px]">{slotLabel(d.nextFree, clockFmt)}</span>
                    </>
                  ) : (
                    "Full this week"
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {doctor && (
        <SlotPicker
          endpoint="/api/calls/slots"
          who="physician"
          query={new URLSearchParams({ doctorId: doctor.id }).toString()}
          value={at}
          onChange={setAt}
          reloadKey={reload}
        />
      )}

      {!hasPhone && doctor && (
        <Input
          label="Your phone number"
          hint="the physician calls this"
          inputMode="tel"
          placeholder="98450 00000"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      )}

      {error && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3">
          <span className="t-body text-[var(--color-ink-2)]">{error}</span>
        </div>
      )}

      {doctor && (
        <Button
          size="lg"
          block
          loading={busy}
          disabled={!at || (!hasPhone && phone.replace(/\D/g, "").length < 10)}
          onClick={book}
        >
          {at ? `Book the call · ${slotLabel(at, clockFmt)}` : "Pick a time for the call"}
        </Button>
      )}
    </section>
  );
}

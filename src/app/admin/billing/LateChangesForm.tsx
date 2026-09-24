"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import { latePolicySentence, tidyPolicy, type LatePolicy } from "@/lib/billing/late-policy";

/**
 * The late window and the fees for moving or cancelling inside it.
 *
 * What patients read on the site and in the app is the sentence shown here,
 * built from these numbers -- so it is previewed before saving rather than
 * discovered afterwards on the FAQ page.
 */
export function LateChangesForm({ policy }: { policy: LatePolicy }) {
  const router = useRouter();
  const [windowHours, setWindowHours] = useState(String(policy.windowHours));
  const [rescheduleFee, setRescheduleFee] = useState(String(policy.rescheduleFee));
  const [cancelFee, setCancelFee] = useState(String(policy.cancelFee));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const n = (s: string) => (s.trim() === "" ? NaN : Number(s));
  const bad = {
    windowHours:
      !Number.isInteger(n(windowHours)) || n(windowHours) < 1 || n(windowHours) > 72 ? "Whole hours, 1 to 72" : undefined,
    rescheduleFee: !Number.isInteger(n(rescheduleFee)) || n(rescheduleFee) < 0 ? "Whole rupees, 0 or more" : undefined,
    cancelFee: !Number.isInteger(n(cancelFee)) || n(cancelFee) < 0 ? "Whole rupees, 0 or more" : undefined,
  };
  const valid = !bad.windowHours && !bad.rescheduleFee && !bad.cancelFee;
  const preview = latePolicySentence(
    tidyPolicy(valid ? { windowHours: n(windowHours), rescheduleFee: n(rescheduleFee), cancelFee: n(cancelFee) } : policy)
  );
  const changed =
    n(windowHours) !== policy.windowHours || n(rescheduleFee) !== policy.rescheduleFee || n(cancelFee) !== policy.cancelFee;

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/billing/late-changes", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ windowHours: n(windowHours), rescheduleFee: n(rescheduleFee), cancelFee: n(cancelFee) }),
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
      <h2 className="t-h3">Late changes by patients</h2>
      <p className="t-body text-[var(--color-ink-2)] mt-1 max-w-[62ch]">
        Moving or cancelling a session is free until the window below. Inside it the nurse is already dispatched with
        the batch drawn, so a fee is added to the session.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mt-5">
        <Input
          label="Late window"
          hint="hours before the slot"
          type="number"
          inputMode="numeric"
          mono
          value={windowHours}
          error={bad.windowHours}
          onChange={(e) => setWindowHours(e.target.value)}
        />
        <Input
          label="Fee to move"
          hint="₹, inside the window"
          type="number"
          inputMode="numeric"
          mono
          value={rescheduleFee}
          error={bad.rescheduleFee}
          onChange={(e) => setRescheduleFee(e.target.value)}
        />
        <Input
          label="Fee to cancel"
          hint="₹, inside the window"
          type="number"
          inputMode="numeric"
          mono
          value={cancelFee}
          error={bad.cancelFee}
          onChange={(e) => setCancelFee(e.target.value)}
        />
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-3 mt-5">
        <span className="t-micro block mb-1">What patients are told</span>
        <span className="t-body">{preview}</span>
      </div>

      <p className="t-small text-[var(--color-ink-3)] mt-4" style={{ textWrap: "pretty" }}>
        Shown on the FAQs, pricing, how it works, the terms and the booking screen, and charged from the moment you
        save. A fee already charged keeps the amount it was charged at.
      </p>

      {error ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3 mt-5">
          <span className="t-body text-[var(--color-ink-2)]">{error}</span>
        </div>
      ) : null}

      <div className="flex items-center gap-4 mt-6">
        <Button size="md" loading={busy} disabled={!valid || !changed} onClick={save}>
          Save
        </Button>
        {saved ? <span className="t-small text-[var(--color-safe-text)]">Saved</span> : null}
      </div>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { DEFAULT_NURSE_DAY_LIMIT, NURSE_DAY_LIMIT_MAX, NURSE_DAY_LIMIT_MIN } from "@/lib/clinical/nurse-options";

const CHOICES = Array.from(
  { length: NURSE_DAY_LIMIT_MAX - NURSE_DAY_LIMIT_MIN + 1 },
  (_, i) => NURSE_DAY_LIMIT_MIN + i
);

/**
 * The most sessions one nurse takes in a day. The booking screen and dispatch
 * both apply it, so a time is never offered -- or paid for -- that no nurse
 * can take.
 */
export function NurseDayForm({ limit }: { limit: number }) {
  const router = useRouter();
  const [choice, setChoice] = useState(limit);
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
        body: JSON.stringify({ nurseDayLimit: choice }),
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
      <h2 className="t-h3">Nurse workload</h2>
      <p className="t-body text-[var(--color-ink-2)] mt-1 max-w-[62ch]">
        The most sessions one nurse takes in a day. Once every nurse who could go has this many, the booking screen
        shows that day&apos;s times as taken, so no patient pays for a time nobody can attend.
      </p>

      <div className="mt-5 max-w-[320px]">
        <SelectMenu
          label="Sessions per nurse per day"
          hint={`${NURSE_DAY_LIMIT_MIN} to ${NURSE_DAY_LIMIT_MAX}`}
          value={String(choice)}
          onChange={(v) => {
            setChoice(Number(v));
            setSaved(false);
          }}
          options={CHOICES.map((n) => ({
            value: String(n),
            label: `${n} session${n === 1 ? "" : "s"} a day`,
            ...(n === DEFAULT_NURSE_DAY_LIMIT ? { detail: ["the default"] } : {}),
          }))}
        />
      </div>

      <p className="t-small text-[var(--color-ink-3)] mt-4 max-w-[62ch]" style={{ textWrap: "pretty" }}>
        Every session on the nurse that day counts, finished ones too. A change applies to what is booked next: sessions
        already booked are never moved or called off by it. An admin can still assign a nurse by hand.
      </p>

      {error ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3 mt-5">
          <span className="t-body text-[var(--color-ink-2)]">{error}</span>
        </div>
      ) : null}

      <div className="flex items-center gap-4 mt-6">
        <Button size="md" loading={busy} disabled={choice === limit} onClick={save}>
          Save
        </Button>
        {saved ? <span className="t-small text-[var(--color-safe-text)]">Saved</span> : null}
      </div>
    </Card>
  );
}

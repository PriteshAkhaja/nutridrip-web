"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { etaLabel } from "@/lib/clinical/nurse-options";

/**
 * "On my way" — the missing half of `en_route`.
 *
 * It is the only thing on this screen the patient sees the result of, which is
 * why it sits above the checklist rather than inside it: it is not a clinical
 * step, it is a courtesy, and it happens before any of them.
 *
 * Once pressed it does not become a second button. Setting off is not
 * something you undo — if the nurse turns back, the session is rescheduled or
 * cancelled, and both of those already exist.
 */
export function EnRouteButton({
  bookingId,
  enRouteAt,
  etaMinutes,
}: {
  bookingId: string;
  enRouteAt: string | null;
  etaMinutes: number | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (enRouteAt) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-safe)] bg-[var(--color-safe-soft)] p-4 mb-5">
        <span className="t-micro block">On the way</span>
        <span className="t-body block mt-[2px]">
          The patient has been told you are {etaLabel(etaMinutes)}.
        </span>
      </div>
    );
  }

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/en-route`, { method: "POST" });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not send that");
      else router.refresh();
    } catch {
      setError("Could not reach the server. The patient has not been told.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-5">
      <Button block loading={busy} onClick={go}>
        On my way
      </Button>
      <p className="t-small text-[var(--color-ink-3)] mt-2">
        Tells the patient you have set off, with roughly how long you will be.
      </p>
      {error ? (
        <p className="t-small text-[var(--color-critical-text)] mt-2">{error}</p>
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";

/**
 * The physician's determination on a filed event. Filing is the nurse's job;
 * deciding what it was, and that it is finished, is not — so this is the only
 * place an event can be closed.
 */
export function AdverseDecision({
  bookingId,
  eventId,
  bookingNo,
}: {
  bookingId: string;
  eventId: string;
  bookingNo: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [determination, setDetermination] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/adverse`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId, determination }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "That did not go through");
      else router.refresh();
    } catch {
      setError("Could not reach the server. Nothing was recorded.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Record your determination
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 mt-2">
      <Textarea
        label={`Your determination on ${bookingNo}`}
        hint="the nurse who filed it sees this"
        rows={3}
        value={determination}
        onChange={(e) => setDetermination(e.target.value)}
        placeholder="Expected magnesium flush, settled without intervention. No change to the protocol."
      />
      {error && <span className="t-small text-[var(--color-critical-text)]">{error}</span>}
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
          Not yet
        </Button>
        <Button size="sm" loading={busy} disabled={!determination.trim()} onClick={close}>
          Close this report
        </Button>
      </div>
    </div>
  );
}

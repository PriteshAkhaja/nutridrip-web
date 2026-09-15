"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select, Input } from "@/components/ui/Field";

/**
 * The override for the automatic choice. Leaving the nurse blank asks the
 * engine to pick again, excluding whoever holds it now — which is what you
 * want when the assigned nurse has simply fallen ill.
 */
export function Reassign({
  bookingId,
  bookingNo,
  currentNurseId,
  nurses,
}: {
  bookingId: string;
  bookingNo: string;
  currentNurseId: string | null;
  nurses: Array<{ id: string; name: string; zones: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nurseId, setNurseId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/assign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nurseId: nurseId || undefined, reason: reason || undefined }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not reassign that session");
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="t-small text-[var(--color-primary)] underline bg-transparent border-0 p-0 cursor-pointer whitespace-nowrap"
      >
        Reassign
      </button>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line-2)] bg-[var(--color-surface-2)] p-4 flex flex-col gap-3 min-w-[280px]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="t-body font-semibold">Reassign {bookingNo}</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="t-small text-[var(--color-ink-2)] bg-transparent border-0 p-0 cursor-pointer underline"
        >
          Close
        </button>
      </div>

      <Select label="Nurse" value={nurseId} onChange={(e) => setNurseId(e.target.value)}>
        <option value="">Nearest available — let the engine choose</option>
        {nurses
          .filter((n) => n.id !== currentNurseId)
          .map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
              {n.zones ? ` — ${n.zones}` : ""}
            </option>
          ))}
      </Select>

      <Input
        label="Reason"
        hint="the nurses see this"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Emma is unwell"
      />

      {error && <span className="t-small text-[var(--color-critical-text)]">{error}</span>}

      <Button size="sm" loading={busy} onClick={submit}>
        Reassign
      </Button>
    </div>
  );
}

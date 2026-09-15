"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";

/**
 * The physician's answer to a blocked infusion. Clearing proceeds under their
 * name; stopping stands the session down. The nurse cannot do either.
 */
export function VitalsDecision({ bookingId, bookingNo }: { bookingId: string; bookingNo: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"clear" | "stop" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (decision: "clear" | "stop") => {
    setBusy(decision);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/clear-vitals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, note: note || undefined }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "That did not go through");
      else router.refresh();
    } catch {
      setError("Could not reach the server. Nothing was recorded.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        label={`Your note on ${bookingNo}`}
        hint="the nurse and the patient see this"
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Known hypertensive on treatment, proceed at 100 ml/hr and recheck at 15 minutes."
      />
      {error && <span className="t-small text-[var(--color-critical-text)]">{error}</span>}
      <div className="flex gap-2 flex-wrap">
        <Button loading={busy === "clear"} onClick={() => decide("clear")}>
          Clear to proceed
        </Button>
        <Button variant="danger" loading={busy === "stop"} onClick={() => decide("stop")}>
          Stop the session
        </Button>
      </div>
    </div>
  );
}

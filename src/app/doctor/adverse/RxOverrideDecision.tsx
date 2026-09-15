"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";

/**
 * A nurse is standing with a patient who cannot give a code. Granting opens the
 * prescription under the physician's name; refusing sends them back to ask for
 * the code or stand the session down.
 *
 * Either way the nurse can still proceed on their own afterwards — that route
 * is recorded and broadcast rather than blocked, because a patient in front of
 * a nurse should not go untreated over a flat battery.
 */
export function RxOverrideDecision({ bookingId, bookingNo }: { bookingId: string; bookingNo: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"grant" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (decision: "grant" | "deny") => {
    setBusy(decision);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/rx-override`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "decide", decision, note: note || undefined }),
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
        hint="the nurse sees this"
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Known to me, proceed — confirm date of birth at the door."
      />
      {error && <span className="t-small text-[var(--color-critical-text)]">{error}</span>}
      <div className="flex gap-2 flex-wrap">
        <Button loading={busy === "grant"} onClick={() => decide("grant")}>
          Open it for them
        </Button>
        <Button variant="secondary" loading={busy === "deny"} onClick={() => decide("deny")}>
          Refuse
        </Button>
      </div>
    </div>
  );
}

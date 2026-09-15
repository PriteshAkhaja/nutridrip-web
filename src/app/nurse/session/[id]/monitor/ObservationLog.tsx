"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { queuedPost } from "@/lib/offline/queue";

/** Observations at ten-minute intervals — anything the patient reports, however minor. */
export function ObservationLog({
  bookingId,
  rateMlHr,
  remainingMl,
  observations,
}: {
  bookingId: string;
  rateMlHr: number;
  remainingMl: number;
  observations: Array<{ at: string; text: string }>;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [rate, setRate] = useState(rateMlHr);
  const [remaining, setRemaining] = useState(remainingMl);
  const [seen, setSeen] = useState({ rateMlHr, remainingMl });

  // These start from the server's figures, and the nurse then edits them. When
  // the server sends new ones — after a refresh, or after another observation
  // landed — the fields must follow, or the nurse would be shown a stale rate
  // and would re-submit it as if it were current. Adjusting state during render
  // on a changed prop is the pattern React prescribes for this.
  if (seen.rateMlHr !== rateMlHr || seen.remainingMl !== remainingMl) {
    setSeen({ rateMlHr, remainingMl });
    setRate(rateMlHr);
    setRemaining(remainingMl);
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await queuedPost(
        `/api/bookings/${bookingId}/observe`,
        { text, rateMlHr: rate, remainingMl: remaining },
        "Observation"
      );
      if (result.queued) {
        setText("");
        setError("Offline — this observation is queued and will sync when you reconnect.");
      } else if (!result.json.success) {
        setError(result.json.error ?? "Could not save the observation");
      } else {
        setText("");
        router.refresh();
      }
    } catch {
      setError("Could not save the observation. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
      <span className="t-micro">Observations</span>

      {observations.length > 0 && (
        <div className="flex flex-col gap-3 mt-3 mb-5">
          {observations.map((o, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="t-data text-[13px] text-[var(--color-ink-3)] flex-none w-[44px]">
                {new Date(o.at).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </span>
              <span className="t-body text-[var(--color-ink-2)]">{o.text}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 mt-4">
        <Textarea
          label="Add an observation"
          placeholder="Site clean, no swelling. Patient comfortable."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
        />

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-[7px]">
            <span className="t-micro">Rate · ml/hr</span>
            <input
              type="number"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="min-h-[44px] px-[14px] rounded-[var(--radius-sm)] border border-[var(--color-line-2)] bg-[var(--color-surface)] text-[14.5px]"
              style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
            />
          </label>
          <label className="flex flex-col gap-[7px]">
            <span className="t-micro">Remaining · ml</span>
            <input
              type="number"
              value={remaining}
              onChange={(e) => setRemaining(Number(e.target.value))}
              className="min-h-[44px] px-[14px] rounded-[var(--radius-sm)] border border-[var(--color-line-2)] bg-[var(--color-surface)] text-[14.5px]"
              style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
            />
          </label>
        </div>

        {error && <span className="t-small text-[var(--color-caution-text)]">{error}</span>}

        <Button block loading={busy} disabled={!text.trim()} onClick={submit}>
          Log it
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

/**
 * The team's half of a clinic's payment: the money is in the account -- or it
 * is not, and the clinic is told why so they can check their reference.
 */
export function VerifyPayment({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [refusing, setRefusing] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (body: Record<string, string>) => {
    setBusy(body.action);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/payment`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "That did not save");
      else router.refresh();
    } catch {
      setError("Could not reach the server. Nothing was changed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {refusing ? (
        <>
          <Input
            label="What was not found"
            hint="the clinic sees this"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. No UPI payment with this reference on 24 Sept"
          />
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" onClick={() => setRefusing(false)}>
              Back
            </Button>
            <Button
              variant="danger"
              loading={busy === "not_received"}
              disabled={note.trim().length < 3}
              onClick={() => act({ action: "not_received", note: note.trim() })}
            >
              Send back to the clinic
            </Button>
          </div>
        </>
      ) : (
        <div className="flex gap-2 flex-wrap">
          <Button loading={busy === "received"} onClick={() => act({ action: "received" })}>
            Payment received
          </Button>
          <Button variant="secondary" onClick={() => setRefusing(true)}>
            Not received
          </Button>
        </div>
      )}
      {error && <span className="t-small text-[var(--color-critical-text)]">{error}</span>}
    </div>
  );
}

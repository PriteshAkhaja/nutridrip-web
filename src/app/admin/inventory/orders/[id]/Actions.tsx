"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * DRAFT → CONFIRMED → DISPATCHED, with cancel available until dispatch.
 * The server refuses anything the stock cannot back, so failures are shown
 * verbatim rather than being pre-empted here.
 */
export function OrderActions({
  orderId,
  status,
  canConfirm,
  confirmNote = null,
}: {
  orderId: string;
  status: string;
  canConfirm: boolean;
  /** Why Confirm is off when it is the clinic's payment holding it up. */
  confirmNote?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (action: "confirm" | "dispatch" | "cancel") => {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action === "cancel" ? { reason: "Cancelled from the order screen" } : {}),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "That did not go through");
      else router.refresh();
    } catch {
      setError("Could not reach the server. Nothing was changed.");
    } finally {
      setBusy(null);
    }
  };

  // Laid out as items of the header's own row: the buttons sit on the line with
  // "Raised …" and the bell. Text under the buttons made this block taller than
  // them, and the header's centring then left the date and the bell floating.
  return (
    <>
      <div className="flex gap-2 flex-wrap justify-end">
        {status === "DRAFT" && (
          <>
            <Button variant="secondary" onClick={() => act("cancel")} loading={busy === "cancel"}>
              Cancel
            </Button>
            <Button
              onClick={() => act("confirm")}
              loading={busy === "confirm"}
              disabled={!canConfirm}
              // Why it is off is on the payment card just below; this is the short form.
              title={!canConfirm && confirmNote ? confirmNote : undefined}
            >
              Confirm &amp; reserve
            </Button>
          </>
        )}
        {status === "CONFIRMED" && (
          <>
            <Button variant="secondary" onClick={() => act("cancel")} loading={busy === "cancel"}>
              Cancel &amp; release
            </Button>
            <Button onClick={() => act("dispatch")} loading={busy === "dispatch"}>
              Dispatch
            </Button>
          </>
        )}
      </div>
      {/* A refusal gets a line of its own under the whole row (after the bell,
          hence order-last), rather than stretching the row it came from. */}
      {error && (
        <p role="alert" className="order-last basis-full m-0 flex justify-end">
          <span className="t-small text-[var(--color-critical-text)] max-w-[420px] text-right">{error}</span>
        </p>
      )}
    </>
  );
}

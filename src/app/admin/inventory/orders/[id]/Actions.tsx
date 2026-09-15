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
}: {
  orderId: string;
  status: string;
  canConfirm: boolean;
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

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2 flex-wrap justify-end">
        {status === "DRAFT" && (
          <>
            <Button variant="secondary" onClick={() => act("cancel")} loading={busy === "cancel"}>
              Cancel
            </Button>
            <Button onClick={() => act("confirm")} loading={busy === "confirm"} disabled={!canConfirm}>
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
      {error && <span className="t-small text-[var(--color-critical-text)] max-w-[420px] text-right">{error}</span>}
    </div>
  );
}

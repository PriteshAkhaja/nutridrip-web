"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";

const REASONS = [
  "Broken in transit",
  "Cold chain failure",
  "Miscount at receiving",
  "Expired — disposing",
  "Damaged packaging",
  "Manufacturer recall",
];

/**
 * The three things that happen to a batch after it arrives: the count was
 * wrong, some of it broke, or it must not be used. Each writes a ledger row —
 * stock never changes without a reason attached.
 */
export function BatchActions({
  lotId,
  batchNo,
  drugName,
  qtyOnHand,
  qtyReserved,
  isQuarantined,
  isExpired,
}: {
  lotId: string;
  batchNo: string;
  drugName: string;
  qtyOnHand: number;
  qtyReserved: number;
  isQuarantined: boolean;
  isExpired: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState(REASONS[0]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (body: Record<string, unknown>, label: string) => {
    setBusy(label);
    setError(null);
    try {
      const res = await fetch(`/api/inventory/lots/${lotId}/adjust`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "That did not go through");
      else {
        setOpen(false);
        setDelta("");
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. Stock is unchanged.");
    } finally {
      setBusy(null);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="t-small text-[var(--color-primary)] underline bg-transparent border-0 p-0 cursor-pointer whitespace-nowrap"
      >
        Adjust
      </button>
    );
  }

  const available = qtyOnHand - qtyReserved;

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line-2)] bg-[var(--color-surface-2)] p-4 flex flex-col gap-3 min-w-[280px]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="t-body font-semibold">
          {drugName} · <span className="t-data text-[14.5px]">{batchNo}</span>
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="t-small text-[var(--color-ink-2)] bg-transparent border-0 p-0 cursor-pointer underline"
        >
          Close
        </button>
      </div>

      <span className="t-small text-[var(--color-ink-2)]">
        <span className="t-data text-[13px]">{qtyOnHand}</span> on hand
        {qtyReserved > 0 && (
          <>
            , <span className="t-data text-[13px]">{qtyReserved}</span> reserved against confirmed orders
          </>
        )}
      </span>

      <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
        {REASONS.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </Select>

      <Input
        label="Change"
        hint="negative writes off"
        type="number"
        mono
        value={delta}
        onChange={(e) => setDelta(e.target.value)}
        placeholder="-3"
      />

      {error && <span className="t-small text-[var(--color-critical-text)]">{error}</span>}

      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          loading={busy === "adjust"}
          disabled={!delta || Number(delta) === 0}
          onClick={() => act({ delta: Number(delta), reason }, "adjust")}
        >
          Apply
        </Button>

        {isExpired && qtyOnHand > 0 && (
          <Button
            size="sm"
            variant="danger"
            loading={busy === "dispose"}
            onClick={() =>
              act({ delta: -available, reason: `Disposed — ${reason}`, dispose: true }, "dispose")
            }
          >
            Dispose all {available}
          </Button>
        )}

        <Button
          size="sm"
          variant="secondary"
          loading={busy === "quarantine"}
          onClick={() =>
            act({ delta: 0, reason: `${isQuarantined ? "Released from" : "Quarantined —"} ${reason}`, quarantine: !isQuarantined }, "quarantine")
          }
        >
          {isQuarantined ? "Release" : "Quarantine"}
        </Button>
      </div>

      <p className="t-small text-[var(--color-ink-3)]">
        Quarantined stock is excluded from every calculation without being deleted, so the batch history survives.
      </p>
    </div>
  );
}

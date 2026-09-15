"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Checkbox } from "@/components/ui/Field";

/**
 * The few things about a product that change after it is defined: where the
 * reorder alert fires, whether a part-used vial can serve the next patient,
 * how it is stored, and whether it is still on the list at all.
 */
export function MasterActions({
  masterId,
  name,
  reorderLevel,
  isMultidose,
  storageCondition,
}: {
  masterId: string;
  name: string;
  reorderLevel: number;
  isMultidose: boolean;
  storageCondition?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    reorderLevel: String(reorderLevel),
    isMultidose,
    storageCondition: storageCondition ?? "",
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const patch = async (body: Record<string, unknown>, label: string) => {
    setBusy(label);
    setError(null);
    try {
      const res = await fetch(`/api/inventory/masters/${masterId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "That did not save");
      else {
        setOpen(false);
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. Nothing was changed.");
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
        Edit
      </button>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line-2)] bg-[var(--color-surface-2)] p-4 flex flex-col gap-3 min-w-[280px]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="t-body font-semibold">{name}</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="t-small text-[var(--color-ink-2)] bg-transparent border-0 p-0 cursor-pointer underline"
        >
          Close
        </button>
      </div>

      <Input
        label="Reorder level"
        hint="alert at or below"
        type="number"
        min={0}
        mono
        value={form.reorderLevel}
        onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
      />
      <Input
        label="Storage"
        value={form.storageCondition}
        onChange={(e) => setForm({ ...form, storageCondition: e.target.value })}
        placeholder="2–8 °C, protect from light"
      />
      <Checkbox
        label="Multidose — a part-used unit can serve the next patient"
        checked={form.isMultidose}
        onChange={(v) => setForm({ ...form, isMultidose: v })}
      />

      {error && <span className="t-small text-[var(--color-critical-text)]">{error}</span>}

      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          loading={busy === "save"}
          onClick={() =>
            patch(
              {
                reorderLevel: Math.max(0, Number(form.reorderLevel) || 0),
                isMultidose: form.isMultidose,
                storageCondition: form.storageCondition,
              },
              "save"
            )
          }
        >
          Save
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={busy === "retire"}
          onClick={() => patch({ isActive: false }, "retire")}
        >
          Retire product
        </Button>
      </div>
      <p className="t-small text-[var(--color-ink-3)]">
        Retiring hides the product from the list and from new recipes. Its batches and their history are kept.
      </p>
    </div>
  );
}

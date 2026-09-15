"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Field";

export function RecallPicker({
  lots,
  selected,
}: {
  lots: Array<{ batchNo: string; drugName: string; expiry: string; qtyOnHand: number }>;
  selected: string;
}) {
  const router = useRouter();

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 max-w-[520px]">
      <Select
        label="Batch"
        hint="sorted by expiry"
        value={selected}
        onChange={(e) =>
          router.push(
            e.target.value ? `/admin/inventory/recall?batch=${encodeURIComponent(e.target.value)}` : "/admin/inventory/recall"
          )
        }
      >
        <option value="">Select a batch…</option>
        {lots.map((l) => (
          <option key={l.batchNo} value={l.batchNo}>
            {l.batchNo} — {l.drugName} ({l.qtyOnHand} on hand)
          </option>
        ))}
      </Select>
    </div>
  );
}

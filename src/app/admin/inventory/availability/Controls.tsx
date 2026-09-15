"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { DripPicker } from "@/components/ui/DripPicker";

/** Selection lives in the URL so a result can be linked to and reloaded. */
export function AvailabilityControls({
  drips,
  selectedSlug,
  quantity,
  includeKits,
}: {
  drips: Array<{ slug: string; name: string; category?: string; keywords?: Array<string | undefined> }>;
  selectedSlug: string;
  quantity: number;
  includeKits: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [slug, setSlug] = useState(selectedSlug);
  const [qty, setQty] = useState(quantity);
  const [kit, setKit] = useState(includeKits);

  const apply = () =>
    startTransition(() => {
      router.push(`/admin/inventory/availability?drip=${slug}&qty=${qty}&kit=${kit ? "1" : "0"}`);
    });

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 flex gap-4 flex-wrap items-end">
      <div className="min-w-[220px] flex-1">
        <DripPicker
          label="Drip"
          value={slug}
          onChange={setSlug}
          options={drips.map((d) => ({
            // Keyed by slug here, because the URL this builds is keyed by slug.
            id: d.slug,
            name: d.name,
            category: d.category,
            keywords: d.keywords,
          }))}
        />
      </div>

      <Field label="Quantity">
        <div className="flex items-center rounded-[var(--radius-sm)] border border-[var(--color-line-2)] bg-[var(--color-surface)] overflow-hidden">
          <button
            type="button"
            aria-label="Decrease"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="w-11 h-11 border-0 border-r border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-2)] cursor-pointer text-[18px]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            −
          </button>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            className="w-[72px] h-11 text-center border-0 bg-transparent text-[16px]"
            style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
            aria-label="Quantity"
          />
          <button
            type="button"
            aria-label="Increase"
            onClick={() => setQty((q) => q + 1)}
            className="w-11 h-11 border-0 border-l border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-2)] cursor-pointer text-[18px]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            +
          </button>
        </div>
      </Field>

      <label className="flex items-center gap-3 cursor-pointer min-h-[44px] px-1">
        <input
          type="checkbox"
          checked={kit}
          onChange={(e) => setKit(e.target.checked)}
          className="w-[18px] h-[18px] accent-[var(--color-primary)] cursor-pointer"
        />
        <span className="t-body">Include session kit</span>
      </label>

      <Button onClick={apply} loading={pending}>
        Check availability
      </Button>
    </div>
  );
}

"use client";

import Link from "next/link";
import { CATEGORIES } from "@/lib/models/types";
import { SearchBox } from "@/components/ui/SearchBox";

const CATEGORY_LABEL: Record<string, string> = {
  DRUG: "Drugs",
  FLUID: "Fluids",
  CONSUMABLE: "Consumables",
  PREMED: "Pre-meds",
};

export function InventoryFilters({
  tab,
  category,
  q,
}: {
  tab: string;
  category?: string;
  q?: string;
}) {
  const href = (next: { tab?: string; cat?: string | null; q?: string }) => {
    const params = new URLSearchParams();
    params.set("tab", next.tab ?? tab);
    const c = next.cat === null ? undefined : (next.cat ?? category);
    if (c) params.set("cat", c);
    const s = next.q ?? q;
    if (s) params.set("q", s);
    return `/admin/inventory?${params}`;
  };

  return (
    <div className="flex flex-wrap gap-3 items-center mb-5">
      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] border border-[var(--color-line)]">
        {[
          ["products", "Products"],
          ["batches", "Batches"],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={href({ tab: key })}
            className={`px-4 min-h-[36px] inline-flex items-center rounded-[6px] text-[13px] font-semibold no-underline hover:no-underline ${
              tab === key
                ? "bg-[var(--color-surface)] text-[var(--color-ink)]"
                : "text-[var(--color-ink-2)]"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Category, only meaningful on the products tab */}
      {tab !== "batches" && (
        <div className="flex flex-wrap gap-2">
          <Link
            href={href({ cat: null })}
            className={`inline-flex items-center min-h-[36px] px-3 rounded-full border text-[13px] font-medium no-underline hover:no-underline ${
              category
                ? "border-[var(--color-line-2)] bg-[var(--color-surface)] text-[var(--color-ink-2)]"
                : "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]"
            }`}
          >
            All
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              href={href({ cat: c })}
              className={`inline-flex items-center min-h-[36px] px-3 rounded-full border text-[13px] font-medium no-underline hover:no-underline ${
                category === c
                  ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]"
                  : "border-[var(--color-line-2)] bg-[var(--color-surface)] text-[var(--color-ink-2)]"
              }`}
            >
              {CATEGORY_LABEL[c]}
            </Link>
          ))}
        </div>
      )}

      {/* Same control as the public catalogue: debounced, and carrying its own
          Clear so the browser's "×" is not sitting next to it. */}
      <SearchBox
        basePath="/admin/inventory"
        q={q}
        keep={{ tab, cat: category }}
        placeholder="Drug name, HSN code, molecule, batch"
        label="Search inventory"
        className="ml-auto w-[300px] max-w-full"
      />
    </div>
  );
}

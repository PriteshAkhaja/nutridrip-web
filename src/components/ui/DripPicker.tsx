"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Label } from "@/components/ui/Field";
import { filterDrips, noMatchMessage } from "@/lib/data/drip-search";

export type DripOptionItem = {
  id: string;
  name: string;
  category?: string;
  /** Ingredient names and the like, so "the one with glutathione" finds it. */
  keywords?: Array<string | undefined>;
  /** Anything worth showing on the row — price, units available. */
  detail?: string;
  disabled?: boolean;
};

/**
 * Choosing a drip, with search.
 *
 * A native <select> is fine for nine drips and poor for ninety: it cannot be
 * searched by ingredient, and on a phone it becomes a wheel you scroll blind.
 * This keeps the same one-tap feel while letting anyone type "glutathione" or
 * "immunity" instead of remembering the product name.
 *
 * The whole list still renders when the box is empty, so nothing is hidden
 * behind knowing what to type.
 */
export function DripPicker({
  options,
  value,
  onChange,
  label = "Drip",
  hint,
  placeholder = "Search by name, category or ingredient",
  emptyLabel = "Choose a drip…",
}: {
  options: DripOptionItem[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  hint?: string;
  placeholder?: string;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value) ?? null;
  const matches = useMemo(() => filterDrips(options, query), [options, query]);

  // Clicking anywhere else closes the list, as a native select would.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (id: string) => {
    onChange(id);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-[7px] min-w-0" ref={boxRef}>
      {label && <Label hint={hint}>{label}</Label>}

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="min-h-[44px] w-full px-[14px] rounded-[var(--radius-sm)] border border-[var(--color-line-2)] bg-[var(--color-surface)] text-[14.5px] text-left flex items-center gap-2 cursor-pointer hover:border-[var(--color-primary)]"
        >
          <span className={`flex-1 truncate ${selected ? "" : "text-[var(--color-ink-3)]"}`}>
            {selected ? selected.name : emptyLabel}
          </span>
          {selected?.detail && (
            <span className="t-data text-[13px] text-[var(--color-ink-3)] flex-none">{selected.detail}</span>
          )}
          <span aria-hidden className="text-[var(--color-ink-3)] flex-none">
            ▾
          </span>
        </button>

        {open && (
          <div className="absolute z-30 left-0 right-0 mt-1 rounded-[var(--radius-md)] border border-[var(--color-line-2)] bg-[var(--color-surface)] shadow-[var(--shadow-pop)] overflow-hidden">
            <div className="p-2 border-b border-[var(--color-line)]">
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                aria-label="Search drips"
                className="min-h-[40px] w-full px-3 rounded-[var(--radius-sm)] border border-[var(--color-line-2)] bg-[var(--color-surface)] text-[14.5px] placeholder:text-[var(--color-ink-3)] focus:border-[var(--color-primary)]"
              />
            </div>

            <div className="max-h-[280px] overflow-y-auto" role="listbox">
              {matches.length === 0 ? (
                <p className="t-small text-[var(--color-ink-3)] px-4 py-4">{noMatchMessage(query)}</p>
              ) : (
                matches.map((o) => {
                  const active = o.id === value;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      disabled={o.disabled}
                      onClick={() => choose(o.id)}
                      className="w-full text-left px-4 py-3 border-b border-[var(--color-line)] last:border-b-0 flex items-center gap-3 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 hover:bg-[var(--color-primary-soft)]"
                      style={active ? { background: "var(--color-primary-soft)" } : undefined}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="t-body block truncate">{o.name}</span>
                        {o.category && <span className="t-small text-[var(--color-ink-3)]">{o.category}</span>}
                      </span>
                      {o.detail && (
                        <span className="t-data text-[13px] text-[var(--color-ink-3)] flex-none">{o.detail}</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

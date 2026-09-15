"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useDebouncedValue } from "@/lib/use-debounced-value";

/**
 * Search that lives in the URL, and searches as you type.
 *
 * The query goes in the address bar rather than in component state, so a
 * search is a place: "/drips?q=glutathione" is a page somebody can send to a
 * friend, and the back button walks out of it.
 *
 * Three details that matter for a server-rendered page:
 *
 *  - the query is DEBOUNCED, because each change is a round trip, and typing
 *    "glutathione" should be one request rather than eleven;
 *  - it navigates with `replace`, not `push`, so eleven half-typed queries do
 *    not become eleven entries the back button has to walk out of;
 *  - the browser's own clear "×" is hidden, because this carries its own Clear
 *    and two of them side by side looks like a mistake.
 */
export function SearchBox({
  basePath,
  q,
  keep,
  placeholder = "Search",
  label = "Search",
  className = "",
}: {
  /** "/drips", for example. */
  basePath: string;
  q?: string;
  /** Other query parameters to preserve, such as a tab or a category filter. */
  keep?: Record<string, string | undefined>;
  placeholder?: string;
  /** What a screen reader announces the field as. */
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(q ?? "");
  const [pending, startTransition] = useTransition();
  const settled = useDebouncedValue(value, 300);

  // What the URL already says. Comparing against it is what stops a wasted
  // round trip on mount and a second one right after each navigation — the
  // URL itself is the record of what has been sent, so nothing else needs to
  // remember it.
  const current = q ?? "";

  useEffect(() => {
    const next = settled.trim();
    if (next === current) return;

    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(keep ?? {})) if (v) params.set(k, v);
    if (next) params.set("q", next);
    const qs = params.toString();

    startTransition(() => {
      router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    });
    // `keep` is a fresh object each render; its contents are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, current, basePath, router, JSON.stringify(keep ?? {})]);

  // If the URL changes from outside — the back button, or a chip that resets
  // the query — follow it rather than leaving stale text in the box. Adjusting
  // state during render is React's own answer here; doing it in an effect
  // would render once with the wrong value and then again with the right one.
  const [seenQ, setSeenQ] = useState(current);
  if (current !== seenQ) {
    setSeenQ(current);
    setValue(current);
  }

  return (
    <div role="search" className={`relative ${className}`}>
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="no-native-clear min-h-[44px] w-full px-[14px] pr-[76px] rounded-[var(--radius-sm)] border border-[var(--color-line-2)] bg-[var(--color-surface)] text-[14.5px] placeholder:text-[var(--color-ink-3)] focus:border-[var(--color-primary)]"
      />
      {/* Only ever one of these shows, so the field never jumps width. */}
      <span className="absolute right-[12px] top-1/2 -translate-y-1/2 flex items-center">
        {pending ? (
          <span className="t-small text-[var(--color-ink-3)]">Searching…</span>
        ) : value ? (
          <button
            type="button"
            onClick={() => setValue("")}
            aria-label="Clear search"
            className="t-small text-[var(--color-ink-2)] bg-transparent border-0 p-0 cursor-pointer underline"
          >
            Clear
          </button>
        ) : null}
      </span>
    </div>
  );
}

/**
 * The summary counts in a console header.
 *
 * Passed as separate items rather than one pre-joined string, because the two
 * behave differently when the header runs out of room. A single string breaks
 * wherever the space happens to fall — "0 prescriptions / waiting" — which
 * turns a count into two half-sentences. Each item here is kept whole, and a
 * wrap can only ever happen between them.
 *
 * Below `sm` they stack, one count per line and no separators: three phrases
 * with middots on a phone are harder to read than three short lines.
 */
export function HeaderCounts({ items }: { items: Array<string | number | null | undefined | false> }) {
  const parts = items.filter((i): i is string | number => i !== null && i !== undefined && i !== false).map(String);
  if (parts.length === 0) return null;

  return (
    <span className="t-data text-[13px] text-[var(--color-ink-3)] flex flex-col items-end sm:flex-row sm:flex-wrap sm:items-center sm:justify-end min-w-0">
      {parts.map((part, i) => (
        <span key={part} className="whitespace-nowrap">
          {part}
          {/* The separator travels with the item BEFORE it, so a wrapped line
              ends with the middot rather than starting with one. */}
          {i < parts.length - 1 && (
            <span aria-hidden="true" className="hidden sm:inline mx-[8px] text-[var(--color-line-2)]">
              ·
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

/** "1 infusion" / "2 infusions" — a count that reads as English. */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

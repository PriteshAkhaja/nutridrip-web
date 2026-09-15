/**
 * One way of matching a drip, used by every screen that lists them.
 *
 * Kept pure and in one file on purpose: the public catalogue, the patient's
 * booking screen and four staff pickers all search the same way, so a nurse
 * typing "vitamin c" and a patient typing "vitamin c" get the same answer.
 *
 * Matching covers the name, the category, and the ingredients — because people
 * look for "the one with glutathione" far more often than they remember that
 * it is called Glow Protocol.
 */

export type SearchableDrip = {
  name: string;
  category?: string;
  /** Ingredient names, taglines — anything worth finding it by. */
  keywords?: Array<string | undefined>;
};

/** Lowercase, collapse whitespace, drop punctuation that people type loosely. */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9%+\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function haystack(drip: SearchableDrip): string {
  return normalise(
    [drip.name, drip.category, ...(drip.keywords ?? [])].filter(Boolean).join(" ")
  );
}

/**
 * Every word must appear somewhere, in any order — so "c immune" finds Immune
 * Shield by its vitamin C, and a half-typed word still narrows as you go.
 */
export function matchesDrip(drip: SearchableDrip, query: string): boolean {
  const terms = normalise(query).split(" ").filter(Boolean);
  if (terms.length === 0) return true;
  const hay = haystack(drip);
  return terms.every((term) => hay.includes(term));
}

export function filterDrips<T extends SearchableDrip>(list: T[], query: string): T[] {
  if (!query.trim()) return list;
  return list.filter((d) => matchesDrip(d, query));
}

/** "No drip matches 'xyz'" — the same wording wherever a search comes up empty. */
export function noMatchMessage(query: string): string {
  return `Nothing matches “${query.trim()}”. Try a drug name, or part of the drip's name.`;
}

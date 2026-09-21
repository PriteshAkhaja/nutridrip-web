/**
 * Pagination, as logic.
 *
 * The rule the whole app follows: the DATABASE pages, not the code. A list asks
 * Mongo for `skip(n).limit(size)` and for a count, and never fetches rows to
 * throw them away. The old lists did the opposite by accident of a different
 * kind — a silent `.limit(200)` that hid everything past 200 with no way to see
 * it. This module is what makes a real page cheap to ask for and safe to ask
 * for badly.
 *
 * Pure: no model, no request, so every edge (page 0, page "abc", a page past the
 * end, an empty table) can be tested without a database.
 */

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;
/** Nobody gets more than this in one request, whatever they ask for. */
export const MAX_PAGE_SIZE = 100;

/**
 * Past this a `skip` is a deliberate attack or a typo, and a database walking a
 * million documents to return none is exactly the slowness this exists to avoid.
 */
const MAX_PAGE = 100_000;

export type Paging = { page: number; pageSize: number; skip: number };

export type PageMeta = {
  /** The page actually being shown — clamped into range, which may differ from the one asked for. */
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  /** 1-based position of the first and last row on this page; 0 and 0 when empty. */
  from: number;
  to: number;
  hasPrev: boolean;
  hasNext: boolean;
};

/** Whole numbers only, from a number or a numeric string; anything else is "not given". */
function wholeNumber(v: unknown): number | null {
  if (typeof v === "string" && v.trim() === "") return null;
  if (typeof v !== "number" && typeof v !== "string") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

/**
 * What the caller asked for, made safe. Never throws and never returns a
 * nonsense window: `page=0`, `page=-3`, `page=abc`, `pageSize=99999` all come
 * back as something the database can answer.
 */
export function parsePaging(
  input: { page?: unknown; pageSize?: unknown } = {},
  opts: { defaultPageSize?: number; maxPageSize?: number } = {}
): Paging {
  const max = opts.maxPageSize ?? MAX_PAGE_SIZE;
  const fallback = Math.min(opts.defaultPageSize ?? DEFAULT_PAGE_SIZE, max);

  const rawPage = wholeNumber(input.page);
  const page = rawPage === null || rawPage < 1 ? 1 : Math.min(rawPage, MAX_PAGE);

  const rawSize = wholeNumber(input.pageSize);
  const pageSize = rawSize === null || rawSize < 1 ? fallback : Math.min(rawSize, max);

  return { page, pageSize, skip: (page - 1) * pageSize };
}

/** Everything a footer needs to say, from a total and a page. Clamps the page into range. */
export function pageMeta(total: number, page: number, pageSize: number): PageMeta {
  const count = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  const size = Math.max(1, Math.floor(pageSize) || DEFAULT_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(count / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);

  const from = count === 0 ? 0 : (current - 1) * size + 1;
  const to = count === 0 ? 0 : Math.min(current * size, count);

  return {
    page: current,
    pageSize: size,
    total: count,
    totalPages,
    from,
    to,
    hasPrev: current > 1,
    hasNext: current < totalPages,
  };
}

/** What goes in the numbered strip: a page number, or a gap standing for the pages skipped. */
export type PageItem = number | "gap-start" | "gap-end";

/**
 * The numbered strip — `1 … 4 [5] 6 … 49`.
 *
 * The first and last page are always there, and so are the current page and its
 * neighbours. A gap that would hide exactly one page shows that page instead: an
 * ellipsis standing for a single number is longer to read than the number.
 */
export function pageWindow(page: number, totalPages: number, siblings = 1): PageItem[] {
  const last = Math.max(1, Math.floor(totalPages) || 1);
  const current = Math.min(Math.max(1, Math.floor(page) || 1), last);

  // Few enough pages that nothing needs hiding.
  const slots = siblings * 2 + 5; // first, last, current, two gaps, and the siblings either side
  if (last <= slots) return Array.from({ length: last }, (_, i) => i + 1);

  const left = Math.max(current - siblings, 1);
  const right = Math.min(current + siblings, last);

  // A gap has to hide at least two pages to be worth drawing: with the window
  // starting at page 3 only page 2 is hidden, and "2" is shorter than "…".
  const showLeftGap = left > 3;
  const showRightGap = right < last - 2;

  // Near an end, fill the strip so its length does not jump as you page.
  if (!showLeftGap && showRightGap) {
    const head = Array.from({ length: siblings * 2 + 3 }, (_, i) => i + 1);
    return [...head, "gap-end", last];
  }
  if (showLeftGap && !showRightGap) {
    const tailLen = siblings * 2 + 3;
    const tail = Array.from({ length: tailLen }, (_, i) => last - tailLen + 1 + i);
    return [1, "gap-start", ...tail];
  }

  const middle = Array.from({ length: right - left + 1 }, (_, i) => left + i);
  return [1, "gap-start", ...middle, "gap-end", last];
}

/**
 * A link to this same list with something changed — keeping every other filter.
 *
 * `page=1` and the default page size are left out, so the first page of a list
 * has the clean URL it always had and a shared link is as short as it can be.
 */
export function hrefWith(
  basePath: string,
  params: Record<string, string | string[] | undefined | null>,
  overrides: Record<string, string | number | undefined | null> = {}
): string {
  const merged: Record<string, string | number | undefined | null> = {};
  for (const [k, v] of Object.entries(params)) merged[k] = Array.isArray(v) ? v[0] : v;
  for (const [k, v] of Object.entries(overrides)) merged[k] = v;

  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === null || v === "") continue;
    if (k === "page" && Number(v) === 1) continue;
    if (k === "pageSize" && Number(v) === DEFAULT_PAGE_SIZE) continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return `${basePath}${s ? `?${s}` : ""}`;
}

/**
 * A sort that gives every row one fixed place.
 *
 * Paging by `skip` over a sort with ties — a hundred rows created in the same
 * millisecond, or sorted by a status with three values — lets the database break
 * the tie differently on each request, so a row can appear on two pages and
 * another on none. Appending `_id`, which is unique, removes the ambiguity. The
 * direction follows the last key so `{ createdAt: -1 }` stays newest-first.
 */
export function stableSort(sort: Record<string, 1 | -1>): Record<string, 1 | -1> {
  if ("_id" in sort) return { ...sort };
  const keys = Object.keys(sort);
  const dir = keys.length ? sort[keys[keys.length - 1]] : -1;
  return { ...sort, _id: dir };
}

/** The block an API sends back beside its rows. */
export function pageInfo(meta: PageMeta) {
  return {
    page: meta.page,
    pageSize: meta.pageSize,
    total: meta.total,
    totalPages: meta.totalPages,
    from: meta.from,
    to: meta.to,
    hasPrev: meta.hasPrev,
    hasNext: meta.hasNext,
  };
}

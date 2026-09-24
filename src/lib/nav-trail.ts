/**
 * Where a page's Back button goes: to the page the person came from.
 *
 * A session report is reached from Today, from the Schedule, from the checklist
 * and from the bell, and a fixed Back to Today was wrong three times out of
 * four. So each page remembers where it was entered from -- but coming back to
 * it from one of its own screens (the checklist's vitals, its report) is not
 * entering it, and does not change that: after taking vitals, the checklist's
 * Back still leads to wherever the checklist was opened from.
 *
 * Kept per browser tab. A page opened fresh -- a new tab, a shared link -- has
 * no history, and falls back to its usual parent.
 */
export type Trail = Record<string, string>;

const pathOf = (url: string) => url.split(/[?#]/)[0];

/** Record arriving at `cur` from `prev` (both path + query). */
export function recordVisit(trail: Trail, prev: string | null, cur: string): Trail {
  if (!prev) return trail;
  const from = pathOf(prev);
  const to = pathOf(cur);
  if (from === to) return trail;
  // Back from one of its own screens: the way in is unchanged.
  if (from.startsWith(`${to}/`)) return trail;
  return { ...trail, [to]: prev };
}

const LABELS: Array<[RegExp, string]> = [
  [/^\/nurse$/, "Back to today"],
  [/^\/nurse\/schedule$/, "Back to the schedule"],
  [/^\/nurse\/kit$/, "Back to kit"],
  [/^\/nurse\/me$/, "Back to your profile"],
  [/^\/nurse\/session\/[^/]+$/, "Back to the checklist"],
  [/^\/nurse\/session\/[^/]+\/report$/, "Back to the report"],
  [/^\/nurse\/plan\/[^/]+$/, "Back to the plan"],
  [/^\/app$/, "Back to home"],
  [/^\/app\/sessions$/, "Back to sessions"],
  [/^\/app\/reports$/, "Back to reports"],
  [/^\/app\/profile$/, "Back to profile"],
  [/^\/app\/drips$/, "Back to drips"],
  [/^\/app\/session\/[^/]+$/, "Back to your session"],
  [/^\/app\/report\/[^/]+$/, "Back to the report"],
  [/^\/app\/results\/[^/]+$/, "Back to your results"],
  [/^\/app\/plan\/[^/]+$/, "Back to your plan"],
];

/** Where Back goes on `cur`, or the page's usual parent when it was not entered from within the app. */
export function backFor(
  trail: Trail,
  cur: string,
  fallback: { href: string; label: string }
): { href: string; label: string } {
  const to = pathOf(cur);
  const origin = trail[to];
  if (!origin) return fallback;
  const from = pathOf(origin);
  // Only within the same app: a nurse's Back never leads into the patient app, or out of both.
  const root = (p: string) => (p === "/nurse" || p.startsWith("/nurse/") ? "nurse" : p === "/app" || p.startsWith("/app/") ? "app" : null);
  if (!root(from) || root(from) !== root(to) || from === to || from.startsWith(`${to}/`)) return fallback;
  const label = LABELS.find(([re]) => re.test(from))?.[1];
  return label ? { href: origin, label } : fallback;
}

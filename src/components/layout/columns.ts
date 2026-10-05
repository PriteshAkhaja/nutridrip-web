/**
 * Page columns for the patient and nurse apps, decided by the width the page
 * actually has rather than by the screen: the desktop sidebar takes 240px, so
 * a 1024px desktop gives a page less room than a 1000px tablet. AppFrame makes
 * <main> the container these `@` variants measure.
 *
 * - under 896px of page: one column, full width, so the pickers and forms
 *   inside a card keep the room they were designed for;
 * - from 896px: two columns ('a' above 'b' on the left, 'c' on the right),
 *   each at least ~430px;
 * - from 1152px: three side by side ('a' 'b' 'c').
 *
 * Each area is a stack of cards. On a phone the page lists them in its own
 * order; a page that interleaves areas on a phone makes its area wrappers
 * `contents` there and orders the cards (see the patient Home).
 *
 * An area with nothing in it takes no room. Whether an area has anything to
 * show is often only known deep inside it (a card that returns null, a
 * session with no vitals yet), so it is read from the markup: an area none of
 * whose elements has any content is hidden. The three columns are flex items,
 * not grid cells, so the areas left share the width instead of leaving a
 * blank third of the page. (A grid cannot do it: hiding a cell leaves its
 * track, and choosing the tracks from the container would need :has() inside
 * :has(), which no browser allows.)
 */
export const COLUMNS =
  "@4xl:grid @4xl:grid-cols-2 @4xl:grid-rows-[auto_1fr] @4xl:[grid-template-areas:'a_c'_'b_c'] @4xl:gap-x-6 @4xl:items-start @6xl:flex @6xl:flex-row";

/** Hidden once the columns start, when none of its elements holds anything (see above). */
const EMPTY_TAKES_NO_ROOM = "@4xl:[&:not(:has(:not(:empty)))]:hidden!";

export const AREA = {
  a: `min-w-0 @4xl:[grid-area:a] @6xl:flex-1 ${EMPTY_TAKES_NO_ROOM}`,
  b: `min-w-0 @4xl:[grid-area:b] @6xl:flex-1 ${EMPTY_TAKES_NO_ROOM}`,
  c: `min-w-0 @4xl:[grid-area:c] @6xl:flex-1 ${EMPTY_TAKES_NO_ROOM}`,
} as const;

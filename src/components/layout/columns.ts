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
 */
export const COLUMNS =
  "@4xl:grid @4xl:grid-cols-2 @4xl:grid-rows-[auto_1fr] @4xl:[grid-template-areas:'a_c'_'b_c'] @4xl:gap-x-6 @4xl:items-start @6xl:grid-cols-3 @6xl:grid-rows-[auto] @6xl:[grid-template-areas:'a_b_c']";

export const AREA = {
  a: "min-w-0 @4xl:[grid-area:a]",
  b: "min-w-0 @4xl:[grid-area:b]",
  c: "min-w-0 @4xl:[grid-area:c]",
} as const;

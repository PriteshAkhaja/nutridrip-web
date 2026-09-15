import type { CSSProperties } from "react";

/**
 * The link arrow, drawn rather than typed.
 *
 * "→" and "←" (U+2192, U+2190) are in none of our three webfonts — Google does
 * not serve them in any subset Inter, Instrument Sans or Noto Sans Mono ship.
 * Typed as characters the browser borrowed them from whatever the operating
 * system had, so the arrow was a different typeface from the label beside it,
 * and a different one again on every platform.
 *
 * Drawn here it takes the text colour through `currentColor` — so it follows a
 * link's hover state and the pale tint used on dark grounds without being told
 * — and sizes in `em`, so it tracks whatever type scale it sits in.
 */
export function Arrow({
  dir = "right",
  className = "",
  style,
}: {
  dir?: "right" | "left";
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="1em"
      height="1em"
      fill="none"
      aria-hidden
      focusable="false"
      className={className}
      /* Tailwind's preflight makes every svg `display:block`, which would drop
         the arrow onto a line of its own. It has to sit in the text like the
         glyph it replaces, so the display is set back explicitly, and the
         baseline nudge puts the shaft where the old glyph's was. `flex:none`
         keeps it unsquashed in the flex rows several of these links live in. */
      style={{ display: "inline-block", verticalAlign: "-0.1em", flex: "none", ...style }}
    >
      <path
        d={dir === "right" ? "M3 10h14M12 5l5 5-5 5" : "M17 10H3M8 5l-5 5 5 5"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

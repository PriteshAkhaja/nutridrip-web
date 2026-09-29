import type { CSSProperties, ReactNode } from "react";

/** A track shorter than this many cards would show its seam on a wide screen. */
const MIN_CARDS_PER_TRACK = 8;

/**
 * A slow, endless row of cards: Most booked on the home page.
 *
 * Built like Marquee (two identical tracks sliding together), but the items
 * are links, so the copies that only exist to fill the loop are `inert` and
 * hidden from assistive tech: each card is focusable, and read out, once. It
 * pauses under the pointer, while a card inside has focus, while a finger is
 * on it (so a tap lands on the card it meant) and while it is off screen
 * (RevealRoot). With reduced motion it stops and shows each card once,
 * wrapped (globals.css).
 *
 * `secondsPerCard` sets the pace: the time one card takes to move its own
 * width, so the speed stays the same however many cards there are.
 */
export function CardMarquee({
  items,
  label,
  secondsPerCard = 7,
}: {
  items: ReactNode[];
  /** Names the row for assistive tech, e.g. "Most booked drips". */
  label: string;
  secondsPerCard?: number;
}) {
  const copies = Math.max(1, Math.ceil(MIN_CARDS_PER_TRACK / Math.max(1, items.length)));
  const track = Array.from({ length: copies }, () => items).flat();
  const style = {
    ["--marquee-duration" as string]: `${track.length * secondsPerCard}s`,
    ["--marquee-gap" as string]: "20px",
  } as CSSProperties;

  return (
    <div className="marquee card-marquee" style={style} data-pause-offscreen="">
      <ul className="marquee-track list-none m-0 p-0" aria-label={label}>
        {track.map((item, i) => {
          const copy = i >= items.length;
          return (
            <li key={i} className="card-marquee-item" aria-hidden={copy || undefined} inert={copy || undefined}>
              {item}
            </li>
          );
        })}
      </ul>
      <ul className="marquee-track list-none m-0 p-0" aria-hidden inert>
        {track.map((item, i) => (
          <li key={i} className="card-marquee-item">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

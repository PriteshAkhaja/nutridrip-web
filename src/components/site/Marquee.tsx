import type { CSSProperties, ReactNode } from "react";

/**
 * A slow, endless strip. Two identical tracks slide together; the second is
 * hidden from assistive tech so the list is read once. Pauses under the
 * pointer and while off screen (RevealRoot); with reduced motion it stops and
 * wraps (globals.css).
 */
export function Marquee({
  items,
  label,
  duration = 48,
  gap = 48,
  className = "",
  fade,
}: {
  items: ReactNode[];
  label: string;
  /** Seconds for one full pass. Longer is calmer. */
  duration?: number;
  gap?: number;
  className?: string;
  /** The ground colour the edges fade into, when it is not the page's white. */
  fade?: string;
}) {
  const style = {
    ["--marquee-duration" as string]: `${duration}s`,
    ["--marquee-gap" as string]: `${gap}px`,
    ...(fade ? { ["--marquee-fade" as string]: fade } : null),
  } as CSSProperties;

  const track = (hidden: boolean) => (
    <ul
      className="marquee-track list-none m-0 p-0"
      aria-hidden={hidden || undefined}
      aria-label={hidden ? undefined : label}
    >
      {items.map((item, i) => (
        <li key={i} className="flex-none">
          {item}
        </li>
      ))}
    </ul>
  );

  return (
    <div className={`marquee ${className}`} style={style} data-pause-offscreen="">
      {track(false)}
      {track(true)}
    </div>
  );
}

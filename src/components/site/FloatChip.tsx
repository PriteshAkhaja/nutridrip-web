import type { CSSProperties, ReactNode } from "react";

/**
 * A small card floating over photography: an icon, a bold line and a quiet
 * one. The outer element takes the entrance; the inner one drifts, so the two
 * transforms never fight. Floating layers are the one thing on the site that
 * casts a shadow.
 *
 * The card is solid rather than frosted glass. A backdrop blur has to be
 * recomputed from the photograph behind it on every frame the card drifts or
 * the page scrolls, which is what made scrolling past these stutter, and at
 * 95% white the blur was barely visible anyway. The drift pauses whenever the
 * card is off screen (RevealRoot).
 *
 * `reveal="hero"` for a chip on the first screen, which enters with the hero
 * from first paint instead of waiting to be scrolled to.
 */
export function FloatChip({
  icon,
  title,
  body,
  className = "",
  style,
  drift = "early",
  reveal = "scroll",
}: {
  icon: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  className?: string;
  style?: CSSProperties;
  drift?: "early" | "late" | "none";
  reveal?: "scroll" | "hero";
}) {
  const driftClass = drift === "early" ? "float-drift" : drift === "late" ? "float-drift-late" : "";
  return (
    <div
      className={className}
      data-reveal={reveal === "hero" ? "hero" : ""}
      data-pause-offscreen={driftClass ? "" : undefined}
      style={style}
    >
      <div
        className={`flex items-center gap-3 rounded-[18px] border border-white/70 bg-white px-4 py-3 shadow-[var(--shadow-float)] ${driftClass}`}
      >
        <span className="w-9 h-9 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary-text)] inline-flex items-center justify-center flex-none">
          {icon}
        </span>
        <span className="flex flex-col min-w-0">
          <span className="text-[13.5px] font-semibold leading-[1.3] text-[var(--color-ink)]">{title}</span>
          {body ? <span className="text-[12.5px] leading-[1.4] text-[var(--color-ink-2)]">{body}</span> : null}
        </span>
      </div>
    </div>
  );
}

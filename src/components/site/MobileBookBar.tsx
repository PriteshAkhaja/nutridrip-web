"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Below Tailwind's `lg`, where the bar exists. */
const BAR_QUERY = "(width < 64rem)";

/**
 * A booking bar pinned to the bottom of a phone screen, for long product
 * pages. It appears only once the page's own price card has scrolled away
 * above, and steps aside again when the closing call to action comes into
 * view, so there is never a second copy of a button on screen. Hidden, it is
 * inert: nothing in it can be tabbed to or read out.
 *
 * Positions are read on scroll (once a frame) rather than with an
 * IntersectionObserver, because a jump — an anchor link, the End key — can
 * carry the card from below the screen to above it without it ever
 * intersecting, and an observer only reports changes of intersection. The
 * listener is only attached below the width where the bar exists (it is
 * `lg:hidden`), so a desktop scroll runs none of it. Solid white rather than
 * frosted: a blur under a fixed bar is recomputed on every frame of a scroll.
 */
export function MobileBookBar({
  targetId,
  hideWhenId,
  asideWhileId,
  children,
}: {
  /** The in-page card the bar stands in for. */
  targetId: string;
  /** A block near the end that already carries the call to action. */
  hideWhenId?: string;
  /** A block that carries its own call to action while it is on screen (the drip assembly): the bar steps aside for it. */
  asideWhileId?: string;
  children: ReactNode;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const card = document.getElementById(targetId);
    const end = hideWhenId ? document.getElementById(hideWhenId) : null;
    const aside = asideWhileId ? document.getElementById(asideWhileId) : null;
    if (!card) return;
    const narrow = window.matchMedia(BAR_QUERY);
    let raf = 0;
    const read = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const pastCard = card.getBoundingClientRect().bottom < 0;
        const atEnd = end ? end.getBoundingClientRect().top < window.innerHeight : false;
        const a = aside?.getBoundingClientRect();
        const inAside = a ? a.top < window.innerHeight && a.bottom > 0 : false;
        setShown(narrow.matches && pastCard && !atEnd && !inAside);
      });
    };
    const listen = () => {
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
      if (narrow.matches) {
        window.addEventListener("scroll", read, { passive: true });
        window.addEventListener("resize", read);
      }
      read();
    };
    listen();
    narrow.addEventListener("change", listen);
    return () => {
      narrow.removeEventListener("change", listen);
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
      cancelAnimationFrame(raf);
    };
  }, [targetId, hideWhenId, asideWhileId]);

  return (
    <div
      inert={!shown}
      className={`lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-line)] bg-white transition-transform duration-500 ease-[var(--ease-glide)] ${
        shown ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-[1280px] items-center gap-4 px-6 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] md:px-10">
        {children}
      </div>
    </div>
  );
}

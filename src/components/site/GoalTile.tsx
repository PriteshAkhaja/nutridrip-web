import Link from "next/link";
import type { SiteImage } from "@/lib/site-images";
import { Photo } from "./Photo";
import { IconArrowUpRight } from "./Icons";

/**
 * A goal as a photograph with its name laid over the lower edge. The scrim is
 * there for the words, not for mood: it only darkens the bottom of the frame,
 * enough for white text to clear AA, and leaves the picture itself alone.
 */
export function GoalTile({
  href,
  name,
  blurb,
  count,
  image,
  sizes = "(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 78vw",
}: {
  href: string;
  name: string;
  blurb: string;
  /** How many live drips the goal filters to; left out when there are none. */
  count: number;
  image: SiteImage;
  sizes?: string;
}) {
  return (
    <Link href={href} prefetch={false} className="group block no-underline hover:no-underline">
      <Photo image={image} sizes={sizes} zoom decorative className="aspect-[4/5] rounded-[var(--radius-xl)]">
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(0deg,rgb(4_24_31/0.86)_0%,rgb(4_24_31/0.42)_38%,rgb(4_24_31/0)_62%)]"
        />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6">
          <div className="flex flex-col gap-1 text-white min-w-0">
            {count > 0 ? (
              <span className="t-small text-white/75">
                {count} {count === 1 ? "drip" : "drips"}
              </span>
            ) : null}
            <span className="t-title">{name}</span>
            <span className="text-[14px] leading-[1.45] text-white/80">{blurb}</span>
          </div>
          <span
            aria-hidden
            className="w-11 h-11 rounded-full bg-white text-[var(--color-ink)] inline-flex items-center justify-center flex-none transition-transform duration-500 ease-[var(--ease-glide)] group-hover:rotate-45"
          >
            <IconArrowUpRight size={18} />
          </span>
        </div>
      </Photo>
    </Link>
  );
}

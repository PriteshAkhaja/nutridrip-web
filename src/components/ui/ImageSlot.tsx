import fs from "node:fs";
import path from "node:path";
import Image from "next/image";

/**
 * A photography slot. Real imagery drops into `public/<src>`; until it does,
 * the striped placeholder from the design pack holds the space at exactly the
 * same size, so the layout never shifts when the photo lands.
 */
export function ImageSlot({
  src,
  alt,
  caption,
  width = 520,
  height = 360,
  priority = false,
  sizes = "(max-width: 1024px) 100vw, 46vw",
  className = "",
}: {
  /** Public path, e.g. "/images/home-hero.png". */
  src?: string;
  alt: string;
  caption?: string;
  /** The file's intrinsic size. Getting this right is what stops the layout
   *  shifting when the photo loads, and it sets the placeholder's ratio. */
  width?: number;
  height?: number;
  priority?: boolean;
  /** Rendered width per breakpoint, so Next picks a sharp enough source. */
  sizes?: string;
  className?: string;
}) {
  // Checked on the server at render time — no broken-image flash if the file
  // has not been added yet.
  const exists =
    Boolean(src) && fs.existsSync(path.join(process.cwd(), "public", src!.replace(/^\//, "")));

  return (
    <figure className={`flex flex-col gap-[14px] m-0 ${className}`}>
      {exists ? (
        <Image
          src={src!}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          sizes={sizes}
          className="rounded-[var(--radius-lg)] border border-[var(--color-line-2)] w-full h-auto"
        />
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          style={{ width: "100%", height: "auto", aspectRatio: `${width} / ${height}` }}
          className="rounded-[var(--radius-lg)] border border-[var(--color-line-2)]"
          role="img"
          aria-label={`Placeholder — ${alt}`}
        >
          <defs>
            <pattern
              id={`ndStripe-${width}x${height}`}
              width="8"
              height="8"
              patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse"
            >
              <rect width="4" height="8" fill="var(--color-line)" />
            </pattern>
          </defs>
          <rect width={width} height={height} fill={`url(#ndStripe-${width}x${height})`} />
        </svg>
      )}
      {caption && (
        <figcaption className="t-small text-[var(--color-ink-3)]">
          {exists ? caption : `Placeholder — ${alt}`}
        </figcaption>
      )}
    </figure>
  );
}

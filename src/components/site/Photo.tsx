import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import type { SiteImage } from "@/lib/site-images";

/**
 * A photograph filling a frame. The frame decides the shape (give it an
 * aspect-ratio or a height through `className`); the photograph covers it,
 * cropped around its own focal point so the subject survives any ratio.
 *
 * - `reveal` fades it in, settling from a slight zoom, as it scrolls in.
 *   `reveal="settle"` is for the first screen's photograph: never hidden (it
 *   is the page's largest paint), it only settles, from first paint. See
 *   globals.css for both.
 * - `zoom` eases it in a few percent when an ancestor `.group` is hovered.
 * - `parallax` lets it drift against the scroll where the browser supports
 *   scroll-linked animation; elsewhere it simply sits still.
 *
 * `sizes` matters: it is how the browser picks a sharp-enough file from the
 * srcset instead of downloading the full-width one on a phone.
 *
 * Until the photograph paints, the frame shows its 20px preview (`blur` in the
 * registry) scaled up by the browser, which reads as a soft blur. Not
 * next/image's own blur placeholder: that one is an SVG running two
 * full-size Gaussian blurs, repainted for every photo still loading as it
 * scrolls past, and it only goes once the page's JavaScript has started.
 */
export function Photo({
  image,
  sizes,
  className = "",
  imgClassName = "",
  preload = false,
  reveal = false,
  zoom = false,
  parallax = false,
  decorative = false,
  fill = false,
  position,
  radius,
  children,
}: {
  image: SiteImage;
  sizes: string;
  className?: string;
  imgClassName?: string;
  /** Only for the one image that is the page's largest paint. */
  preload?: boolean;
  reveal?: boolean | "settle";
  zoom?: boolean;
  parallax?: boolean;
  /** The picture adds nothing a screen reader needs; alt is left empty. */
  decorative?: boolean;
  /**
   * Cover the nearest positioned ancestor instead of taking a shape of its own.
   * A separate prop rather than an `absolute` class, because the frame is
   * `relative` by default and Tailwind would let that win over the class.
   */
  fill?: boolean;
  /** Overrides the image's own focal point for this crop. */
  position?: string;
  /** The frame's corner radius. */
  radius?: string;
  children?: ReactNode;
}) {
  const focal = position ?? image.position;
  const img = (
    <Image
      src={image.src}
      alt={decorative ? "" : image.alt}
      fill
      sizes={sizes}
      preload={preload}
      className={`object-cover ${zoom ? "transition-transform duration-[1100ms] ease-[var(--ease-glide)] group-hover:scale-[1.045]" : ""} ${imgClassName}`}
      style={{ objectPosition: focal }}
    />
  );
  const frame: CSSProperties = {
    backgroundImage: `url("${image.blur}")`,
    backgroundSize: "cover",
    backgroundPosition: focal,
    ...(radius ? { borderRadius: radius } : null),
  };

  return (
    <div
      className={`${fill ? "absolute inset-0" : "relative"} overflow-hidden isolate ${className}`}
      data-reveal={reveal === "settle" ? "settle" : reveal ? "image" : undefined}
      style={frame}
    >
      {parallax ? <div className="absolute inset-x-0 -top-[9%] -bottom-[9%] parallax-y">{img}</div> : img}
      {children}
    </div>
  );
}

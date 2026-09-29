import type { ReactNode } from "react";
import type { SiteImage } from "@/lib/site-images";
import { Container, delay } from "./Layout";
import { Photo } from "./Photo";

/**
 * The opening of every inner page: eyebrow, a large heading, the lede, and
 * either a photograph or another block (a form, a card) beside it. It sits on
 * a mist-to-white wash, so each page starts in the same light and the white
 * sections below read as the body.
 *
 * `below` runs under the text column: a row of figures, a search box.
 */
export function PageHero({
  eyebrow,
  title,
  lede,
  actions,
  below,
  image,
  imageSizes = "(min-width: 1024px) 46vw, 100vw",
  imageOverlay,
  aside,
  imageAspect = "aspect-[4/3] lg:aspect-[5/4.4]",
  alignTop = false,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  below?: ReactNode;
  image?: SiteImage;
  imageSizes?: string;
  /** Chips or labels laid over the photograph. */
  imageOverlay?: ReactNode;
  aside?: ReactNode;
  imageAspect?: string;
  /** Top-align the two columns, for a tall block such as a form. */
  alignTop?: boolean;
}) {
  const side = image ? (
    <div className="relative">
      <Photo
        image={image}
        sizes={imageSizes}
        preload
        reveal="settle"
        radius="var(--radius-2xl)"
        className={`${imageAspect} rounded-[var(--radius-2xl)] bg-[var(--color-surface-2)]`}
      />
      {imageOverlay}
    </div>
  ) : (
    aside
  );

  return (
    <section className="relative bg-[linear-gradient(180deg,var(--color-mist)_0%,var(--color-paper)_100%)]">
      <Container
        className={`pt-[calc(var(--site-header-h)+48px)] pb-16 md:pt-[calc(var(--site-header-h)+64px)] md:pb-20 lg:pt-[calc(var(--site-header-h)+80px)] lg:pb-24 ${
          side
            ? `grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:gap-16 ${alignTop ? "items-start" : "items-center"}`
            : ""
        }`}
      >
        <div className={side ? "min-w-0" : "max-w-[68ch]"}>
          <span className="t-eyebrow" data-reveal="hero">
            {eyebrow}
          </span>
          <h1 className="t-display-sm mt-5 max-w-[17ch]" data-reveal="hero" style={delay(60)}>
            {title}
          </h1>
          {lede ? (
            <p className="t-lead mt-6 max-w-[56ch]" data-reveal="hero" style={delay(120)}>
              {lede}
            </p>
          ) : null}
          {actions ? (
            <div className="mt-9 flex flex-wrap gap-3" data-reveal="hero" style={delay(180)}>
              {actions}
            </div>
          ) : null}
          {below ? (
            <div className="mt-10" data-reveal="hero" style={delay(220)}>
              {below}
            </div>
          ) : null}
        </div>
        {side}
      </Container>
    </section>
  );
}

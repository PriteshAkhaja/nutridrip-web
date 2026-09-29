import type { ReactNode } from "react";
import type { SiteImage } from "@/lib/site-images";
import { Container, delay } from "./Layout";
import { Photo } from "./Photo";

/**
 * The closing panel most pages end on: a deep band with the next step in it,
 * and a photograph that fades into the colour rather than stopping at an edge.
 * On a phone the photograph sits above the words instead of behind them.
 */
export function CtaPanel({
  eyebrow,
  title,
  lede,
  actions,
  note,
  image,
  id,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  note?: ReactNode;
  image?: SiteImage;
  id?: string;
}) {
  return (
    <section className="section-y" id={id}>
      <Container>
        <div
          className="on-dark relative isolate overflow-hidden rounded-[var(--radius-2xl)] bg-[var(--color-deep)] text-white md:grid md:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] md:min-h-[440px]"
          data-reveal
        >
          {image ? (
            <div className="relative aspect-[16/10] md:aspect-auto md:order-2">
              <Photo image={image} sizes="(min-width: 768px) 46vw, 100vw" parallax fill />
              {/* Fades the photograph into the band: downward on a phone,
                  leftward beside the text. */}
              <div
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(0deg,var(--color-deep)_0%,rgb(6_37_48/0)_55%)] md:bg-[linear-gradient(90deg,var(--color-deep)_0%,rgb(6_37_48/0.55)_32%,rgb(6_37_48/0)_70%)]"
              />
            </div>
          ) : null}
          <div className="relative z-10 flex flex-col justify-center px-7 pb-12 pt-4 sm:px-10 md:order-1 md:px-14 md:py-16 lg:px-16">
            {eyebrow ? (
              <span className="t-eyebrow" data-reveal style={delay(120)}>
                {eyebrow}
              </span>
            ) : null}
            <h2 className="t-section mt-4 max-w-[16ch]" data-reveal style={delay(180)}>
              {title}
            </h2>
            {lede ? (
              <p className="t-lead mt-5 max-w-[48ch]" data-reveal style={delay(240)}>
                {lede}
              </p>
            ) : null}
            {actions ? (
              <div className="mt-9 flex flex-wrap gap-3" data-reveal style={delay(300)}>
                {actions}
              </div>
            ) : null}
            {note ? (
              <p className="t-small mt-6 text-white/55" data-reveal style={delay(360)}>
                {note}
              </p>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}

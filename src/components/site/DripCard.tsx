import Link from "next/link";
import type { DripCard as Drip } from "@/lib/data/drips";
import { formatInr } from "@/lib/inventory/units";
import { dripImage } from "@/lib/site-images";
import { Pill } from "@/components/ui/Pill";
import { Photo } from "./Photo";
import { IconArrowUpRight } from "./Icons";

/**
 * Availability is a real number, not a marketing badge: in-date, unreserved
 * stock through the same FEFO engine the pharmacist uses. Status colours are
 * used because it is a genuine status, and always with its word.
 */
export function AvailabilityPill({ available }: { available: number }) {
  if (available === 0)
    return (
      <Pill tone="critical" dot>
        Out of stock
      </Pill>
    );
  if (available <= 3)
    return (
      <Pill tone="caution" dot>
        {available} left today
      </Pill>
    );
  return (
    <Pill tone="safe" dot>
      Available
    </Pill>
  );
}

/**
 * A drip as a product: its photograph, then the facts. The photograph eases
 * in and the corner arrow turns on hover; the whole card is one link.
 *
 * `feature` is the editorial card for the home page and "other protocols";
 * `catalogue` adds what someone comparing formulas needs: the description,
 * the headline actives with doses, tags, and live availability.
 */
export function DripCard({
  drip,
  variant = "feature",
  available,
  sizes = "(min-width: 1280px) 290px, (min-width: 1024px) 23vw, (min-width: 640px) 45vw, 82vw",
  preload = false,
}: {
  drip: Drip;
  variant?: "feature" | "catalogue";
  /** Whole-vial availability; the catalogue shows it on the photograph. */
  available?: number;
  sizes?: string;
  /** For the one card whose photograph is the page's largest paint. */
  preload?: boolean;
}) {
  const image = dripImage(drip.slug, drip.category);
  const catalogue = variant === "catalogue";

  return (
    <Link
      href={`/drips/${drip.slug}`}
      prefetch={false}
      className="group flex h-full flex-col no-underline hover:no-underline text-[var(--color-ink)]"
    >
      <Photo
        image={image}
        sizes={sizes}
        preload={preload}
        zoom
        className={`${catalogue ? "aspect-[4/3]" : "aspect-[4/5]"} rounded-[var(--radius-xl)] bg-[var(--color-surface-2)]`}
      >
        <span className="absolute left-4 top-4 inline-flex items-center gap-[6px] rounded-full bg-white px-3 py-[6px] text-[12px] font-semibold tracking-[0.02em] text-[var(--color-ink)]">
          {drip.icon ? (
            <span aria-hidden className="text-[13px] leading-none">
              {drip.icon}
            </span>
          ) : null}
          {drip.category}
        </span>
        {catalogue && available !== undefined ? (
          <span className="absolute right-4 top-4">
            <AvailabilityPill available={available} />
          </span>
        ) : null}
        <span
          aria-hidden
          className="absolute bottom-4 right-4 w-11 h-11 rounded-full bg-white text-[var(--color-ink)] inline-flex items-center justify-center shadow-[0_6px_20px_-8px_rgba(6,37,48,0.45)] transition-[transform,background-color,color] duration-500 ease-[var(--ease-glide)] group-hover:rotate-45 group-hover:bg-[var(--color-ink)] group-hover:text-white"
        >
          <IconArrowUpRight size={18} />
        </span>
      </Photo>

      <div className="flex flex-1 flex-col pt-5">
        <div className="flex items-center justify-between gap-3 t-small text-[var(--color-ink-3)]">
          <span>{drip.durationLabel}</span>
          {drip.isPopular && catalogue ? (
            <span className="font-medium text-[var(--color-primary-text)]">Most popular</span>
          ) : null}
        </div>
        <h3 className="t-title mt-2 transition-colors duration-200 group-hover:text-[var(--color-primary-text)]">
          {drip.name}
        </h3>
        <p className="t-body text-[var(--color-ink-2)] mt-2">
          {catalogue ? drip.description : (drip.tagline ?? drip.description)}
        </p>

        {catalogue && drip.headline.length > 0 ? (
          <ul className="list-none m-0 p-0 mt-4 flex flex-col gap-[6px]" aria-label="Headline ingredients">
            {drip.headline.map((h) => (
              <li key={h} className="t-data text-[13px] text-[var(--color-ink-2)]">
                {h}
              </li>
            ))}
          </ul>
        ) : null}

        {catalogue && drip.tags.length > 0 ? (
          <div className="flex flex-wrap gap-[6px] mt-4">
            {drip.tags.map((t) => (
              <span
                key={t}
                className="t-small rounded-full px-[10px] py-[3px] border border-[var(--color-line-2)] text-[var(--color-ink-2)]"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}

        {/* mt-auto only distributes the surplus; the fixed gap above it lives
            on the padding, so the footer never touches the text on the
            tallest card in a row. */}
        <div className="mt-auto pt-5">
          {/* Wraps rather than squeezes: four cards to a row at 1024 are about
              210px wide, too narrow for the price and the details on one line. */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-[var(--color-line)] pt-4">
            <span className="t-data text-[18px] leading-none">{formatInr(drip.priceInr)}</span>
            <span className="t-small text-[var(--color-ink-3)] whitespace-nowrap">
              {[drip.volumeMl ? `${drip.volumeMl} ml` : null, `${drip.ingredientCount} components`]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

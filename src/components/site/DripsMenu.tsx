import Link from "next/link";
import type { DripCard } from "@/lib/data/drips";
import { CATEGORIES } from "@/lib/data/marketing";
import { formatInr } from "@/lib/inventory/units";
import { dripImage } from "@/lib/site-images";
import { Arrow } from "@/components/ui/Arrow";
import { Photo } from "./Photo";

/**
 * What opens under "Drips" in the header, on a wide screen: the goals the
 * catalogue is sorted by, each with its count and a line on what it is for,
 * and the drips the super admin marked "Most popular" — the same set the home
 * page calls Most booked, so the two never disagree.
 *
 * A goal with nothing on the public catalogue is left out rather than shown
 * with a zero; with nothing marked popular the goals take the whole width.
 * The photographs are small lazy loads inside a closed menu, so nothing is
 * fetched until someone opens it.
 */
export function DripsMenu({ drips }: { drips: DripCard[] }) {
  const counts = new Map<string, number>();
  for (const d of drips) counts.set(d.category, (counts.get(d.category) ?? 0) + 1);
  const goals = CATEGORIES.filter((c) => (counts.get(c.slug) ?? 0) > 0);
  const popular = drips.filter((d) => d.isPopular).slice(0, 3);

  return (
    <div className="p-2">
      <div className={`grid gap-2 ${popular.length > 0 ? "grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]" : "grid-cols-1"}`}>
        <div className="p-3">
          <p className="t-micro">Browse by goal</p>
          <ul className="mt-2 grid list-none grid-cols-2 gap-1 p-0">
            {goals.map((g) => (
              <li key={g.slug}>
                <Link
                  href={`/drips?goal=${encodeURIComponent(g.slug)}`}
                  prefetch={false}
                  className="flex flex-col gap-[2px] rounded-[14px] px-3 py-[10px] no-underline transition-colors duration-200 hover:bg-[var(--color-surface-2)] hover:no-underline"
                >
                  <span className="flex items-baseline gap-2 text-[14.5px] font-semibold text-[var(--color-ink)]">
                    {g.name}
                    <span className="t-data text-[12px] font-normal text-[var(--color-ink-3)]">
                      {counts.get(g.slug)}
                    </span>
                  </span>
                  <span className="t-small text-[var(--color-ink-2)]">{g.blurb}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {popular.length > 0 ? (
          <div className="rounded-[18px] bg-[var(--color-mist)] p-3">
            <p className="t-micro">Most booked</p>
            <ul className="mt-2 flex list-none flex-col gap-1 p-0">
              {popular.map((d) => (
                <li key={d.slug}>
                  <Link
                    href={`/drips/${d.slug}`}
                    prefetch={false}
                    className="group flex items-center gap-3 rounded-[14px] p-2 no-underline transition-colors duration-200 hover:bg-white hover:no-underline"
                  >
                    <Photo
                      image={dripImage(d.slug, d.category)}
                      sizes="56px"
                      zoom
                      decorative
                      radius="12px"
                      className="h-14 w-14 flex-none bg-[var(--color-surface-2)]"
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[14.5px] font-semibold text-[var(--color-ink)]">{d.name}</span>
                      <span className="t-small text-[var(--color-ink-2)]">
                        <span className="t-data">{formatInr(d.priceInr)}</span> · {d.durationLabel}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="mt-1 flex items-center justify-between gap-4 border-t border-[var(--color-line)] px-5 pb-2 pt-3">
        <Link
          href="/drips"
          prefetch={false}
          className="t-small font-semibold link-sweep no-underline hover:no-underline"
        >
          See all {drips.length} drips <Arrow />
        </Link>
        <Link
          href="/pricing"
          prefetch={false}
          className="t-small text-[var(--color-ink-2)] link-sweep no-underline hover:text-[var(--color-ink)] hover:no-underline"
        >
          What a session costs
        </Link>
      </div>
    </div>
  );
}

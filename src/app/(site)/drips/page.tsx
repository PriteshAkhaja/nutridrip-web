import Link from "next/link";
import type { Metadata } from "next";
import { listDrips } from "@/lib/data/drips";
import { formatInr } from "@/lib/inventory/units";
import { checkAvailability } from "@/lib/inventory/availability";
import { Pill } from "@/components/ui/Pill";
import { Stars, SectionHeading } from "@/components/ui/Marketing";
import { SearchBox } from "@/components/ui/SearchBox";
import { filterDrips, noMatchMessage } from "@/lib/data/drip-search";
import { DRIP_CATEGORIES } from "@/lib/models/types";

export const metadata: Metadata = { title: "Drips" };
export const dynamic = "force-dynamic";

/** From the one list, so a category added there appears here without a code hunt. */
const GOALS = DRIP_CATEGORIES;

/**
 * Availability is a real number here, not a marketing badge: it comes from
 * in-date, unreserved stock through the same FEFO engine the pharmacist uses.
 */
function availabilityPill(available: number) {
  if (available === 0) return <Pill tone="critical" dot>Out of stock</Pill>;
  if (available <= 3) return <Pill tone="caution" dot>{available} left today</Pill>;
  return <Pill tone="safe" dot>Available</Pill>;
}

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ goal?: string; q?: string }>;
}) {
  const { goal, q } = await searchParams;
  const all = await listDrips();
  // Goal narrows first, then the search runs inside it — so the chips and the
  // box compose rather than fight each other.
  const byGoal = goal ? all.filter((d) => d.category === goal) : all;
  const drips = filterDrips(
    // Tags as well as ingredients, so "NAD+" finds a drip whose name never says it.
    byGoal.map((d) => ({ ...d, keywords: [...d.headline, ...d.tags] })),
    q ?? ""
  );

  const availability = await checkAvailability(
    drips.map((d) => ({ dripId: d.id, quantity: 1 })),
    true
  );
  const availableByDrip = new Map(
    availability.results.map((r) => [r.dripId, r.wholeVialAvailability])
  );

  const counts = new Map<string, number>();
  for (const d of all) counts.set(d.category, (counts.get(d.category) ?? 0) + 1);

  return (
    <div className="mx-auto max-w-[1280px] px-6 md:px-10 py-12">
      <SectionHeading
        eyebrow="Catalogue"
        title={`${all.length} protocols, every dose published`}
        sub="Each formula is a fixed recipe a physician can adjust for you. Availability is live — it counts only in-date stock that is not already promised to another session."
      />

      <SearchBox
        basePath="/drips"
        q={q}
        keep={{ goal }}
        placeholder="Search by name, goal or ingredient"
        label="Search drips"
        className="max-w-[420px] mb-8"
      />

      {drips.length === 0 && (
        <p className="t-body text-[var(--color-ink-2)] mb-8">{noMatchMessage(q ?? "")}</p>
      )}

      {/* Goal filter */}
      <div className="flex flex-wrap gap-[10px] mb-8">
        <Link
          href={q ? `/drips?q=${encodeURIComponent(q)}` : "/drips"}
          className={`inline-flex items-center gap-[9px] rounded-full px-[14px] py-[7px] border no-underline hover:no-underline ${
            goal
              ? "border-[var(--color-line-2)] bg-[var(--color-surface)] text-[var(--color-ink)]"
              : "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
          }`}
          style={{ font: "500 13px/1.4 var(--font-sans)" }}
        >
          All
          <span className="t-data text-[13px] opacity-70">{all.length}</span>
        </Link>
        {GOALS.map((g) => {
          const active = goal === g;
          return (
            <Link
              key={g}
              href={`/drips?goal=${encodeURIComponent(g)}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`inline-flex items-center gap-[9px] rounded-full px-[14px] py-[7px] border no-underline hover:no-underline ${
                active
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                  : "border-[var(--color-line-2)] bg-[var(--color-surface)] text-[var(--color-ink)]"
              }`}
              style={{ font: "500 13px/1.4 var(--font-sans)" }}
            >
              {g}
              <span className="t-data text-[13px] opacity-70">{counts.get(g) ?? 0}</span>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {drips.map((d) => {
          const available = availableByDrip.get(d.id) ?? 0;
          return (
            <Link
              key={d.slug}
              href={`/drips/${d.slug}`}
              className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 no-underline hover:no-underline hover:border-[var(--color-ink)] transition-colors duration-150 flex flex-col gap-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex gap-3">
                  {/* An emoji, not a colour: the palette keeps its clinical
                      hues for genuine status, so a card earns identity here
                      without spending one. */}
                  {d.icon && (
                    <span aria-hidden="true" className="text-[26px] leading-none flex-none">
                      {d.icon}
                    </span>
                  )}
                  <div className="min-w-0">
                    <span className="t-micro">{d.category}</span>
                    <h2 className="t-h3 mt-1">{d.name}</h2>
                    <div className="mt-2"><Stars rating={5} size={12} /></div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-none">
                  {availabilityPill(available)}
                  {d.isPopular && <Pill tone="primary">Most popular</Pill>}
                </div>
              </div>

              <p className="t-body text-[var(--color-ink-2)]">{d.description}</p>

              <ul className="flex flex-col gap-[6px] list-none p-0 m-0">
                {d.headline.map((h) => (
                  <li key={h} className="t-data text-[13px] text-[var(--color-ink-2)]">
                    {h}
                  </li>
                ))}
              </ul>

              {d.tags.length > 0 && (
                <div className="flex flex-wrap gap-[6px]">
                  {d.tags.map((t) => (
                    <span
                      key={t}
                      className="t-small rounded-full px-[10px] py-[3px] border border-[var(--color-line-2)] text-[var(--color-ink-2)]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-6 pt-4 mt-auto border-t border-[var(--color-line)]">
                <div className="flex flex-col">
                  <span className="t-micro">Price</span>
                  <span className="t-data text-[16px] leading-[1.4]">{formatInr(d.priceInr)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="t-micro">Duration</span>
                  <span className="t-data text-[16px] leading-[1.4]">{d.durationLabel}</span>
                </div>
                {d.volumeMl && (
                  <div className="flex flex-col">
                    <span className="t-micro">Volume</span>
                    <span className="t-data text-[16px] leading-[1.4]">{d.volumeMl} ml</span>
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="t-micro">Ingredients</span>
                  <span className="t-data text-[16px] leading-[1.4]">{d.ingredientCount}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

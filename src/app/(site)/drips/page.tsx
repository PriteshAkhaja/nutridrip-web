import Link from "next/link";
import type { Metadata } from "next";
import { listDrips } from "@/lib/data/drips";
import { checkAvailability } from "@/lib/inventory/availability";
import { SearchBox } from "@/components/ui/SearchBox";
import { filterDrips, noMatchMessage } from "@/lib/data/drip-search";
import { DRIP_CATEGORIES } from "@/lib/models/types";
import { PageHero } from "@/components/site/PageHero";
import { Container, delay } from "@/components/site/Layout";
import { DripCard } from "@/components/site/DripCard";
import { CtaPanel } from "@/components/site/CtaPanel";
import { QuizButton } from "@/components/layout/QuizButton";
import { ButtonLink } from "@/components/ui/Button";
import { SITE_IMAGES } from "@/lib/site-images";

export const metadata: Metadata = { title: "Drips" };
export const dynamic = "force-dynamic";

/** From the one list, so a category added there appears here without a code hunt. */
const GOALS = DRIP_CATEGORIES;

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

  // Availability is a real number here, not a marketing badge: it comes from
  // in-date, unreserved stock through the same FEFO engine the pharmacist uses.
  const availability = await checkAvailability(
    drips.map((d) => ({ dripId: d.id, quantity: 1 })),
    true
  );
  const availableByDrip = new Map(availability.results.map((r) => [r.dripId, r.wholeVialAvailability]));

  const counts = new Map<string, number>();
  for (const d of all) counts.set(d.category, (counts.get(d.category) ?? 0) + 1);

  const chip = (active: boolean) =>
    `inline-flex min-h-[40px] items-center gap-[9px] rounded-full px-4 border no-underline hover:no-underline transition-colors duration-200 ${
      active
        ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-white"
        : "border-[var(--color-line-2)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-[var(--color-ink)]"
    }`;

  return (
    <>
      <PageHero
        eyebrow="Catalogue"
        title={
          <>
            {all.length} protocols, <span className="tone-2">every dose published.</span>
          </>
        }
        lede="Each formula is a fixed recipe a physician can adjust for you. Availability is live — it counts only in-date stock that is not already promised to another session."
        below={
          <SearchBox
            basePath="/drips"
            q={q}
            keep={{ goal }}
            placeholder="Search by name, goal or ingredient"
            label="Search drips"
            className="max-w-[460px]"
          />
        }
      />

      <section className="pb-4">
        <Container>
          {/* Goal filter. Links, not buttons: every filter is a URL someone
              can share, and it works with JavaScript off. scroll={false}: a
              filter re-sorts the grid below, so the page stays where it is
              instead of jumping back to the top like a new page would. */}
          <nav
            aria-label="Filter by goal"
            // The snap padding matches the side padding: a rail snaps its row
            // to the snap edge, and without it the first chip sat flush
            // against the side of a phone.
            className="-mx-6 overflow-x-auto px-6 scroll-px-6 rail md:mx-0 md:overflow-visible md:px-0 md:scroll-px-0"
          >
            <ul className="flex w-max gap-2 list-none m-0 p-0 md:w-auto md:flex-wrap">
              <li>
                <Link
                  href={q ? `/drips?q=${encodeURIComponent(q)}` : "/drips"}
                  scroll={false}
                  aria-current={!goal ? "page" : undefined}
                  className={chip(!goal)}
                  style={{ font: "500 13.5px/1.2 var(--font-sans)" }}
                >
                  All
                  <span className="t-data text-[12.5px] opacity-70">{all.length}</span>
                </Link>
              </li>
              {GOALS.map((g) => {
                const active = goal === g;
                return (
                  <li key={g}>
                    <Link
                      href={`/drips?goal=${encodeURIComponent(g)}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                      scroll={false}
                      aria-current={active ? "page" : undefined}
                      className={chip(active)}
                      style={{ font: "500 13.5px/1.2 var(--font-sans)" }}
                    >
                      {g}
                      <span className="t-data text-[12.5px] opacity-70">{counts.get(g) ?? 0}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <p className="t-small text-[var(--color-ink-3)] mt-6" aria-live="polite">
            {drips.length === all.length
              ? `Showing all ${all.length} drips`
              : `Showing ${drips.length} of ${all.length} drips`}
          </p>
        </Container>
      </section>

      <section className="pb-[var(--section-y)] pt-6">
        <Container>
          {drips.length === 0 ? (
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-mist)] p-8 md:p-10">
              <p className="t-body-lg text-[var(--color-ink)]">{noMatchMessage(q ?? "")}</p>
              <div className="mt-5">
                <ButtonLink href="/drips" scroll={false} variant="secondary">
                  Clear the search
                </ButtonLink>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              {drips.map((d, i) => (
                <div key={d.slug} data-reveal style={delay((i % 3) * 90)}>
                  <DripCard
                    drip={d}
                    variant="catalogue"
                    // The first photograph is the page's largest paint: fetch it first.
                    preload={i === 0}
                    available={availableByDrip.get(d.id) ?? 0}
                    sizes="(min-width: 1280px) 390px, (min-width: 1024px) 31vw, (min-width: 640px) 46vw, 92vw"
                  />
                </div>
              ))}
            </div>
          )}
        </Container>
      </section>

      <CtaPanel
        eyebrow="Not sure which?"
        title="Let a physician choose with you."
        lede="Take the health quiz. A registered physician reads it, then approves a protocol, changes the doses, or tells you what would suit you better."
        actions={
          <>
            <QuizButton size="lg">Take the health quiz</QuizButton>
            <ButtonLink href="/consult" size="lg" variant="secondary">
              Ask a clinician
            </ButtonLink>
          </>
        }
        image={SITE_IMAGES.dripStand}
      />
    </>
  );
}

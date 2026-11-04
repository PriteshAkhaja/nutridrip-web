import Link from "next/link";
import type { Metadata } from "next";
import { listDrips } from "@/lib/data/drips";
import { listAssemblyDrips } from "@/lib/data/assembly";
import { checkAvailability } from "@/lib/inventory/availability";
import { uploadedDripPhotos } from "@/lib/media/resolve";
import { DRIP_CATEGORIES } from "@/lib/models/types";
import { DripsMotion } from "@/components/site/drips/DripsMotion";
import { DripsBrowser, type ListDrip } from "@/components/site/drips/DripsBrowser";
import { Cta } from "@/components/site/v3/Cta";
import { word } from "@/components/site/home/format";
// The drip card it shares with the landing, and the page's own styles,
// scoped to .sc-site (scripts/scope-site-css.mjs).
import "@/components/site/v3/styles/scoped/fcard.css";
import "@/components/site/v3/styles/scoped/drips.css";
import { Crumbs } from "@/components/site/v3/Crumbs";

export const metadata: Metadata = {
  title: "Drips",
  description:
    "Every NutriDrip drip with every dose: what is in the bag, what is given beside it, how long it takes and what it costs.",
};
export const dynamic = "force-dynamic";

/**
 * The Drips list, in the client's design (approved prototype:
 * scrollcraft/builds/drips-v3): the landing formulary's cards as a grid, with
 * the goal filter and the search. A Light page (AGENTS.md).
 */
export default async function DripsPage() {
  const [catalogue, cards, photoOf] = await Promise.all([listAssemblyDrips(), listDrips(), uploadedDripPhotos()]);
  // The catalogue read gives each drip's containers and colour; the card read
  // gives its stock id, its tags and its goal (with the fallback for rows
  // older than the field), so the chips and the cards agree.
  const bySlug = new Map(cards.map((c) => [c.slug, c]));
  // Availability is real: in-date stock not promised to another session, as
  // the pharmacist sees it. Shown on a card only when low or out.
  const { results } = await checkAvailability(
    cards.map((c) => ({ dripId: c.id, quantity: 1 })),
    true
  );
  const stockOf = new Map(results.map((r) => [r.dripId, r.wholeVialAvailability]));

  const drips: ListDrip[] = catalogue.map((d) => {
    const c = bySlug.get(d.slug);
    return {
      drip: { ...d, category: c?.category ?? d.category },
      keywords: [
        ...d.items.map((i) => i.name),
        d.carrier?.name ?? "",
        ...(c?.headline ?? []),
        ...(c?.tags ?? []),
        d.tagline ?? "",
      ].filter(Boolean),
      photo: photoOf(d.slug),
      stock: c ? (stockOf.get(c.id) ?? null) : null,
    };
  });
  // Only goals that have a drip: a chip leading to an empty list helps no one.
  const goals = DRIP_CATEGORIES.map((g) => ({
    name: g,
    count: drips.filter((x) => x.drip.category === g).length,
  })).filter((g) => g.count > 0);
  const n = drips.length;
  const count = word(n).replace(/^./, (c) => c.toUpperCase());

  return (
    <DripsMotion>
      {n ? (
        <DripsBrowser drips={drips} goals={goals}>
          <Crumbs trail={[{ name: "Drips" }]} />
          <h1 className="nd-q">
            {count} drip{n === 1 ? "" : "s"}, every dose published.
          </h1>
          <p className="nd-lede">
            Each is a fixed recipe a physician can adjust for you. Prices are per session, everything included.
          </p>
        </DripsBrowser>
      ) : (
        // No public drip: say so, and keep the way to the quiz.
        <section className="nd-pagehead">
          <div className="nd-wrap">
            <h1 className="nd-q">Our drips are being updated.</h1>
            <p className="nd-lede">The health quiz is open, and a physician reads every answer.</p>
          </div>
        </section>
      )}

      <section className="sc-section dl-end" aria-labelledby="end-h">
        <div className="nd-wrap">
          <div className="dl-end__in" data-sc-in="">
            <h2 id="end-h" className="nd-q nd-q--sm">
              Not sure which?
            </h2>
            <p className="nd-body">
              Take the health quiz. A registered physician reads it, then approves a protocol, changes the doses, or
              tells you what would suit you better.
            </p>
            <div className="dl-end__acts">
              <Cta />
              <Link className="nd-btn nd-btn--ghost" href="/consult" prefetch={false}>
                Ask a clinician
              </Link>
            </div>
          </div>
        </div>
      </section>
    </DripsMotion>
  );
}

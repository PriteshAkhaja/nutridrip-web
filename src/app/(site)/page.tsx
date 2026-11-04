import { getContent } from "@/lib/content";
import { getLatePolicy } from "@/lib/billing/settings";
import { fillLatePolicy } from "@/lib/billing/late-policy";
import { getZones } from "@/lib/zones-store";
import { fillZoneCount, servedZones } from "@/lib/zones";
import { FAQS } from "@/lib/data/marketing";
import { listAssemblyDrips } from "@/lib/data/assembly";
import { uploadedDripPhotos } from "@/lib/media/resolve";
import { Landing } from "@/components/site/home/Landing";
import { Cta } from "@/components/site/v3/Cta";
// The landing page's own styles, the glass, label and liquid it shares with
// the drip page, and the drip card it shares with the Drips list, scoped to
// .sc-site (scripts/scope-site-css.mjs).
import "@/components/site/v3/styles/scoped/glass.css";
import "@/components/site/v3/styles/scoped/fcard.css";
import "@/components/site/v3/styles/scoped/home.css";

export const dynamic = "force-dynamic";

/** The drip the page builds first: the default first drip. */
const HOME_DRIP = "myers-revive";

export default async function HomePage() {
  const [drips, copy, zones, late, photoOf] = await Promise.all([
    listAssemblyDrips(),
    getContent(),
    getZones(),
    getLatePolicy(),
    uploadedDripPhotos(),
  ]);

  // With no public drip there is nothing to build or list: say so, and keep
  // the way to the quiz.
  if (!drips.length) {
    return (
      <section className="sc-section" style={{ paddingTop: "calc(var(--bar-h) + 4rem)" }}>
        <div className="nd-wrap sc-stack">
          <h1 className="nd-q">{copy["home.headline"]}</h1>
          <p className="nd-lede">
            Our drips are being updated. The health quiz is open, and a physician reads every answer.
          </p>
          <Cta />
        </div>
      </section>
    );
  }

  const chosen = drips.find((d) => d.slug === HOME_DRIP) ?? drips.find((d) => d.isPopular) ?? drips[0];
  return (
    <Landing
      drips={drips}
      chosen={chosen}
      copy={copy}
      zoneCount={servedZones(zones).length}
      late={late}
      faqs={FAQS.map((f) => ({ q: f.q, a: fillZoneCount(fillLatePolicy(f.a, late), zones) }))}
      photos={Object.fromEntries(drips.map((d) => [d.slug, photoOf(d.slug)]))}
    />
  );
}

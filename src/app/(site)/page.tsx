import { preload } from "react-dom";
import { getContent } from "@/lib/content";
import { getHomeData } from "@/lib/data/home-v5";
import { HomeV5 } from "@/components/site/home/v5/HomeV5";
import { HOME_V5_BOOT } from "@/components/site/home/v5/port/boot";
import { HOME_V5_PRELOADS } from "@/components/site/home/v5/port/preloads";
import { Cta } from "@/components/site/v3/Cta";
// The home page's stylesheet, ported from the preview and scoped to .sc-site .hv5 (scripts/port-home-v5.mjs).
import "@/components/site/home/v5/port/home-v5.css";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Asked for before the first paint, as the preview's head does: the wall, the bag, the heading's fonts and the
  // page script, or the page paints pale in a stand-in font and changes again as each arrives. Called before any
  // await: after one, React no longer sends them with the page.
  for (const { href, ...options } of HOME_V5_PRELOADS) preload(href, options);
  preload(HOME_V5_BOOT, { as: "script", fetchPriority: "high" });

  const data = await getHomeData();

  // With no public drip there is nothing to show on the ring or the bench: say so, and keep the way to the quiz.
  if (!data.drips.length) {
    const copy = await getContent();
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

  return <HomeV5 data={data} />;
}

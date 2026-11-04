import type { Metadata } from "next";
import { getContent } from "@/lib/content";
import { uploadedSiteImages } from "@/lib/media/resolve";
import { About } from "@/components/site/about/About";
import { getBookFacts } from "@/components/site/v3/BookSection";
// The page's own styles, scoped to .sc-site (scripts/scope-site-css.mjs).
import "@/components/site/v3/styles/scoped/about.css";

export const metadata: Metadata = {
  title: "About",
  description:
    "Who NutriDrip is, what each team can and cannot do, and the numbers that describe the service today: all of them counted, none of them rounded up.",
};

// The figures are counted live, and the paragraphs are editable copy.
export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const [copy, facts, uploaded] = await Promise.all([getContent(), getBookFacts(), uploadedSiteImages()]);
  return (
    <About
      copy={copy}
      facts={facts}
      // The same counts as the home page's: the public drips and the served zones.
      figures={{ drips: facts.drips.length, zones: facts.zoneCount }}
      photos={{
        physicians: uploaded("about.physicians"),
        nurses: uploaded("about.nurses"),
        pharmacy: uploaded("about.pharmacy"),
      }}
    />
  );
}

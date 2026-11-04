import type { Metadata } from "next";
import { Safety } from "@/components/site/safety/Safety";
import { getBookFacts } from "@/components/site/v3/BookSection";
import { siteImages } from "@/lib/media/resolve";
// The page's own styles, scoped to .sc-site (scripts/scope-site-css.mjs).
import "@/components/site/v3/styles/scoped/safety.css";

export const metadata: Metadata = {
  title: "Safety",
  description:
    "Where the safety actually sits: a named physician, a 29-step checklist a nurse cannot skip, vitals that block the infusion, and batch numbers recorded per session.",
};

// The slip's figures and the first screen's photo are read, not typed here.
export const dynamic = "force-dynamic";

export default async function SafetyPage() {
  const [facts, img] = await Promise.all([getBookFacts(), siteImages()]);
  return <Safety facts={facts} hero={img("safety.hero")} />;
}

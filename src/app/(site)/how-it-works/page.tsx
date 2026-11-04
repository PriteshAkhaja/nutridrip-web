import type { Metadata } from "next";
import { getLatePolicy } from "@/lib/billing/settings";
import { latePolicySentence } from "@/lib/billing/late-policy";
import { HowItWorks } from "@/components/site/hiw/HowItWorks";
import { getBookFacts } from "@/components/site/v3/BookSection";
import { siteImages } from "@/lib/media/resolve";
// The page's own styles, scoped to .sc-site (scripts/scope-site-css.mjs).
import "@/components/site/v3/styles/scoped/hiw.css";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "From the health quiz to the session report: who reviews you, what the nurse does at your door, and what is written down at every step.",
};

// The late-change rule and the slip's figures are read, not typed here.
export const dynamic = "force-dynamic";

export default async function HowItWorksPage() {
  const [facts, late, img] = await Promise.all([getBookFacts(), getLatePolicy(), siteImages()]);
  return <HowItWorks facts={facts} latePolicy={latePolicySentence(late)} hero={img("how-it-works.hero")} />;
}

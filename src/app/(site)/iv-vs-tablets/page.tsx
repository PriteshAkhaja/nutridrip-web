import type { Metadata } from "next";
import { getContent } from "@/lib/content";
import { IvTabs } from "@/components/site/ivtabs/IvTabs";
import { getBookFacts } from "@/components/site/v3/BookSection";
// The page's own styles, scoped to .sc-site (scripts/scope-site-css.mjs).
import "@/components/site/v3/styles/scoped/ivtabs.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "IV vs Tablets · NutriDrip",
  description:
    "How tablets are absorbed compared with an IV drip, when tablets are enough, and when a physician may choose IV.",
};

export default async function IvVsTabletsPage() {
  // The IV's running time and the slip's range come from every public drip;
  // the client's 45 to 60 minutes was not ours. No drip: no figures.
  const [copy, facts] = await Promise.all([getContent(), getBookFacts()]);
  return <IvTabs copy={copy} facts={facts} />;
}

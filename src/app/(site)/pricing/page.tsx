import type { Metadata } from "next";
import { listAssemblyDrips } from "@/lib/data/assembly";
import { getLatePolicy } from "@/lib/billing/settings";
import { getZones } from "@/lib/zones-store";
import { faqCategories } from "@/lib/data/faqs";
import { Pricing } from "@/components/site/pricing/Pricing";
import { getBookFacts } from "@/components/site/v3/BookSection";
// The page's own styles, scoped to .sc-site (scripts/scope-site-css.mjs).
import "@/components/site/v3/styles/scoped/pricing.css";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "One price per session, by drip: the physician, the nurse visit, the sealed kit and the drip itself. When a session is refunded, and the late-change rule.",
};

// Prices, the late-change rule and the zones are read, not typed here.
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const [drips, late, zones, facts] = await Promise.all([
    listAssemblyDrips(),
    getLatePolicy(),
    getZones(),
    getBookFacts(),
  ]);
  // The booking questions, and the pincode one, as the FAQs page answers them.
  const cats = faqCategories(late, zones);
  const faqs = [
    ...(cats.find((c) => c.id === "booking")?.items ?? []),
    ...(cats.find((c) => c.id === "before")?.items.filter((f) => /pincode/i.test(f.q)) ?? []),
  ];
  return <Pricing drips={drips} late={late} faqs={faqs} facts={facts} />;
}

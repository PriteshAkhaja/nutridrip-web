import type { Metadata } from "next";
import { getContent } from "@/lib/content";
import { getZones } from "@/lib/zones-store";
import { servedZones } from "@/lib/zones";
import { Consult } from "@/components/site/consult/Consult";
// The page's own styles, scoped to .sc-site (scripts/scope-site-css.mjs).
import "@/components/site/v3/styles/scoped/consult.css";

export const metadata: Metadata = {
  title: "Ask a clinician",
  description:
    "Not sure whether IV therapy is right for you? Leave a question and our clinical team will get back to you. Nothing is booked and nothing is charged.",
};

// The wording of what happens next is editable site copy.
export const dynamic = "force-dynamic";

export default async function ConsultPage() {
  const [copy, zones] = await Promise.all([getContent(), getZones()]);
  return <Consult copy={copy} zones={servedZones(zones)} />;
}

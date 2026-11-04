import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDrip, listDrips } from "@/lib/data/drips";
import { getAssemblyDrip } from "@/lib/data/assembly";
import { checkAvailability } from "@/lib/inventory/availability";
import { getLatePolicy } from "@/lib/billing/settings";
import { fillLatePolicy } from "@/lib/billing/late-policy";
import { getZones } from "@/lib/zones-store";
import { fillZoneCount, servedZones } from "@/lib/zones";
import { FAQS } from "@/lib/data/marketing";
import { DripPage } from "@/components/site/drip/DripPage";
import { uploadedDripPhotos } from "@/lib/media/resolve";
// The page's own styles, and the glass, label and liquid it shares with the
// landing, scoped to .sc-site (scripts/scope-site-css.mjs).
import "@/components/site/v3/styles/scoped/glass.css";
import "@/components/site/v3/styles/scoped/drip.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const drip = await getDrip(slug);
  // No drip: the page throws notFound(), and the tab says so.
  return drip ? { title: drip.name, description: drip.description } : { title: "Drip not found" };
}

export default async function DripDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [drip, assembly, all, late, zones, photoOf] = await Promise.all([
    getDrip(slug),
    getAssemblyDrip(slug),
    listDrips(),
    getLatePolicy(),
    getZones(),
    uploadedDripPhotos(),
  ]);
  if (!drip) notFound();
  // The same public drip, read for its containers: missing only when that read
  // failed, and the page is its ingredients, so it does not render without them.
  if (!assembly) throw new Error(`The ingredients of ${slug} could not be read.`);

  const { results } = await checkAvailability([{ dripId: drip.id, quantity: 1 }], true);
  const stock = results[0]?.wholeVialAvailability ?? null;

  // Read next: the rest of its category; with none, the three nearest in price.
  const others = all.filter((d) => d.slug !== drip.slug && d.category === drip.category);
  const also = others.length
    ? { label: `Also in ${drip.category.toLowerCase()}:`, drips: others }
    : {
        label: "Other drips:",
        drips: all
          .filter((d) => d.slug !== drip.slug)
          .sort((a, b) => Math.abs(a.priceInr - drip.priceInr) - Math.abs(b.priceInr - drip.priceInr))
          .slice(0, 3),
      };

  return (
    <DripPage
      drip={drip}
      assembly={assembly}
      also={{ label: also.label, drips: also.drips.map((d) => ({ slug: d.slug, name: d.name })) }}
      faqs={FAQS.map((f) => ({ q: f.q, a: fillZoneCount(fillLatePolicy(f.a, late), zones) }))}
      zoneCount={servedZones(zones).length}
      late={late}
      stock={stock}
      photo={photoOf(drip.slug)}
    />
  );
}

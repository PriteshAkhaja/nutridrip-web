import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDrip, listDrips } from "@/lib/data/drips";
import { getAssemblyDrip, lastBookableSlot } from "@/lib/data/assembly";
import { checkAvailability } from "@/lib/inventory/availability";
import { getLatePolicy } from "@/lib/billing/settings";
import { fillLatePolicy } from "@/lib/billing/late-policy";
import { getZones } from "@/lib/zones-store";
import { fillZoneCount, servedZones } from "@/lib/zones";
import { FAQS } from "@/lib/data/marketing";
import { DripPage } from "@/components/site/drip/DripPage";
import { uploadedDripPhotos } from "@/lib/media/resolve";
import { getContent } from "@/lib/content";
import { getClockFormat } from "@/lib/settings/clock";
import { clockOf } from "@/lib/time";
import { feelImage } from "@/lib/feel";
// The page's own styles, and the glass, label and liquid it shares with the
// landing, scoped to .sc-site (scripts/scope-site-css.mjs).
import "@/components/site/v3/styles/scoped/glass.css";
import "@/components/site/v3/styles/scoped/drip.css";
import "@/components/site/v3/styles/scoped/drip-build.css";

export const dynamic = "force-dynamic";

/** The clock while a drip runs: "HH:MM" every 5 minutes from `start` until `minutes` later. */
function runClock(start: string, minutes: number): string[] {
  const [h, m] = start.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m) || !(minutes > 0)) return [];
  const out: string[] = [];
  for (let k = 0; k <= minutes; k += 5) {
    const t = (h * 60 + m + Math.min(k, minutes)) % (24 * 60);
    out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  }
  if (minutes % 5) {
    const t = (h * 60 + m + minutes) % (24 * 60);
    out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  }
  return out;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const drip = await getDrip(slug);
  // No drip: the page throws notFound(), and the tab says so.
  return drip ? { title: drip.name, description: drip.description } : { title: "Drip not found" };
}

export default async function DripDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [drip, assembly, all, late, zones, photoOf, lastSlot, clockFormat, copy] = await Promise.all([
    getDrip(slug),
    getAssemblyDrip(slug),
    listDrips(),
    getLatePolicy(),
    getZones(),
    uploadedDripPhotos(),
    lastBookableSlot(),
    getClockFormat(),
    getContent(),
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
      evening={lastSlot ? clockOf(lastSlot, clockFormat) : null}
      call={`${copy["home.stat2.value"]} ${copy["home.stat2.label"]}`}
      feel={feelImage(drip.category)}
      times={
        lastSlot ? runClock(lastSlot, drip.durationToMin ?? drip.durationMin).map((t) => clockOf(t, clockFormat)) : []
      }
    />
  );
}

import type { Metadata } from "next";
import { servedZones } from "@/lib/zones";
import { stepLabel } from "@/lib/clinical/slots";
import { getZones } from "@/lib/zones-store";
import { getClockFormat } from "@/lib/settings/clock";
import { clockText } from "@/lib/time";
import { Zones } from "@/components/site/zones/Zones";
import { getBookFacts } from "@/components/site/v3/BookSection";
// The page's own styles, scoped to .sc-site (scripts/scope-site-css.mjs).
import "@/components/site/v3/styles/scoped/zones.css";

// The zones are edited by the super admin (Service zones), so this is read per request.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const n = servedZones(await getZones()).length;
  return {
    title: "Where we come",
    description: `The ${n} Bengaluru ${n === 1 ? "zone" : "zones"} NutriDrip nurses serve, their pincodes and hours. Check yours.`,
  };
}

export default async function ZonesPage() {
  const [zones, clockFmt, facts] = await Promise.all([getZones(), getClockFormat(), getBookFacts()]);
  // Paused zones are not offered, so they are not listed either.
  const shown = servedZones(zones).map((z) => ({
    ...z,
    hours: clockText(z.window, clockFmt),
    step: stepLabel(z.slotMinutes),
  }));
  return <Zones zones={shown} facts={facts} />;
}

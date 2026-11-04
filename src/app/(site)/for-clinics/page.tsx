import type { Metadata } from "next";
import { listAssemblyDrips } from "@/lib/data/assembly";
import { siteImages } from "@/lib/media/resolve";
import { Clinics, type DeckLine } from "@/components/site/clinics/Clinics";
// The page's own styles, scoped to .sc-site (scripts/scope-site-css.mjs).
import "@/components/site/v3/styles/scoped/clinics.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "For clinics",
  description:
    "Run IV therapy out of your rooms without running a pharmacy. Physician review, nurse dispatch, stock by batch and expiry, and recall traceability.",
};

// The example order's quantities; its drips and ingredients are the panel's.
const QTY = [6, 4];

export default async function ForClinicsPage() {
  const [drips, img] = await Promise.all([listAssemblyDrips(), siteImages()]);
  const lines: DeckLine[] = drips
    .filter((d) => d.items.some((i) => !i.separate))
    .slice(0, QTY.length)
    .map((d, i) => ({
      drip: d.name,
      qty: QTY[i],
      items: d.items
        .filter((it) => !it.separate)
        .slice(0, 2)
        .map((it) => it.name),
    }));
  return <Clinics hero={img("for-clinics.hero")} protocols={drips.length} lines={lines} />;
}

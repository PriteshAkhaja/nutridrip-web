import { cache } from "react";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { BatchLot, Drip } from "@/lib/models";
import { getZones } from "@/lib/zones-store";
import { servedZones } from "@/lib/zones";
import { slotTimes } from "@/lib/clinical/slots";

/**
 * What the drip assembly (components/site/scroll) needs to build a drip on
 * screen: every ingredient in the container its stock arrives in, the carrier
 * that IS the bag, and which ingredients go beside the bag rather than in it.
 * Shared by the home page and, next, the drip detail page.
 */
export type AssemblyItem = {
  name: string;
  dose: number;
  unit: string;
  role: string;
  /**
   * The container, from the master's stock lots: the most common unitForm
   * among unexpired, unquarantined, active lots, "Vial" when there are none.
   * Only the form is read: never a batch, lot or expiry.
   */
  form: string;
  /** Given beside the bag, not in it: a pre-med, or notes that say it is a push. */
  separate: boolean;
};

export type AssemblyDrip = {
  slug: string;
  name: string;
  volumeMl: number;
  durationMin: number;
  durationToMin: number | null;
  carrier: { name: string; dose: number; unit: string } | null;
  items: AssemblyItem[];
};

type LeanDrip = {
  slug: string;
  name: string;
  volumeMl?: number | null;
  durationMin: number;
  durationToMin?: number | null;
  ingredients: Array<{ masterId?: unknown; name?: string; dose: number; unit: string; role: string; notes?: string }>;
};

/** Null when the drip is missing, retired or not public: the caller shows the plain hero instead. */
export const getAssemblyDrip = cache(async (slug: string): Promise<AssemblyDrip | null> => {
  try {
    await connectDB();
    const d = await Drip.findOne({ slug, isActive: true, isPublic: true })
      .select("slug name volumeMl durationMin durationToMin ingredients")
      .lean<LeanDrip | null>();
    if (!d) return null;

    const ids = (d.ingredients ?? [])
      .map((i) => i.masterId)
      .filter((v): v is Types.ObjectId => v instanceof Types.ObjectId);
    const lots = await BatchLot.aggregate<{ _id: { m: Types.ObjectId; f: string | null }; n: number }>([
      {
        $match: {
          masterId: { $in: ids },
          expiry: { $gt: new Date() },
          isQuarantined: { $ne: true },
          isActive: { $ne: false },
        },
      },
      { $group: { _id: { m: "$masterId", f: "$unitForm" }, n: { $sum: 1 } } },
    ]);
    const formOf = new Map<string, { f: string; n: number }>();
    for (const l of lots) {
      const key = String(l._id.m);
      const f = l._id.f ?? "Vial";
      const best = formOf.get(key);
      if (!best || l.n > best.n) formOf.set(key, { f, n: l.n });
    }

    const carrier = d.ingredients.find((i) => i.role === "FLUID");
    return {
      slug: d.slug,
      name: d.name,
      volumeMl: d.volumeMl ?? carrier?.dose ?? 500,
      durationMin: d.durationMin,
      durationToMin: d.durationToMin ?? null,
      carrier: carrier ? { name: carrier.name ?? "Carrier", dose: carrier.dose, unit: carrier.unit } : null,
      items: d.ingredients
        .filter((i) => i.role !== "FLUID")
        .map((i) => ({
          name: i.name ?? "",
          dose: i.dose,
          unit: i.unit,
          role: i.role,
          form: formOf.get(String(i.masterId))?.f ?? "Vial",
          separate: i.role === "PREMED" || /push/i.test(i.notes ?? ""),
        })),
    };
  } catch (err) {
    console.error("getAssemblyDrip() failed:", err);
    return null;
  }
});

/** The latest bookable time across the zones we serve, "HH:MM" 24-hour; null when none is open. */
export async function lastBookableSlot(): Promise<string | null> {
  const zones = servedZones(await getZones());
  let last: string | null = null;
  for (const z of zones) {
    const times = slotTimes({ opensAt: z.opensAt, closesAt: z.closesAt, slotMinutes: z.slotMinutes });
    const t = times[times.length - 1];
    if (t && (!last || t > last)) last = t;
  }
  return last;
}

import { cache } from "react";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { BatchLot, Drip, ProductMaster } from "@/lib/models";
import { tintFor, type SiteTint } from "@/lib/tints";
import { getZones } from "@/lib/zones-store";
import { servedZones } from "@/lib/zones";
import { slotTimes } from "@/lib/clinical/slots";

/**
 * What the drip assembly (components/site/scroll) needs to build a drip on
 * screen: every ingredient in the container its stock arrives in, the carrier
 * that IS the bag, and which ingredients go beside the bag rather than in it.
 * Shared by the home page and the drip detail page.
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
  /** The drip's own note on it ("if nausea present", "slow IV push"). */
  notes: string | null;
  /**
   * The vitamin or element it is, from the product master ("Vitamin B12" for
   * cyanocobalamin): the second line a printed label carries.
   */
  molecule: string | null;
};

export type AssemblyDrip = {
  slug: string;
  name: string;
  volumeMl: number;
  durationMin: number;
  durationToMin: number | null;
  carrier: { name: string; dose: number; unit: string } | null;
  items: AssemblyItem[];
  /** Its colour on the site: the liquid, the label band (lib/tints.ts). */
  tint: SiteTint;
};

/** A public drip as the landing page shows it: the assembly plus the catalogue's facts. */
export type CatalogueDrip = AssemblyDrip & {
  tagline: string | null;
  category: string | null;
  goodToKnow: string[];
  priceInr: number;
  isPopular: boolean;
};

type LeanDrip = {
  slug: string;
  name: string;
  volumeMl?: number | null;
  durationMin: number;
  durationToMin?: number | null;
  tint?: string | null;
  ingredients: Array<{ masterId?: unknown; name?: string; dose: number; unit: string; role: string; notes?: string }>;
};

type LeanCatalogueDrip = LeanDrip & {
  tagline?: string | null;
  category?: string | null;
  goodToKnow?: string[];
  priceInr: number;
  isPopular?: boolean;
};

const masterIds = (drips: LeanDrip[]) =>
  drips
    .flatMap((d) => d.ingredients ?? [])
    .map((i) => i.masterId)
    .filter((v): v is Types.ObjectId => v instanceof Types.ObjectId);

/**
 * Each master's container: the most common unitForm among its unexpired,
 * unquarantined, active lots. Only the form is read: never a batch, lot or
 * expiry.
 */
async function formsByMaster(ids: Types.ObjectId[]): Promise<Map<string, string>> {
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
  const best = new Map<string, { f: string; n: number }>();
  for (const l of lots) {
    const key = String(l._id.m);
    const f = l._id.f ?? "Vial";
    const b = best.get(key);
    if (!b || l.n > b.n) best.set(key, { f, n: l.n });
  }
  return new Map([...best].map(([k, v]) => [k, v.f]));
}

function assemble(d: LeanDrip, forms: Map<string, string>, molecules: Map<string, string | null>): AssemblyDrip {
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
        form: forms.get(String(i.masterId)) ?? "Vial",
        separate: i.role === "PREMED" || /push/i.test(i.notes ?? ""),
        notes: i.notes ?? null,
        molecule: molecules.get(String(i.masterId)) ?? null,
      })),
    tint: tintFor(d),
  };
}

/**
 * Every public drip, cheapest first, assembled: the landing page builds any
 * of them on screen and lists all of them. One query per collection.
 */
export const listAssemblyDrips = cache(async (): Promise<CatalogueDrip[]> => {
  await connectDB();
  const drips = await Drip.find({ isActive: true, isPublic: true })
    .sort({ priceInr: 1 })
    .select(
      "slug name tagline category goodToKnow priceInr isPopular tint volumeMl durationMin durationToMin ingredients"
    )
    .lean<LeanCatalogueDrip[]>();
  const ids = masterIds(drips);
  const [forms, masters] = await Promise.all([
    formsByMaster(ids),
    ProductMaster.find({ _id: { $in: ids } })
      .select("molecule")
      .lean<Array<{ _id: Types.ObjectId; molecule?: string | null }>>(),
  ]);
  const molecules = new Map(masters.map((m) => [String(m._id), m.molecule ?? null]));
  return drips.map((d) => ({
    ...assemble(d, forms, molecules),
    tagline: d.tagline ?? null,
    category: d.category ?? null,
    goodToKnow: d.goodToKnow ?? [],
    priceInr: d.priceInr,
    isPopular: Boolean(d.isPopular),
  }));
});

/** Null when the drip is missing, retired or not public: the caller shows the plain hero instead. */
export const getAssemblyDrip = cache(async (slug: string): Promise<AssemblyDrip | null> => {
  try {
    await connectDB();
    const d = await Drip.findOne({ slug, isActive: true, isPublic: true })
      .select("slug name volumeMl durationMin durationToMin tint ingredients")
      .lean<LeanDrip | null>();
    if (!d) return null;

    const ids = masterIds([d]);
    const [forms, masters] = await Promise.all([
      formsByMaster(ids),
      ProductMaster.find({ _id: { $in: ids } })
        .select("molecule")
        .lean<Array<{ _id: Types.ObjectId; molecule?: string | null }>>(),
    ]);
    return assemble(d, forms, new Map(masters.map((m) => [String(m._id), m.molecule ?? null])));
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

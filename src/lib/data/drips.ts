import { connectDB } from "@/lib/db/mongoose";
import { Drip } from "@/lib/models";

export type DripCard = {
  id: string;
  slug: string;
  name: string;
  category: string;
  tagline?: string;
  description: string;
  priceInr: number;
  durationMin: number;
  /** The upper end when a session is a range; null when it is a single figure. */
  durationToMin: number | null;
  /** "60–90 min" or "45 min" — worked out once, so no screen has to. */
  durationLabel: string;
  volumeMl: number | null;
  tags: string[];
  icon: string | null;
  isPopular: boolean;
  /** On the website. Off: clinics, doctors and the pharmacy still see it; the public does not. */
  isPublic: boolean;
  requiresApproval: boolean;
  /** Headline ingredients for the catalogue card. */
  headline: string[];
  ingredientCount: number;
};

export type DripDetail = DripCard & {
  infusionNotes?: string;
  bestFor: string[];
  goodToKnow: string[];
  benefits: Array<{ title: string; description?: string }>;
  ingredients: Array<{
    name: string;
    dose: number;
    unit: string;
    role: string;
    notes?: string;
    /** Share of the largest dose in the formula, for the FillBar. */
    pct: number;
  }>;
};

type LeanDrip = {
  _id: unknown;
  slug: string;
  name: string;
  /** Null on rows written before this was a field; the slug map covers those. */
  category?: string | null;
  tagline?: string;
  description?: string;
  infusionNotes?: string;
  priceInr: number;
  durationMin: number;
  durationToMin?: number | null;
  volumeMl?: number | null;
  tags?: string[];
  icon?: string | null;
  isPopular?: boolean;
  isPublic?: boolean;
  requiresApproval: boolean;
  bestFor?: string[];
  goodToKnow?: string[];
  benefits?: Array<{ title: string; description?: string }>;
  ingredients: Array<{ name?: string; dose: number; unit: string; role: string; notes?: string }>;
};

/**
 * Category is derived from the recipe's own tagging in the seed; the public
 * catalogue groups by it, so it is kept alongside the drip rather than in a
 * separate taxonomy table.
 */
/**
 * The seeded catalogue's categories, from before `category` was a field.
 *
 * Kept only as a fallback for rows written before the column existed — a
 * stored category always wins. Nothing new lands here, and once the seeded
 * drips have been saved through the builder once, this can go.
 */
const CATEGORY_BY_SLUG: Record<string, string> = {
  "myers-revive": "Energy",
  "deep-recharge": "Energy",
  "jetlag-reset": "Energy",
  "iron-restore": "Energy",
  "immune-shield": "Immunity",
  "post-viral-rebuild": "Post-viral",
  "glow-protocol": "Skin",
  "hydrate-plus": "Hydration",
  "athletic-recovery": "Athletic recovery",
};

function headlineOf(d: LeanDrip): string[] {
  return d.ingredients
    .filter((i) => i.role === "ACTIVE")
    .slice(0, 3)
    .map((i) => `${i.name} ${i.dose.toLocaleString("en-IN")} ${i.unit}`);
}

function toCard(d: LeanDrip): DripCard {
  return {
    id: String(d._id),
    slug: d.slug,
    name: d.name,
    category: d.category || CATEGORY_BY_SLUG[d.slug] || "Wellness",
    tagline: d.tagline,
    description: d.description ?? "",
    priceInr: d.priceInr,
    durationMin: d.durationMin,
    durationToMin: d.durationToMin ?? null,
    // Built once here so a card, a detail page and a booking summary cannot
    // each render the range slightly differently.
    durationLabel:
      d.durationToMin && d.durationToMin > d.durationMin
        ? `${d.durationMin}–${d.durationToMin} min`
        : `${d.durationMin} min`,
    volumeMl: d.volumeMl ?? null,
    tags: d.tags ?? [],
    icon: d.icon ?? null,
    isPopular: Boolean(d.isPopular),
    isPublic: d.isPublic !== false,
    requiresApproval: d.requiresApproval,
    headline: headlineOf(d),
    ingredientCount: d.ingredients.length,
  };
}

/** How many "Most popular" drips the home page shows: one row of cards. */
export const POPULAR_ON_HOME = 4;

/**
 * The public catalogue: Live and "Show on the public catalogue" ticked. Only
 * the website reads this: Home, Drips, Pricing, About, For clinics.
 */
export async function listDrips(): Promise<DripCard[]> {
  await connectDB();
  const drips = await Drip.find({ isActive: true, isPublic: true }).sort({ priceInr: 1 }).lean<LeanDrip[]>();
  return drips.map(toCard);
}

/**
 * Every Live drip, on the website or not: what a clinic orders, a physician
 * recommends and the pharmacy counts. "Show on the public catalogue" is about
 * advertising, not about whether a drip exists.
 */
export async function listLiveDrips(): Promise<DripCard[]> {
  await connectDB();
  const drips = await Drip.find({ isActive: true }).sort({ priceInr: 1 }).lean<LeanDrip[]>();
  return drips.map(toCard);
}

/**
 * What a patient may book: the public catalogue, plus a drip kept off the
 * website that their physician recommended to them.
 */
export async function listBookableDrips(recommendedIds: string[]): Promise<DripCard[]> {
  await connectDB();
  const drips = await Drip.find({
    isActive: true,
    $or: [{ isPublic: true }, { _id: { $in: recommendedIds } }],
  })
    .sort({ priceInr: 1 })
    .lean<LeanDrip[]>();
  return drips.map(toCard);
}

export async function getDrip(slug: string): Promise<DripDetail | null> {
  await connectDB();
  // A drip kept off the website has no public page either.
  const d = await Drip.findOne({ slug, isActive: true, isPublic: true }).lean<LeanDrip | null>();
  if (!d) return null;

  // Doses across units are not comparable, so the bar is scaled within the
  // formula's own maximum — it shows relative weight, not an absolute quantity.
  const max = Math.max(...d.ingredients.map((i) => i.dose), 1);

  return {
    ...toCard(d),
    infusionNotes: d.infusionNotes,
    bestFor: d.bestFor ?? [],
    goodToKnow: d.goodToKnow ?? [],
    benefits: d.benefits ?? [],
    ingredients: d.ingredients.map((i) => ({
      name: i.name ?? "",
      dose: i.dose,
      unit: i.unit,
      role: i.role,
      notes: i.notes,
      pct: Math.round((i.dose / max) * 100),
    })),
  };
}

export function formatDose(dose: number, unit: string): string {
  return `${dose.toLocaleString("en-IN")} ${unit}`;
}

import { z } from "zod";
import { ProductMaster } from "@/lib/models";
import { DRIP_CATEGORIES, INGREDIENT_ROLES, UNITS } from "@/lib/models/types";
import { sameFamily } from "./units";

export const Ingredient = z.object({
  masterId: z.string(),
  dose: z.number().positive(),
  unit: z.enum(UNITS),
  role: z.enum(INGREDIENT_ROLES),
  notes: z.string().max(200).optional(),
});

export const DripInput = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens").max(60),
  tagline: z.string().max(160).optional(),
  description: z.string().max(1000).optional(),
  infusionNotes: z.string().max(2000).optional(),
  durationMin: z.number().int().min(5).max(360).default(45),
  priceInr: z.number().min(0).max(1000000).default(0),
  ingredients: z.array(Ingredient).min(1, "A drip needs at least one ingredient"),
  /** Which group it appears under on the public catalogue. */
  category: z.enum(DRIP_CATEGORIES).nullable().optional(),
  volumeMl: z.number().int().min(0).max(5000).nullable().optional(),
  /** The upper end of a range; must be above durationMin, checked below. */
  durationToMin: z.number().int().min(5).max(360).nullable().optional(),
  /** Tax classification, for the invoice a clinic downloads after dispatch. */
  hsnCode: z.string().max(12).nullable().optional(),
  /** Null clears it: that drip is exempt, or we are not charging GST. */
  gstRate: z.number().min(0).max(28).nullable().optional(),
  tags: z.array(z.string().max(40)).max(8).default([]),
  /** One or two characters — an emoji, not a colour. */
  icon: z.string().max(8).nullable().optional(),
  isPopular: z.boolean().default(false),
  benefits: z
    .array(z.object({ title: z.string().min(1).max(80), description: z.string().max(400).optional() }))
    .max(6)
    .default([]),
  withKit: z.boolean().default(true),
  /** Which session kit. Omitted means the default one. */
  kitId: z.string().max(40).nullable().optional(),
  isPublic: z.boolean().default(true),
  requiresApproval: z.boolean().default(true),
  isActive: z.boolean().default(true),
  bestFor: z.array(z.string().max(120)).default([]),
  goodToKnow: z.array(z.string().max(200)).default([]),
});

/**
 * A range that runs backwards is a typo, not a range.
 *
 * Checked as a function rather than a `.refine()` on DripInput, for two
 * reasons. Zod refuses `.partial()` on a refined schema, and the edit route is
 * built on exactly that — adding the refinement broke editing every drip, not
 * just the new fields. And on a partial edit the refinement could not see the
 * value it was comparing against: sending only `durationToMin` has to be
 * checked against the duration already on the record.
 */
export function durationRangeError(from?: number | null, to?: number | null): string | null {
  if (to == null || from == null) return null;
  if (to <= from) return "The longer end of the range must be more than the shorter end";
  return null;
}

/**
 * Validates a recipe against the products it names, and returns the unit slips
 * rather than silently accepting a dose the engine could never fulfil.
 */
export async function resolveIngredients(list: z.infer<typeof Ingredient>[]) {
  const masters = await ProductMaster.find({ _id: { $in: list.map((i) => i.masterId) } }).lean<
    Array<{ _id: unknown; name: string; canonicalUnit: (typeof UNITS)[number] }>
  >();
  const byId = new Map(masters.map((m) => [String(m._id), m]));

  const slips: string[] = [];
  const resolved = list.map((i) => {
    const master = byId.get(i.masterId);
    if (!master) throw new Error(`One of the ingredients no longer exists`);
    if (!sameFamily(i.unit, master.canonicalUnit)) {
      slips.push(`${master.name} is held in ${master.canonicalUnit} but dosed here in ${i.unit}`);
    }
    return { ...i, name: master.name };
  });

  return { resolved, slips };
}

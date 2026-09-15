import { z } from "zod";

/** A consumables bundle: what goes into the box with every drip. */
export const KitInput = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  items: z.array(z.object({ masterId: z.string(), qty: z.number().int().min(1).max(100) })).min(1),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});


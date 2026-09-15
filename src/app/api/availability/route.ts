import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { checkAvailability } from "@/lib/inventory/availability";
import { ok, fail, handleError } from "@/lib/api";

const Input = z.object({
  items: z.array(z.object({ dripId: z.string(), quantity: z.number().int().min(1).max(500) })).min(1),
  includeKits: z.boolean().default(true),
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "availability.check")) return fail("Not permitted", 403);

    const { items, includeKits } = Input.parse(await req.json());
    return ok(await checkAvailability(items, includeKits));
  } catch (err) {
    return handleError(err);
  }
}

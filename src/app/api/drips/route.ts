import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Drip, SessionKit } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { DripInput, durationRangeError, resolveIngredients } from "@/lib/inventory/drip-input";
import { ok, fail, handleError } from "@/lib/api";

export async function GET() {
  try {
    const session = await getSession();
    if (!can(session?.role, "inventory.view")) return fail("Not permitted", 403);
    await connectDB();
    const drips = await Drip.find({}).sort({ name: 1 }).lean();
    return ok({ drips });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "drips.build")) return fail("Not permitted", 403);

    const input = DripInput.parse(await req.json());
    await connectDB();

    if (await Drip.exists({ slug: input.slug })) {
      return fail(`A drip already uses the address "${input.slug}"`, 409);
    }
    if (await Drip.exists({ name: input.name })) {
      return fail(`A drip is already called "${input.name}"`, 409);
    }

    const badRange = durationRangeError(input.durationMin, input.durationToMin);
    if (badRange) return fail(badRange, 422);

    const { resolved, slips } = await resolveIngredients(input.ingredients);
    // A unit slip is a warning at build time and a hard stop at dispatch, so
    // refuse it here rather than let it reach a nurse.
    if (slips.length) return fail(slips.join(". "), 422);

    const kit = input.withKit
      ? await SessionKit.findOne({ isDefault: true, isActive: true }).lean<{ _id: unknown } | null>()
      : null;

    const drip = await Drip.create({
      ...input,
      ingredients: resolved,
      // A named kit wins; without one the default stands, which is what every
      // drip did before a kit could be chosen at all.
      kitId: input.kitId || kit?._id,
      createdBy: session!.sub,
    });

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "drip.create",
      entity: "Drip",
      entityId: String(drip._id),
      after: { name: input.name, ingredients: resolved.length },
    });

    return ok({ id: String(drip._id), slug: drip.slug, name: drip.name }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

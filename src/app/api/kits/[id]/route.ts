import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Drip, Order, ProductMaster, SessionKit } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { KitInput } from "@/lib/inventory/kit-input";
import { ok, fail, handleError } from "@/lib/api";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "drips.build")) return fail("Not permitted", 403);

    const { id } = await params;
    // Same trap as the drip route: `.partial()` keeps `.default()`, so a PATCH
    // that renames a kit would also set isDefault false and isActive true.
    const body = (await req.json()) as Record<string, unknown>;
    const sent = new Set(Object.keys(body ?? {}));
    const input = KitInput.partial().parse(body);
    await connectDB();

    const kit = await SessionKit.findById(id);
    if (!kit) return fail("Kit not found", 404);

    // items, isDefault and isActive all change what a confirmed order will
    // actually draw from the shelf, so all three are locked while reservations
    // stand — not just the item list.
    const changesWhatIsDrawn =
      sent.has("items") || sent.has("isDefault") || sent.has("isActive");

    if (changesWhatIsDrawn) {
      // Confirmed orders reserved consumables against the kit as it was; the
      // reserved units have to keep matching what will go in the box.
      // Only orders that actually draw THIS kit hold reservations against it:
      // a drip either names the kit or falls back to the default one.
      const drips = await Drip.find({
        withKit: true,
        ...(kit.isDefault ? { $or: [{ kitId: id }, { kitId: null }] } : { kitId: id }),
      })
        .select("_id")
        .lean<Array<{ _id: unknown }>>();

      const open = drips.length
        ? await Order.countDocuments({
            status: "CONFIRMED",
            includeKits: true,
            "lines.dripId": { $in: drips.map((d) => d._id) },
          })
        : 0;

      if (open > 0) {
        return fail(`${open} confirmed order${open === 1 ? "" : "s"} reserved consumables against this kit. Dispatch or cancel them before changing it.`, 409);
      }
    }

    if (sent.has("items") && input.items) {
      const found = await ProductMaster.countDocuments({ _id: { $in: input.items.map((i) => i.masterId) } });
      if (found !== new Set(input.items.map((i) => i.masterId)).size) return fail("One of the kit items no longer exists", 422);
      kit.items = input.items;
    }
    if (sent.has("name") && input.name !== undefined) kit.name = input.name;
    if (sent.has("description") && input.description !== undefined) kit.description = input.description;
    if (sent.has("isActive") && input.isActive !== undefined) kit.isActive = input.isActive;
    if (sent.has("isDefault") && input.isDefault) {
      await SessionKit.updateMany({ _id: { $ne: id }, isDefault: true }, { $set: { isDefault: false } });
      kit.isDefault = true;
    }
    await kit.save();

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "kit.update",
      entity: "SessionKit",
      entityId: id,
      after: { name: kit.name, items: kit.items.length, isDefault: kit.isDefault },
    });

    return ok({ id, name: kit.name, items: kit.items.length });
  } catch (err) {
    return handleError(err);
  }
}

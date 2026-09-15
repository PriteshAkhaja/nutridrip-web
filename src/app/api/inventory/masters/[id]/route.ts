import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Allocation, AuditLog, BatchLot, ProductMaster } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { listLots } from "@/lib/data/inventory";
import { ok, fail, handleError } from "@/lib/api";

const Patch = z.object({
  name: z.string().min(1).max(160).optional(),
  molecule: z.string().max(160).optional(),
  gstRate: z.number().min(0).max(28).optional(),
  reorderLevel: z.number().int().min(0).max(100000).optional(),
  isMultidose: z.boolean().optional(),
  storageCondition: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  isActive: z.boolean().optional(),
});

/** A product with every batch under it. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "inventory.view")) return fail("Not permitted", 403);
    const { id } = await params;
    await connectDB();
    const master = await ProductMaster.findById(id).lean();
    if (!master) return fail("Product not found", 404);
    return ok({ master, lots: await listLots({ masterId: id }) });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "inventory.manage")) return fail("Not permitted", 403);

    const { id } = await params;
    const input = Patch.parse(await req.json());
    await connectDB();

    const master = await ProductMaster.findById(id);
    if (!master) return fail("Product not found", 404);

    // Whether a vial can be shared between patients changes how many units a
    // confirmed order holds, so it cannot flip while reservations stand.
    if (input.isMultidose !== undefined && input.isMultidose !== master.isMultidose) {
      const reserved = await Allocation.exists({ masterId: id, releasedAt: null });
      if (reserved) {
        return fail("Confirmed orders hold reservations against this product. Dispatch or cancel them before changing how it is dosed.", 409);
      }
    }

    // Retiring means "we no longer stock this". It hides the product from the
    // stock views and stops its expiry and reorder alerts, so it must not be
    // possible while units are still reserved or still on the shelf — that
    // combination is stock nobody is watching but the engine can still draw.
    if (input.isActive === false && master.isActive) {
      const reserved = await Allocation.exists({ masterId: id, releasedAt: null });
      if (reserved) {
        return fail("Confirmed orders still hold units of this product. Dispatch or cancel them first.", 409);
      }
      const onShelf = await BatchLot.aggregate<{ units: number }>([
        { $match: { masterId: master._id, isActive: true, expiry: { $gt: new Date() } } },
        { $group: { _id: null, units: { $sum: "$qtyOnHand" } } },
        { $project: { _id: 0, units: 1 } },
      ]);
      const units = onShelf[0]?.units ?? 0;
      if (units > 0) {
        return fail(
          `${units} in-date unit${units === 1 ? "" : "s"} of this product are still on the shelf. Dispose of or quarantine them first, so retiring it does not hide stock the engine can still draw.`,
          409
        );
      }
    }

    const before = {
      name: master.name,
      reorderLevel: master.reorderLevel,
      isMultidose: master.isMultidose,
      isActive: master.isActive,
    };

    for (const key of ["name", "molecule", "gstRate", "reorderLevel", "isMultidose", "storageCondition", "notes", "isActive"] as const) {
      if (input[key] !== undefined) (master as Record<string, unknown>)[key] = input[key];
    }
    await master.save();

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "master.update",
      entity: "ProductMaster",
      entityId: id,
      before,
      after: {
        name: master.name,
        reorderLevel: master.reorderLevel,
        isMultidose: master.isMultidose,
        isActive: master.isActive,
      },
    });

    return ok({ id, name: master.name, reorderLevel: master.reorderLevel, isMultidose: master.isMultidose, isActive: master.isActive });
  } catch (err) {
    return handleError(err);
  }
}

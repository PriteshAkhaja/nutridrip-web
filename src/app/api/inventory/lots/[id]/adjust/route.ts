import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, BatchLot, StockTxn } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { ok, fail, handleError } from "@/lib/api";

const Adjust = z.object({
  /** Signed: negative writes stock off, positive corrects a miscount. */
  delta: z.number().int(),
  reason: z.string().min(3).max(300),
  dispose: z.boolean().default(false),
  quarantine: z.boolean().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "inventory.manage")) return fail("Not permitted", 403);

    const { id } = await params;
    const { delta, reason, dispose, quarantine } = Adjust.parse(await req.json());
    await connectDB();

    const lot = await BatchLot.findById(id);
    if (!lot) return fail("Batch not found", 404);

    if (quarantine !== undefined) lot.isQuarantined = quarantine;

    if (delta !== 0) {
      const next = lot.qtyOnHand + delta;
      if (next < 0) return fail(`Only ${lot.qtyOnHand} units are on hand — stock cannot go negative`, 422);
      // Units already promised to a confirmed order are not yours to write off.
      if (next < lot.qtyReserved) {
        return fail(
          `${lot.qtyReserved} units are reserved against confirmed orders. Cancel those first.`,
          409
        );
      }
      lot.qtyOnHand = next;
    }

    await lot.save();

    await StockTxn.create({
      type: dispose ? "DISPOSE" : "ADJUST",
      lotId: lot._id,
      masterId: lot.masterId,
      delta,
      balanceAfter: lot.qtyOnHand,
      actorId: session!.sub,
      reason,
    });

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: dispose ? "lot.dispose" : "lot.adjust",
      entity: "BatchLot",
      entityId: id,
      after: { delta, reason, qtyOnHand: lot.qtyOnHand, quarantined: lot.isQuarantined },
    });

    return ok({ qtyOnHand: lot.qtyOnHand, isQuarantined: lot.isQuarantined });
  } catch (err) {
    return handleError(err);
  }
}

import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, BatchLot, ProductMaster, StockTxn } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { UNITS, UNIT_FORMS } from "@/lib/models/types";
import { sameFamily } from "@/lib/inventory/units";
import { notifyRole } from "@/lib/notify";
import { ok, fail, handleError } from "@/lib/api";

const ReceiveLot = z.object({
  brandName: z.string().min(1).max(160),
  manufacturer: z.string().max(160).optional(),
  batchNo: z.string().min(1).max(60),
  expiry: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  /** Active content per physical unit, e.g. 500 mg per vial. */
  contentValue: z.number().positive(),
  contentUnit: z.enum(UNITS),
  packVolumeMl: z.number().positive().optional(),
  unitForm: z.enum(UNIT_FORMS).default("Vial"),
  qtyReceived: z.number().int().min(1).max(1000000),
  costPerUnit: z.number().min(0).optional(),
  mrp: z.number().min(0).optional(),
});

/** Receiving stock is adding a lot under a master — nothing else creates stock. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "inventory.manage")) return fail("Not permitted", 403);

    const { id } = await params;
    const input = ReceiveLot.parse(await req.json());
    await connectDB();

    const master = await ProductMaster.findById(id).lean<{
      _id: unknown;
      name: string;
      canonicalUnit: (typeof UNITS)[number];
    } | null>();
    if (!master) return fail("Product not found", 404);

    const expiry = new Date(input.expiry);
    if (Number.isNaN(expiry.getTime())) return fail("That expiry date is not valid", 422);
    if (expiry <= new Date()) {
      return fail("That batch is already expired — it can never be dispensed, so it is not worth receiving", 422);
    }

    // A lot measured in a different unit family can never serve this drug's
    // doses, so refuse it at the door rather than at dispatch.
    if (!sameFamily(input.contentUnit, master.canonicalUnit)) {
      return fail(
        `${master.name} is dosed in ${master.canonicalUnit}, so a batch measured in ${input.contentUnit} cannot be used for it`,
        422
      );
    }

    if (await BatchLot.exists({ masterId: id, batchNo: input.batchNo })) {
      return fail(`Batch ${input.batchNo} has already been received for ${master.name}`, 409);
    }

    const lot = await BatchLot.create({
      ...input,
      masterId: id,
      expiry,
      qtyOnHand: input.qtyReceived,
      qtyReserved: 0,
    });

    await StockTxn.create({
      type: "RECEIPT",
      lotId: lot._id,
      masterId: id,
      delta: input.qtyReceived,
      balanceAfter: input.qtyReceived,
      actorId: session!.sub,
      reason: `Received ${input.batchNo}`,
    });

    // A batch arriving with a short shelf life is worth saying out loud.
    const days = Math.floor((expiry.getTime() - Date.now()) / 86_400_000);
    if (days <= 90) {
      await notifyRole(
        ["admin", "superadmin"],
        `Short-dated batch received · ${master.name}`,
        `${input.batchNo} expires in ${days} days. FEFO will draw it first.`,
        "warning",
        "/admin/inventory/alerts"
      );
    }

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "lot.receive",
      entity: "BatchLot",
      entityId: String(lot._id),
      after: { batchNo: input.batchNo, qty: input.qtyReceived, expiry: expiry.toISOString() },
    });

    return ok(
      { lot: { id: String(lot._id), batchNo: lot.batchNo, qtyOnHand: lot.qtyOnHand, daysToExpiry: days } },
      { status: 201 }
    );
  } catch (err) {
    return handleError(err);
  }
}

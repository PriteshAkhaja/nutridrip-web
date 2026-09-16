import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import {
  Allocation,
  BatchLot,
  Consumption,
  Drip,
  Order,
  ProductMaster,
  SessionKit,
  StockTxn,
} from "@/lib/models";
import type { Unit } from "@/lib/models/types";
import { convert } from "./units";

export type PlannedDraw = {
  lotId: string;
  masterId: string;
  batchNo: string;
  drugName: string;
  units: number;
  /** Active content actually delivered from this lot, in its own content unit. */
  activeUsed: number;
  /** Content discarded because the unit could not be split. */
  wasted: number;
  contentUnit: Unit;
};

export type AllocationPlan = {
  draws: PlannedDraw[];
  shortfalls: Array<{ drugName: string; masterId: string; shortUnits: number }>;
};

type Requirement = { masterId: string; dose: number; unit: Unit };

/** The committed order row a transition hands back to its caller. */
export type OrderRow = {
  _id: unknown;
  orderNo: string;
  status: string;
  clinicId?: unknown;
  orderedBy: unknown;
  patientRef?: string;
  patientName?: string;
  amount?: number;
  includeKits?: boolean;
  lines?: Array<{ dripId: unknown; dripName?: string; quantity: number; withKit: boolean; unitPrice: number }>;
  confirmedAt?: Date;
  dispatchedAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
};

/** Flatten an order into per-master dose requirements, one entry per drip prepared. */
async function requirementsForOrder(orderId: string): Promise<Requirement[]> {
  const order = await Order.findById(orderId).lean<{
    includeKits: boolean;
    lines: Array<{ dripId: unknown; quantity: number; withKit: boolean }>;
  } | null>();
  if (!order) throw new Error("Order not found");

  const reqs: Requirement[] = [];

  for (const line of order.lines) {
    const drip = await Drip.findById(line.dripId).lean<{
      withKit: boolean;
      kitId?: unknown;
      ingredients: Array<{ masterId: unknown; dose: number; unit: Unit }>;
    } | null>();
    if (!drip) continue;

    // The kit is chosen by the drip, so every session on this line draws the
    // same one. Reading it here rather than inside the loop below also means a
    // line of fifty sessions cannot pick up two different default kits halfway
    // through.
    const kit =
      order.includeKits && line.withKit && drip.withKit
        ? await SessionKit.findOne(
            drip.kitId ? { _id: drip.kitId } : { isDefault: true, isActive: true }
          ).lean<{ items: Array<{ masterId: unknown; qty: number }> } | null>()
        : null;

    for (let n = 0; n < line.quantity; n++) {
      for (const ing of drip.ingredients) {
        reqs.push({ masterId: String(ing.masterId), dose: ing.dose, unit: ing.unit });
      }

      for (const k of kit?.items ?? []) {
        reqs.push({ masterId: String(k.masterId), dose: k.qty, unit: "unit" });
      }
    }
  }

  return reqs;
}

/**
 * Walk the requirements FEFO and decide exactly which units come from which
 * lots. Multidose lots carry their remainder forward; single-use lots do not.
 */
export async function planAllocation(
  orderId: string,
  /**
   * At dispatch the units this order needs are already reserved *by this
   * order*, so a lot whose whole remainder it holds looks unavailable and drops
   * out of the plan — taking the drug name and the active/wasted figures with
   * it, and leaving a hole in the recall trail. Crediting the order's own
   * reservations back reproduces the shelf as it stood when it confirmed.
   */
  opts: { creditOwnReservations?: boolean } = {}
): Promise<AllocationPlan> {
  await connectDB();
  const reqs = await requirementsForOrder(orderId);
  const now = new Date();

  const credited = new Map<string, number>();
  if (opts.creditOwnReservations) {
    const held = await Allocation.find({ orderId, releasedAt: null }).lean<
      Array<{ lotId: unknown; unitsReserved: number }>
    >();
    for (const a of held) {
      const key = String(a.lotId);
      credited.set(key, (credited.get(key) ?? 0) + a.unitsReserved);
    }
  }

  // Group requirements by master so each drug's shelf is walked once.
  const byMaster = new Map<string, Requirement[]>();
  for (const r of reqs) {
    const list = byMaster.get(r.masterId) ?? [];
    list.push(r);
    byMaster.set(r.masterId, list);
  }

  const draws: PlannedDraw[] = [];
  const shortfalls: AllocationPlan["shortfalls"] = [];

  for (const [masterId, list] of byMaster) {
    const master = await ProductMaster.findById(masterId).lean<{
      name: string;
      isMultidose: boolean;
    } | null>();
    const drugName = master?.name ?? "Unknown";
    const isMultidose = master?.isMultidose ?? false;

    const lots = await BatchLot.find({
      masterId,
      isActive: true,
      isQuarantined: false,
      expiry: { $gt: now },
      ...(opts.creditOwnReservations ? {} : { $expr: { $gt: ["$qtyOnHand", "$qtyReserved"] } }),
    })
      .sort({ expiry: 1 })
      .lean<
        Array<{
          _id: unknown;
          batchNo: string;
          qtyOnHand: number;
          qtyReserved: number;
          contentValue: number;
          contentUnit: Unit;
        }>
      >();

    const shelf = lots
      .map((l) => ({
        lotId: String(l._id),
        batchNo: l.batchNo,
        left: Math.max(0, l.qtyOnHand - l.qtyReserved + (credited.get(String(l._id)) ?? 0)),
        contentValue: l.contentValue,
        contentUnit: l.contentUnit,
      }))
      .filter((l) => l.left > 0);

    const drawMap = new Map<string, PlannedDraw>();
    const touch = (lot: (typeof shelf)[number]) => {
      let d = drawMap.get(lot.lotId);
      if (!d) {
        d = {
          lotId: lot.lotId,
          masterId,
          batchNo: lot.batchNo,
          drugName,
          units: 0,
          activeUsed: 0,
          wasted: 0,
          contentUnit: lot.contentUnit,
        };
        drawMap.set(lot.lotId, d);
      }
      return d;
    };

    /** Open multidose remainder, held in the unit of the lot it came from. */
    let carry = 0;
    let carryLot: (typeof shelf)[number] | null = null;
    let shortUnits = 0;

    for (const req of list) {
      let need = req.dose;

      if (isMultidose && carry > 0 && carryLot) {
        const carryInDose = convert(carry, carryLot.contentUnit, req.unit);
        if (carryInDose !== null && carryInDose > 0) {
          const takeDose = Math.min(carryInDose, need);
          const takeContent = convert(takeDose, req.unit, carryLot.contentUnit) ?? 0;
          carry -= takeContent;
          need -= takeDose;
          touch(carryLot).activeUsed += takeContent;
        }
      }

      while (need > 1e-9) {
        const lot = shelf.find((l) => l.left > 0);
        if (!lot) {
          shortUnits += 1;
          break;
        }

        const perUnitInDose = convert(lot.contentValue, lot.contentUnit, req.unit);
        if (perUnitInDose === null || perUnitInDose <= 0) {
          lot.left = 0; // Unit slip: this lot cannot serve this dose.
          continue;
        }

        lot.left -= 1;
        const d = touch(lot);
        d.units += 1;

        if (perUnitInDose >= need) {
          const usedContent = convert(need, req.unit, lot.contentUnit) ?? 0;
          d.activeUsed += usedContent;
          const remainderContent = lot.contentValue - usedContent;
          if (isMultidose) {
            // Flush any older carry that is now stranded on a different lot.
            if (carryLot && carryLot.lotId !== lot.lotId && carry > 0) {
              touch(carryLot).wasted += carry;
            }
            carry = remainderContent;
            carryLot = lot;
          } else {
            d.wasted += remainderContent;
          }
          need = 0;
        } else {
          d.activeUsed += lot.contentValue;
          need -= perUnitInDose;
        }
      }
    }

    // Anything left in an open multidose vial at the end of the order is waste.
    if (carryLot && carry > 0) touch(carryLot).wasted += carry;

    draws.push(...drawMap.values());
    if (shortUnits > 0) shortfalls.push({ drugName, masterId, shortUnits });
  }

  return { draws, shortfalls };
}

/**
 * Confirm an order: soft-reserve the exact units it will need. The units stay
 * on the shelf but stop counting as available, so two orders cannot promise
 * the same vial.
 */
export async function confirmOrder(orderId: string, actorId?: string) {
  await connectDB();
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.status !== "DRAFT") throw new Error(`Cannot confirm an order in ${order.status}`);

  const plan = await planAllocation(orderId);
  if (plan.shortfalls.length) {
    const names = plan.shortfalls.map((s) => s.drugName).join(", ");
    throw new Error(`Insufficient in-date stock: ${names}`);
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const draw of plan.draws) {
        const res = await BatchLot.updateOne(
          { _id: draw.lotId, $expr: { $gte: [{ $subtract: ["$qtyOnHand", "$qtyReserved"] }, draw.units] } },
          { $inc: { qtyReserved: draw.units } },
          { session }
        );
        if (res.modifiedCount !== 1) {
          throw new Error(`Batch ${draw.batchNo} was claimed by another order — re-check availability`);
        }

        await Allocation.create(
          [
            {
              orderId: order._id,
              lotId: draw.lotId,
              masterId: draw.masterId,
              unitsReserved: draw.units,
            },
          ],
          { session }
        );

        await StockTxn.create(
          [
            {
              type: "RESERVE",
              lotId: draw.lotId,
              masterId: draw.masterId,
              delta: -draw.units,
              orderId: order._id,
              actorId,
              reason: `Reserved for ${order.orderNo}`,
            },
          ],
          { session }
        );
      }

      // Claiming the transition as a conditional write is what makes two
      // simultaneous confirms safe: only one can move the order out of DRAFT,
      // and the loser's whole transaction — reservations included — aborts.
      const claimed = await Order.updateOne(
        { _id: order._id, status: "DRAFT" },
        { $set: { status: "CONFIRMED", confirmedAt: new Date() } },
        { session }
      );
      if (claimed.modifiedCount !== 1) {
        throw new Error("That order was confirmed by someone else a moment ago");
      }
    });
  } finally {
    await session.endSession();
  }

  // Re-read so the caller sees the committed row rather than the in-memory copy.
  return (await Order.findById(orderId).lean<OrderRow | null>())!;
}

/**
 * Dispatch: consume stock for real, drawing whole units FEFO, then release the
 * reservation and write the immutable consumption ledger.
 */
export async function dispatchOrder(orderId: string, actorId?: string) {
  await connectDB();
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.status !== "CONFIRMED") throw new Error(`Cannot dispatch an order in ${order.status}`);

  const allocations = await Allocation.find({ orderId, releasedAt: null }).lean<
    Array<{ _id: unknown; lotId: unknown; masterId: unknown; unitsReserved: number }>
  >();

  // The plan is recomputed so the ledger records active-vs-wasted content, but
  // the units drawn are the ones already reserved — so the recompute must see
  // the shelf as it stood at confirm, not as the reservation left it.
  const plan = await planAllocation(orderId, { creditOwnReservations: true });
  const planByLot = new Map(plan.draws.map((d) => [d.lotId, d]));

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const alloc of allocations) {
        const lotId = String(alloc.lotId);
        const draw = planByLot.get(lotId);

        const lot = await BatchLot.findById(lotId).session(session);
        if (!lot) throw new Error("Batch lot vanished mid-dispatch");
        if (lot.qtyOnHand < alloc.unitsReserved) {
          throw new Error(`Batch ${lot.batchNo} has less stock than reserved`);
        }

        lot.qtyOnHand -= alloc.unitsReserved;
        lot.qtyReserved = Math.max(0, lot.qtyReserved - alloc.unitsReserved);
        await lot.save({ session });

        // The ledger is the recall trail, so its identifying fields come from
        // the master and the lot themselves — never from a plan that might not
        // contain this row.
        const master = await ProductMaster.findById(alloc.masterId).session(session).lean<{ name: string } | null>();

        await Consumption.create(
          [
            {
              orderId: order._id,
              lotId,
              masterId: alloc.masterId,
              batchNo: lot.batchNo,
              drugName: draw?.drugName ?? master?.name ?? "Unknown",
              unitsConsumed: alloc.unitsReserved,
              activeUsed: Math.round((draw?.activeUsed ?? 0) * 100) / 100,
              wasted: Math.round((draw?.wasted ?? 0) * 100) / 100,
              contentUnit: lot.contentUnit,
              dispatchedBy: actorId,
            },
          ],
          { session }
        );

        await StockTxn.create(
          [
            {
              type: "CONSUME",
              lotId,
              masterId: alloc.masterId,
              delta: -alloc.unitsReserved,
              balanceAfter: lot.qtyOnHand,
              orderId: order._id,
              actorId,
              reason: `Dispatched on ${order.orderNo}`,
            },
          ],
          { session }
        );

        await Allocation.updateOne(
          { _id: alloc._id },
          { $set: { releasedAt: new Date() } },
          { session }
        );
      }

      const claimed = await Order.updateOne(
        { _id: order._id, status: "CONFIRMED" },
        { $set: { status: "DISPATCHED", dispatchedAt: new Date() } },
        { session }
      );
      if (claimed.modifiedCount !== 1) {
        throw new Error("That order was already dispatched or cancelled");
      }
    });
  } finally {
    await session.endSession();
  }

  return (await Order.findById(orderId).lean<OrderRow | null>())!;
}

/** Cancel: hand the reserved units back to available stock. */
export async function cancelOrder(orderId: string, reason?: string, actorId?: string) {
  await connectDB();
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.status === "DISPATCHED") throw new Error("Dispatched orders cannot be cancelled");
  if (order.status === "CANCELLED") return order.toObject();

  /**
   * A draft holds nothing, so cancelling one needs no transaction.
   *
   * The transaction below exists to make "release N reservations and close the
   * order" one indivisible act. With no reservations there is a single write —
   * and a single-document update is already atomic. Opening a transaction for
   * it bought nothing and cost everything: transactions require a replica set,
   * so cancelling a draft failed outright on a standalone mongod.
   *
   * The claim is narrowed to DRAFT on purpose. If another request confirmed
   * this order between the two reads there are now reservations to release,
   * the conditional update matches nothing, and we fall through to the
   * transactional path rather than closing an order while its stock stays
   * held.
   */
  const held = await Allocation.countDocuments({ orderId, releasedAt: null });
  if (held === 0) {
    const claimed = await Order.updateOne(
      { _id: order._id, status: "DRAFT" },
      { $set: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason } }
    );
    if (claimed.modifiedCount === 1) {
      return (await Order.findById(orderId).lean<OrderRow | null>())!;
    }
  }

  const allocations = await Allocation.find({ orderId, releasedAt: null }).lean<
    Array<{ _id: unknown; lotId: unknown; masterId: unknown; unitsReserved: number }>
  >();

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const alloc of allocations) {
        // Release the allocation row first, conditionally: if another request
        // already released it, this returns 0 and the shelf is left alone
        // rather than being credited the same units twice.
        const released = await Allocation.updateOne(
          { _id: alloc._id, releasedAt: null },
          { $set: { releasedAt: new Date() } },
          { session }
        );
        if (released.modifiedCount !== 1) continue;

        await BatchLot.updateOne(
          { _id: alloc.lotId },
          { $inc: { qtyReserved: -alloc.unitsReserved } },
          { session }
        );
        await StockTxn.create(
          [
            {
              type: "RELEASE",
              lotId: alloc.lotId,
              masterId: alloc.masterId,
              delta: alloc.unitsReserved,
              orderId: order._id,
              actorId,
              reason: reason ?? `Cancelled ${order.orderNo}`,
            },
          ],
          { session }
        );
      }

      const claimed = await Order.updateOne(
        { _id: order._id, status: { $in: ["DRAFT", "CONFIRMED"] } },
        { $set: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason } },
        { session }
      );
      if (claimed.modifiedCount !== 1) {
        throw new Error("That order was already dispatched or cancelled");
      }
    });
  } finally {
    await session.endSession();
  }

  return (await Order.findById(orderId).lean<OrderRow | null>())!;
}

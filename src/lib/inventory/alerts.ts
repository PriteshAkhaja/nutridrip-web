import { connectDB } from "@/lib/db/mongoose";
import { BatchLot, ProductMaster } from "@/lib/models";

export type AlertSeverity = "critical" | "caution" | "info";

export type StockAlert = {
  type: "EXPIRED" | "EXPIRING_SOON" | "LOW_STOCK" | "OUT_OF_STOCK";
  severity: AlertSeverity;
  masterId: string;
  drugName: string;
  batchNo?: string;
  lotId?: string;
  expiry?: string;
  daysToExpiry?: number;
  units?: number;
  available?: number;
  reorderLevel?: number;
  valueAtRiskInr?: number;
};

export type AlertsSummary = {
  expired: StockAlert[];
  expiringSoon: StockAlert[];
  lowStock: StockAlert[];
  outOfStock: StockAlert[];
  counts: { expired: number; expiringSoon: number; lowStock: number; outOfStock: number };
  valueAtRiskInr: number;
};

const DAY = 86_400_000;

/** Everything the Alerts view flags: expiry, expired-on-shelf, and reorder. */
export async function getAlerts(withinDays = 90): Promise<AlertsSummary> {
  await connectDB();
  const now = new Date();
  const horizon = new Date(now.getTime() + withinDays * DAY);

  const masters = await ProductMaster.find({ isActive: true }).lean<
    Array<{ _id: unknown; name: string; reorderLevel: number }>
  >();
  const masterById = new Map(masters.map((m) => [String(m._id), m]));

  const lots = await BatchLot.find({ isActive: true }).lean<
    Array<{
      _id: unknown;
      masterId: unknown;
      batchNo: string;
      expiry: Date;
      qtyOnHand: number;
      qtyReserved: number;
      isQuarantined?: boolean;
      mrp?: number;
      costPerUnit?: number;
    }>
  >();

  const expired: StockAlert[] = [];
  const expiringSoon: StockAlert[] = [];
  const availableByMaster = new Map<string, number>();
  let valueAtRisk = 0;

  for (const lot of lots) {
    const masterId = String(lot.masterId);
    const master = masterById.get(masterId);
    if (!master) continue;

    const drugName = master.name;
    const daysToExpiry = Math.floor((lot.expiry.getTime() - now.getTime()) / DAY);
    const unitValue = lot.costPerUnit ?? lot.mrp ?? 0;

    if (lot.expiry < now) {
      // Expired stock still sitting on the shelf.
      if (lot.qtyOnHand > 0) {
        expired.push({
          type: "EXPIRED",
          severity: "critical",
          masterId,
          drugName,
          batchNo: lot.batchNo,
          lotId: String(lot._id),
          expiry: lot.expiry.toISOString(),
          daysToExpiry,
          units: lot.qtyOnHand,
          valueAtRiskInr: unitValue * lot.qtyOnHand,
        });
        valueAtRisk += unitValue * lot.qtyOnHand;
      }
      continue; // Expired lots never count toward availability.
    }

    // Quarantined stock is excluded from every calculation, exactly as the
    // availability engine excludes it — otherwise a drug whose only batch is
    // quarantined reads as healthy here while no drip can actually be prepared.
    const available = lot.isQuarantined ? 0 : Math.max(0, lot.qtyOnHand - lot.qtyReserved);
    availableByMaster.set(masterId, (availableByMaster.get(masterId) ?? 0) + available);

    if (lot.expiry <= horizon && lot.qtyOnHand > 0) {
      expiringSoon.push({
        type: "EXPIRING_SOON",
        severity: "caution",
        masterId,
        drugName,
        batchNo: lot.batchNo,
        lotId: String(lot._id),
        expiry: lot.expiry.toISOString(),
        daysToExpiry,
        units: lot.qtyOnHand,
        valueAtRiskInr: unitValue * lot.qtyOnHand,
      });
      valueAtRisk += unitValue * lot.qtyOnHand;
    }
  }

  const lowStock: StockAlert[] = [];
  const outOfStock: StockAlert[] = [];

  for (const master of masters) {
    const masterId = String(master._id);
    const available = availableByMaster.get(masterId) ?? 0;

    if (available === 0) {
      outOfStock.push({
        type: "OUT_OF_STOCK",
        severity: "critical",
        masterId,
        drugName: master.name,
        available,
        reorderLevel: master.reorderLevel,
      });
    } else if (available <= master.reorderLevel) {
      lowStock.push({
        type: "LOW_STOCK",
        severity: "caution",
        masterId,
        drugName: master.name,
        available,
        reorderLevel: master.reorderLevel,
      });
    }
  }

  expiringSoon.sort((a, b) => (a.daysToExpiry ?? 0) - (b.daysToExpiry ?? 0));
  expired.sort((a, b) => (a.daysToExpiry ?? 0) - (b.daysToExpiry ?? 0));

  return {
    expired,
    expiringSoon,
    lowStock,
    outOfStock,
    counts: {
      expired: expired.length,
      expiringSoon: expiringSoon.length,
      lowStock: lowStock.length,
      outOfStock: outOfStock.length,
    },
    valueAtRiskInr: Math.round(valueAtRisk),
  };
}

/**
 * Recall trace: every order a batch fed, and every batch an order drew from.
 * The consumption ledger is the source of truth.
 */
export async function traceBatch(lotId: string) {
  await connectDB();
  const { Consumption, Order } = await import("@/lib/models");

  const rows = await Consumption.find({ lotId })
    .sort({ dispatchedAt: -1 })
    .lean<
      Array<{
        _id: unknown;
        orderId: unknown;
        batchNo: string;
        drugName: string;
        unitsConsumed: number;
        activeUsed: number;
        contentUnit?: string;
        dispatchedAt: Date;
      }>
    >();

  const orderIds = [...new Set(rows.map((r) => String(r.orderId)))];
  const orders = await Order.find({ _id: { $in: orderIds } }).lean<
    Array<{ _id: unknown; orderNo: string; patientRef?: string; patientName?: string; dispatchedAt?: Date }>
  >();
  const orderById = new Map(orders.map((o) => [String(o._id), o]));

  return rows.map((r) => ({
    id: String(r._id),
    orderNo: orderById.get(String(r.orderId))?.orderNo ?? "—",
    patientRef:
      orderById.get(String(r.orderId))?.patientRef ??
      orderById.get(String(r.orderId))?.patientName ??
      "—",
    batchNo: r.batchNo,
    drugName: r.drugName,
    unitsConsumed: r.unitsConsumed,
    activeUsed: r.activeUsed,
    contentUnit: r.contentUnit,
    dispatchedAt: r.dispatchedAt?.toISOString() ?? null,
  }));
}

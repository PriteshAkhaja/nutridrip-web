import { connectDB } from "@/lib/db/mongoose";
import { BatchLot, ProductMaster } from "@/lib/models";
import type { Category, Unit, UnitForm } from "@/lib/models/types";
import type { StockStatus } from "@/components/ui/Fill";

const DAY = 86_400_000;
const EXPIRING_SOON_DAYS = 90;

export type MasterRow = {
  id: string;
  name: string;
  molecule?: string;
  hsnCode: string;
  category: Category;
  canonicalUnit: Unit;
  reorderLevel: number;
  isMultidose: boolean;
  storageCondition?: string;
  /** In-date units on the shelf. Expired lots are never counted. */
  onHand: number;
  /** On hand minus units promised to confirmed orders. */
  available: number;
  reserved: number;
  lotCount: number;
  brands: string[];
  /** Days to the earliest in-date expiry, or null when nothing is in date. */
  soonestExpiryDays: number | null;
  status: StockStatus;
};

export type LotRow = {
  id: string;
  masterId: string;
  drugName: string;
  brandName: string;
  manufacturer?: string;
  batchNo: string;
  expiry: string;
  daysToExpiry: number;
  contentValue: number;
  contentUnit: Unit;
  unitForm: UnitForm;
  qtyReceived: number;
  qtyOnHand: number;
  qtyReserved: number;
  available: number;
  mrp?: number;
  costPerUnit?: number;
  isQuarantined: boolean;
  status: StockStatus;
  /** Share of the lot still on the shelf, for the depleting Fill. */
  remainingPct: number;
};

function statusFor(args: {
  daysToExpiry: number | null;
  available: number;
  reorderLevel: number;
}): StockStatus {
  if (args.daysToExpiry !== null && args.daysToExpiry < 0) return "expired";
  if (args.available <= 0) return "out";
  if (args.daysToExpiry !== null && args.daysToExpiry <= EXPIRING_SOON_DAYS) return "expiring";
  if (args.available <= args.reorderLevel) return "low";
  return "healthy";
}

export async function listMasters(opts: { category?: Category; q?: string } = {}): Promise<MasterRow[]> {
  await connectDB();
  const now = new Date();

  const filter: Record<string, unknown> = { isActive: true };
  if (opts.category) filter.category = opts.category;
  if (opts.q) {
    const rx = new RegExp(opts.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { molecule: rx }, { hsnCode: rx }];
  }

  const masters = await ProductMaster.find(filter).sort({ name: 1 }).lean<
    Array<{
      _id: unknown;
      name: string;
      molecule?: string;
      hsnCode: string;
      category: Category;
      canonicalUnit: Unit;
      reorderLevel: number;
      isMultidose: boolean;
      storageCondition?: string;
    }>
  >();

  const lots = await BatchLot.find({
    masterId: { $in: masters.map((m) => m._id) },
    isActive: true,
  }).lean<
    Array<{
      masterId: unknown;
      brandName: string;
      expiry: Date;
      qtyOnHand: number;
      qtyReserved: number;
      isQuarantined: boolean;
    }>
  >();

  const byMaster = new Map<string, typeof lots>();
  for (const l of lots) {
    const k = String(l.masterId);
    byMaster.set(k, [...(byMaster.get(k) ?? []), l]);
  }

  return masters.map((m) => {
    const own = byMaster.get(String(m._id)) ?? [];
    const inDate = own.filter((l) => l.expiry > now && !l.isQuarantined);

    const onHand = inDate.reduce((s, l) => s + l.qtyOnHand, 0);
    const reserved = inDate.reduce((s, l) => s + l.qtyReserved, 0);
    const available = Math.max(0, onHand - reserved);

    const soonest = inDate
      .filter((l) => l.qtyOnHand > 0)
      .reduce<number | null>((min, l) => {
        const d = Math.floor((l.expiry.getTime() - now.getTime()) / DAY);
        return min === null || d < min ? d : min;
      }, null);

    return {
      id: String(m._id),
      name: m.name,
      molecule: m.molecule,
      hsnCode: m.hsnCode,
      category: m.category,
      canonicalUnit: m.canonicalUnit,
      reorderLevel: m.reorderLevel,
      isMultidose: m.isMultidose,
      storageCondition: m.storageCondition,
      onHand,
      available,
      reserved,
      lotCount: own.length,
      brands: [...new Set(own.map((l) => l.brandName))],
      soonestExpiryDays: soonest,
      status: statusFor({ daysToExpiry: soonest, available, reorderLevel: m.reorderLevel }),
    };
  });
}

export async function listLots(opts: { masterId?: string; q?: string } = {}): Promise<LotRow[]> {
  await connectDB();
  const now = new Date();

  const filter: Record<string, unknown> = { isActive: true };
  if (opts.masterId) filter.masterId = opts.masterId;

  const lots = await BatchLot.find(filter).sort({ expiry: 1 }).lean<
    Array<{
      _id: unknown;
      masterId: unknown;
      brandName: string;
      manufacturer?: string;
      batchNo: string;
      expiry: Date;
      contentValue: number;
      contentUnit: Unit;
      unitForm: UnitForm;
      qtyReceived: number;
      qtyOnHand: number;
      qtyReserved: number;
      mrp?: number;
      costPerUnit?: number;
      isQuarantined: boolean;
    }>
  >();

  const masters = await ProductMaster.find({
    _id: { $in: [...new Set(lots.map((l) => String(l.masterId)))] },
  }).lean<Array<{ _id: unknown; name: string; reorderLevel: number }>>();
  const masterById = new Map(masters.map((m) => [String(m._id), m]));

  const rows = lots.map((l) => {
    const daysToExpiry = Math.floor((l.expiry.getTime() - now.getTime()) / DAY);
    const master = masterById.get(String(l.masterId));
    const available = Math.max(0, l.qtyOnHand - l.qtyReserved);
    return {
      id: String(l._id),
      masterId: String(l.masterId),
      drugName: master?.name ?? "Unknown",
      brandName: l.brandName,
      manufacturer: l.manufacturer,
      batchNo: l.batchNo,
      expiry: l.expiry.toISOString(),
      daysToExpiry,
      contentValue: l.contentValue,
      contentUnit: l.contentUnit,
      unitForm: l.unitForm,
      qtyReceived: l.qtyReceived,
      qtyOnHand: l.qtyOnHand,
      qtyReserved: l.qtyReserved,
      available,
      mrp: l.mrp,
      costPerUnit: l.costPerUnit,
      isQuarantined: l.isQuarantined,
      status: l.isQuarantined
        ? ("expired" as StockStatus)
        : statusFor({ daysToExpiry, available, reorderLevel: master?.reorderLevel ?? 0 }),
      remainingPct: l.qtyReceived > 0 ? Math.round((l.qtyOnHand / l.qtyReceived) * 100) : 0,
    };
  });

  if (!opts.q) return rows;
  const rx = new RegExp(opts.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  return rows.filter((r) => rx.test(r.drugName) || rx.test(r.batchNo) || rx.test(r.brandName));
}

/** Formats a date the way every date in the product is formatted. */
export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(value: string | Date): string {
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function expiryPhrase(days: number): string {
  if (days < 0) return `Expired ${Math.abs(days)} days ago`;
  if (days === 0) return "Expires today";
  return `${days} days left`;
}

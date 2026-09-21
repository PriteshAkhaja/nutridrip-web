import { connectDB } from "@/lib/db/mongoose";
import { paginate } from "@/lib/pagination-db";
import type { PageMeta, Paging } from "@/lib/pagination";
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

type MasterDoc = {
  _id: unknown;
  name: string;
  molecule?: string;
  hsnCode: string;
  category: Category;
  canonicalUnit: Unit;
  reorderLevel: number;
  isMultidose: boolean;
  storageCondition?: string;
};

type MasterOpts = { category?: Category; q?: string };

/** The database's filter for products: active, in a category, matching a search. */
function masterFilter(opts: MasterOpts): Record<string, unknown> {
  const filter: Record<string, unknown> = { isActive: true };
  if (opts.category) filter.category = opts.category;
  if (opts.q) {
    const rx = new RegExp(opts.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { molecule: rx }, { hsnCode: rx }];
  }
  return filter;
}

/**
 * Products with their stock figures worked out.
 *
 * The stock figures are sums, so the database sums them: one row per product,
 * however many batches it has. This used to load EVERY active batch of every
 * product and add them up in JavaScript, so opening the screen cost more with
 * every vial ever received.
 *
 * "In date" is the rule the whole app uses: not expired, not quarantined.
 */
async function withStock(masters: MasterDoc[]): Promise<MasterRow[]> {
  const now = new Date();
  const inDate = { $and: [{ $gt: ["$expiry", now] }, { $ne: ["$isQuarantined", true] }] };
  const stats = await BatchLot.aggregate<{
    _id: unknown;
    lotCount: number;
    brands: string[];
    onHand: number;
    reserved: number;
    soonestExpiry: Date | null;
  }>([
    { $match: { masterId: { $in: masters.map((m) => m._id) }, isActive: true } },
    {
      $group: {
        _id: "$masterId",
        lotCount: { $sum: 1 },
        brands: { $addToSet: "$brandName" },
        onHand: { $sum: { $cond: [inDate, "$qtyOnHand", 0] } },
        reserved: { $sum: { $cond: [inDate, "$qtyReserved", 0] } },
        // Soonest expiry among lots that are in date AND still hold stock.
        // $min skips nulls, so it is null when there is no such lot.
        soonestExpiry: {
          $min: { $cond: [{ $and: [inDate, { $gt: ["$qtyOnHand", 0] }] }, "$expiry", null] },
        },
      },
    },
  ]);
  const statsByMaster = new Map(stats.map((r) => [String(r._id), r]));

  return masters.map((m) => {
    const own = statsByMaster.get(String(m._id));
    const onHand = own?.onHand ?? 0;
    const reserved = own?.reserved ?? 0;
    const available = Math.max(0, onHand - reserved);

    // The floor of the soonest expiry is the soonest of the floors.
    const soonest =
      own?.soonestExpiry != null
        ? Math.floor((new Date(own.soonestExpiry).getTime() - now.getTime()) / DAY)
        : null;

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
      lotCount: own?.lotCount ?? 0,
      // $addToSet has no order; a fixed one keeps the screen from reshuffling.
      brands: [...(own?.brands ?? [])].sort((a, b) => a.localeCompare(b)),
      soonestExpiryDays: soonest,
      status: statusFor({ daysToExpiry: soonest, available, reorderLevel: m.reorderLevel }),
    };
  });
}

/** Every matching product. For callers that need them all (the API); a table should use listMastersPage. */
export async function listMasters(opts: MasterOpts = {}): Promise<MasterRow[]> {
  await connectDB();
  const masters = await ProductMaster.find(masterFilter(opts)).sort({ name: 1 }).lean<MasterDoc[]>();
  return withStock(masters);
}

/** One page of products, by name, counted and sliced by the database; stock worked out for that page only. */
export async function listMastersPage(
  opts: MasterOpts & { paging: Paging }
): Promise<{ rows: MasterRow[]; meta: PageMeta }> {
  await connectDB();
  const { rows, meta } = await paginate<MasterDoc>(ProductMaster, masterFilter(opts), {
    sort: { name: 1 },
    paging: opts.paging,
  });
  return { rows: await withStock(rows), meta };
}

/**
 * The product figures for the cards, worked out by the database over EVERY
 * matching product, not just the page on screen.
 *
 * "At or below reorder" means the status is low or out, by the same rule as
 * statusFor(): out when nothing is available; otherwise low when available is at
 * or under the reorder level AND nothing is expiring inside 90 days (expiring
 * takes precedence, exactly as it does on the row).
 */
export async function masterStats(opts: MasterOpts = {}): Promise<{ total: number; low: number; lowNames: string[] }> {
  await connectDB();
  const filter = masterFilter(opts);
  const now = new Date();
  const [total, facet] = await Promise.all([
    ProductMaster.countDocuments(filter),
    ProductMaster.aggregate<{ n: Array<{ n: number }>; names: Array<{ name: string }> }>([
      { $match: filter },
      {
        $lookup: {
          from: BatchLot.collection.name,
          let: { id: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$masterId", "$$id"] },
                    { $eq: ["$isActive", true] },
                    { $gt: ["$expiry", now] },
                    { $ne: ["$isQuarantined", true] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                onHand: { $sum: "$qtyOnHand" },
                reserved: { $sum: "$qtyReserved" },
                soonest: { $min: { $cond: [{ $gt: ["$qtyOnHand", 0] }, "$expiry", null] } },
              },
            },
          ],
          as: "s",
        },
      },
      { $set: { s: { $first: "$s" } } },
      {
        $set: {
          available: { $max: [0, { $subtract: [{ $ifNull: ["$s.onHand", 0] }, { $ifNull: ["$s.reserved", 0] }] }] },
          soonestDays: {
            $cond: [
              { $eq: [{ $ifNull: ["$s.soonest", null] }, null] },
              null,
              { $floor: { $divide: [{ $subtract: ["$s.soonest", now] }, DAY] } },
            ],
          },
        },
      },
      {
        $match: {
          $expr: {
            $or: [
              { $lte: ["$available", 0] },
              {
                $and: [
                  { $or: [{ $eq: ["$soonestDays", null] }, { $gt: ["$soonestDays", EXPIRING_SOON_DAYS] }] },
                  { $lte: ["$available", "$reorderLevel"] },
                ],
              },
            ],
          },
        },
      },
      { $sort: { name: 1, _id: 1 } },
      { $facet: { n: [{ $count: "n" }], names: [{ $limit: 2 }, { $project: { name: 1 } }] } },
    ]),
  ]);
  return { total, low: facet[0]?.n[0]?.n ?? 0, lowNames: (facet[0]?.names ?? []).map((m) => m.name) };
}

/** Just enough of each product for a picker: no stock figures, so no batch is read. */
export async function masterChoices(opts: MasterOpts = {}) {
  await connectDB();
  const rows = await ProductMaster.find(masterFilter(opts))
    .sort({ name: 1 })
    .select("name canonicalUnit")
    .lean<Array<{ _id: unknown; name: string; canonicalUnit: Unit }>>();
  return rows.map((m) => ({ id: String(m._id), name: m.name, canonicalUnit: m.canonicalUnit }));
}

type LotDoc = {
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
};

/**
 * The database's filter for lots, search included.
 *
 * Batch number and brand are on the lot, so they are matched in the query. The
 * drug's name is on the product, so the matching products are found first (a
 * small lookup on a short list) and lots are then matched by their product.
 * This search used to be a `.filter()` over every lot already loaded, so the
 * database could neither use an index for it nor page the result.
 */
async function lotFilter(opts: { masterId?: string; q?: string }): Promise<Record<string, unknown>> {
  const filter: Record<string, unknown> = { isActive: true };
  if (opts.masterId) filter.masterId = opts.masterId;
  if (opts.q) {
    const rx = new RegExp(opts.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const byName = await ProductMaster.find({ name: rx }).select("_id").lean<Array<{ _id: unknown }>>();
    filter.$or = [
      { batchNo: rx },
      { brandName: rx },
      ...(byName.length ? [{ masterId: { $in: byName.map((m) => m._id) } }] : []),
    ];
  }
  return filter;
}

/** Every matching lot. For a screen that truly needs them all (a picker); a table should use listLotsPage. */
export async function listLots(opts: { masterId?: string; q?: string } = {}): Promise<LotRow[]> {
  await connectDB();
  const lots = await BatchLot.find(await lotFilter(opts)).sort({ expiry: 1 }).lean<LotDoc[]>();
  return toLotRows(lots);
}

/** One page of lots, soonest expiry first, counted and sliced by the database. */
export async function listLotsPage(opts: {
  masterId?: string;
  q?: string;
  paging: Paging;
}): Promise<{ rows: LotRow[]; meta: PageMeta }> {
  await connectDB();
  const { rows, meta } = await paginate<LotDoc>(BatchLot, await lotFilter(opts), {
    sort: { expiry: 1 },
    paging: opts.paging,
  });
  return { rows: await toLotRows(rows), meta };
}

/**
 * The figures over the matching lots, counted by the database.
 *
 * Same definitions the screen always used: "expiring" is 0 to 90 whole days left
 * (so the edge is 91 days), "expired on the shelf" is past its date with units
 * still on hand.
 */
export async function lotStats(opts: { masterId?: string; q?: string } = {}) {
  await connectDB();
  const filter = await lotFilter(opts);
  const now = new Date();
  const edge = new Date(now.getTime() + (EXPIRING_SOON_DAYS + 1) * DAY);
  const [total, expiring, expiredOnShelf] = await Promise.all([
    BatchLot.countDocuments(filter),
    BatchLot.countDocuments({ ...filter, expiry: { $gte: now, $lt: edge } }),
    BatchLot.countDocuments({ ...filter, expiry: { $lt: now }, qtyOnHand: { $gt: 0 } }),
  ]);
  return { total, expiring, expiredOnShelf };
}

/** Lots as the screens show them: with the product's name, and their status worked out. */
async function toLotRows(lots: LotDoc[]): Promise<LotRow[]> {
  const now = new Date();
  const masters = await ProductMaster.find({
    _id: { $in: [...new Set(lots.map((l) => String(l.masterId)))] },
  }).lean<Array<{ _id: unknown; name: string; reorderLevel: number }>>();
  const masterById = new Map(masters.map((m) => [String(m._id), m]));

  return lots.map((l) => {
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

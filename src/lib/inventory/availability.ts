import { connectDB } from "@/lib/db/mongoose";
import { BatchLot, Drip, ProductMaster, SessionKit } from "@/lib/models";
import type { Unit } from "@/lib/models/types";
import { convert } from "./units";

export type LotView = {
  lotId: string;
  batchNo: string;
  expiry: string;
  daysToExpiry: number;
  /** Units physically on the shelf and not promised to a confirmed order. */
  usableUnits: number;
  contentValue: number;
  contentUnit: Unit;
};

export type IngredientAvailability = {
  masterId: string;
  drugName: string;
  role: string;
  dosePerDrip: number;
  doseUnit: Unit;
  /** Drips possible if every milligram were usable. */
  pooledDrips: number;
  /** Drips possible drawing whole units FEFO — the realistic number. */
  wholeVialDrips: number;
  /** Drips lost to the indivisibility of single-use vials. */
  wastageDrips: number;
  /** Active content discarded across the whole-vial run. */
  wastedContent: number;
  unitsRequired: number;
  totalUsableUnits: number;
  unitSlip: boolean;
  batches: LotView[];
};

export type DripAvailability = {
  dripId: string;
  dripName: string;
  requested: number;
  pooledAvailability: number;
  wholeVialAvailability: number;
  canFulfil: boolean;
  bottleneck: { ingredient: string; availableUnits: number; requiredPerDrip: number } | null;
  ingredients: IngredientAvailability[];
};

export type AvailabilityResult = {
  results: DripAvailability[];
  warnings: string[];
};

const DAY = 86_400_000;
const EXPIRING_SOON_DAYS = 90;

type IngredientSpec = {
  masterId: string;
  name: string;
  role: string;
  dose: number;
  unit: Unit;
};

/**
 * Simulate drawing `dose` per drip from FEFO-ordered lots, drawing whole units.
 * Single-use lots waste the remainder of every opened unit; multidose lots
 * carry it to the next drip.
 */
function simulateWholeUnits(
  lots: LotView[],
  dose: number,
  doseUnit: Unit,
  isMultidose: boolean,
  cap: number
): { drips: number; unitsUsed: number; wastedContent: number } {
  const shelf = lots.map((l) => ({ ...l, left: l.usableUnits }));
  let drips = 0;
  let unitsUsed = 0;
  let wasted = 0;
  /** Content left in an already-opened multidose unit, in dose units. */
  let carry = 0;

  while (drips < cap) {
    let need = dose;

    if (isMultidose && carry > 0) {
      const take = Math.min(carry, need);
      carry -= take;
      need -= take;
    }

    let satisfied = need <= 1e-9;

    while (!satisfied) {
      const lot = shelf.find((l) => l.left > 0);
      if (!lot) break;

      const perUnit = convert(lot.contentValue, lot.contentUnit, doseUnit);
      if (perUnit === null || perUnit <= 0) {
        // Unit slip or a zero-content lot: it cannot serve this dose.
        lot.left = 0;
        continue;
      }

      lot.left -= 1;
      unitsUsed += 1;

      if (perUnit >= need) {
        const remainder = perUnit - need;
        need = 0;
        if (isMultidose) carry += remainder;
        else wasted += remainder;
        satisfied = true;
      } else {
        need -= perUnit;
      }
    }

    if (!satisfied) {
      // Ran out mid-drip: the partially drawn units are wasted, not a drip.
      break;
    }
    drips += 1;
  }

  return { drips, unitsUsed, wastedContent: wasted };
}

/** A product as this file needs it, already read from the database. */
type MasterRecord = {
  _id?: unknown;
  name: string;
  isMultidose: boolean;
  isActive: boolean;
  canonicalUnit: Unit;
};

/** One physical lot, already filtered to in-date and unreserved. */
type LotRecord = {
  _id: unknown;
  masterId?: unknown;
  batchNo: string;
  expiry: Date;
  qtyOnHand: number;
  qtyReserved: number;
  contentValue: number;
  contentUnit: Unit;
};

/**
 * Pure: it is handed the product and its shelf rather than fetching them, so
 * the caller can read every product and every lot in one query each instead of
 * two per ingredient per drip.
 */
function ingredientAvailability(
  spec: IngredientSpec,
  requested: number,
  now: Date,
  warnings: string[],
  master: MasterRecord | null,
  /** Every usable lot of this master, earliest expiry first. */
  lotsForMaster: LotRecord[]
): IngredientAvailability {
  const drugName = master?.name ?? spec.name;
  const isMultidose = master?.isMultidose ?? false;
  // A retired product is hidden from every stock view, so counting its lots
  // here would promise drips from stock nobody is watching.
  const retired = master ? master.isActive === false : false;
  if (retired) {
    warnings.push(`${drugName} has been retired, so nothing can be prepared from it`);
  }

  // Expired and quarantined batches were already excluded when the shelf was
  // read — never counted, never dispensed.
  const lots = retired ? [] : lotsForMaster;

  const batches: LotView[] = lots.map((l) => {
    const daysToExpiry = Math.floor((l.expiry.getTime() - now.getTime()) / DAY);
    if (daysToExpiry <= EXPIRING_SOON_DAYS) {
      warnings.push(`${drugName}: batch ${l.batchNo} expires in ${daysToExpiry} days`);
    }
    return {
      lotId: String(l._id),
      batchNo: l.batchNo,
      expiry: l.expiry.toISOString(),
      daysToExpiry,
      usableUnits: Math.max(0, l.qtyOnHand - l.qtyReserved),
      contentValue: l.contentValue,
      contentUnit: l.contentUnit,
    };
  });

  let unitSlip = false;
  let pooledContent = 0;
  let totalUsableUnits = 0;

  for (const b of batches) {
    totalUsableUnits += b.usableUnits;
    const perUnit = convert(b.contentValue, b.contentUnit, spec.unit);
    if (perUnit === null) {
      unitSlip = true;
      warnings.push(
        `${drugName}: batch ${b.batchNo} is measured in ${b.contentUnit} but the recipe doses in ${spec.unit}`
      );
      continue;
    }
    pooledContent += perUnit * b.usableUnits;
  }

  const pooledDrips = spec.dose > 0 ? Math.floor(pooledContent / spec.dose) : 0;

  // Simulate a little past what was asked so the ceiling is visible.
  const cap = Math.max(requested, pooledDrips) + 1;
  const sim = simulateWholeUnits(batches, spec.dose, spec.unit, isMultidose, cap);
  const forRequested = simulateWholeUnits(batches, spec.dose, spec.unit, isMultidose, requested);

  return {
    masterId: spec.masterId,
    drugName,
    role: spec.role,
    dosePerDrip: spec.dose,
    doseUnit: spec.unit,
    pooledDrips,
    wholeVialDrips: sim.drips,
    wastageDrips: Math.max(0, pooledDrips - sim.drips),
    wastedContent: Math.round(sim.wastedContent * 100) / 100,
    unitsRequired: forRequested.unitsUsed,
    totalUsableUnits,
    unitSlip,
    batches,
  };
}

/**
 * How many of each drip can actually be prepared right now. Every ingredient is
 * checked against in-date, unreserved stock; the lowest count wins and names
 * the bottleneck.
 */
export async function checkAvailability(
  items: Array<{ dripId: string; quantity: number }>,
  includeKits = true
): Promise<AvailabilityResult> {
  await connectDB();
  const now = new Date();
  const warnings: string[] = [];
  const results: DripAvailability[] = [];

  /**
   * Everything is read up front, in four queries, rather than per ingredient
   * inside the loop.
   *
   * The public catalogue asks about every drip at once. Fetching each product
   * and its lots inside the loop meant roughly twenty round trips per drip —
   * unnoticeable for nine drips, and about thirty-five seconds for two hundred.
   * The arithmetic below is unchanged; only the reads moved.
   */
  const drips = await Drip.find({ _id: { $in: items.map((i) => i.dripId) } }).lean<
    Array<{
      _id: unknown;
      name: string;
      withKit: boolean;
      kitId?: unknown;
      ingredients: Array<{ masterId: unknown; name?: string; dose: number; unit: Unit; role: string }>;
    }>
  >();
  const dripById = new Map(drips.map((d) => [String(d._id), d]));

  /* Kits: the ones a drip names, plus the default for those that name none. */
  const namedKitIds = drips.filter((d) => d.withKit && d.kitId).map((d) => d.kitId);
  const needsDefault = drips.some((d) => d.withKit && !d.kitId);
  const kitConditions: Record<string, unknown>[] = [];
  if (namedKitIds.length) kitConditions.push({ _id: { $in: namedKitIds } });
  if (needsDefault) kitConditions.push({ isDefault: true, isActive: true });

  const kits =
    includeKits && kitConditions.length
      ? await SessionKit.find({ $or: kitConditions }).lean<
          Array<{ _id: unknown; isDefault: boolean; isActive: boolean; items: Array<{ masterId: unknown; qty: number }> }>
        >()
      : [];
  const kitById = new Map(kits.map((k) => [String(k._id), k]));
  const defaultKit = kits.find((k) => k.isDefault && k.isActive) ?? null;

  /* Work out what each drip needs, so every product involved is known before
     a single stock query runs. */
  const specsByDrip = new Map<string, IngredientSpec[]>();
  for (const item of items) {
    const drip = dripById.get(String(item.dripId));
    if (!drip) {
      warnings.push(`Drip ${item.dripId} no longer exists`);
      continue;
    }

    const specs: IngredientSpec[] = drip.ingredients.map((i) => ({
      masterId: String(i.masterId),
      name: i.name ?? "",
      role: i.role,
      dose: i.dose,
      unit: i.unit,
    }));

    // The session kit is deducted per drip prepared, so its consumables are
    // ingredients for availability purposes.
    if (includeKits && drip.withKit) {
      const kit = drip.kitId ? (kitById.get(String(drip.kitId)) ?? null) : defaultKit;
      for (const k of kit?.items ?? []) {
        specs.push({ masterId: String(k.masterId), name: "", role: "KIT", dose: k.qty, unit: "unit" });
      }
    }

    specsByDrip.set(String(item.dripId), specs);
  }

  const masterIds = [...new Set([...specsByDrip.values()].flat().map((s) => s.masterId))];

  const [masters, lots] = await Promise.all([
    ProductMaster.find({ _id: { $in: masterIds } }).lean<MasterRecord[]>(),
    // One read of the whole shelf. Sorted globally by expiry, so each product's
    // bucket below comes out earliest-first, which is what FEFO needs.
    BatchLot.find({
      masterId: { $in: masterIds },
      isActive: true,
      isQuarantined: false,
      expiry: { $gt: now },
      $expr: { $gt: ["$qtyOnHand", "$qtyReserved"] },
    })
      .sort({ expiry: 1 })
      .lean<LotRecord[]>(),
  ]);

  const masterById = new Map(masters.map((m) => [String(m._id), m]));
  const lotsByMaster = new Map<string, LotRecord[]>();
  for (const lot of lots) {
    const key = String(lot.masterId);
    const bucket = lotsByMaster.get(key);
    if (bucket) bucket.push(lot);
    else lotsByMaster.set(key, [lot]);
  }

  for (const item of items) {
    const drip = dripById.get(String(item.dripId));
    if (!drip) continue; // already reported above

    const specs = specsByDrip.get(String(item.dripId)) ?? [];
    const ingredients: IngredientAvailability[] = specs.map((spec) =>
      ingredientAvailability(
        spec,
        item.quantity,
        now,
        warnings,
        masterById.get(spec.masterId) ?? null,
        lotsByMaster.get(spec.masterId) ?? []
      )
    );

    const pooled = ingredients.length ? Math.min(...ingredients.map((i) => i.pooledDrips)) : 0;
    const whole = ingredients.length ? Math.min(...ingredients.map((i) => i.wholeVialDrips)) : 0;

    const bottleneckIngredient = ingredients.length
      ? ingredients.reduce((lo, i) => (i.wholeVialDrips < lo.wholeVialDrips ? i : lo))
      : null;

    results.push({
      dripId: String(drip._id),
      dripName: drip.name,
      requested: item.quantity,
      pooledAvailability: pooled,
      wholeVialAvailability: whole,
      canFulfil: whole >= item.quantity,
      bottleneck: bottleneckIngredient
        ? {
            ingredient: bottleneckIngredient.drugName,
            availableUnits: bottleneckIngredient.totalUsableUnits,
            requiredPerDrip: bottleneckIngredient.dosePerDrip,
          }
        : null,
      ingredients,
    });
  }

  return { results, warnings: [...new Set(warnings)] };
}

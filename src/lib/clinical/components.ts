import { BatchLot, Drip } from "@/lib/models";
import { convert } from "@/lib/inventory/units";
import type { Unit } from "@/lib/models/types";

export type GivenComponent = {
  name: string;
  dose: number;
  unit: Unit;
  batchNo?: string;
  lotId?: unknown;
};

export type LotView = {
  lotId: unknown;
  batchNo: string;
  /** Active content per physical unit, in the lot's own unit. */
  contentValue: number;
  contentUnit: Unit;
  /** Units on the shelf and not promised to a confirmed order. */
  usable: number;
};

export type IngredientSpec = { name: string; dose: number; unit: Unit };

/**
 * Which physical units one session will draw, and from which batch.
 *
 * A dose is not always one vial: 15,000 mg of ascorbic acid is two 7,500 mg
 * vials, and under FEFO those two can come from different lots — the last unit
 * of a short-dated batch, then the first of the next. Recording only the first
 * batch would name one lot on a report where two were given, and a recall
 * notice answered from that report would miss a patient.
 *
 * So this walks the shelf the way dispatch does — earliest expiry first, whole
 * units only — and returns one row per lot actually touched, carrying the
 * content that came from it.
 */
export function planDraw(ingredients: IngredientSpec[], lotsByMaster: Map<string, LotView[]>, masterIdOf: (i: number) => string): GivenComponent[] {
  const rows: GivenComponent[] = [];

  ingredients.forEach((ing, index) => {
    const shelf = (lotsByMaster.get(masterIdOf(index)) ?? []).map((l) => ({ ...l, left: l.usable }));

    if (shelf.length === 0) {
      // Nothing in date. Record the intent so the report is not silently short.
      rows.push({ name: ing.name, dose: ing.dose, unit: ing.unit });
      return;
    }

    let need = ing.dose;
    let drewAnything = false;

    for (const lot of shelf) {
      if (need <= 1e-9) break;
      const perUnit = convert(lot.contentValue, lot.contentUnit, ing.unit);
      // A lot measured in another family cannot serve this dose; skip it rather
      // than guess a conversion.
      if (perUnit === null || perUnit <= 0) continue;

      let fromThisLot = 0;
      while (need > 1e-9 && lot.left > 0) {
        lot.left -= 1;
        fromThisLot += Math.min(perUnit, need);
        need -= perUnit;
      }

      if (fromThisLot > 0) {
        drewAnything = true;
        rows.push({
          name: ing.name,
          dose: Math.round(fromThisLot * 100) / 100,
          unit: ing.unit,
          batchNo: lot.batchNo,
          lotId: lot.lotId,
        });
      }
    }

    // Every usable lot exhausted before the dose was met, or none could serve
    // it at all: say so rather than record a dose nothing backed.
    if (!drewAnything) rows.push({ name: ing.name, dose: ing.dose, unit: ing.unit });
  });

  return rows;
}

/**
 * The batches this drip's session will actually be drawn from, decided the way
 * the pharmacy decides it. Recorded on the session so a manufacturer recall
 * traces to the patient, not only to the order.
 */
export async function componentsForDrip(dripId: unknown): Promise<GivenComponent[]> {
  const drip = await Drip.findById(dripId).lean<{
    ingredients: Array<{ masterId: unknown; name?: string; dose: number; unit: Unit }>;
  } | null>();
  if (!drip) return [];

  const masterIds = [...new Set(drip.ingredients.map((i) => String(i.masterId)))];
  const lots = await BatchLot.find({
    masterId: { $in: masterIds },
    isActive: true,
    isQuarantined: false,
    expiry: { $gt: new Date() },
    $expr: { $gt: ["$qtyOnHand", "$qtyReserved"] },
  })
    .sort({ expiry: 1 })
    .lean<
      Array<{
        _id: unknown;
        masterId: unknown;
        batchNo: string;
        contentValue: number;
        contentUnit: Unit;
        qtyOnHand: number;
        qtyReserved: number;
      }>
    >();

  const byMaster = new Map<string, LotView[]>();
  for (const l of lots) {
    const key = String(l.masterId);
    const view: LotView = {
      lotId: l._id,
      batchNo: l.batchNo,
      contentValue: l.contentValue,
      contentUnit: l.contentUnit,
      usable: Math.max(0, l.qtyOnHand - l.qtyReserved),
    };
    byMaster.set(key, [...(byMaster.get(key) ?? []), view]);
  }

  return planDraw(
    drip.ingredients.map((i) => ({ name: i.name ?? "", dose: i.dose, unit: i.unit })),
    byMaster,
    (index) => String(drip.ingredients[index].masterId)
  );
}

import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { MobileShell } from "@/components/layout/MobileShell";
import { nurseRoute } from "@/lib/data/sessions";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, Drip, ProductMaster, BatchLot } from "@/lib/models";
import { FillDepleting } from "@/components/ui/Fill";
import { EmptyState } from "@/components/ui/States";
import { formatDate } from "@/lib/data/inventory";
import { NURSE_TABS } from "../tabs";
import type { Unit } from "@/lib/models/types";
import { convert } from "@/lib/inventory/units";

export const metadata: Metadata = { title: "My kit" };
export const dynamic = "force-dynamic";

/**
 * What the nurse is carrying, measured against what today's route actually
 * needs. The Fill encodes coverage, not a vague "stock level".
 */
export default async function KitPage() {
  const session = await requireRole("nurse", "superadmin");
  const route = await nurseRoute(session.sub);
  await connectDB();

  const bookings = await Booking.find({
    _id: { $in: route.map((r) => r.id) },
    status: { $nin: ["cancelled", "completed"] },
  }).lean<Array<{ dripId: unknown }>>();

  const drips = await Drip.find({ _id: { $in: bookings.map((b) => b.dripId) } }).lean<
    Array<{ _id: unknown; ingredients: Array<{ masterId: unknown; name?: string; dose: number; unit: Unit }> }>
  >();
  const dripById = new Map(drips.map((d) => [String(d._id), d]));

  // Add up what the remaining sessions will consume, per product.
  const needed = new Map<string, { name: string; dose: number; unit: Unit }>();
  for (const b of bookings) {
    const drip = dripById.get(String(b.dripId));
    for (const ing of drip?.ingredients ?? []) {
      const key = String(ing.masterId);
      const cur = needed.get(key);
      if (cur) {
        const add = convert(ing.dose, ing.unit, cur.unit);
        // Recipes are validated against the product's canonical unit when they
        // are built, so this should never be null; if it ever is, count the
        // dose at face value rather than silently as nothing.
        cur.dose += add ?? ing.dose;
      } else {
        needed.set(key, { name: ing.name ?? "", dose: ing.dose, unit: ing.unit });
      }
    }
  }

  const masters = await ProductMaster.find({ _id: { $in: [...needed.keys()] } }).lean<
    Array<{ _id: unknown; name: string }>
  >();
  const masterById = new Map(masters.map((m) => [String(m._id), m]));

  const lots = await BatchLot.find({
    masterId: { $in: [...needed.keys()] },
    isActive: true,
    isQuarantined: false,
    expiry: { $gt: new Date() },
  })
    .sort({ expiry: 1 })
    .lean<
      Array<{
        masterId: unknown;
        batchNo: string;
        expiry: Date;
        qtyOnHand: number;
        qtyReserved: number;
        contentValue: number;
        contentUnit: Unit;
      }>
    >();

  const items = [...needed.entries()].map(([masterId, need]) => {
    // Two lots of the same drug can be different strengths — the schema says so
    // explicitly. Taking the first lot's strength and multiplying by the total
    // unit count would report a coverage figure no shelf actually holds, so
    // every lot is measured at its own strength and the results added up.
    const own = lots.filter((l) => String(l.masterId) === masterId);
    const usable = own.map((l) => ({
      lot: l,
      units: Math.max(0, l.qtyOnHand - l.qtyReserved),
      perUnit: convert(l.contentValue, l.contentUnit, need.unit),
    }));
    // A lot measured in another unit family cannot serve this dose at all.
    const servable = usable.filter((u) => u.perUnit !== null && u.perUnit > 0);

    const units = servable.reduce((n, u) => n + u.units, 0);
    const haveContent = servable.reduce((n, u) => n + (u.perUnit as number) * u.units, 0);
    const coverage = need.dose > 0 ? Math.min(100, (haveContent / need.dose) * 100) : 100;
    // FEFO: the batch that will actually be opened is the soonest to expire.
    const first = servable.find((u) => u.units > 0)?.lot;

    return {
      masterId,
      name: masterById.get(masterId)?.name ?? need.name,
      batchNo: first?.batchNo ?? "—",
      expiry: first?.expiry,
      units,
      coverage,
      enough: coverage >= 100,
      unit: need.unit,
      needed: need.dose,
    };
  });

  items.sort((a, b) => a.coverage - b.coverage);
  const short = items.filter((i) => !i.enough);

  return (
    <MobileShell
      title="My kit"
      subtitle={
        short.length
          ? `${short.length} item${short.length === 1 ? "" : "s"} short for today`
          : "Enough for every session today"
      }
      tabs={NURSE_TABS}
      activeHref="/nurse/kit"
    >
      {items.length === 0 ? (
        <EmptyState
          kind="cleared"
          title="Nothing to carry"
          body="No sessions remain on your route today, so there is nothing to check."
        />
      ) : (
        <>
          {short.length > 0 && (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-caution)] bg-[var(--color-caution-soft)] px-4 py-3 mb-5">
              <span className="t-body font-semibold">Restock before your next session</span>
              <p className="t-body text-[var(--color-ink-2)] mt-1">
                {short.map((s) => s.name).join(", ")} will not cover today&apos;s route.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {items.map((i) => (
              <div
                key={i.masterId}
                className="rounded-[var(--radius-lg)] border p-5"
                style={{
                  borderColor: i.enough ? "var(--color-line)" : "var(--color-caution)",
                  background: i.enough ? "var(--color-surface)" : "var(--color-caution-soft)",
                }}
              >
                <FillDepleting
                  label={i.name}
                  value={`${i.units} ${i.units === 1 ? "unit" : "units"}`}
                  pct={i.coverage}
                  color={
                    i.units === 0
                      ? "var(--color-critical)"
                      : i.enough
                        ? "var(--color-safe)"
                        : "var(--color-caution)"
                  }
                  markerPct={100}
                  note={
                    i.units === 0
                      ? `Out — sessions needing ${i.name} cannot run`
                      : i.enough
                        ? `Enough for today · batch ${i.batchNo}`
                        : `Covers ${Math.round(i.coverage)}% of today's need`
                  }
                />
                {i.expiry && (
                  <span className="t-small text-[var(--color-ink-3)] block mt-2">
                    Batch {i.batchNo} · expires {formatDate(i.expiry)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-5 mt-5">
        <span className="t-micro">Anaphylaxis kit</span>
        <p className="t-body text-[var(--color-ink-2)] mt-2">
          Check the seal is intact before the first session of the day. A broken seal means the kit is spent, whatever
          it looks like inside.
        </p>
      </div>
    </MobileShell>
  );
}

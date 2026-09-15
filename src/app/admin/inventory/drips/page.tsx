import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { adminNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { connectDB } from "@/lib/db/mongoose";
import { Drip, ProductMaster, SessionKit } from "@/lib/models";
import { checkAvailability } from "@/lib/inventory/availability";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { FillBar } from "@/components/ui/Fill";
import { ButtonLink } from "@/components/ui/Button";
import { formatInr } from "@/lib/inventory/units";
import type { Unit } from "@/lib/models/types";
import { sameFamily } from "@/lib/inventory/units";
import { DripLibrary } from "./DripLibrary";
import { KitEditor } from "./KitEditor";

export const metadata: Metadata = { title: "Drip builder" };
export const dynamic = "force-dynamic";

const ROLE_TONE = {
  ACTIVE: "primary",
  FLUID: "info",
  PREMED: "caution",
  ADDITIVE: "neutral",
} as const;

export default async function DripBuilderPage() {
  const session = await requireRole("superadmin", "admin");
  const nav = await adminNav();

  await connectDB();
  const drips = await Drip.find({}).sort({ name: 1 }).lean<
    Array<{
      _id: unknown;
      name: string;
      slug: string;
      tagline?: string;
      description?: string;
      infusionNotes?: string;
      priceInr: number;
      hsnCode?: string;
      gstRate?: number;
      durationMin: number;
      isActive: boolean;
      withKit: boolean;
      category?: string | null;
      kitId?: unknown;
      durationToMin?: number | null;
      volumeMl?: number | null;
      tags?: string[];
      icon?: string | null;
      isPopular?: boolean;
      benefits?: Array<{ title: string; description?: string }>;
      ingredients: Array<{ masterId: unknown; name?: string; dose: number; unit: Unit; role: string; notes?: string }>;
    }>
  >();

  const masters = await ProductMaster.find({ isActive: true }).sort({ name: 1 }).lean<
    Array<{ _id: unknown; name: string; canonicalUnit: Unit; category: string }>
  >();
  const masterById = new Map(masters.map((m) => [String(m._id), m]));

  const allKits = await SessionKit.find({ isActive: true })
    .sort({ isDefault: -1, name: 1 })
    .lean<Array<{ _id: unknown; name: string; isDefault: boolean; items?: unknown[] }>>();

  const kit = await SessionKit.findOne({ isDefault: true }).lean<{
    _id: unknown;
    name: string;
    description?: string;
    items: Array<{ masterId: unknown; qty: number }>;
  } | null>();

  const { results } = await checkAvailability(
    drips.filter((d) => d.isActive).map((d) => ({ dripId: String(d._id), quantity: 1 })),
    true
  );
  const availableByDrip = new Map(results.map((r) => [r.dripId, r.wholeVialAvailability]));

  return (
    <ConsoleShell
      session={session}
      roleLabel={session.role === "superadmin" ? "Super admin" : "Admin"}
      nav={nav}
      activeHref="/admin/inventory/drips"
      breadcrumb={["Inventory", "Drip builder"]}
      title="Drip library"
      meta={`${drips.length} formulas`}
      actions={<ButtonLink href="/admin/inventory/availability">Check availability</ButtonLink>}
    >
      {session.role === "superadmin" && (
        <div className="mb-6">
          <DripLibrary
            masters={masters.map((m) => ({
              id: String(m._id),
              name: m.name,
              canonicalUnit: m.canonicalUnit,
              category: m.category,
            }))}
            kits={allKits.map((k) => ({
              id: String(k._id),
              name: k.name,
              isDefault: Boolean(k.isDefault),
              itemCount: (k.items ?? []).length,
            }))}
            drips={drips.map((d) => ({
              id: String(d._id),
              name: d.name,
              slug: d.slug,
              tagline: d.tagline ?? "",
              description: d.description ?? "",
              infusionNotes: d.infusionNotes ?? "",
              durationMin: String(d.durationMin ?? 45),
              priceInr: String(d.priceInr ?? 0),
              hsnCode: d.hsnCode ?? "",
              gstRate: d.gstRate === undefined || d.gstRate === null ? "" : String(d.gstRate),
              category: d.category ?? "",
              durationToMin: d.durationToMin != null ? String(d.durationToMin) : "",
              volumeMl: d.volumeMl != null ? String(d.volumeMl) : "",
              tags: d.tags ?? [],
              icon: d.icon ?? "",
              isPopular: Boolean(d.isPopular),
              benefits: (d.benefits ?? []).map((b) => ({ title: b.title, description: b.description ?? "" })),
              withKit: d.withKit,
              kitId: d.kitId ? String(d.kitId) : "",
              isPublic: true,
              requiresApproval: true,
              isActive: d.isActive,
              ingredients: d.ingredients.map((i) => ({
                masterId: String(i.masterId),
                dose: String(i.dose),
                unit: i.unit,
                role: i.role,
                notes: i.notes ?? "",
              })),
            }))}
          />
        </div>
      )}

      <p className="t-body text-[var(--color-ink-2)] max-w-[76ch] mb-6" style={{ textWrap: "pretty" }}>
        A recipe is ingredients plus doses plus roles. Where a dose is expressed in a different unit family from the
        product master&apos;s canonical unit, the slip is flagged inline — the engine cannot convert across families
        and will not guess.
      </p>

      <div className="grid gap-4 xl:grid-cols-2">
        {drips.map((d) => {
          const available = availableByDrip.get(String(d._id)) ?? 0;
          const maxDose = Math.max(...d.ingredients.map((i) => i.dose), 1);

          return (
            <Card key={String(d._id)} padding="p-6" className="h-full flex flex-col">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="t-h3">{d.name}</h2>
                    {d.isActive ? <Pill tone="safe">Active</Pill> : <Pill tone="neutral">Inactive</Pill>}
                    {d.withKit && <Pill tone="primary">Kit included</Pill>}
                  </div>
                  {d.description && (
                    <p className="t-body text-[var(--color-ink-2)] mt-2 max-w-[54ch]">{d.description}</p>
                  )}
                </div>
                <div className="flex flex-col items-end flex-none">
                  <span className="t-data text-[18px]">{formatInr(d.priceInr)}</span>
                  <span className="t-small text-[var(--color-ink-3)]">{d.durationMin} min</span>
                </div>
              </div>

              <div className="flex flex-col gap-[14px] py-4 border-t border-[var(--color-line)]">
                {d.ingredients.map((ing, i) => {
                  const master = masterById.get(String(ing.masterId));
                  const slip = master ? !sameFamily(ing.unit, master.canonicalUnit) : false;
                  return (
                    <div key={i}>
                      <FillBar
                        label={
                          <span className="flex items-center gap-2 flex-wrap">
                            {ing.name ?? master?.name}
                            <Pill tone={ROLE_TONE[ing.role as keyof typeof ROLE_TONE] ?? "neutral"}>
                              {ing.role}
                            </Pill>
                          </span>
                        }
                        value={`${ing.dose.toLocaleString("en-IN")} ${ing.unit}`}
                        pct={(ing.dose / maxDose) * 100}
                        color={ing.role === "ACTIVE" ? "var(--color-primary)" : "var(--color-primary-line)"}
                      />
                      {slip && (
                        <span className="t-small text-[var(--color-critical-text)] block mt-[6px]">
                          Unit slip — dosed in {ing.unit}, but {master?.name} is held in{" "}
                          {master?.canonicalUnit}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-4 mt-auto pt-4 border-t border-[var(--color-line)] flex-wrap">
                <div className="flex gap-6">
                  <div className="flex flex-col">
                    <span className="t-micro">Can prepare</span>
                    <span
                      className="t-data text-[16px]"
                      style={{
                        color:
                          available === 0
                            ? "var(--color-critical)"
                            : available <= 3
                              ? "var(--color-caution)"
                              : "var(--color-safe)",
                      }}
                    >
                      {available}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="t-micro">Components</span>
                    <span className="t-data text-[16px]">{d.ingredients.length}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <ButtonLink href={`/drips/${d.slug}`} variant="secondary" size="sm">
                    Public page
                  </ButtonLink>
                  <ButtonLink
                    href={`/admin/inventory/availability?drip=${d.slug}&qty=10`}
                    variant="ghost"
                    size="sm"
                  >
                    Check stock
                  </ButtonLink>
                </div>
              </div>

              {d.infusionNotes && (
                <p className="t-small text-[var(--color-ink-2)] mt-4 pt-4 border-t border-[var(--color-line)]">
                  {d.infusionNotes}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      {/* ---------------- Session kit ---------------- */}
      {kit && (
        <section className="mt-8">
          <h2 className="t-h3 mb-1">{kit.name}</h2>
          <p className="t-body text-[var(--color-ink-2)] mb-4">
            Deducted per drip prepared, on top of the formula&apos;s own ingredients — so it counts in every
            availability figure.
          </p>
          {session.role === "superadmin" ? (
            <KitEditor
              kit={{
                id: String(kit._id),
                name: kit.name,
                description: kit.description,
                items: kit.items.map((i) => ({ masterId: String(i.masterId), qty: i.qty })),
              }}
              masters={masters.map((m) => ({ id: String(m._id), name: m.name, category: m.category }))}
            />
          ) : (
            <Card padding="p-5">
              <div className="flex flex-col gap-3">
                {kit.items.map((item, i) => (
                  <div key={i} className="flex justify-between gap-4 items-baseline">
                    <span className="t-body text-[var(--color-ink-2)]">
                      {masterById.get(String(item.masterId))?.name ?? "Unknown item"}
                    </span>
                    <span className="t-data text-[14.5px]">{item.qty} per drip</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </section>
      )}

      <p className="t-small text-[var(--color-ink-3)] mt-8">
        A recipe that has already been given to somebody is retired rather than deleted, and one with confirmed
        orders against it cannot be changed until those are dispatched or cancelled — the reserved vials have to keep
        matching what will actually be prepared.
      </p>
    </ConsoleShell>
  );
}

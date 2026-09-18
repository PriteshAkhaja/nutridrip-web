import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { adminNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { checkAvailability } from "@/lib/inventory/availability";
import { listDrips } from "@/lib/data/drips";
import { formatInr } from "@/lib/inventory/units";
import { expiryPhrase, formatDate } from "@/lib/data/inventory";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { AvailabilityControls } from "./Controls";

export const metadata: Metadata = { title: "Availability" };
export const dynamic = "force-dynamic";

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ drip?: string; qty?: string; kit?: string }>;
}) {
  const session = await requireRole("superadmin", "admin");
  const nav = await adminNav();

  const { drip: dripSlug, qty, kit } = await searchParams;
  const drips = await listDrips();
  const selected = drips.find((d) => d.slug === dripSlug) ?? drips[0];
  const quantity = Math.max(1, Number(qty) || 10);
  const includeKits = kit !== "0";

  const { results, warnings } = await checkAvailability(
    selected ? [{ dripId: selected.id, quantity }] : [],
    includeKits
  );
  const result = results[0];

  return (
    <ConsoleShell
      session={session}
      roleLabel={session.role === "superadmin" ? "Super admin" : "Admin"}
      nav={nav}
      activeHref="/admin/inventory/availability"
      breadcrumb={["Inventory", "Availability"]}
      title="Availability calculator"
      meta="Live · recomputed on every load"
    >
      <p className="t-body text-[var(--color-ink-2)] max-w-[76ch] mb-6" style={{ textWrap: "pretty" }}>
        Stock does not divide evenly. A vial opened for one patient cannot be pooled into the next, so the honest
        answer to &ldquo;how many drips can we run today&rdquo; is always lower than the arithmetic. Both numbers are
        below, and the bottleneck is named.
      </p>

      <AvailabilityControls
        drips={drips.map((d) => ({ slug: d.slug, name: d.name, category: d.category, keywords: d.headline }))}
        selectedSlug={selected?.slug ?? ""}
        quantity={quantity}
        includeKits={includeKits}
      />

      {!result ? (
        <Card className="mt-6">
          <p className="t-body text-[var(--color-ink-2)]">No active drip formulas to check.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px] items-start mt-6">
          <div className="flex flex-col gap-4">
            {/* ---------------- Headline ---------------- */}
            <Card padding="p-6">
              <div className="flex justify-between items-baseline gap-4 flex-wrap">
                <span style={{ font: "600 18px/1.3 var(--font-display)" }}>{result.dripName}</span>
                <span className="t-small text-[var(--color-ink-3)]">whole-vial maths · FEFO batch order</span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 my-[18px]">
                <div className="rounded-[var(--radius-md)] border border-[var(--color-primary-line)] bg-[var(--color-primary-soft)] p-5">
                  <span className="t-micro text-[var(--color-primary-dark)]">Realistic</span>
                  <div className="t-data mt-2" style={{ font: "500 44px/1.05 var(--font-mono)" }}>
                    {result.wholeVialAvailability}
                  </div>
                  <span className="t-small text-[var(--color-ink-2)]">drips can actually be prepared today</span>
                </div>
                <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-5">
                  <span className="t-micro">Theoretical · pooled</span>
                  <div
                    className="t-data mt-2 text-[var(--color-ink-2)]"
                    style={{ font: "500 44px/1.05 var(--font-mono)" }}
                  >
                    {result.pooledAvailability}
                  </div>
                  <span className="t-small text-[var(--color-ink-2)]">if partial vials could be combined</span>
                </div>
              </div>

              {result.bottleneck && (
                <div className="rounded-[var(--radius-md)] border border-[var(--color-caution)] bg-[var(--color-caution-soft)] p-[16px_18px] flex gap-[14px] items-start">
                  <span
                    className="w-5 h-5 rounded-full bg-[var(--color-caution)] text-white inline-flex items-center justify-center flex-none text-[12px] font-semibold"
                    aria-hidden
                  >
                    !
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="t-body font-semibold">Bottleneck — {result.bottleneck.ingredient}</span>
                    <p className="t-body text-[var(--color-ink-2)] mt-[3px] mb-[10px]">
                      Only <span className="t-data text-[14.5px]">{result.bottleneck.availableUnits} units</span> in
                      date. Every drip needs{" "}
                      <span className="t-data text-[14.5px]">
                        {result.bottleneck.requiredPerDrip.toLocaleString("en-IN")}
                      </span>{" "}
                      of it.
                    </p>
                    <div className="h-[6px] rounded-[2px] bg-white relative overflow-hidden">
                      <div
                        className="absolute top-0 bottom-0 left-0 bg-[var(--color-caution)]"
                        style={{
                          width: `${Math.min(
                            100,
                            result.pooledAvailability
                              ? (result.wholeVialAvailability / result.pooledAvailability) * 100
                              : 0
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* ---------------- Per ingredient ---------------- */}
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--color-line)]">
                <span style={{ font: "600 18px/1.3 var(--font-display)" }}>Per ingredient</span>
              </div>

              <div className="scroll-x">
                <div className="min-w-[720px]">
                  <div className="grid grid-cols-[1.5fr_0.9fr_0.8fr_1.2fr_0.9fr] bg-[var(--color-surface-2)] border-b border-[var(--color-line)]">
                    <div className="t-micro px-5 py-[10px]">Ingredient</div>
                    <div className="t-micro px-3 py-[10px] text-right">Per drip</div>
                    <div className="t-micro px-3 py-[10px] text-right">In date</div>
                    <div className="t-micro px-3 py-[10px]">Supports</div>
                    <div className="t-micro px-5 py-[10px] text-right">Waste</div>
                  </div>

                  {result.ingredients.map((ing) => {
                    const limiting = ing.wholeVialDrips === result.wholeVialAvailability;
                    const color =
                      ing.wholeVialDrips === 0
                        ? "var(--color-critical)"
                        : limiting
                          ? "var(--color-caution)"
                          : "var(--color-safe)";
                    const pct = result.pooledAvailability
                      ? Math.min(100, (ing.wholeVialDrips / Math.max(1, result.pooledAvailability)) * 100)
                      : 0;

                    return (
                      <div
                        key={ing.masterId + ing.role}
                        className="grid grid-cols-[1.5fr_0.9fr_0.8fr_1.2fr_0.9fr] items-center border-b border-[var(--color-line)] last:border-b-0"
                        style={{ background: limiting ? "var(--color-caution-soft)" : "transparent" }}
                      >
                        <div className="px-5 py-[14px] flex flex-col min-w-0">
                          <span className="t-body font-medium truncate">{ing.drugName}</span>
                          <span className="t-data text-[13px] text-[var(--color-ink-3)] truncate">
                            {ing.batches.length
                              ? ing.batches.map((b) => b.batchNo).join(" · ")
                              : "no in-date batches"}
                          </span>
                        </div>
                        <div className="px-3 py-[14px] text-right t-data text-[14.5px]">
                          {ing.dosePerDrip.toLocaleString("en-IN")} {ing.doseUnit}
                        </div>
                        <div className="px-3 py-[14px] text-right t-data text-[14.5px]">{ing.totalUsableUnits}</div>
                        <div className="px-3 py-[14px] flex flex-col gap-[6px]">
                          <span className="t-data text-[14.5px]" style={{ color }}>
                            {ing.wholeVialDrips} drips
                          </span>
                          <div className="h-[5px] rounded-[2px] bg-[var(--color-surface-2)] relative overflow-hidden">
                            <div
                              className="absolute top-0 bottom-0 left-0"
                              style={{ width: `${pct}%`, background: color }}
                            />
                          </div>
                        </div>
                        <div
                          className="px-5 py-[14px] text-right t-data text-[14.5px]"
                          style={{ color: ing.wastedContent > 0 ? "var(--color-caution)" : "var(--color-ink-3)" }}
                        >
                          {ing.wastedContent > 0
                            ? `${ing.wastedContent.toLocaleString("en-IN")} ${ing.doseUnit}`
                            : "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ---------------- Rail ---------------- */}
          <div className="flex flex-col gap-4">
            <Card padding="p-5">
              <span className="t-micro">Requested</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="t-data text-[30px] leading-[1.15]">{result.requested}</span>
                <span className="t-small text-[var(--color-ink-3)]">drips</span>
              </div>
              <div className="mt-4">
                {result.canFulfil ? (
                  <Pill tone="safe" dot>
                    Can be fulfilled
                  </Pill>
                ) : (
                  <Pill tone="critical" dot>
                    Short by {result.requested - result.wholeVialAvailability}
                  </Pill>
                )}
              </div>
              <p className="t-small text-[var(--color-ink-2)] mt-4">
                Wastage across the run:{" "}
                <span className="t-data text-[13px]">
                  {result.pooledAvailability - result.wholeVialAvailability}
                </span>{" "}
                drips&apos; worth of active content, at roughly{" "}
                <span className="t-data text-[13px]">
                  {formatInr((result.pooledAvailability - result.wholeVialAvailability) * 700)}
                </span>
                .
              </p>
            </Card>

            <Card padding="p-5">
              <span className="t-micro">Batch allocation · FEFO</span>
              <div className="flex flex-col gap-4 mt-4">
                {result.ingredients
                  .filter((i) => i.batches.length > 0)
                  .slice(0, 6)
                  .map((ing) => (
                    <div key={ing.masterId + ing.role} className="flex flex-col gap-2">
                      <span className="t-body font-medium">{ing.drugName}</span>
                      {ing.batches.map((b) => (
                        <div key={b.lotId} className="flex items-baseline justify-between gap-3">
                          <span className="t-data text-[13px] text-[var(--color-ink-2)]">{b.batchNo}</span>
                          <span
                            className="t-small"
                            style={{
                              color:
                                b.daysToExpiry <= 30
                                  ? "var(--color-critical-text)"
                                  : b.daysToExpiry <= 90
                                    ? "var(--color-caution-text)"
                                    : "var(--color-ink-3)",
                            }}
                          >
                            {formatDate(b.expiry)} · {expiryPhrase(b.daysToExpiry)}
                          </span>
                          <span className="t-data text-[13px]">{b.usableUnits}</span>
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            </Card>

            {warnings.length > 0 && (
              <Card tone="caution" padding="p-5">
                <span className="t-micro text-[var(--color-caution-text)]">
                  {warnings.length} warning{warnings.length === 1 ? "" : "s"}
                </span>
                <ul className="flex flex-col gap-2 mt-3 list-none p-0 m-0">
                  {warnings.slice(0, 8).map((w) => (
                    <li key={w} className="t-small text-[var(--color-ink-2)]">
                      {w}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}
    </ConsoleShell>
  );
}

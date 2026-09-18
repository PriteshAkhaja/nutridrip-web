import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { adminNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { listMasters, listLots, formatDate, expiryPhrase } from "@/lib/data/inventory";
import { STATUS_STYLE, FillDepleting } from "@/components/ui/Fill";
import { DataTable, THead, TH, TR, TD, Pieces } from "@/components/ui/Table";
import { Pill } from "@/components/ui/Pill";
import { StatCard } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import { ButtonLink } from "@/components/ui/Button";
import { InventoryFilters } from "./Filters";
import { ReceiveStock } from "./ReceiveStock";
import { BatchActions } from "./BatchActions";
import { HeaderCounts } from "@/components/layout/HeaderCounts";
import { MasterActions } from "./MasterActions";
import type { Category } from "@/lib/models/types";

export const metadata: Metadata = { title: "Products & batches" };
export const dynamic = "force-dynamic";

const TONE_FOR_STATUS = {
  healthy: "safe",
  expiring: "caution",
  low: "caution",
  expired: "critical",
  out: "critical",
} as const;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; cat?: string; q?: string }>;
}) {
  const session = await requireRole("superadmin", "admin");
  const nav = await adminNav();

  const { tab = "products", cat, q } = await searchParams;
  const category = (cat as Category) || undefined;

  const [masters, lots] = await Promise.all([listMasters({ category, q }), listLots({ q })]);

  const expiringLots = lots.filter((l) => l.daysToExpiry >= 0 && l.daysToExpiry <= 90);
  const expiredLots = lots.filter((l) => l.daysToExpiry < 0 && l.qtyOnHand > 0);
  const lowMasters = masters.filter((m) => m.status === "low" || m.status === "out");

  return (
    <ConsoleShell
      session={session}
      roleLabel={session.role === "superadmin" ? "Super admin" : "Admin"}
      nav={nav}
      activeHref="/admin/inventory"
      breadcrumb={["Inventory", tab === "batches" ? "Batches" : "Products"]}
      title="Products & batches"
      meta={<HeaderCounts items={[`${masters.length} masters`, `${lots.length} lots`]} />}
      actions={<ButtonLink href="/admin/inventory/alerts" variant="secondary">View alerts</ButtonLink>}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard label="Product masters" value={String(masters.length)} />
        <StatCard label="Batch lots" value={String(lots.length)} />
        <StatCard
          label="Expiring ≤90 days"
          value={String(expiringLots.length)}
          pct={lots.length ? (expiringLots.length / lots.length) * 100 : 0}
          color="var(--color-caution)"
          note={expiredLots.length ? `${expiredLots.length} already expired on the shelf` : "Nothing expired"}
        />
        <StatCard
          label="At or below reorder"
          value={String(lowMasters.length)}
          pct={masters.length ? (lowMasters.length / masters.length) * 100 : 0}
          color="var(--color-critical)"
          note={lowMasters.map((m) => m.name).slice(0, 2).join(", ") || "All healthy"}
        />
      </div>

      {session.role === "superadmin" && (
        <div className="mb-6">
          <ReceiveStock
            masters={masters.map((m) => ({ id: m.id, name: m.name, canonicalUnit: m.canonicalUnit }))}
          />
        </div>
      )}

      <InventoryFilters tab={tab} category={cat} q={q} />

      {tab === "batches" ? (
        lots.length === 0 ? (
          <EmptyState
            kind="filtered"
            title="No batches match"
            body="Nothing on the shelf matches that search. Clearing it brings every lot back."
            actionLabel="Clear filters"
            actionHref="/admin/inventory?tab=batches"
          />
        ) : (
          <DataTable>
            <THead>
              <TR>
                <TH>Drug · brand</TH>
                <TH>Batch</TH>
                <TH>Expiry</TH>
                <TH numeric>Content</TH>
                <TH numeric>On hand</TH>
                <TH numeric>Reserved</TH>
                <TH width="180px">Remaining</TH>
                <TH>Status</TH>
                {session.role === "superadmin" && <TH>Adjust</TH>}
              </TR>
            </THead>
            <tbody>
              {lots.map((l) => {
                const s = STATUS_STYLE[l.status];
                return (
                  <TR key={l.id}>
                    <TD>
                      <div className="flex flex-col">
                        <span className="font-medium whitespace-nowrap">{l.drugName}</span>
                        <span className="t-small text-[var(--color-ink-3)]">
                          <Pieces items={[l.brandName, l.manufacturer]} separator=" · " />
                        </span>
                      </div>
                    </TD>
                    <TD mono nowrap>{l.batchNo}</TD>
                    <TD nowrap>
                      <div className="flex flex-col">
                        <span className="t-data text-[14.5px]">{formatDate(l.expiry)}</span>
                        <span className="t-small" style={{ color: l.daysToExpiry < 0 ? s.color : "var(--color-ink-3)" }}>
                          {expiryPhrase(l.daysToExpiry)}
                        </span>
                      </div>
                    </TD>
                    <TD numeric nowrap>
                      {l.contentValue.toLocaleString("en-IN")} {l.contentUnit}
                    </TD>
                    <TD numeric>{l.qtyOnHand}</TD>
                    <TD numeric>{l.qtyReserved || "—"}</TD>
                    <TD>
                      <div className="min-w-[150px]">
                        <FillDepleting
                          label=""
                          value={`${l.qtyOnHand} / ${l.qtyReceived}`}
                          pct={l.remainingPct}
                          color={s.color}
                          track={s.soft}
                        />
                      </div>
                    </TD>
                    <TD>
                      <Pill tone={TONE_FOR_STATUS[l.status]} dot>
                        {s.label}
                      </Pill>
                    </TD>
                    {session.role === "superadmin" && (
                      <TD>
                        <BatchActions
                          lotId={l.id}
                          batchNo={l.batchNo}
                          drugName={l.drugName}
                          qtyOnHand={l.qtyOnHand}
                          qtyReserved={l.qtyReserved}
                          isQuarantined={l.isQuarantined}
                          isExpired={l.daysToExpiry < 0}
                        />
                      </TD>
                    )}
                  </TR>
                );
              })}
            </tbody>
          </DataTable>
        )
      ) : masters.length === 0 ? (
        <EmptyState
          kind="filtered"
          title="No products match"
          body="No product master matches that search or category. Clearing the filters brings the full list back."
          actionLabel="Clear filters"
          actionHref="/admin/inventory"
        />
      ) : (
        <DataTable>
          <THead>
            <TR>
              <TH>Drug</TH>
              <TH>HSN</TH>
              <TH>Category</TH>
              <TH numeric>In date</TH>
              <TH numeric>Available</TH>
              <TH numeric>Reorder at</TH>
              <TH>Soonest expiry</TH>
              <TH>Status</TH>
              {session.role === "superadmin" && <TH>Edit</TH>}
            </TR>
          </THead>
          <tbody>
            {masters.map((m) => {
              const s = STATUS_STYLE[m.status];
              return (
                <TR key={m.id}>
                  <TD>
                    <Link href={`/admin/inventory?tab=batches&q=${encodeURIComponent(m.name)}`} className="flex flex-col no-underline hover:no-underline">
                      <span className="font-medium whitespace-nowrap text-[var(--color-ink)]">{m.name}</span>
                      <span className="t-small text-[var(--color-ink-3)]">
                        <Pieces separator=" · " items={[m.molecule, `${m.lotCount} lot${m.lotCount === 1 ? "" : "s"}`, m.isMultidose ? "multidose" : null]} />
                      </span>
                    </Link>
                  </TD>
                  <TD mono>{m.hsnCode}</TD>
                  <TD>
                    <span className="t-small text-[var(--color-ink-2)]">{m.category}</span>
                  </TD>
                  <TD numeric>{m.onHand}</TD>
                  <TD numeric>{m.available}</TD>
                  <TD numeric>{m.reorderLevel}</TD>
                  <TD nowrap>
                    {m.soonestExpiryDays === null ? (
                      <span className="t-small text-[var(--color-ink-3)]">Nothing in date</span>
                    ) : (
                      <span
                        className="t-small"
                        style={{
                          color:
                            m.soonestExpiryDays <= 30
                              ? "var(--color-critical-text)"
                              : m.soonestExpiryDays <= 90
                                ? "var(--color-caution-text)"
                                : "var(--color-ink-2)",
                        }}
                      >
                        {expiryPhrase(m.soonestExpiryDays)}
                      </span>
                    )}
                  </TD>
                  <TD>
                    <Pill tone={TONE_FOR_STATUS[m.status]} dot>
                      {s.label}
                    </Pill>
                  </TD>
                  {session.role === "superadmin" && (
                    <TD>
                      <MasterActions
                        masterId={m.id}
                        name={m.name}
                        reorderLevel={m.reorderLevel}
                        isMultidose={m.isMultidose}
                        storageCondition={m.storageCondition}
                      />
                    </TD>
                  )}
                </TR>
              );
            })}
          </tbody>
        </DataTable>
      )}
    </ConsoleShell>
  );
}

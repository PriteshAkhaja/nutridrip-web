import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { adminNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { getAlerts, type StockAlert } from "@/lib/inventory/alerts";
import { formatDate, expiryPhrase } from "@/lib/data/inventory";
import { formatInr } from "@/lib/inventory/units";
import { StatCard } from "@/components/ui/Card";
import { DataTable, THead, TH, TR, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/States";
import { FillDepleting } from "@/components/ui/Fill";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Alerts" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "expiring", label: "Expiring soon" },
  { key: "expired", label: "Expired stock" },
  { key: "low", label: "Low stock" },
  { key: "out", label: "Out of stock" },
] as const;

function ExpiryTable({ rows, expired }: { rows: StockAlert[]; expired: boolean }) {
  return (
    <DataTable>
      <THead>
        <TR>
          <TH>Drug</TH>
          <TH>Batch</TH>
          <TH>Expiry</TH>
          <TH>{expired ? "Expired" : "Time left"}</TH>
          <TH numeric>Units</TH>
          <TH numeric>Value at risk</TH>
        </TR>
      </THead>
      <tbody>
        {rows.map((a) => (
          <TR key={a.lotId}>
            <TD nowrap>
              <span className="font-medium">{a.drugName}</span>
            </TD>
            <TD mono nowrap>{a.batchNo}</TD>
            <TD mono nowrap>{a.expiry ? formatDate(a.expiry) : "—"}</TD>
            <TD nowrap>
              <span
                className="t-small"
                style={{ color: expired ? "var(--color-critical-text)" : "var(--color-caution-text)" }}
              >
                {expiryPhrase(a.daysToExpiry ?? 0)}
              </span>
            </TD>
            <TD numeric>{a.units}</TD>
            <TD numeric>{formatInr(a.valueAtRiskInr ?? 0)}</TD>
          </TR>
        ))}
      </tbody>
    </DataTable>
  );
}

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; days?: string }>;
}) {
  const session = await requireRole("superadmin", "admin");
  const nav = await adminNav();

  const { tab = "expiring", days } = await searchParams;
  const withinDays = Number(days) || 90;
  const alerts = await getAlerts(withinDays);

  return (
    <ConsoleShell
      session={session}
      roleLabel={session.role === "superadmin" ? "Super admin" : "Admin"}
      nav={nav}
      activeHref="/admin/inventory/alerts"
      breadcrumb={["Inventory", "Alerts"]}
      title="Alerts"
      meta={`Horizon ${withinDays} days`}
      actions={
        <div className="flex gap-2">
          {[30, 90, 180].map((d) => (
            <ButtonLink
              key={d}
              href={`/admin/inventory/alerts?tab=${tab}&days=${d}`}
              variant={withinDays === d ? "primary" : "secondary"}
              size="sm"
            >
              {d}d
            </ButtonLink>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard
          label="Expired on the shelf"
          value={String(alerts.counts.expired)}
          color="var(--color-critical)"
          pct={alerts.counts.expired ? 100 : 0}
          note="Never counted, never dispensed — but still occupying space"
        />
        <StatCard
          label={`Expiring within ${withinDays}d`}
          value={String(alerts.counts.expiringSoon)}
          color="var(--color-caution)"
          pct={Math.min(100, alerts.counts.expiringSoon * 12)}
          note="Use these first under FEFO"
        />
        <StatCard
          label="At or below reorder"
          value={String(alerts.counts.lowStock)}
          color="var(--color-caution)"
          pct={Math.min(100, alerts.counts.lowStock * 20)}
        />
        <StatCard
          label="Value at risk"
          value={formatInr(alerts.valueAtRiskInr)}
          color="var(--color-critical)"
          pct={60}
          note="Cost of expired plus expiring stock"
        />
      </div>

      <div className="flex gap-1 p-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] border border-[var(--color-line)] mb-5 w-fit flex-wrap">
        {TABS.map((t) => {
          const count = {
            expiring: alerts.counts.expiringSoon,
            expired: alerts.counts.expired,
            low: alerts.counts.lowStock,
            out: alerts.counts.outOfStock,
          }[t.key];
          return (
            <Link
              key={t.key}
              href={`/admin/inventory/alerts?tab=${t.key}&days=${withinDays}`}
              className={`px-4 min-h-[36px] inline-flex items-center gap-2 rounded-[6px] text-[13px] font-semibold no-underline hover:no-underline ${
                tab === t.key ? "bg-[var(--color-surface)] text-[var(--color-ink)]" : "text-[var(--color-ink-2)]"
              }`}
            >
              {t.label}
              <span className="t-data text-[13px] text-[var(--color-ink-3)]">{count}</span>
            </Link>
          );
        })}
      </div>

      {tab === "expiring" &&
        (alerts.expiringSoon.length ? (
          <ExpiryTable rows={alerts.expiringSoon} expired={false} />
        ) : (
          <EmptyState
            kind="cleared"
            title="Nothing expiring soon"
            body={`No in-date batch falls inside the next ${withinDays} days. Widen the horizon if you are planning further ahead.`}
          />
        ))}

      {tab === "expired" &&
        (alerts.expired.length ? (
          <ExpiryTable rows={alerts.expired} expired />
        ) : (
          <EmptyState
            kind="cleared"
            title="No expired stock on the shelf"
            body="Every lot with units on hand is still in date."
          />
        ))}

      {tab === "low" &&
        (alerts.lowStock.length ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {alerts.lowStock.map((a) => (
              <div
                key={a.masterId}
                className="rounded-[var(--radius-lg)] border border-[var(--color-caution)] bg-[var(--color-surface)] p-5"
              >
                <FillDepleting
                  label={a.drugName}
                  value={`${a.available} / ${a.reorderLevel}`}
                  pct={a.reorderLevel ? ((a.available ?? 0) / a.reorderLevel) * 100 : 0}
                  color="var(--color-caution)"
                  markerPct={100}
                  note={`At or below reorder level of ${a.reorderLevel}`}
                />
                <div className="mt-4">
                  <ButtonLink
                    href={`/admin/inventory?tab=batches&q=${encodeURIComponent(a.drugName)}`}
                    variant="secondary"
                    size="sm"
                  >
                    View batches
                  </ButtonLink>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState kind="cleared" title="Nothing below reorder" body="Every master is above its reorder level." />
        ))}

      {tab === "out" &&
        (alerts.outOfStock.length ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {alerts.outOfStock.map((a) => (
              <div
                key={a.masterId}
                className="rounded-[var(--radius-lg)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] p-5"
              >
                <span className="t-body font-semibold">{a.drugName}</span>
                <p className="t-small text-[var(--color-ink-2)] mt-2">
                  No in-date, unreserved units. Any drip needing it cannot be prepared.
                </p>
                <div className="mt-4">
                  <ButtonLink
                    href={`/admin/inventory?tab=batches&q=${encodeURIComponent(a.drugName)}`}
                    variant="secondary"
                    size="sm"
                  >
                    Receive a batch
                  </ButtonLink>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState kind="cleared" title="Nothing out of stock" body="Every master has usable units on the shelf." />
        ))}
    </ConsoleShell>
  );
}

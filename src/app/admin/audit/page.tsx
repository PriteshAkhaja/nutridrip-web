import Link from "next/link";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guard";
import { adminNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog } from "@/lib/models";
import { DataTable, THead, TH, TR, TD } from "@/components/ui/Table";
import { Pill } from "@/components/ui/Pill";
import { nameEntities, nameKey } from "@/lib/data/audit-names";
import { AuditFilters, AuditResults, AuditView } from "./AuditFilters";
import { Pagination } from "@/components/ui/Paged";
import { parsePaging } from "@/lib/pagination";
import { paginate } from "@/lib/pagination-db";
import { EmptyState } from "@/components/ui/States";
import { formatDate, formatTime } from "@/lib/data/inventory";
import {
  actionLabel,
  AUDIT_GROUPS,
  auditRange,
  describeChange,
  entityLabel,
  groupFilter,
  groupFor,
  isNotable,
  presetsFor,
  type AuditGroup,
} from "@/lib/data/audit";

export const metadata: Metadata = { title: "Audit trail" };
export const dynamic = "force-dynamic";


type Row = {
  _id: unknown;
  actorId?: unknown;
  actorRole?: string;
  action: string;
  entity?: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  at: Date;
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    group?: string;
    action?: string;
    actor?: string;
    from?: string;
    to?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const session = await requirePermission("audit.view");
  const query = await searchParams;
  const { group, action, actor, from, to, page, pageSize } = query;
  const nav = await adminNav();
  await connectDB();

  const paging = parsePaging({ page, pageSize });

  /**
   * The date window scopes everything on the page, including the counts.
   *
   * Action and actor are dimensions *within* a window, so they do not narrow
   * each other's counts — but a window that left the counts alone would offer
   * "Checklist complete (99)" and then show an empty table, which reads as a
   * bug rather than as a filter.
   */
  const range = auditRange(from, to);
  const window = range ? { at: range } : {};

  /** "on 16 Sept 2026", "between … and …", "from … onwards" — as picked. */
  const rangeLabel = !range
    ? ""
    : range.$gte && range.$lte
      ? formatDate(range.$gte) === formatDate(range.$lte)
        ? `on ${formatDate(range.$gte)}`
        : `between ${formatDate(range.$gte)} and ${formatDate(range.$lte)}`
      : range.$gte
        ? `from ${formatDate(range.$gte)} onwards`
        : `up to ${formatDate(range.$lte as Date)}`;

  /** One exact action beats a group; a group beats everything. */
  const activeGroup = AUDIT_GROUPS.includes(group as AuditGroup) ? (group as AuditGroup) : null;
  const filter: Record<string, unknown> = {
    ...window,
    ...(action ? { action } : activeGroup ? { action: groupFilter(activeGroup) } : {}),
    ...(actor ? { actorId: actor } : {}),
  };

  const [paged, counts, actorCounts] = await Promise.all([
    // One page, asked of the database: the count, the skip and the limit are all
    // in the query, and `at` is indexed, so page 400 costs what page 1 does.
    paginate<Row>(AuditLog, filter, { sort: { at: -1 }, paging }),
    AuditLog.aggregate<{ _id: string; n: number }>([
      { $match: window },
      { $group: { _id: "$action", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ]),
    // Counted across the whole window, not the page: a "Who" list built from
    // fifty rows would offer only the people who happen to be on screen.
    AuditLog.aggregate<{ _id: unknown; n: number }>([
      { $match: { ...window, actorId: { $ne: null } } },
      { $group: { _id: "$actorId", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 40 },
    ]),
  ]);

  const { rows, meta: pageMeta } = paged;
  const total = pageMeta.total;

  // Every id on the page, turned into what a person calls the thing: actor
  // names, and the record each row was about. One query per kind, not per row.
  const names = await nameEntities(rows, [
    ...rows.map((r) => (r.actorId ? String(r.actorId) : null)),
    ...actorCounts.map((a) => String(a._id)),
  ]);
  const nameById = (id: string) => names.get(nameKey("User", id));

  /**
   * The trail outlives the accounts in it — a reseed or a removed user leaves
   * rows behind, which is correct. But several entries all reading "Deleted
   * account" cannot be told apart, so each carries the tail of its id.
   */
  const actorOptions = actorCounts.map((a) => {
    const id = String(a._id);
    return { id, name: nameById(id) ?? `Deleted account …${id.slice(-6)}`, n: a.n };
  });

  // The 40 busiest actors are the ones worth offering, but a list is read by
  // name, so the cut is by volume and the order is by name.
  actorOptions.sort((a, b) => a.name.localeCompare(b.name));

  const byGroup = new Map<AuditGroup, number>();
  for (const c of counts) {
    const g = groupFor(c._id);
    byGroup.set(g, (byGroup.get(g) ?? 0) + c.n);
  }


  return (
    <ConsoleShell
      session={session}
      roleLabel={session.role === "superadmin" ? "Super admin" : "Admin"}
      nav={nav}
      activeHref="/admin/audit"
      breadcrumb={["Admin", "Audit trail"]}
      title="Audit trail"
      meta={`${total.toLocaleString("en-IN")} entr${total === 1 ? "y" : "ies"}${
        rangeLabel ? ` ${rangeLabel}` : ""
      }`}
    >
      <p className="t-body text-[var(--color-ink-2)] max-w-[76ch] mb-6" style={{ textWrap: "pretty" }}>
        Every clinical and administrative action, with who did it and what changed. Refused
        access is recorded here too — the sign-in page and the privacy policy both promise it,
        and this is where that promise is kept. Rows are never edited or deleted.
      </p>

      {/* One pending state for the bar and the rows: a filter shows at once,
          and the rows dim until the server has the new ones. */}
      <AuditView>
      <AuditFilters
        group={activeGroup}
        action={action}
        actor={actor}
        from={from}
        to={to}
        presets={presetsFor(new Date())}
        counts={counts.map((c) => ({ action: c._id, n: c.n }))}
        actors={actorOptions}
        byGroup={Object.fromEntries(byGroup)}
        total={counts.reduce((n, c) => n + c.n, 0)}
        pageSize={query.pageSize}
      />

      <AuditResults>
      {rows.length === 0 ? (
        <EmptyState
          kind="filtered"
          title={range ? "Nothing in that date range" : "Nothing recorded under that"}
          // An empty table has to say *which* filter emptied it, or it reads as
          // "this never happens" when the truth is "not in the days you chose".
          body={
            range
              ? `No action was recorded ${rangeLabel}. The trail only goes back as far as the first row in it.`
              : "No action of that kind has been taken yet."
          }
          actionLabel="Show everything"
          actionHref="/admin/audit"
        />
      ) : (
        <>
          <DataTable>
            <THead>
              <TR>
                <TH>When</TH>
                <TH>Who</TH>
                <TH>Action</TH>
                <TH>On</TH>
                <TH>What changed</TH>
                <TH> </TH>
              </TR>
            </THead>
            <tbody>
              {rows.map((r) => {
                const changes = describeChange(r.before, r.after);
                // A record is called what people call it — a name, a booking
                // number, an order number. Falls back to the id only when the
                // record itself is gone, which is worth seeing in its own right.
                const onName =
                  r.entity && r.entityId ? names.get(nameKey(r.entity, r.entityId)) : undefined;
                return (
                  <TR key={String(r._id)}>
                    <TD>
                      <span className="t-data text-[13px] whitespace-nowrap block">
                        {formatDate(r.at)}
                      </span>
                      <span className="t-small text-[var(--color-ink-3)] whitespace-nowrap">
                        {formatTime(r.at)}
                      </span>
                    </TD>
                    <TD>
                      <span className="block whitespace-nowrap">
                        {r.actorId
                          ? (nameById(String(r.actorId)) ??
                            `Deleted account …${String(r.actorId).slice(-6)}`)
                          : "System"}
                      </span>
                      <span className="t-small text-[var(--color-ink-3)]">{r.actorRole ?? "—"}</span>
                    </TD>
                    <TD nowrap>
                      {isNotable(r.action) ? (
                        <Pill tone="caution">{actionLabel(r.action)}</Pill>
                      ) : (
                        <span className="t-small">{actionLabel(r.action)}</span>
                      )}
                    </TD>
                    <TD>
                      <span className="t-small block whitespace-nowrap">{r.entity ? entityLabel(r.entity) : "—"}</span>
                      {onName ? (
                        <span className="t-small block whitespace-nowrap text-[var(--color-ink-2)]">{onName}</span>
                      ) : r.entityId ? (
                        <span className="t-data text-[12px] text-[var(--color-ink-3)] break-all">
                          {/* Shortened only when it is an opaque id. An
                              access.refused row carries the route or the
                              permission that was refused, and "…t.view" out of
                              "audit.view" destroys the one useful part. */}
                          {/^[0-9a-f]{24}$/.test(r.entityId)
                            ? `…${r.entityId.slice(-6)}`
                            : r.entityId}
                        </span>
                      ) : null}
                    </TD>
                    <TD>
                      {changes.length === 0 ? (
                        <span className="t-small text-[var(--color-ink-3)]">—</span>
                      ) : (
                        <div className="flex flex-col gap-[3px]">
                          {changes.slice(0, 4).map((c) => (
                            <span key={c.field} className="t-small leading-[1.5]">
                              <span className="text-[var(--color-ink-3)]">{c.field}</span>{" "}
                              {c.from !== undefined && c.to !== undefined ? (
                                <>
                                  <span className="t-data text-[12px] line-through text-[var(--color-ink-3)]">
                                    {c.from}
                                  </span>
                                  <span className="text-[var(--color-ink-3)]"> → </span>
                                  <span className="t-data text-[12px]">{c.to}</span>
                                </>
                              ) : (
                                <span className="t-data text-[12px]">{c.to ?? c.from}</span>
                              )}
                            </span>
                          ))}
                          {changes.length > 4 ? (
                            <span className="t-small text-[var(--color-ink-3)]">
                              +{changes.length - 4} more
                            </span>
                          ) : null}
                        </div>
                      )}
                    </TD>
                    <TD>
                      <Link
                        href={`/admin/audit/${String(r._id)}`}
                        className="t-small font-semibold whitespace-nowrap"
                      >
                        Open
                      </Link>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </DataTable>
        </>
      )}
      </AuditResults>

      {/* Outside the dimmed wrapper, so the controls stay sharp while the rows
          are on their way. Every filter rides along in the links. */}
      <Pagination meta={pageMeta} basePath="/admin/audit" params={query} nouns={["entry", "entries"]} />
      </AuditView>
    </ConsoleShell>
  );
}

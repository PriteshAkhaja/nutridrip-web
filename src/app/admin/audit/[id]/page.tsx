import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guard";
import { adminNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, User } from "@/lib/models";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Arrow } from "@/components/ui/Arrow";
import { formatDate, formatTime } from "@/lib/data/inventory";
import {
  actionLabel,
  CLINICAL_WITHHELD,
  describeChange,
  entityLabel,
  groupFor,
  isNotable,
  withholdsDetail,
} from "@/lib/data/audit";
import { nameEntities, nameKey } from "@/lib/data/audit-names";

export const metadata: Metadata = { title: "Audit entry" };
export const dynamic = "force-dynamic";

/** Where an entity id points, when it points anywhere a reader can follow. */
const LINK_FOR: Record<string, (id: string) => string | null> = {
  User: (id) => `/admin/users?edit=${id}`,
  Booking: () => null,
  TreatmentPlan: () => null,
  Order: (id) => `/admin/inventory/orders/${id}`,
  Drip: () => `/admin/inventory/drips`,
  ProductMaster: (id) => `/admin/inventory/masters/${id}`,
};

export default async function AuditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("audit.view");
  const { id } = await params;
  const nav = await adminNav();
  await connectDB();

  const row = await AuditLog.findById(id).lean<{
    _id: unknown;
    actorId?: unknown;
    actorRole?: string;
    action: string;
    entity?: string;
    entityId?: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    ip?: string;
    at: Date;
  } | null>();
  if (!row) notFound();

  const actor = row.actorId
    ? await User.findById(row.actorId).select("name email phone role").lean<{
        name?: string;
        email?: string;
        phone?: string;
        role?: string;
      } | null>()
    : null;

  // An entry about a record should say which one. The id stays underneath it:
  // names change and records get removed, and the id is what the trail is
  // keyed on. Resolved by the same helper the list uses, so the two agree.
  const names = await nameEntities([row], [row.actorId ? String(row.actorId) : null]);
  const targetName =
    row.entity && row.entityId ? (names.get(nameKey(row.entity, row.entityId)) ?? null) : null;

  const withheld = withholdsDetail(session.role, row.action);
  const changes = withheld ? [] : describeChange(row.before, row.after);
  const target =
    row.entity && row.entityId ? (LINK_FOR[row.entity]?.(row.entityId) ?? null) : null;

  return (
    <ConsoleShell
      session={session}
      roleLabel={session.role === "superadmin" ? "Super admin" : "Admin"}
      nav={nav}
      activeHref="/admin/audit"
      breadcrumb={["Admin", "Audit trail", actionLabel(row.action)]}
      title={actionLabel(row.action)}
      meta={`${formatDate(row.at)} · ${formatTime(row.at)}`}
    >
      <Link href="/admin/audit" className="t-body inline-block mb-5">
        <Arrow dir="left" />
        &nbsp;Back to the trail
      </Link>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-start">
        <div className="flex flex-col gap-5">
          <Card padding="p-6">
            <div className="flex items-center gap-3 flex-wrap mb-5">
              {isNotable(row.action) ? (
                <Pill tone="caution" dot>
                  {actionLabel(row.action)}
                </Pill>
              ) : (
                <Pill tone="neutral">{actionLabel(row.action)}</Pill>
              )}
              <span className="t-small text-[var(--color-ink-3)]">{groupFor(row.action)}</span>
            </div>

            <div className="flex flex-col gap-3">
              {[
                ["Action", row.action],
                ["When", `${formatDate(row.at)} · ${formatTime(row.at)}`],
                ["Record", row.entity ? entityLabel(row.entity) : "—"],
                ...(targetName ? ([["Which one", targetName]] as Array<[string, string]>) : []),
                ["Record id", row.entityId ?? "—"],
                ...(row.ip ? ([["From", row.ip]] as Array<[string, string]>) : []),
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between gap-6 items-baseline pb-3 border-b border-[var(--color-line)] last:border-0 last:pb-0"
                >
                  <span className="t-body text-[var(--color-ink-2)] flex-none">{k}</span>
                  <span
                    className={`text-right break-all ${
                      k === "Which one" ? "t-body" : "t-data text-[13.5px]"
                    }`}
                  >
                    {v}
                  </span>
                </div>
              ))}
            </div>

            {target ? (
              <Link href={target} className="t-small font-semibold inline-block mt-5">
                Open the record&nbsp;
                <Arrow />
              </Link>
            ) : null}
          </Card>

          {/* The whole point of opening a row: what moved, in full, with
              nothing truncated the way the table has to truncate it. */}
          <Card padding="p-6">
            <h2 className="t-h3 mb-1">What changed</h2>
            {withheld ? (
              <p className="t-body text-[var(--color-ink-2)] mt-2">
                {CLINICAL_WITHHELD}. This record holds what a patient told a physician, or what a physician found, so an
                Admin sees that it happened, who did it and when, but not the detail. The super admin can read it.
              </p>
            ) : changes.length === 0 ? (
              <p className="t-body text-[var(--color-ink-2)] mt-2">
                Nothing was recorded as changing. Some actions are events rather than edits —
                a record being opened, a session being started — and carry no before and after.
              </p>
            ) : (
              <div className="flex flex-col gap-4 mt-4">
                {changes.map((c) => (
                  <div key={c.field} className="flex flex-col gap-1">
                    <span className="t-micro">{c.field}</span>
                    {c.from !== undefined && c.to !== undefined ? (
                      <div className="flex gap-3 items-baseline flex-wrap">
                        <span className="t-data text-[13.5px] line-through text-[var(--color-ink-3)] break-all">
                          {c.from}
                        </span>
                        <Arrow />
                        <span className="t-data text-[13.5px] break-all">{c.to}</span>
                      </div>
                    ) : (
                      <span className="t-data text-[13.5px] break-all">{c.to ?? c.from}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card padding="p-6">
          <h2 className="t-h3 mb-1">Who</h2>
          {actor ? (
            <>
              <p className="t-body-lg mt-3">{actor.name}</p>
              <span className="t-small text-[var(--color-ink-3)]">{actor.role ?? row.actorRole}</span>
              <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-[var(--color-line)]">
                {actor.email ? (
                  <span className="t-data text-[13px] break-all">{actor.email}</span>
                ) : null}
                {actor.phone ? <span className="t-data text-[13px]">{actor.phone}</span> : null}
              </div>
              <Link
                href={`/admin/audit?actor=${String(row.actorId)}`}
                className="t-small font-semibold inline-block mt-5"
              >
                Everything they have done&nbsp;
                <Arrow />
              </Link>
            </>
          ) : (
            <p className="t-body text-[var(--color-ink-2)] mt-3">
              {row.actorId
                ? "The account behind this entry has since been removed. The entry stands — that is the point of a trail."
                : "Done by the system rather than a person."}
            </p>
          )}
        </Card>
      </div>
    </ConsoleShell>
  );
}

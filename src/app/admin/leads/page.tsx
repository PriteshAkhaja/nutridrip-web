import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { adminNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { connectDB } from "@/lib/db/mongoose";
import { Lead } from "@/lib/models";
import { DataTable, THead, TH, TR, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/States";
import { formatDate } from "@/lib/data/inventory";
import { LeadStatus } from "./LeadStatus";
import { PagedResults, PagedView, Pagination } from "@/components/ui/Paged";
import { hrefWith, parsePaging } from "@/lib/pagination";
import { paginate } from "@/lib/pagination-db";

export const metadata: Metadata = { title: "Enquiries" };
export const dynamic = "force-dynamic";

const STATUSES = ["new", "contacted", "qualified", "converted", "closed"] as const;

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; pageSize?: string }>;
}) {
  const session = await requireRole("superadmin", "admin");
  const nav = await adminNav();
  const { status = "all", page, pageSize } = await searchParams;
  const paging = parsePaging({ page, pageSize });

  await connectDB();
  const filter = status === "all" ? {} : { status };
  // One page from the database; the old `.limit(200)` hid the 201st enquiry.
  type LeadRow = {
      _id: unknown;
      kind: string;
      name: string;
      email?: string;
      phone?: string;
      organisation?: string;
      city?: string;
      rooms?: number;
      monthlyVolume?: number;
      message?: string;
      pincode?: string;
      status: string;
      createdAt: Date;
  };
  const { rows: leads, meta } = await paginate<LeadRow>(Lead, filter, { sort: { createdAt: -1 }, paging });

  const counts = Object.fromEntries(
    await Promise.all(STATUSES.map(async (s) => [s, await Lead.countDocuments({ status: s })] as const))
  ) as Record<string, number>;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <ConsoleShell
      session={session}
      roleLabel={session.role === "superadmin" ? "Super admin" : "Admin"}
      nav={nav}
      activeHref="/admin/leads"
      breadcrumb={["Platform", "Enquiries"]}
      title="Enquiries"
      meta={`${total} total`}
    >
      <div className="flex gap-1 p-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] border border-[var(--color-line)] mb-5 w-fit flex-wrap">
        {[["all", "All", total] as const, ...STATUSES.map((s) => [s, s.charAt(0).toUpperCase() + s.slice(1), counts[s] ?? 0] as const)].map(
          ([key, label, count]) => (
            <Link
              key={key}
              href={hrefWith("/admin/leads", { pageSize }, { status: key })}
              className={`px-4 min-h-[36px] inline-flex items-center gap-2 rounded-[6px] text-[13px] font-semibold no-underline hover:no-underline ${
                status === key ? "bg-[var(--color-surface)] text-[var(--color-ink)]" : "text-[var(--color-ink-2)]"
              }`}
            >
              {label}
              <span className="t-data text-[13px] text-[var(--color-ink-3)]">{count}</span>
            </Link>
          )
        )}
      </div>

      {leads.length === 0 ? (
        <EmptyState
          kind={status === "all" ? "first-run" : "filtered"}
          title={status === "all" ? "No enquiries yet" : "Nothing in this state"}
          body={
            status === "all"
              ? "Clinic partnership requests from the public site land here, and everyone on the admin team is notified."
              : "No enquiry currently sits at that stage."
          }
          actionLabel={status === "all" ? undefined : "Show all"}
          actionHref={status === "all" ? undefined : "/admin/leads?status=all"}
        />
      ) : (
        <PagedView>
        <PagedResults>
        <DataTable>
          <THead>
            <TR>
              <TH>Who</TH>
              <TH>Contact</TH>
              <TH>Where</TH>
              <TH numeric>Rooms</TH>
              <TH numeric>Sessions/mo</TH>
              <TH>Raised</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <tbody>
            {leads.map((l) => (
              <TR key={String(l._id)}>
                <TD nowrap>
                  <div className="flex flex-col">
                    <span className="font-medium">{l.name}</span>
                    <span className="t-small text-[var(--color-ink-3)]">
                      {l.organisation ?? (l.kind === "consult" ? "Consultation request" : l.kind)}
                    </span>
                  </div>
                </TD>
                <TD>
                  <div className="flex flex-col">
                    {l.email && <span className="t-data text-[13px]">{l.email}</span>}
                    {l.phone && <span className="t-data text-[13px] text-[var(--color-ink-3)]">{l.phone}</span>}
                  </div>
                </TD>
                <TD>{l.city ?? l.pincode ?? "—"}</TD>
                <TD numeric>{l.rooms ?? "—"}</TD>
                <TD numeric>{l.monthlyVolume ?? "—"}</TD>
                <TD mono nowrap>{formatDate(l.createdAt)}</TD>
                <TD>
                  <LeadStatus id={String(l._id)} status={l.status} />
                </TD>
              </TR>
            ))}
          </tbody>
        </DataTable>
        </PagedResults>
        <Pagination meta={meta} basePath="/admin/leads" params={{ status, pageSize }} nouns={["enquiry", "enquiries"]} />
        </PagedView>
      )}

      {leads.some((l) => l.message) && (
        <section className="mt-8">
          <h2 className="t-h3 mb-3">What they wrote</h2>
          <div className="flex flex-col gap-3">
            {leads
              .filter((l) => l.message)
              .map((l) => (
                <div
                  key={`msg-${String(l._id)}`}
                  className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4"
                >
                  <span className="t-micro">
                    {l.name}
                    {l.organisation ? ` · ${l.organisation}` : ""}
                  </span>
                  <p className="t-body text-[var(--color-ink-2)] mt-2 whitespace-pre-line">{l.message}</p>
                </div>
              ))}
          </div>
        </section>
      )}
    </ConsoleShell>
  );
}

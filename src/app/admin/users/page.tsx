import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { adminNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models";
import { DataTable, THead, TH, TR, TD, Pieces } from "@/components/ui/Table";
import { StatusPill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/States";
import { StatCard } from "@/components/ui/Card";
import { formatDate } from "@/lib/data/inventory";
import { AddPerson } from "./AddPerson";
import { EditPerson } from "./EditPerson";
import { ROLES, type Role } from "@/lib/models/types";
import { PagedResults, PagedView, Pagination } from "@/components/ui/Paged";
import { hrefWith, parsePaging } from "@/lib/pagination";
import { paginate } from "@/lib/pagination-db";

export const metadata: Metadata = { title: "People" };
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Super admin",
  admin: "Admin",
  doctor: "Doctor",
  nurse: "Nurse",
  clinic: "Clinic",
  patient: "Patient",
};

/** The one detail that matters per role, so the table says something useful. */
function detailFor(u: {
  role: Role;
  doctor?: { specialization?: string; licenseNo?: string };
  nurse?: { licenseNo?: string; serviceAreas?: string[] };
  clinic?: { city?: string; pincode?: string };
  patient?: { vitalityScore?: number; city?: string };
}): string {
  switch (u.role) {
    case "doctor":
      return [u.doctor?.specialization, u.doctor?.licenseNo].filter(Boolean).join(" · ") || "—";
    case "nurse":
      return [u.nurse?.licenseNo, u.nurse?.serviceAreas?.slice(0, 2).join(", ")].filter(Boolean).join(" · ") || "—";
    case "clinic":
      return [u.clinic?.city, u.clinic?.pincode].filter(Boolean).join(" · ") || "—";
    case "patient":
      return u.patient?.vitalityScore ? `Vitality ${u.patient.vitalityScore}` : u.patient?.city ?? "—";
    default:
      return "Platform access";
  }
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; q?: string; edit?: string; page?: string; pageSize?: string }>;
}) {
  const session = await requireRole("superadmin", "admin");
  const nav = await adminNav();
  const { role, q, edit, page, pageSize } = await searchParams;
  const paging = parsePaging({ page, pageSize });

  await connectDB();
  const filter: Record<string, unknown> = {};
  if (role && ROLES.includes(role as Role)) filter.role = role;
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }

  // One page, asked of the database. This used to be `.limit(300)`: the 301st
  // person simply did not exist on the screen, with nothing to say so.
  type UserRow = {
      _id: unknown;
      name: string;
      email?: string;
      phone?: string;
      role: Role;
      status: string;
      createdAt: Date;
      lastLoginAt?: Date;
      doctor?: { specialization?: string; licenseNo?: string };
      nurse?: { licenseNo?: string; serviceAreas?: string[]; doctorId?: unknown };
      clinic?: { city?: string; pincode?: string };
      patient?: { vitalityScore?: number; city?: string };
  };
  const { rows: users, meta } = await paginate<UserRow>(User, filter, { sort: { createdAt: -1 }, paging });

  /**
   * The person being edited comes from the URL, so the form is server-rendered
   * with real values and the back button closes it. Keeping it in client state
   * would mean every row carrying every field of its own account just in case.
   */
  const editing = edit
    ? await User.findById(edit).lean<{
        _id: unknown;
        name: string;
        email?: string;
        phone?: string;
        role: Role;
        status: string;
        doctor?: { specialization?: string; licenseNo?: string; registrationCouncil?: string };
        nurse?: {
          licenseNo?: string;
          doctorId?: unknown;
          serviceAreas?: string[];
          latitude?: number;
          longitude?: number;
        };
        clinic?: { address?: string; city?: string; pincode?: string; gstin?: string; monthlyVolumeTarget?: number };
        patient?: { address?: string; city?: string; pincode?: string };
      } | null>()
    : null;

  // Opening a person, and closing them again, keeps the list where it was:
  // the same filter, the same page, the same rows per page.
  const here = { role, q, page, pageSize };
  const listHref = hrefWith("/admin/users", here);
  const editHref = (id: string) => hrefWith("/admin/users", here, { edit: id });

  // Offered when adding a nurse: the physician they work under.
  const doctorOptions = (
    await User.find({ role: "doctor", status: "active" })
      .select("name")
      .sort({ name: 1 })
      .lean<Array<{ _id: unknown; name: string }>>()
  ).map((d) => ({ id: String(d._id), name: d.name }));

  const counts = Object.fromEntries(
    await Promise.all(ROLES.map(async (r) => [r, await User.countDocuments({ role: r })] as const))
  ) as Record<Role, number>;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <ConsoleShell
      session={session}
      roleLabel={session.role === "superadmin" ? "Super admin" : "Admin"}
      nav={nav}
      activeHref="/admin/users"
      breadcrumb={["Platform", "People"]}
      title="People"
      meta={`${total} accounts`}
    >
      {session.role === "superadmin" && (
        <div className="mb-6">
          {/* One form at a time: editing somebody replaces the add form rather
              than sitting beside it, so it is never ambiguous which one a
              "Save" belongs to. */}
          {editing ? (
            <EditPerson
              doctors={doctorOptions}
              closeHref={listHref}
              user={{
                id: String(editing._id),
                role: editing.role,
                status: editing.status,
                serviceAreas: editing.nurse?.serviceAreas ?? [],
                form: {
                  name: editing.name,
                  email: editing.email ?? "",
                  phone: editing.phone ?? "",
                  password: "",
                  specialization: editing.doctor?.specialization ?? "",
                  licenseNo: editing.doctor?.licenseNo ?? editing.nurse?.licenseNo ?? "",
                  registrationCouncil: editing.doctor?.registrationCouncil ?? "",
                  doctorId: editing.nurse?.doctorId ? String(editing.nurse.doctorId) : "",
                  latitude: editing.nurse?.latitude != null ? String(editing.nurse.latitude) : "",
                  longitude: editing.nurse?.longitude != null ? String(editing.nurse.longitude) : "",
                  address: editing.clinic?.address ?? editing.patient?.address ?? "",
                  city: editing.clinic?.city ?? editing.patient?.city ?? "",
                  pincode: editing.clinic?.pincode ?? editing.patient?.pincode ?? "",
                  gstin: editing.clinic?.gstin ?? "",
                  monthlyVolumeTarget:
                    editing.clinic?.monthlyVolumeTarget != null
                      ? String(editing.clinic.monthlyVolumeTarget)
                      : "",
                },
              }}
            />
          ) : (
            <AddPerson doctors={doctorOptions} />
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard label="Patients" value={String(counts.patient)} pct={Math.min(100, counts.patient * 8)} />
        <StatCard label="Doctors" value={String(counts.doctor)} pct={Math.min(100, counts.doctor * 20)} />
        <StatCard label="Nurses" value={String(counts.nurse)} pct={Math.min(100, counts.nurse * 20)} />
        <StatCard label="Partner clinics" value={String(counts.clinic)} pct={Math.min(100, counts.clinic * 25)} />
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-5">
        <Link
          href={hrefWith("/admin/users", { pageSize })}
          className={`inline-flex items-center min-h-[36px] px-3 rounded-full border text-[13px] font-medium no-underline hover:no-underline ${
            role
              ? "border-[var(--color-line-2)] bg-[var(--color-surface)] text-[var(--color-ink-2)]"
              : "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]"
          }`}
        >
          All <span className="t-data text-[13px] ml-2 opacity-70">{total}</span>
        </Link>
        {ROLES.map((r) => (
          <Link
            key={r}
            href={hrefWith("/admin/users", { pageSize }, { role: r })}
            className={`inline-flex items-center min-h-[36px] px-3 rounded-full border text-[13px] font-medium no-underline hover:no-underline ${
              role === r
                ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]"
                : "border-[var(--color-line-2)] bg-[var(--color-surface)] text-[var(--color-ink-2)]"
            }`}
          >
            {ROLE_LABEL[r]} <span className="t-data text-[13px] ml-2 opacity-70">{counts[r]}</span>
          </Link>
        ))}
      </div>

      {users.length === 0 ? (
        <EmptyState
          kind="filtered"
          title="No accounts match"
          body="Nothing matches that filter. Clearing it brings every account back."
          actionLabel="Clear filters"
          actionHref="/admin/users"
        />
      ) : (
        <PagedView>
        <PagedResults>
        <DataTable>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Role</TH>
              <TH>Contact</TH>
              <TH>Detail</TH>
              <TH>Joined</TH>
              <TH>Last seen</TH>
              <TH>Status</TH>
              {session.role === "superadmin" && <TH>Edit</TH>}
            </TR>
          </THead>
          <tbody>
            {users.map((u) => (
              <TR key={String(u._id)}>
                <TD nowrap>
                  <span className="font-medium">{u.name}</span>
                </TD>
                <TD nowrap>
                  <span className="t-small text-[var(--color-ink-2)]">{ROLE_LABEL[u.role]}</span>
                </TD>
                <TD>
                  <span className="t-data text-[13px] text-[var(--color-ink-2)]">
                    {u.email ?? u.phone ?? "—"}
                  </span>
                </TD>
                <TD>
                  <span className="t-small text-[var(--color-ink-2)]"><Pieces items={detailFor(u).split(" · ")} separator=" · " /></span>
                </TD>
                <TD mono nowrap>{formatDate(u.createdAt)}</TD>
                <TD mono nowrap>{u.lastLoginAt ? formatDate(u.lastLoginAt) : "Never"}</TD>
                <TD>
                  <StatusPill status={u.status} dot />
                </TD>
                {session.role === "superadmin" && (
                  <TD>
                    {/* No scroll={false} here: the form opens at the top of
                        the page, so staying put reads as nothing having
                        happened. EditPerson also pulls focus to itself. */}
                    <Link
                      href={editHref(String(u._id))}
                      className="t-small text-[var(--color-primary)] underline"
                    >
                      Edit
                    </Link>
                  </TD>
                )}
              </TR>
            ))}
          </tbody>
        </DataTable>
        </PagedResults>
        {/* Not in the edit form's params: paging away closes it, as it should. */}
        <Pagination meta={meta} basePath="/admin/users" params={{ role, q, pageSize }} nouns={["account", "accounts"]} />
        </PagedView>
      )}
    </ConsoleShell>
  );
}

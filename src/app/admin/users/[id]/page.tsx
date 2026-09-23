import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { requireRole } from "@/lib/auth/guard";
import { logRecordAccess } from "@/lib/auth/access-log";
import { adminNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, HealthQuiz, LabReport, Order, TreatmentPlan, User } from "@/lib/models";
import { ADMIN_BOOKING_SELECT } from "@/lib/data/admin-view";
import { nurseFeedback } from "@/lib/data/nurse-feedback";
import { formatDate, formatTime } from "@/lib/data/inventory";
import { formatInr } from "@/lib/inventory/units";
import { paginate } from "@/lib/pagination-db";
import { parsePaging } from "@/lib/pagination";
import { Card, StatCard } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Pill, StatusPill } from "@/components/ui/Pill";
import { DataTable, THead, TH, TR, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/States";
import { NameLink } from "@/components/ui/NameLink";
import { PagedResults, PagedView, Pagination } from "@/components/ui/Paged";
import type { Role } from "@/lib/models/types";

export const metadata: Metadata = { title: "Person" };
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Super admin",
  admin: "Admin",
  doctor: "Doctor",
  nurse: "Nurse",
  clinic: "Partner clinic",
  patient: "Patient",
};

/** Which booking field names each role, so "their sessions" is one query for any of them. */
const SESSION_FIELD: Partial<Record<Role, string>> = {
  patient: "patientId",
  nurse: "nurseId",
  doctor: "doctorId",
  clinic: "clinicId",
};

type Person = {
  _id: unknown;
  name: string;
  email?: string;
  phone?: string;
  role: Role;
  status: string;
  createdAt: Date;
  lastLoginAt?: Date;
  doctor?: { specialization?: string; licenseNo?: string; registrationCouncil?: string };
  nurse?: { licenseNo?: string; doctorId?: unknown; serviceAreas?: string[]; latitude?: number; longitude?: number };
  clinic?: {
    address?: string;
    city?: string;
    pincode?: string;
    gstin?: string;
    monthlyVolumeTarget?: number;
    partnerSince?: Date;
  };
  patient?: { address?: string; city?: string; pincode?: string };
};

type SessionRow = {
  _id: unknown;
  bookingNo: string;
  patientId: unknown;
  dripName?: string;
  scheduledAt: Date;
  status: string;
  amount?: number;
};

/** Tailwind needs whole class names, so the columns are looked up, not built. */
const XL_COLUMNS: Record<number, string> = {
  0: "xl:grid-cols-1",
  1: "xl:grid-cols-1",
  2: "xl:grid-cols-2",
  3: "xl:grid-cols-3",
  4: "xl:grid-cols-4",
};

/** One labelled value. A missing value is shown as a dash, never as a blank. */
function Fact({ label, children }: { label: string; children?: ReactNode }) {
  const empty = children === undefined || children === null || children === "";
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="t-micro">{label}</span>
      <span className={`t-body break-words ${empty ? "text-[var(--color-ink-3)]" : ""}`}>{empty ? "—" : children}</span>
    </div>
  );
}

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const session = await requireRole("superadmin", "admin");
  const nav = await adminNav();
  const { id } = await params;
  const { page, pageSize } = await searchParams;

  // The id comes from the address bar, so it is checked before it is used.
  if (!/^[0-9a-f]{24}$/i.test(id)) notFound();

  await connectDB();

  // A patient's profile is selected FIELD BY FIELD, not loaded whole and trimmed
  // afterwards: what is never read cannot be shown, logged or leaked. Allergies,
  // history, vitality and the emergency contact are simply not asked for.
  const person = await User.findById(id)
    .select(
      "name email phone role status createdAt lastLoginAt doctor nurse clinic patient.address patient.city patient.pincode"
    )
    .lean<Person | null>();
  if (!person) notFound();

  const role = person.role;
  const isPatient = role === "patient";

  // Opening a patient's page is opening a patient's record, limited or not: the
  // privacy policy's promise covers it, so it is written to the trail (after the
  // record is known to exist, so a bad address is never filed as a read).
  if (isPatient) {
    await logRecordAccess({
      session,
      kind: "patient profile",
      entity: "User",
      entityId: id,
      patientId: id,
      note: session.role === "admin" ? "limited view" : "limited view (super admin)",
    });
  }

  const field = SESSION_FIELD[role];
  const oid = new Types.ObjectId(id);

  // ---- Sessions: one paged list, whoever the person is. Only the scheduling
  // fields leave the database -- never vitals, checklists, reactions or consent.
  const sessions = field
    ? await paginate<SessionRow>(Booking, { [field]: oid }, {
        sort: { scheduledAt: -1 },
        paging: parsePaging({ page, pageSize }),
        select: ADMIN_BOOKING_SELECT,
      })
    : null;

  // Everything else on the page is a count or a sum, done by the database.
  const [byStatus, extras] = await Promise.all([
    field
      ? Booking.aggregate<{ _id: string; n: number }>([
          { $match: { [field]: oid } },
          { $group: { _id: "$status", n: { $sum: 1 } } },
        ])
      : Promise.resolve([]),
    roleExtras(role, id, oid),
  ]);
  const statusCount = (s: string) => byStatus.find((r) => r._id === s)?.n ?? 0;
  const totalSessions = byStatus.reduce((n, r) => n + r.n, 0);

  // Names for the patient column (and the nurse's physician), in one query.
  const nameIds = [
    ...(sessions?.rows ?? []).map((r) => String(r.patientId)),
    ...(person.nurse?.doctorId ? [String(person.nurse.doctorId)] : []),
  ];
  const named = nameIds.length
    ? await User.find({ _id: { $in: [...new Set(nameIds)] } })
        .select("name")
        .lean<Array<{ _id: unknown; name: string }>>()
    : [];
  const nameById = new Map(named.map((n) => [String(n._id), n.name]));

  const here = `/admin/users/${id}`;

  const figureCount =
    (field ? 2 : 0) + (isPatient || role === "clinic" ? 1 : 0) + extras.cards.length;

  return (
    <ConsoleShell
      session={session}
      roleLabel={session.role === "superadmin" ? "Super admin" : "Admin"}
      nav={nav}
      activeHref="/admin/users"
      breadcrumb={["Platform", "People", person.name]}
      title={person.name}
      meta={ROLE_LABEL[role]}
      actions={
        <div className="flex gap-2 flex-wrap justify-end">
          {session.role === "superadmin" && (
            <ButtonLink href={`/admin/users?edit=${id}`} variant="secondary">
              Edit
            </ButtonLink>
          )}
          <ButtonLink href={`/admin/audit?actor=${id}`} variant="secondary">
            Activity
          </ButtonLink>
          {/* The full clinical record is a physician's screen. The super admin may
              open it; an Admin is never offered it. */}
          {isPatient && session.role === "superadmin" && (
            <ButtonLink href={`/doctor/patients/${id}`}>Open clinical record</ButtonLink>
          )}
        </div>
      }
    >
      {/* ---------------- Figures ---------------- */}
      {/* Two to a row on a phone (a stack of full-width cards is a long scroll for
          three numbers), and as many columns as there are cards on a wide screen,
          so three cards do not leave a hole where a fourth would be. */}
      {figureCount > 0 && (
      <div className={`grid grid-cols-2 gap-4 ${XL_COLUMNS[Math.min(figureCount, 4)]} mb-6`}>
        {field && <StatCard label="Sessions" value={String(totalSessions)} />}
        {field && (
          <StatCard
            label="Completed"
            value={String(statusCount("completed"))}
            pct={totalSessions ? (statusCount("completed") / totalSessions) * 100 : 0}
            color="var(--color-safe)"
          />
        )}
        {(isPatient || role === "clinic") && (
          <StatCard
            label="Cancelled"
            value={String(statusCount("cancelled"))}
            pct={totalSessions ? (statusCount("cancelled") / totalSessions) * 100 : 0}
            color="var(--color-caution)"
          />
        )}
        {extras.cards.map((c) => (
          <StatCard key={c.label} label={c.label} value={c.value} note={c.note} />
        ))}
      </div>
      )}

      {/* ---------------- Account, and the role's own details ---------------- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-8">
        <Card padding="p-5">
          <span className="t-micro block mb-4">Account</span>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <Fact label="Status">
              <StatusPill status={person.status} dot />
            </Fact>
            <Fact label="Role">{ROLE_LABEL[role]}</Fact>
            <Fact label="Email">{person.email}</Fact>
            <Fact label="Phone">{person.phone}</Fact>
            <Fact label="Joined">{formatDate(person.createdAt)}</Fact>
            <Fact label="Last seen">
              {person.lastLoginAt ? `${formatDate(person.lastLoginAt)} · ${formatTime(person.lastLoginAt)}` : "Never"}
            </Fact>
          </div>
        </Card>

        <Card padding="p-5">
          {isPatient && (
            <>
              <span className="t-micro block mb-4">Where they are</span>
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <Fact label="Address">{person.patient?.address}</Fact>
                <Fact label="City">{person.patient?.city}</Fact>
                <Fact label="Pincode">{person.patient?.pincode}</Fact>
              </div>
              <p className="t-small text-[var(--color-ink-3)] mt-5 pt-4 border-t border-[var(--color-line)]">
                Medical history, answers and reports are for the treating physician, so they are not shown on this page.
              </p>
            </>
          )}

          {role === "doctor" && (
            <>
              <span className="t-micro block mb-4">Registration</span>
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <Fact label="Specialisation">{person.doctor?.specialization}</Fact>
                <Fact label="Council number">{person.doctor?.licenseNo}</Fact>
                <Fact label="Council">{person.doctor?.registrationCouncil}</Fact>
              </div>
            </>
          )}

          {role === "nurse" && (
            <>
              <span className="t-micro block mb-4">Posting</span>
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <Fact label="Council number">{person.nurse?.licenseNo}</Fact>
                <Fact label="Works under">
                  {person.nurse?.doctorId ? (
                    <NameLink href={`/admin/users/${String(person.nurse.doctorId)}`}>
                      {nameById.get(String(person.nurse.doctorId)) ?? "Physician"}
                    </NameLink>
                  ) : undefined}
                </Fact>
                <Fact label="Home location">
                  {person.nurse?.latitude != null && person.nurse?.longitude != null
                    ? "Set — used to pick the nearest nurse"
                    : "Not set — dispatch cannot rank this nurse by distance"}
                </Fact>
              </div>
              <div className="mt-4">
                <span className="t-micro block mb-2">Zones covered</span>
                {(person.nurse?.serviceAreas ?? []).length ? (
                  <div className="flex gap-2 flex-wrap">
                    {(person.nurse?.serviceAreas ?? []).map((z) => (
                      <Pill key={z} tone="neutral">
                        {z}
                      </Pill>
                    ))}
                  </div>
                ) : (
                  <span className="t-small text-[var(--color-ink-3)]">None set — offered for every zone</span>
                )}
              </div>
            </>
          )}

          {role === "clinic" && (
            <>
              <span className="t-micro block mb-4">Partner details</span>
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <Fact label="Address">{person.clinic?.address}</Fact>
                <Fact label="City · pincode">
                  {[person.clinic?.city, person.clinic?.pincode].filter(Boolean).join(" · ") || undefined}
                </Fact>
                <Fact label="GSTIN">{person.clinic?.gstin}</Fact>
                <Fact label="Monthly session target">{person.clinic?.monthlyVolumeTarget}</Fact>
                <Fact label="Partner since">
                  {person.clinic?.partnerSince ? formatDate(person.clinic.partnerSince) : undefined}
                </Fact>
              </div>
            </>
          )}

          {(role === "admin" || role === "superadmin") && (
            <>
              <span className="t-micro block mb-4">Access</span>
              <p className="t-body text-[var(--color-ink-2)]">
                {role === "superadmin"
                  ? "Can create accounts, receive stock, build recipes and read every clinical record."
                  : "Runs operations: approvals queue, inventory, orders and the audit trail. Does not read clinical records."}
              </p>
            </>
          )}
        </Card>
      </div>

      {/* ---------------- Role extras: a patient's care summary, a physician's nurses ---------------- */}
      {extras.panel}

      {/* ---------------- Sessions ---------------- */}
      {field && sessions && (
        <section>
          <div className="flex items-baseline justify-between gap-4 mb-3">
            <h2 className="t-h3">Sessions</h2>
            <span className="t-data text-[13px] text-[var(--color-ink-3)]">{sessions.meta.total} in total</span>
          </div>
          {sessions.meta.total === 0 ? (
            <EmptyState kind="first-run" title="No sessions yet" body="Nothing has been booked for this account." />
          ) : (
            <PagedView>
              <PagedResults>
                <DataTable>
                  <THead>
                    <TR>
                      <TH width="120px">Booking</TH>
                      {!isPatient && <TH>Patient</TH>}
                      <TH>Drip</TH>
                      <TH>When</TH>
                      <TH>Status</TH>
                      <TH numeric>Amount</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {sessions.rows.map((b) => (
                      <TR key={String(b._id)}>
                        <TD mono nowrap>
                          {b.bookingNo}
                        </TD>
                        {!isPatient && (
                          <TD nowrap>
                            <NameLink href={`/admin/users/${String(b.patientId)}`}>
                              {nameById.get(String(b.patientId)) ?? "Patient"}
                            </NameLink>
                          </TD>
                        )}
                        <TD nowrap>{b.dripName ?? "—"}</TD>
                        <TD mono nowrap>
                          {formatDate(b.scheduledAt)} · {formatTime(b.scheduledAt)}
                        </TD>
                        <TD>
                          <StatusPill status={b.status} dot />
                        </TD>
                        <TD numeric nowrap>
                          {formatInr(b.amount ?? 0)}
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </DataTable>
              </PagedResults>
              <Pagination
                meta={sessions.meta}
                basePath={here}
                params={{ pageSize }}
                nouns={["session", "sessions"]}
              />
            </PagedView>
          )}
        </section>
      )}
    </ConsoleShell>
  );
}

/**
 * The parts of the page that differ by role: a few figures, and one panel.
 * Everything here is a count, a sum or a name -- nothing a patient told a doctor.
 */
async function roleExtras(
  role: Role,
  id: string,
  oid: Types.ObjectId
): Promise<{ cards: Array<{ label: string; value: string; note?: string }>; panel: ReactNode }> {
  if (role === "patient") {
    const [latest, plans, reports, reactions] = await Promise.all([
      HealthQuiz.findOne({ patientId: oid }).sort({ completedAt: -1 }).select("reviewStatus completedAt").lean<{
        reviewStatus: string;
        completedAt: Date;
      } | null>(),
      TreatmentPlan.countDocuments({ patientId: oid, status: { $nin: ["draft", "archived"] } }),
      LabReport.countDocuments({ patientId: oid }),
      Booking.countDocuments({ patientId: oid, "adverseEvents.0": { $exists: true } }),
    ]);
    return {
      cards: [],
      panel: (
        <Card padding="p-5" className="mb-8">
          <span className="t-micro block mb-4">Care at a glance</span>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <Fact label="Health assessment">
              {latest ? (
                <span className="flex items-center gap-2 flex-wrap">
                  <StatusPill status={latest.reviewStatus} dot />
                  <span className="t-small text-[var(--color-ink-3)]">{formatDate(latest.completedAt)}</span>
                </span>
              ) : (
                "Not taken yet"
              )}
            </Fact>
            <Fact label="Treatment plans">{plans}</Fact>
            <Fact label="Lab reports uploaded">{reports}</Fact>
            <Fact label="Reactions on record">{reactions}</Fact>
          </div>
        </Card>
      ),
    };
  }

  if (role === "doctor") {
    const [reviewed, plans, nurses] = await Promise.all([
      HealthQuiz.countDocuments({ reviewedBy: oid }),
      TreatmentPlan.countDocuments({ doctorId: oid }),
      User.find({ role: "nurse", "nurse.doctorId": oid })
        .select("name status")
        .sort({ name: 1 })
        .lean<Array<{ _id: unknown; name: string; status: string }>>(),
    ]);
    return {
      cards: [
        { label: "Assessments reviewed", value: String(reviewed) },
        { label: "Plans written", value: String(plans) },
      ],
      panel: (
        <Card padding="p-5" className="mb-8">
          <span className="t-micro block mb-4">Nurses working under this physician · {nurses.length}</span>
          {nurses.length === 0 ? (
            <p className="t-body text-[var(--color-ink-2)]">No nurse is posted under this physician.</p>
          ) : (
            <ul className="list-none p-0 m-0 flex flex-col gap-3">
              {nurses.map((n) => (
                <li key={String(n._id)} className="flex items-center justify-between gap-3">
                  <NameLink href={`/admin/users/${String(n._id)}`}>{n.name}</NameLink>
                  <StatusPill status={n.status} dot />
                </li>
              ))}
            </ul>
          )}
        </Card>
      ),
    };
  }

  if (role === "nurse") {
    // One comment is fetched and not shown; the figures are what this page wants. (A limit of 0 would mean "no limit" to the database.)
    const fb = await nurseFeedback(id, 1);
    return {
      cards: [
        {
          label: "Patient rating",
          value: fb.average !== null ? `${fb.average}/5` : "—",
          note: fb.count === 0 ? "No ratings yet" : `from ${fb.count} ${fb.count === 1 ? "rating" : "ratings"}${fb.poor ? ` · ${fb.poor} of 2 or less` : ""}`,
        },
      ],
      panel: null,
    };
  }

  if (role === "clinic") {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [month, orders] = await Promise.all([
      Booking.aggregate<{ n: number; revenue: number }>([
        { $match: { clinicId: oid, status: "completed", completedAt: { $gte: monthStart } } },
        { $group: { _id: null, n: { $sum: 1 }, revenue: { $sum: { $ifNull: ["$amount", 0] } } } },
      ]),
      Order.aggregate<{ _id: string; n: number }>([
        { $match: { clinicId: oid } },
        { $group: { _id: "$status", n: { $sum: 1 } } },
      ]),
    ]);
    const total = orders.reduce((n, o) => n + o.n, 0);
    return {
      cards: [
        { label: "Revenue this month", value: formatInr(month[0]?.revenue ?? 0), note: `${month[0]?.n ?? 0} completed sessions` },
      ],
      panel: (
        <Card padding="p-5" className="mb-8">
          <div className="flex items-baseline justify-between gap-4 mb-4">
            <span className="t-micro">Preparation orders · {total}</span>
            <Link href="/admin/inventory/orders" className="t-small">
              All orders
            </Link>
          </div>
          {total === 0 ? (
            <p className="t-body text-[var(--color-ink-2)]">This clinic has not raised an order.</p>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {orders.map((o) => (
                <span key={o._id} className="flex items-center gap-2">
                  <StatusPill status={o._id.toLowerCase()} dot />
                  <span className="t-data text-[13px]">{o.n}</span>
                </span>
              ))}
            </div>
          )}
        </Card>
      ),
    };
  }

  return { cards: [], panel: null };
}

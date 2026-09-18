import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { clinicNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, User } from "@/lib/models";
import { DataTable, THead, TH, TR, TD } from "@/components/ui/Table";
import { StatusPill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/States";
import { formatInr } from "@/lib/inventory/units";
import { formatDate, formatTime } from "@/lib/data/inventory";

export const metadata: Metadata = { title: "Bookings" };
export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
] as const;

export default async function ClinicBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await requireRole("clinic", "superadmin");
  const nav = await clinicNav(session.sub);
  const { view = "upcoming" } = await searchParams;

  await connectDB();
  const now = new Date();
  const filter: Record<string, unknown> = { clinicId: session.sub };
  if (view === "upcoming") filter.scheduledAt = { $gte: now };
  if (view === "past") filter.scheduledAt = { $lt: now };

  const bookings = await Booking.find(filter)
    .sort({ scheduledAt: view === "past" ? -1 : 1 })
    .limit(200)
    .lean<
      Array<{
        _id: unknown;
        bookingNo: string;
        patientId: unknown;
        nurseId?: unknown;
        dripName?: string;
        scheduledAt: Date;
        status: string;
        amount: number;
        location: string;
      }>
    >();

  const people = await User.find({
    _id: { $in: [...bookings.map((b) => b.patientId), ...bookings.map((b) => b.nurseId).filter(Boolean)] },
  }).lean<Array<{ _id: unknown; name: string }>>();
  const nameById = new Map(people.map((p) => [String(p._id), p.name]));

  return (
    <ConsoleShell
      session={session}
      roleLabel="Partner clinic"
      nav={nav}
      activeHref="/clinic/bookings"
      breadcrumb={["Clinic", "Bookings"]}
      title="Bookings"
      meta={`${bookings.length} shown`}
    >
      <div className="flex gap-1 p-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] border border-[var(--color-line)] mb-5 w-fit">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/clinic/bookings?view=${f.key}`}
            className={`px-4 min-h-[36px] inline-flex items-center rounded-[6px] text-[13px] font-semibold no-underline hover:no-underline ${
              view === f.key ? "bg-[var(--color-surface)] text-[var(--color-ink)]" : "text-[var(--color-ink-2)]"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          kind="filtered"
          title="No bookings here"
          body="Nothing matches that view. Bookings appear as soon as a physician approves the patient's protocol."
          actionLabel="Show all"
          actionHref="/clinic/bookings?view=all"
        />
      ) : (
        <DataTable>
          <THead>
            <TR>
              <TH width="130px">Booking</TH>
              <TH>Patient</TH>
              <TH>Drip</TH>
              <TH>When</TH>
              <TH>Nurse</TH>
              <TH>Status</TH>
              <TH numeric>Amount</TH>
            </TR>
          </THead>
          <tbody>
            {bookings.map((b) => (
              <TR key={String(b._id)}>
                <TD mono nowrap>{b.bookingNo}</TD>
                <TD nowrap>{nameById.get(String(b.patientId)) ?? "—"}</TD>
                <TD nowrap>{b.dripName ?? "—"}</TD>
                <TD mono nowrap>
                  {formatDate(b.scheduledAt)} · {formatTime(b.scheduledAt)}
                </TD>
                <TD nowrap>{b.nurseId ? (nameById.get(String(b.nurseId)) ?? "—") : "Unassigned"}</TD>
                <TD>
                  <StatusPill status={b.status} dot />
                </TD>
                <TD numeric>{formatInr(b.amount ?? 0)}</TD>
              </TR>
            ))}
          </tbody>
        </DataTable>
      )}
    </ConsoleShell>
  );
}

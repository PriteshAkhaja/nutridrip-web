import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { doctorNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, User } from "@/lib/models";
import { DataTable, THead, TH, TR, TD } from "@/components/ui/Table";
import { StatusPill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/States";
import { formatTime } from "@/lib/data/inventory";
import { Reassign } from "./Reassign";

export const metadata: Metadata = { title: "Schedule" };
export const dynamic = "force-dynamic";

export default async function DoctorSchedulePage() {
  const session = await requireRole("doctor", "superadmin");
  const nav = await doctorNav(session.sub);
  await connectDB();

  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 14 * 86_400_000);

  const bookings = await Booking.find({
    scheduledAt: { $gte: from, $lte: to },
    status: { $nin: ["cancelled", "rejected"] },
  })
    .sort({ scheduledAt: 1 })
    .lean<
      Array<{
        _id: unknown;
        bookingNo: string;
        patientId: unknown;
        nurseId?: unknown;
        dripName?: string;
        scheduledAt: Date;
        status: string;
        location: string;
      }>
    >();

  const people = await User.find({
    _id: { $in: [...bookings.map((b) => b.patientId), ...bookings.map((b) => b.nurseId).filter(Boolean)] },
  }).lean<Array<{ _id: unknown; name: string }>>();
  const nameById = new Map(people.map((p) => [String(p._id), p.name]));

  const nurses = (
    await User.find({ role: "nurse", status: "active" })
      .sort({ name: 1 })
      .lean<Array<{ _id: unknown; name: string; nurse?: { serviceAreas?: string[] } }>>()
  ).map((n) => ({
    id: String(n._id),
    name: n.name,
    zones: (n.nurse?.serviceAreas ?? []).slice(0, 2).join(", "),
  }));

  // Group by day so the fortnight reads as days rather than as one long list.
  const byDay = new Map<string, typeof bookings>();
  for (const b of bookings) {
    const key = b.scheduledAt.toDateString();
    byDay.set(key, [...(byDay.get(key) ?? []), b]);
  }

  return (
    <ConsoleShell
      session={session}
      roleLabel="Physician"
      nav={nav}
      activeHref="/doctor/schedule"
      breadcrumb={["Clinical", "Schedule"]}
      title="Next fortnight"
      meta={`${bookings.length} session${bookings.length === 1 ? "" : "s"}`}
    >
      {bookings.length === 0 ? (
        <EmptyState
          kind="cleared"
          title="Nothing scheduled"
          body="No sessions fall inside the next two weeks. Approved protocols appear here as patients book them."
          actionLabel="Back to approvals"
          actionHref="/doctor"
        />
      ) : (
        <div className="flex flex-col gap-6">
          {[...byDay].map(([day, items]) => (
            <section key={day}>
              <div className="flex items-baseline gap-3 mb-3">
                <h2 className="t-h3">
                  {new Date(day).toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "2-digit",
                    month: "short",
                  })}
                </h2>
                <span className="t-data text-[13px] text-[var(--color-ink-3)]">
                  {items.length} session{items.length === 1 ? "" : "s"}
                </span>
              </div>

              <DataTable>
                <THead>
                  <TR>
                    <TH width="90px">Time</TH>
                    <TH>Patient</TH>
                    <TH>Drip</TH>
                    <TH>Nurse</TH>
                    <TH>Where</TH>
                    <TH>Status</TH>
                    <TH>Change</TH>
                  </TR>
                </THead>
                <tbody>
                  {items.map((b) => (
                    <TR key={String(b._id)}>
                      <TD mono nowrap>{formatTime(b.scheduledAt)}</TD>
                      <TD nowrap>
                        <Link href={`/doctor/patients/${String(b.patientId)}`}>
                          {nameById.get(String(b.patientId)) ?? "—"}
                        </Link>
                      </TD>
                      <TD nowrap>{b.dripName ?? "—"}</TD>
                      <TD nowrap>{b.nurseId ? (nameById.get(String(b.nurseId)) ?? "—") : "Unassigned"}</TD>
                      <TD>
                        <span className="t-small text-[var(--color-ink-2)] capitalize">{b.location}</span>
                      </TD>
                      <TD>
                        <StatusPill status={b.status} dot />
                      </TD>
                      <TD>
                        {["completed", "cancelled", "in_progress"].includes(b.status) ? (
                          <span className="t-small text-[var(--color-ink-3)]">—</span>
                        ) : (
                          <Reassign
                            bookingId={String(b._id)}
                            bookingNo={b.bookingNo}
                            currentNurseId={b.nurseId ? String(b.nurseId) : null}
                            nurses={nurses}
                          />
                        )}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </DataTable>
            </section>
          ))}
        </div>
      )}
    </ConsoleShell>
  );
}

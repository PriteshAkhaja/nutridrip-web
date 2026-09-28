import Link from "next/link";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { adminNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { CallsBoard } from "@/components/calls/CallsBoard";
import { DataTable, THead, TR, TH, TD } from "@/components/ui/Table";
import { connectDB } from "@/lib/db/mongoose";
import { DoctorHours, User } from "@/lib/models";
import { callsBoard, expireStaleHolds } from "@/lib/data/calls";
import { hoursSummary } from "@/lib/clinical/calls";
import { getClockFormat } from "@/lib/settings/clock";

export const metadata: Metadata = { title: "Doctor calls" };
export const dynamic = "force-dynamic";

export default async function AdminCallsPage() {
  const clockFmt = await getClockFormat();
  const session = await requirePermission("calls.view");
  await expireStaleHolds();
  await connectDB();
  const [nav, rows, doctors, hours] = await Promise.all([
    adminNav(),
    callsBoard(),
    User.find({ role: "doctor" })
      .select("name status doctor.specialization")
      .sort({ name: 1 })
      .lean<Array<{ _id: unknown; name: string; status: string; doctor?: { specialization?: string } }>>(),
    DoctorHours.find({}).lean<
      Array<{
        doctorId: unknown;
        weekly?: Array<{ day: number; start: string; end: string }>;
        callMinutes?: number;
        daysOff?: string[];
      }>
    >(),
  ]);
  const hoursById = new Map(hours.map((h) => [String(h.doctorId), h]));
  const canManage = can(session.role, "calls.manage");
  const active = doctors.filter((d) => d.status === "active").map((d) => ({ id: String(d._id), name: d.name }));
  const booked = rows.filter((r) => r.status === "booked");

  return (
    <ConsoleShell
      session={session}
      roleLabel={session.role === "superadmin" ? "Super admin" : "Admin"}
      nav={nav}
      activeHref="/admin/calls"
      breadcrumb={["Platform", "Doctor calls"]}
      title="Doctor calls"
      meta={`${booked.filter((r) => r.today).length} today · ${booked.filter((r) => r.overdue).length} overdue`}
    >
      <p className="t-body text-[var(--color-ink-2)] max-w-[76ch] mb-6" style={{ textWrap: "pretty" }}>
        Every patient waiting for an approval books a phone call with a physician. Overdue calls and calls outside a
        physician&apos;s hours come first.
        {canManage ? " Hand a call to another physician when one is away; the patient is told." : ""}
      </p>

      <CallsBoard rows={rows} mode="admin" doctors={active} canHandOver={canManage} />

      <section className="mt-4">
        <h2 className="t-h3 mb-3">Physicians&apos; hours</h2>
        <DataTable>
          <THead>
            <TR>
              <TH>Physician</TH>
              <TH>Hours</TH>
              <TH>Call</TH>
              <TH>Days off</TH>
              <TH>
                <span className="sr-only">Edit</span>
              </TH>
            </TR>
          </THead>
          <tbody>
            {doctors.map((d) => {
              const h = hoursById.get(String(d._id));
              const view = h
                ? { weekly: h.weekly ?? [], callMinutes: h.callMinutes ?? 15, daysOff: h.daysOff ?? [] }
                : null;
              return (
                <TR key={String(d._id)}>
                  <TD>
                    <span className="font-medium">{d.name}</span>
                    {d.status !== "active" && <span className="t-small text-[var(--color-ink-3)]"> · {d.status}</span>}
                  </TD>
                  <TD>
                    <span className="t-small">
                      {view && view.weekly.length ? hoursSummary(view, clockFmt) : "Not set — not offered to patients"}
                    </span>
                  </TD>
                  <TD>
                    <span className="t-data text-[13px]">{view ? `${view.callMinutes} min` : "—"}</span>
                  </TD>
                  <TD>
                    <span className="t-data text-[13px]">
                      {view?.daysOff.length ? view.daysOff.join(", ") : "None"}
                    </span>
                  </TD>
                  <TD>
                    {canManage && (
                      <Link href={`/admin/calls/hours/${String(d._id)}`} className="t-body font-medium">
                        Edit
                      </Link>
                    )}
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </DataTable>
      </section>
    </ConsoleShell>
  );
}

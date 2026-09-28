import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guard";
import { adminNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { HoursEditor } from "@/components/calls/HoursEditor";
import { BackLink } from "@/components/layout/NavTrail";
import { connectDB } from "@/lib/db/mongoose";
import { Consultation, User } from "@/lib/models";
import { hoursOf } from "@/lib/data/calls";
import { callClash, callWhen } from "@/lib/clinical/calls";
import { istParts } from "@/lib/clinical/slots";
import { getClockFormat } from "@/lib/settings/clock";

export const metadata: Metadata = { title: "Physician hours" };
export const dynamic = "force-dynamic";

/** The super admin sets a physician's call hours for them. */
export default async function AdminDoctorHoursPage({ params }: { params: Promise<{ doctorId: string }> }) {
  const clockFmt = await getClockFormat();
  const session = await requirePermission("calls.manage");
  const { doctorId } = await params;
  await connectDB();
  const doctor = await User.findOne({ _id: doctorId, role: "doctor" }).select("name").lean<{ name: string } | null>();
  if (!doctor) notFound();
  const [nav, hours, booked] = await Promise.all([
    adminNav(),
    hoursOf(doctorId),
    Consultation.find({ doctorId, status: "booked", startAt: { $gte: new Date() } })
      .select("callNo startAt minutes")
      .lean<Array<{ _id: unknown; callNo: string; startAt: Date; minutes: number }>>(),
  ]);
  const clashes = hours
    ? booked
        .map((c) => ({
          id: String(c._id),
          callNo: c.callNo,
          when: callWhen(c.startAt, clockFmt),
          reason: callClash(hours, c.startAt, c.minutes),
        }))
        .filter((c) => c.reason)
    : [];

  return (
    <ConsoleShell
      session={session}
      roleLabel="Super admin"
      nav={nav}
      activeHref="/admin/calls"
      breadcrumb={["Platform", "Doctor calls", doctor.name]}
      title={`${doctor.name} · hours`}
      meta={`${booked.length} call${booked.length === 1 ? "" : "s"} booked`}
    >
      <div className="mb-4">
        <BackLink fallback={{ href: "/admin/calls", label: "Doctor calls" }} />
      </div>
      <HoursEditor doctorId={doctorId} initial={hours} initialClashes={clashes} today={istParts(new Date()).date} />
    </ConsoleShell>
  );
}

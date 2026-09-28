import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { doctorNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { HoursEditor } from "@/components/calls/HoursEditor";
import { connectDB } from "@/lib/db/mongoose";
import { Consultation } from "@/lib/models";
import { hoursOf } from "@/lib/data/calls";
import { callClash, callWhen } from "@/lib/clinical/calls";
import { istParts } from "@/lib/clinical/slots";
import { getClockFormat } from "@/lib/settings/clock";

export const metadata: Metadata = { title: "Availability" };
export const dynamic = "force-dynamic";

export default async function DoctorAvailabilityPage() {
  const clockFmt = await getClockFormat();
  const session = await requireRole("doctor", "superadmin");
  // Hours belong to a physician. The super admin edits them from Doctor calls.
  if (session.role !== "doctor") redirect("/admin/calls");
  await connectDB();
  const [nav, hours, booked] = await Promise.all([
    doctorNav(session.sub),
    hoursOf(session.sub),
    Consultation.find({ doctorId: session.sub, status: "booked", startAt: { $gte: new Date() } })
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
      roleLabel="Physician"
      nav={nav}
      activeHref="/doctor/availability"
      breadcrumb={["Account", "Availability"]}
      title="When you take calls"
      meta={`${booked.length} call${booked.length === 1 ? "" : "s"} booked`}
    >
      <p className="t-body text-[var(--color-ink-2)] max-w-[76ch] mb-6" style={{ textWrap: "pretty" }}>
        Before their first drip, a patient books a short phone call with the physician they choose, inside these hours.
        Until you set hours, patients are not offered you.
      </p>
      <HoursEditor doctorId={session.sub} initial={hours} initialClashes={clashes} today={istParts(new Date()).date} />
    </ConsoleShell>
  );
}

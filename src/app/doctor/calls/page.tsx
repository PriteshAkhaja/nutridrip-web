import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { doctorNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { CallsBoard } from "@/components/calls/CallsBoard";
import { callsBoard, expireStaleHolds, hoursOf } from "@/lib/data/calls";
import { hoursSummary } from "@/lib/clinical/calls";
import { getClockFormat } from "@/lib/settings/clock";

export const metadata: Metadata = { title: "Calls" };
export const dynamic = "force-dynamic";

export default async function DoctorCallsPage() {
  const clockFmt = await getClockFormat();
  const session = await requireRole("doctor", "superadmin");
  await expireStaleHolds();
  const [nav, rows, hours] = await Promise.all([
    doctorNav(session.sub),
    // A physician sees their own calls; the super admin, opening this page, sees everyone's.
    callsBoard(session.role === "doctor" ? session.sub : undefined),
    session.role === "doctor" ? hoursOf(session.sub) : Promise.resolve(null),
  ]);
  const booked = rows.filter((r) => r.status === "booked");

  return (
    <ConsoleShell
      session={session}
      roleLabel="Physician"
      nav={nav}
      activeHref="/doctor/calls"
      breadcrumb={["Clinical", "Calls"]}
      title="Calls"
      meta={`${booked.filter((r) => r.today).length} today · ${booked.length} booked`}
    >
      <p className="t-body text-[var(--color-ink-2)] max-w-[76ch] mb-6" style={{ textWrap: "pretty" }}>
        Patients book a phone call with you before their first drip. Read their answers, ring them at the time, then
        mark the call and decide. Their drip is held from two hours after the call, so the decision comes before the
        nurse sets off.
      </p>
      {session.role === "doctor" && (
        <p className="t-small text-[var(--color-ink-3)] mb-6">
          Your hours: {hours ? hoursSummary(hours, clockFmt) : "not set — patients cannot book you yet"} ·{" "}
          <Link href="/doctor/availability">Change</Link>
        </p>
      )}
      <CallsBoard rows={rows} mode="doctor" />
    </ConsoleShell>
  );
}

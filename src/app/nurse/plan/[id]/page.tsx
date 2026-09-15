import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { MobileShell } from "@/components/layout/MobileShell";
import { PlanSchedule } from "@/components/clinical/PlanSchedule";
import { planFor } from "@/lib/data/plans";

export const metadata: Metadata = { title: "Treatment plan" };
export const dynamic = "force-dynamic";

/**
 * The course a physician wrote, as the nurse reads it before a session.
 *
 * Read-only on purpose. A plan is a prescribing act signed by one physician;
 * the nurse records what was actually given on the session report, which is a
 * separate document and stays separate.
 */
export default async function NursePlanPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("nurse", "superadmin");
  const { id } = await params;

  // planFor() returns nothing for a plan that was not shared with this nurse,
  // so an unshared plan is a 404 here rather than a forbidden page that
  // confirms it exists.
  const plan = await planFor(id, session);
  if (!plan) notFound();

  return (
    <MobileShell
      title={plan.patientName}
      subtitle={`${plan.totalWeeks} week${plan.totalWeeks === 1 ? "" : "s"} · ${plan.sessions.length} session${plan.sessions.length === 1 ? "" : "s"}`}
      back={{ href: "/nurse/schedule", label: "Back to the schedule" }}
    >
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-5">
        <span className="t-micro">Diagnosis or primary concern</span>
        <p className="t-body mt-1">{plan.diagnosis ?? "Not recorded"}</p>
        <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-[var(--color-line)]">
          {[
            ["Prescribed by", plan.doctorName],
            ["Starts", plan.startDate ?? "—"],
            ["Written", plan.writtenOn],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 items-baseline">
              <span className="t-small text-[var(--color-ink-2)]">{k}</span>
              <span className="t-data text-[13px] text-right">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <PlanSchedule sessions={plan.sessions} />

      <p className="t-small text-[var(--color-ink-3)] mt-6" style={{ textWrap: "pretty" }}>
        This is the physician&rsquo;s prescription. Record what you actually gave on the session
        report — if it has to differ from this, ring the physician first.
      </p>
    </MobileShell>
  );
}

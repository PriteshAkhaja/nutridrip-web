import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { logRecordAccess } from "@/lib/auth/access-log";
import { MobileShell } from "@/components/layout/MobileShell";
import { PlanSchedule } from "@/components/clinical/PlanSchedule";
import { FillSegments } from "@/components/ui/Fill";
import { planFor } from "@/lib/data/plans";

export const metadata: Metadata = { title: "Your treatment plan" };
export const dynamic = "force-dynamic";

/**
 * The course the physician wrote, as the patient reads it.
 *
 * Every drug and dose is shown, not a summary. A patient is being asked to
 * consent to what goes into their arm, and consent to "a drip" is not consent
 * at all — it is also how they notice when something has changed.
 */
export default async function PatientPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("patient", "superadmin");
  const { id } = await params;

  // A draft has been shared with nobody, so it is not the patient's to read yet.
  const plan = await planFor(id, session);
  if (!plan) notFound();

  // A patient reading their own record is still an access, and the policy
  // says every one is written.
  await logRecordAccess({
    session,
    kind: "treatment plan",
    entity: "TreatmentPlan",
    entityId: id,
    patientId: session.sub,
  });

  return (
    <MobileShell
      title="Your treatment plan"
      subtitle={`${plan.totalWeeks} week${plan.totalWeeks === 1 ? "" : "s"} · written by ${plan.doctorName}`}
      back={{ href: "/app", label: "Back to home" }}
    >
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-5">
        <span className="t-micro">Why this was prescribed</span>
        <p className="t-body mt-1">{plan.diagnosis ?? "Your physician has not written a note here."}</p>

        <div className="mt-4 pt-4 border-t border-[var(--color-line)]">
          <FillSegments
            name="Sessions so far"
            done={plan.sessionsPast}
            total={plan.sessions.length}
          />
        </div>

        <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-[var(--color-line)]">
          {[
            ["Starts", plan.startDate ?? "—"],
            ["Your nurse", plan.nurseName ?? "Not assigned yet"],
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
        Your physician can change this plan at any time, and you will be told when they do. If
        anything here looks wrong, or you no longer want a session, say so before the nurse arrives.
      </p>
    </MobileShell>
  );
}

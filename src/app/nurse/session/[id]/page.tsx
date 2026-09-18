import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { logRecordAccess } from "@/lib/auth/access-log";
import { MobileShell } from "@/components/layout/MobileShell";
import { nurseOwns } from "@/lib/auth/ownership";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, User } from "@/lib/models";
import { PHASE_ORDER, phaseProgress } from "@/lib/clinical/checklist";
import { FillSegments } from "@/components/ui/Fill";
import { Checklist } from "./Checklist";
import { EnRouteButton } from "./EnRouteButton";
import { formatTime } from "@/lib/data/inventory";
import { Pill } from "@/components/ui/Pill";
import { rxLockState } from "@/lib/clinical/prescription";
import type { ChecklistPhase } from "@/lib/models/types";

export const metadata: Metadata = { title: "Checklist" };
export const dynamic = "force-dynamic";

export type StepView = {
  key: string;
  phase: ChecklistPhase;
  label: string;
  detail?: string;
  mandatory: boolean;
  opens?: "vitals" | "consent" | "kit" | "observation" | null;
  doneAt: string | null;
  stamp?: string;
};

export default async function ChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("nurse", "superadmin");
  const { id } = await params;

  await connectDB();
  const booking = await Booking.findById(id).lean<{
    _id: unknown;
    bookingNo: string;
    patientId: unknown;
    nurseId?: unknown;
    dripName?: string;
    scheduledAt: Date;
    status: string;
    enRouteAt?: Date;
    etaMinutes?: number;
    rxUnlockedAt?: Date;
    vitalsClearedAt?: Date;
    vitalsClearanceNote?: string;
    checklist: Array<{
      key: string;
      phase: ChecklistPhase;
      label: string;
      detail?: string;
      mandatory: boolean;
      opens?: "vitals" | "consent" | "kit" | "observation" | null;
      doneAt?: Date;
      stamp?: string;
    }>;
    vitals: Array<{ outOfRange?: string[] }>;
  } | null>();

  if (!booking || !nurseOwns(session, booking)) notFound();

  await logRecordAccess({
    session,
    kind: "session",
    entity: "Booking",
    entityId: id,
    patientId: String(booking.patientId),
  });

  const patient = await User.findById(booking.patientId).lean<{ name: string } | null>();
  const progress = phaseProgress(booking.checklist ?? []);

  const steps: StepView[] = (booking.checklist ?? []).map((s) => ({
    key: s.key,
    phase: s.phase,
    label: s.label,
    detail: s.detail,
    mandatory: s.mandatory,
    opens: s.opens ?? null,
    doneAt: s.doneAt ? s.doneAt.toISOString() : null,
    stamp: s.stamp,
  }));

  // The first incomplete step is the one the nurse is on; everything after it
  // is dimmed, because the checklist is a sequence and not a menu.
  const currentIndex = steps.findIndex((s) => !s.doneAt);
  const rxLock = rxLockState(booking);
  const flagged = (booking.vitals ?? []).some((v) => (v.outOfRange ?? []).length > 0);
  const clearance = booking.vitalsClearedAt
    ? { at: booking.vitalsClearedAt.toISOString(), note: booking.vitalsClearanceNote }
    : null;
  const blocked = flagged && !clearance;

  return (
    <MobileShell
      title={patient?.name ?? "Session"}
      subtitle={
        <span className="t-data text-[13px]">
          {booking.bookingNo} · {booking.dripName} · {formatTime(booking.scheduledAt)}
        </span>
      }
      back={{ href: "/nurse", label: "Back to today" }}
    >
      {/* ---------------- On my way ----------------
           Above the checklist because it is not a clinical step: it happens
           before any of them, and it is the one thing here the patient sees. */}
      {["approved", "nurse_assigned", "en_route"].includes(booking.status) ? (
        <EnRouteButton
          bookingId={id}
          enRouteAt={booking.enRouteAt ? booking.enRouteAt.toISOString() : null}
          etaMinutes={booking.etaMinutes ?? null}
        />
      ) : null}

      {/* ---------------- Phase progress ---------------- */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 flex flex-col gap-[14px] mb-5">
        {PHASE_ORDER.map((phase) => {
          const p = progress.find((x) => x.phase === phase)!;
          return <FillSegments key={phase} name={phase} done={p.done} total={p.total} />;
        })}
      </div>

      {/* ---------------- Prescription ---------------- */}
      <Link
        href={`/nurse/session/${id}/rx`}
        className="no-underline hover:no-underline mb-5 rounded-[var(--radius-lg)] border p-4 flex items-center gap-3"
        style={{
          borderColor: rxLock.unlocked ? "var(--color-line)" : "var(--color-primary)",
          background: rxLock.unlocked ? "var(--color-surface)" : "var(--color-primary-soft)",
        }}
      >
        <div className="min-w-0 flex-1">
          <span className="t-micro block">Prescription</span>
          <span className="t-body block mt-[2px]">
            {rxLock.unlocked
              ? "Open — drugs, doses and the physician's note"
              : `Locked — ask ${patient?.name ?? "the patient"} for their code`}
          </span>
        </div>
        <Pill tone={rxLock.unlocked ? "safe" : "primary"} dot>
          {rxLock.unlocked ? "Open" : "Locked"}
        </Pill>
      </Link>

      <Checklist
        bookingId={id}
        steps={steps}
        currentIndex={currentIndex}
        vitalsBlocked={blocked}
        rxLocked={!rxLock.unlocked}
        clearance={flagged ? clearance : null}
      />
    </MobileShell>
  );
}

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { MobileShell } from "@/components/layout/MobileShell";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, User } from "@/lib/models";
import { FillColumn, FillSegments } from "@/components/ui/Fill";
import { StatusPill } from "@/components/ui/Pill";
import { phaseProgress, PHASE_ORDER } from "@/lib/clinical/checklist";
import { formatTime } from "@/lib/data/inventory";
import { PATIENT_TABS } from "../../tabs";

export const metadata: Metadata = { title: "Your session" };
export const dynamic = "force-dynamic";

export default async function LiveSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("patient", "superadmin");
  const { id } = await params;

  await connectDB();
  const booking = await Booking.findById(id).lean<{
    _id: unknown;
    bookingNo: string;
    patientId: unknown;
    nurseId?: unknown;
    dripName?: string;
    status: string;
    startedAt?: Date;
    durationMin?: number;
    bagVolumeMl?: number;
    remainingMl?: number;
    rateMlHr?: number;
    checklist: Array<{ phase: string; doneAt?: Date }>;
    vitals: Array<{ takenAt: Date; systolic?: number; diastolic?: number; heartRate?: number; spo2?: number; temperatureF?: number }>;
    observations: Array<{ at: Date; text: string }>;
  } | null>();

  if (!booking) notFound();
  if (String(booking.patientId) !== session.sub && session.role !== "superadmin") notFound();

  const nurse = booking.nurseId
    ? await User.findById(booking.nurseId).lean<{ name: string; nurse?: { licenseNo?: string } } | null>()
    : null;

  const bag = booking.bagVolumeMl ?? 500;
  const remaining = booking.remainingMl ?? bag;
  const pct = bag > 0 ? (remaining / bag) * 100 : 0;
  const minutesLeft = booking.rateMlHr ? Math.round((remaining / booking.rateMlHr) * 60) : null;
  const progress = phaseProgress(booking.checklist ?? []);
  const baseline = booking.vitals?.[0];

  return (
    <MobileShell
      title={booking.dripName ?? "Your session"}
      subtitle={
        <span className="flex items-center gap-2">
          <span className="t-data text-[13px]">{booking.bookingNo}</span>
          <StatusPill status={booking.status} dot />
        </span>
      }
      tabs={PATIENT_TABS}
      activeHref="/app"
    >
      {/* ---------------- The bag ---------------- */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 flex gap-6 items-center mb-4">
        <FillColumn pct={pct} ariaLabel={`${remaining} of ${bag} millilitres remaining`} />
        <div className="flex flex-col gap-[10px]">
          <div className="flex flex-col">
            <span className="t-micro">Remaining</span>
            <span className="t-data text-[22px] leading-[1.3]">{remaining} ml</span>
          </div>
          {minutesLeft !== null && (
            <div className="flex flex-col">
              <span className="t-micro">About</span>
              <span className="t-data text-[14.5px]">{minutesLeft} min left</span>
            </div>
          )}
          {booking.startedAt && (
            <div className="flex flex-col">
              <span className="t-micro">Started</span>
              <span className="t-data text-[14.5px]">{formatTime(booking.startedAt)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ---------------- Nurse ---------------- */}
      {nurse && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-4">
          <span className="t-micro">Your nurse</span>
          <div className="flex items-baseline justify-between gap-3 mt-2">
            <span className="t-body font-semibold">{nurse.name}</span>
            <span className="t-data text-[13px] text-[var(--color-ink-3)]">{nurse.nurse?.licenseNo}</span>
          </div>
        </div>
      )}

      {/* ---------------- Baseline vitals ---------------- */}
      {baseline && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-4">
          <span className="t-micro">Baseline vitals · {formatTime(baseline.takenAt)}</span>
          <div className="grid grid-cols-2 gap-3 mt-3">
            {[
              ["Blood pressure", `${baseline.systolic}/${baseline.diastolic}`],
              ["Heart rate", `${baseline.heartRate} bpm`],
              ["SpO₂", `${baseline.spo2}%`],
              ["Temperature", `${baseline.temperatureF} °F`],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col">
                <span className="t-small text-[var(--color-ink-3)]">{k}</span>
                <span className="t-data text-[16px]">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- Checklist progress ---------------- */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-4">
        <span className="t-micro block mb-4">Where your nurse is up to</span>
        <div className="flex flex-col gap-[14px]">
          {PHASE_ORDER.map((phase) => {
            const p = progress.find((x) => x.phase === phase)!;
            return <FillSegments key={phase} name={phase} done={p.done} total={p.total} />;
          })}
        </div>
      </div>

      {/* ---------------- Observations ---------------- */}
      {booking.observations?.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
          <span className="t-micro block mb-3">Notes from your nurse</span>
          <div className="flex flex-col gap-3">
            {booking.observations.map((o, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="t-data text-[13px] text-[var(--color-ink-3)] flex-none w-[44px]">
                  {o.at.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}
                </span>
                <span className="t-body text-[var(--color-ink-2)]">{o.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </MobileShell>
  );
}

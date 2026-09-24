import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { MobileShell } from "@/components/layout/MobileShell";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, User } from "@/lib/models";
import { Timeline } from "@/components/ui/Timeline";
import { Pill } from "@/components/ui/Pill";
import { formatDate, formatTime } from "@/lib/data/inventory";
import { formatInr } from "@/lib/inventory/units";
import { RateSession } from "../../sessions/SessionActions";
import { PATIENT_TABS } from "../../tabs";
import { VitalsCorrected } from "@/components/ui/VitalsCorrected";
import type { VitalsCorrection } from "@/lib/clinical/checklist";
import { readFeedback, type StoredFeedback } from "@/lib/clinical/feedback";
import { LateCharges } from "@/components/ui/LateCharges";

export const metadata: Metadata = { title: "Session report" };
export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("patient", "superadmin");
  const { id } = await params;

  await connectDB();
  const booking = await Booking.findById(id).lean<{
    bookingNo: string;
    patientId: unknown;
    nurseId?: unknown;
    doctorId?: unknown;
    dripName?: string;
    scheduledAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    status: string;
    amount: number;
    vitals: Array<{
      takenAt: Date;
      label?: string;
      systolic?: number;
      diastolic?: number;
      heartRate?: number;
      spo2?: number;
      temperatureF?: number;
      outOfRange?: string[];
      corrections?: VitalsCorrection[];
    }>;
    componentsGiven: Array<{ name?: string; dose?: number; unit?: string; batchNo?: string }>;
    observations: Array<{ at: Date; text: string }>;
    adverseEvents: Array<{ at: Date; symptoms: string[]; severity?: string }>;
    aftercareNotes?: string;
    feedback?: StoredFeedback;
    charges?: Array<{ kind: "late_reschedule" | "late_cancel"; amount: number; at: Date; note?: string; settledAs?: "paid" | "waived" }>;
  } | null>();

  if (!booking) notFound();
  if (String(booking.patientId) !== session.sub && session.role !== "superadmin") notFound();

  const [nurse, doctor] = await Promise.all([
    booking.nurseId
      ? User.findById(booking.nurseId).lean<{ name: string; nurse?: { licenseNo?: string } } | null>()
      : null,
    booking.doctorId
      ? User.findById(booking.doctorId).lean<{
          name: string;
          doctor?: { licenseNo?: string; registrationCouncil?: string };
        } | null>()
      : null,
  ]);

  const baseline = booking.vitals?.[0];
  const closing = booking.vitals?.length > 1 ? booking.vitals[booking.vitals.length - 1] : null;

  return (
    <MobileShell
      title="Session report"
      subtitle={
        <span className="t-data text-[13px]">
          {booking.bookingNo} · {formatDate(booking.scheduledAt)}
        </span>
      }
      back={{ href: "/app/sessions", label: "Back to sessions" }}
      tabs={PATIENT_TABS}
      activeHref="/app/sessions"
    >
      {/* ---------------- Header ---------------- */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-4">
        <h2 className="t-h3">{booking.dripName}</h2>
        <div className="flex flex-col gap-2 mt-4">
          {[
            ["Started", booking.startedAt ? formatTime(booking.startedAt) : "—"],
            ["Finished", booking.completedAt ? formatTime(booking.completedAt) : "—"],
            ["Session total", formatInr(booking.amount ?? 0)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 items-baseline">
              <span className="t-body text-[var(--color-ink-2)]">{k}</span>
              <span className="t-data text-[14.5px]">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ---------------- What was given ---------------- */}
      {booking.componentsGiven?.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-4">
          <span className="t-micro block mb-3">What was given</span>
          <div className="flex flex-col gap-3">
            {booking.componentsGiven.map((c, i) => (
              <div key={i} className="flex justify-between gap-4 items-baseline">
                <div className="flex flex-col min-w-0">
                  <span className="t-body text-[var(--color-ink-2)]">{c.name}</span>
                  {c.batchNo && (
                    <span className="t-data text-[13px] text-[var(--color-ink-3)]">Batch {c.batchNo}</span>
                  )}
                </div>
                <span className="t-data text-[14.5px] flex-none">
                  {c.dose?.toLocaleString("en-IN")} {c.unit}
                </span>
              </div>
            ))}
          </div>
          <p className="t-small text-[var(--color-ink-3)] mt-4">
            Batch numbers are recorded so any recall can be traced back to you.
          </p>
        </div>
      )}

      {/* ---------------- Vitals ---------------- */}
      {baseline && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-4">
          <span className="t-micro block mb-3">Vitals</span>
          <div tabIndex={0} role="group" aria-label="Vitals before and after" className="scroll-x">
            <table className="w-full border-collapse min-w-[320px]">
              <thead>
                <tr>
                  <th className="t-micro text-left pb-2">Reading</th>
                  <th className="t-micro text-right pb-2">Before</th>
                  {closing && <th className="t-micro text-right pb-2">After</th>}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Blood pressure", `${baseline.systolic}/${baseline.diastolic}`, closing ? `${closing.systolic}/${closing.diastolic}` : null],
                    ["Heart rate", `${baseline.heartRate} bpm`, closing ? `${closing.heartRate} bpm` : null],
                    ["SpO₂", `${baseline.spo2}%`, closing ? `${closing.spo2}%` : null],
                    ["Temperature", `${baseline.temperatureF} °F`, closing ? `${closing.temperatureF} °F` : null],
                  ] as Array<[string, string, string | null]>
                ).map(([k, before, after]) => (
                  <tr key={k} className="border-t border-[var(--color-line)]">
                    <td className="t-body text-[var(--color-ink-2)] py-2">{k}</td>
                    <td className="t-data text-[14.5px] text-right py-2">{before}</td>
                    {closing && <td className="t-data text-[14.5px] text-right py-2">{after}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <VitalsCorrected corrections={baseline.corrections} name={closing ? "Before" : undefined} />
          {closing && <VitalsCorrected corrections={closing.corrections} name="After" />}
          {(baseline.outOfRange ?? []).length > 0 && (
            <p className="t-small text-[var(--color-critical-text)] mt-3">
              {baseline.outOfRange!.join(", ")} was outside the reference range at the start. Your nurse escalated it
              before proceeding.
            </p>
          )}
        </div>
      )}

      {/* ---------------- What happened ---------------- */}
      {booking.observations?.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-4">
          <span className="t-micro block mb-4">What happened</span>
          <Timeline
            items={booking.observations.map((o) => ({
              label: o.text,
              time: formatTime(o.at),
              state: "done" as const,
            }))}
          />
        </div>
      )}

      {booking.adverseEvents?.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] p-5 mb-4">
          <span className="t-micro text-[var(--color-critical-text)] block mb-3">Adverse events</span>
          {booking.adverseEvents.map((e, i) => (
            <div key={i} className="flex flex-col gap-2">
              <span className="t-data text-[13px]">{formatTime(e.at)}</span>
              <div className="flex gap-2 flex-wrap">
                {e.symptoms.map((s) => (
                  <Pill key={s} tone="critical">
                    {s}
                  </Pill>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- Aftercare + who ---------------- */}
      {/* A late-change fee on this session, said where the session is. */}
      {(booking.charges ?? []).length > 0 && (
        <div className="-mt-3 mb-4">
          <LateCharges
            charges={(booking.charges ?? []).map((c) => ({
              kind: c.kind,
              amount: c.amount,
              at: new Date(c.at).toISOString(),
              note: c.note ?? null,
              settledAs: c.settledAs ?? null,
            }))}
          />
        </div>
      )}

      {booking.aftercareNotes && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-primary-line)] bg-[var(--color-primary-soft)] p-5 mb-4">
          <span className="t-micro text-[var(--color-primary-dark)] block mb-2">Aftercare</span>
          <p className="t-body-lg">{booking.aftercareNotes}</p>
        </div>
      )}

      {booking.status === "completed" && (
        <div className="mb-4">
          <RateSession bookingId={id} nurseName={nurse?.name ?? null} existing={readFeedback(booking.feedback)} />
        </div>
      )}

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-5">
        <span className="t-micro block mb-3">Who was responsible</span>
        <div className="flex flex-col gap-3">
          {doctor && (
            <div className="flex flex-col">
              <span className="t-body font-medium">{doctor.name}</span>
              <span className="t-small text-[var(--color-ink-2)]">
                Reviewing physician · <span className="t-data text-[13px]">{doctor.doctor?.licenseNo}</span>
                {doctor.doctor?.registrationCouncil ? ` · ${doctor.doctor.registrationCouncil}` : ""}
              </span>
            </div>
          )}
          {nurse && (
            <div className="flex flex-col">
              <span className="t-body font-medium">{nurse.name}</span>
              <span className="t-small text-[var(--color-ink-2)]">
                Attending nurse · <span className="t-data text-[13px]">{nurse.nurse?.licenseNo}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </MobileShell>
  );
}

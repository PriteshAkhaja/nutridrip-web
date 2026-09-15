import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { MobileShell } from "@/components/layout/MobileShell";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, User } from "@/lib/models";
import { Timeline } from "@/components/ui/Timeline";
import { Pill, StatusPill } from "@/components/ui/Pill";
import { FillSegments } from "@/components/ui/Fill";
import { ButtonLink } from "@/components/ui/Button";
import { PHASE_ORDER, phaseProgress, VITAL_RANGES, type VitalKey } from "@/lib/clinical/checklist";
import { formatDate, formatTime } from "@/lib/data/inventory";
import { nurseOwns } from "@/lib/auth/ownership";

export const metadata: Metadata = { title: "Session report" };
export const dynamic = "force-dynamic";

export default async function NurseReportPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("nurse", "superadmin");
  const { id } = await params;

  await connectDB();
  const booking = await Booking.findById(id).lean<{
    _id: unknown;
    bookingNo: string;
    patientId: unknown;
    nurseId?: unknown;
    doctorId?: unknown;
    dripName?: string;
    scheduledAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    status: string;
    checklist: Array<{ phase: string; label: string; doneAt?: Date }>;
    vitals: Array<{
      takenAt: Date;
      label?: string;
      systolic?: number;
      diastolic?: number;
      heartRate?: number;
      spo2?: number;
      temperatureF?: number;
      outOfRange?: string[];
    }>;
    consent?: { givenAt?: Date; version?: string; viaOtp?: string };
    observations: Array<{ at: Date; text: string }>;
    adverseEvents: Array<{ at: Date; symptoms: string[]; severity?: string; actionsTaken?: string[] }>;
    componentsGiven: Array<{ name?: string; dose?: number; unit?: string; batchNo?: string }>;
    aftercareNotes?: string;
    feedback?: { rating?: number; comment?: string; givenAt?: Date };
  } | null>();

  if (!booking || !nurseOwns(session, booking)) notFound();

  const patient = await User.findById(booking.patientId).lean<{ name: string } | null>();
  const progress = phaseProgress(booking.checklist ?? []);
  const doneCount = progress.reduce((s, p) => s + p.done, 0);
  const totalCount = progress.reduce((s, p) => s + p.total, 0);

  return (
    <MobileShell
      title="Session report"
      subtitle={
        <span className="t-data text-[13px]">
          {patient?.name} · {booking.bookingNo}
        </span>
      }
      back={{ href: "/nurse", label: "Back to today" }}
    >
      <div className="flex items-center gap-3 flex-wrap mb-5">
        <StatusPill status={booking.status} dot />
        <span className="t-data text-[13px] text-[var(--color-ink-3)]">
          {doneCount} / {totalCount} steps
        </span>
      </div>

      {/* ---------------- Times ---------------- */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-4">
        <span className="t-micro">{booking.dripName}</span>
        <div className="flex flex-col gap-2 mt-3">
          {[
            ["Scheduled", `${formatDate(booking.scheduledAt)} · ${formatTime(booking.scheduledAt)}`],
            ["Started", booking.startedAt ? formatTime(booking.startedAt) : "—"],
            ["Finished", booking.completedAt ? formatTime(booking.completedAt) : "Not yet"],
            [
              "Consent",
              booking.consent?.givenAt
                ? `${formatTime(booking.consent.givenAt)} · ${booking.consent.version ?? "v2.1"}`
                : "Not captured",
            ],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 items-baseline">
              <span className="t-body text-[var(--color-ink-2)]">{k}</span>
              <span className="t-data text-[14.5px] text-right">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ---------------- Checklist coverage ---------------- */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-4">
        <span className="t-micro block mb-4">Checklist</span>
        <div className="flex flex-col gap-[14px]">
          {PHASE_ORDER.map((phase) => {
            const p = progress.find((x) => x.phase === phase)!;
            return <FillSegments key={phase} name={phase} done={p.done} total={p.total} />;
          })}
        </div>
      </div>

      {/* ---------------- Vitals ---------------- */}
      {booking.vitals?.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-4">
          <span className="t-micro block mb-3">Vitals recorded</span>
          <div className="flex flex-col gap-4">
            {booking.vitals.map((v, i) => (
              <div key={i}>
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <span className="t-body font-medium capitalize">{v.label ?? "reading"}</span>
                  <span className="t-data text-[13px] text-[var(--color-ink-3)]">{formatTime(v.takenAt)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["Blood pressure", `${v.systolic}/${v.diastolic}`, "systolic"],
                      ["Heart rate", `${v.heartRate} bpm`, "heartRate"],
                      ["SpO₂", `${v.spo2}%`, "spo2"],
                      ["Temperature", `${v.temperatureF} °F`, "temperatureF"],
                    ] as Array<[string, string, VitalKey]>
                  ).map(([k, val, key]) => {
                    const out = (v.outOfRange ?? []).includes(key);
                    return (
                      <div key={k} className="flex flex-col">
                        <span className="t-small text-[var(--color-ink-3)]">{k}</span>
                        <span
                          className="t-data text-[16px]"
                          style={out ? { color: "var(--color-critical)" } : undefined}
                        >
                          {val}
                        </span>
                        {out && (
                          <span className="t-small text-[var(--color-critical-text)]">
                            Outside {VITAL_RANGES[key].min}–{VITAL_RANGES[key].max}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
        </div>
      )}

      {/* ---------------- Observations ---------------- */}
      {booking.observations?.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-4">
          <span className="t-micro block mb-4">Observations</span>
          <Timeline
            items={booking.observations.map((o) => ({
              label: o.text,
              time: formatTime(o.at),
              state: "done" as const,
            }))}
          />
        </div>
      )}

      {/* ---------------- Adverse events ---------------- */}
      {booking.adverseEvents?.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] p-5 mb-4">
          <span className="t-micro text-[var(--color-critical-text)] block mb-3">Adverse events filed</span>
          <div className="flex flex-col gap-4">
            {booking.adverseEvents.map((e, i) => (
              <div key={i} className="flex flex-col gap-2">
                <span className="t-data text-[13px]">
                  {formatTime(e.at)}
                  {e.severity ? ` · ${e.severity}` : ""}
                </span>
                <div className="flex gap-2 flex-wrap">
                  {e.symptoms.map((s) => (
                    <Pill key={s} tone="critical">
                      {s}
                    </Pill>
                  ))}
                </div>
                {(e.actionsTaken ?? []).length > 0 && (
                  <span className="t-small text-[var(--color-ink-2)]">{e.actionsTaken!.join(" · ")}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {booking.aftercareNotes && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-primary-line)] bg-[var(--color-primary-soft)] p-5 mb-4">
          <span className="t-micro text-[var(--color-primary-dark)] block mb-2">Aftercare given</span>
          <p className="t-body-lg">{booking.aftercareNotes}</p>
        </div>
      )}

      {/* The patient is told "your nurse sees this on their record" when they
          rate a session. This is that record. A rating that only ever travelled
          back to the person who gave it was a promise made and not kept. */}
      {typeof booking.feedback?.rating === "number" && (
        <div
          className="rounded-[var(--radius-lg)] border p-5 mb-4"
          style={{
            borderColor: booking.feedback.rating <= 2 ? "var(--color-caution)" : "var(--color-safe)",
            background: booking.feedback.rating <= 2 ? "var(--color-caution-soft)" : "var(--color-safe-soft)",
          }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span
              className="t-micro"
              style={{
                color:
                  booking.feedback.rating <= 2 ? "var(--color-caution-text)" : "var(--color-safe-text)",
              }}
            >
              {patient?.name ?? "The patient"} rated this session
            </span>
            <span className="t-data text-[18px]">{booking.feedback.rating}/5</span>
          </div>
          {booking.feedback.comment?.trim() ? (
            <p className="t-body-lg mt-3">{booking.feedback.comment.trim()}</p>
          ) : (
            <p className="t-small text-[var(--color-ink-2)] mt-2">No comment left.</p>
          )}
          {booking.feedback.givenAt && (
            <span className="t-small text-[var(--color-ink-3)] block mt-2">
              {formatDate(booking.feedback.givenAt)} · {formatTime(booking.feedback.givenAt)}
            </span>
          )}
        </div>
      )}

      <p className="t-small text-[var(--color-ink-3)] mb-4">
        The patient sees this same record from their own account, with the physician&apos;s and your registration
        numbers on it.
      </p>

      {booking.status !== "completed" && (
        <ButtonLink href={`/nurse/session/${id}`} block size="lg">
          Back to the checklist
        </ButtonLink>
      )}
    </MobileShell>
  );
}

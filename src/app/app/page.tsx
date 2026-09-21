import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { MobileShell } from "@/components/layout/MobileShell";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, HealthQuiz, User } from "@/lib/models";
import { FillRing, FillBar } from "@/components/ui/Fill";
import { Timeline, type TimelineItem } from "@/components/ui/Timeline";
import { StatusPill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/States";
import { ButtonLink } from "@/components/ui/Button";
import { riskColor, riskBand } from "@/lib/models/types";
import { approvalState } from "@/lib/clinical/validity";
import { formatDate, formatTime } from "@/lib/data/inventory";
import { plansFor } from "@/lib/data/plans";
import { etaLabel } from "@/lib/clinical/nurse-options";
import { PATIENT_TABS } from "./tabs";
import { Arrow } from "@/components/ui/Arrow";

export const metadata: Metadata = { title: "Home" };
export const dynamic = "force-dynamic";

/**
 * What the nurse stage is honestly called right now.
 *
 * A session sits at `nurse_assigned` from the moment a physician approves it
 * until the nurse actually sets off, which can be days. Calling that "en route"
 * is simply untrue, and it is the sort of line a patient waits by the door for.
 */
function nurseStageLabel(status: string): string {
  if (status === "en_route") return "Nurse on the way";
  if (status === "in_progress" || status === "completed") return "Nurse arrived";
  if (status === "nurse_assigned") return "Nurse assigned";
  return "Nurse being assigned";
}

/** The session's life, from booked to aftercare, as the patient sees it. */
function timelineFor(booking: {
  status: string;
  createdAt?: Date;
  approvedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  scheduledAt: Date;
  durationMin?: number;
  enRouteAt?: Date;
  etaMinutes?: number;
}): TimelineItem[] {
  const fmt = (d?: Date) =>
    d
      ? d.toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      : "—";

  const stages: Array<[string, string, boolean]> = [
    ["Booked", fmt(booking.createdAt), Boolean(booking.createdAt)],
    [
      "Physician approved",
      booking.approvedAt ? fmt(booking.approvedAt) : "Usually within two hours",
      Boolean(booking.approvedAt),
    ],
    [
      // The label follows the actual status. Saying "Nurse en route" for a
      // session that is still two days away tells the patient somebody has set
      // off when nobody has, and it is the line they will ring us about.
      nurseStageLabel(booking.status),
      // The figure is what the nurse's distance was when they set off, not a
      // live countdown — nothing tracks them afterwards, so a number that kept
      // falling on its own would be invented.
      booking.status === "en_route"
        ? `Set off ${fmt(booking.enRouteAt)} · ${etaLabel(booking.etaMinutes)}`
        : fmt(booking.scheduledAt),
      ["en_route", "in_progress", "completed"].includes(booking.status),
    ],
    ["Consent & vitals", booking.startedAt ? fmt(booking.startedAt) : "—", Boolean(booking.startedAt)],
    [
      "Infusion",
      `${booking.durationMin ?? 45} min expected`,
      booking.status === "in_progress" || booking.status === "completed",
    ],
    ["Aftercare & report", booking.completedAt ? fmt(booking.completedAt) : "—", Boolean(booking.completedAt)],
  ];

  const firstPending = stages.findIndex(([, , done]) => !done);
  return stages.map(([label, time, done], i) => ({
    label,
    time,
    state: done ? "done" : i === firstPending ? "now" : "next",
  }));
}

export default async function PatientHomePage() {
  const session = await requireRole("patient", "superadmin");
  await connectDB();

  const [user, quiz, upcoming, plans] = await Promise.all([
    User.findById(session.sub).lean<{ name: string; patient?: { vitalityScore?: number } } | null>(),
    HealthQuiz.findOne({ patientId: session.sub }).sort({ completedAt: -1 }).lean<{
      _id: unknown;
      vitalityScore: number;
      nutrientRisks: Array<{ name: string; pct: number }>;
      reviewStatus: string;
      reviewedAt?: Date;
      completedAt: Date;
    } | null>(),
    Booking.findOne({
      patientId: session.sub,
      status: { $nin: ["completed", "cancelled", "rejected"] },
    })
      .sort({ scheduledAt: 1 })
      .lean<{
        _id: unknown;
        bookingNo: string;
        dripName?: string;
        scheduledAt: Date;
        durationMin?: number;
        status: string;
        createdAt?: Date;
        approvedAt?: Date;
        startedAt?: Date;
        completedAt?: Date;
        remainingMl?: number;
        bagVolumeMl?: number;
        enRouteAt?: Date;
        etaMinutes?: number;
      } | null>(),
    // Drafts are excluded inside plansFor — a plan the physician has not
    // shared yet is not the patient's to read.
    // Only the current plan is shown here, so only one is fetched.
    plansFor(session, { limit: 1 }),
  ]);

  const plan = plans[0] ?? null;

  const lowest = quiz
    ? [...quiz.nutrientRisks].sort((a, b) => a.pct - b.pct).slice(0, 3)
    : [];
  const approval = approvalState(quiz);

  return (
    <MobileShell
      title={`Hello, ${(user?.name ?? "there").split(" ")[0]}`}
      subtitle={quiz ? "Your latest assessment" : "Start with the quiz"}
      tabs={PATIENT_TABS}
      activeHref="/app"
    >
      {/* ---------------- Vitality ---------------- */}
      {quiz ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 mb-4">
          <div className="flex flex-col items-center gap-2">
            <FillRing score={quiz.vitalityScore} size={150} stroke={13} caption="of 100" />
            <Link href={`/app/results/${String(quiz._id)}`} className="t-body font-medium mt-2">
              See all 16 markers&nbsp;<Arrow />
            </Link>
          </div>

          {lowest.length > 0 && (
            <div className="flex flex-col gap-[14px] mt-6 pt-6 border-t border-[var(--color-line)]">
              <span className="t-micro">Three lowest markers</span>
              {lowest.map((m) => (
                <FillBar
                  key={m.name}
                  label={
                    <span className="flex items-center gap-2">
                      {m.name}
                      <span className="t-small" style={{ color: riskColor(m.pct) }}>
                        {riskBand(m.pct)}
                      </span>
                    </span>
                  }
                  value={`${m.pct}%`}
                  pct={m.pct}
                  color={riskColor(m.pct)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mb-4">
          <EmptyState
            kind="first-run"
            title="No assessment yet"
            body="Sixteen markers, your history, medication and allergies. Three minutes, and a physician reads every word of it."
            actionLabel="Take the health quiz"
            actionHref="/quiz"
          />
        </div>
      )}

      {/* ---------------- Treatment plan ---------------- */}
      {plan ? (
        <Link
          href={`/app/plan/${plan.id}`}
          className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 mb-4 flex items-start justify-between gap-4 no-underline hover:no-underline hover:border-[var(--color-primary-line)] transition-colors duration-150"
        >
          <div className="min-w-0">
            <span className="t-micro">Your treatment plan</span>
            <h2 className="t-h3 mt-1">
              {plan.totalWeeks} week{plan.totalWeeks === 1 ? "" : "s"} · {plan.sessions.length}{" "}
              session{plan.sessions.length === 1 ? "" : "s"}
            </h2>
            <span className="t-small text-[var(--color-ink-2)] block mt-1">
              {plan.diagnosis ?? `Written by ${plan.doctorName}`}
            </span>
            <span className="t-small text-[var(--color-ink-3)] block mt-2">
              See every drip and dose&nbsp;<Arrow />
            </span>
          </div>
          <div className="flex flex-col items-end flex-none">
            <span className="t-data text-[18px]">
              {plan.sessionsPast}/{plan.sessions.length}
            </span>
            <span className="t-small text-[var(--color-ink-3)]">so far</span>
          </div>
        </Link>
      ) : null}

      {/* ---------------- Next session ---------------- */}
      {upcoming ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <span className="t-micro">Next session</span>
              <h2 className="t-h3 mt-1">{upcoming.dripName}</h2>
              <span className="t-data text-[13px] text-[var(--color-ink-2)] block mt-1">
                {formatDate(upcoming.scheduledAt)} · {formatTime(upcoming.scheduledAt)} · {upcoming.bookingNo}
              </span>
            </div>
            <StatusPill status={upcoming.status} dot />
          </div>

          <Timeline items={timelineFor(upcoming)} />

          {upcoming.status === "in_progress" && (
            <div className="mt-5">
              <ButtonLink href={`/app/session/${String(upcoming._id)}`} block size="lg">
                Watch it run
              </ButtonLink>
            </div>
          )}

          {upcoming.status === "awaiting_review" && (
            <p className="t-small text-[var(--color-ink-2)] mt-5">
              A registered physician is reading your submission now. You will get a notification either way —
              approval, an adjusted protocol, or a decline with the reason.
            </p>
          )}
        </div>
      ) : (
        <EmptyState
          kind="first-run"
          title={
            approval.canBook
              ? "Nothing booked yet"
              : approval.status === "pending"
                ? "Waiting on the physician"
                : approval.status === "expired"
                  ? "Your approval has lapsed"
                  : approval.status === "rejected"
                    ? "IV therapy is not right for you now"
                    : "Start with the quiz"
          }
          body={approval.message}
          actionLabel={approval.canBook ? "Book a session" : approval.status === "pending" ? undefined : "Take the quiz"}
          actionHref={approval.canBook ? "/app/book" : approval.status === "pending" ? undefined : "/quiz"}
        />
      )}

      {/* The one line that answers "do I have to do this every time?" */}
      {quiz && approval.status !== "none" && (
        <div
          className="rounded-[var(--radius-md)] border px-4 py-3 mt-4"
          style={{
            borderColor:
              approval.status === "valid"
                ? "var(--color-safe)"
                : approval.status === "expiring"
                  ? "var(--color-caution)"
                  : "var(--color-line)",
            background:
              approval.status === "valid"
                ? "var(--color-safe-soft)"
                : approval.status === "expiring"
                  ? "var(--color-caution-soft)"
                  : "var(--color-surface-2)",
          }}
        >
          <span className="t-micro block mb-1">Your physician approval</span>
          <span className="t-body text-[var(--color-ink-2)]">{approval.message}</span>
        </div>
      )}
    </MobileShell>
  );
}

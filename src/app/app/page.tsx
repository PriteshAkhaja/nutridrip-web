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
import { NurseCodes } from "./NurseCodes";
import { liveCodesFor } from "@/lib/data/session-codes";
import { FeedbackPrompt } from "./FeedbackPrompt";
import { sessionToRate } from "@/lib/data/feedback-prompt";
import { getLatePolicy } from "@/lib/billing/settings";
import { LateCharges } from "@/components/ui/LateCharges";
import { CancelSession, RescheduleSession } from "./sessions/SessionActions";

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
        charges?: Array<{ kind: "late_reschedule" | "late_cancel"; amount: number; at: Date; note?: string; settledAs?: "paid" | "waived" }>;
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
  // For moving or cancelling the next session from here, on the same terms as Sessions.
  const policy = await getLatePolicy();

  // A nurse can be at the door for any of these, and may ask for a code.
  const sessionOn = await Booking.exists({
    patientId: session.sub,
    status: { $in: ["approved", "nurse_assigned", "en_route", "in_progress"] },
  });
  const codes = sessionOn ? await liveCodesFor(session.sub) : [];
  // A finished session not yet rated, asked about while it is fresh.
  const toRate = await sessionToRate(session.sub);

  /** What to do next when nothing is booked, by where the approval stands. */
  const next: { label: string; href: string } | null = !quiz
    ? null
    : approval.canBook
      ? { label: "Book a session", href: "/app/book" }
      : approval.status === "info_needed"
        ? { label: "Answer the question", href: `/app/results/${String(quiz._id)}` }
        : approval.canHold
          ? { label: "Hold a slot", href: "/app/book" }
          : approval.status === "expired"
            ? { label: "Retake the health quiz", href: "/quiz?retake=1" }
            : approval.status === "rejected"
              ? { label: "See your results", href: `/app/results/${String(quiz._id)}` }
              : null;

  return (
    <MobileShell
      title={`Hello, ${(user?.name ?? "there").split(" ")[0]}`}
      subtitle={quiz ? "Your latest assessment" : "Start with the quiz"}
      tabs={PATIENT_TABS}
      activeHref="/app"
    >
      {/* ---------------- A code the nurse is waiting on ---------------- */}
      <NurseCodes initial={codes} active={Boolean(sessionOn)} />

      {/* ---------------- How was it? ---------------- */}
      {toRate && <FeedbackPrompt session={toRate} />}

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

          <LateCharges
            charges={(upcoming.charges ?? []).map((c) => ({
              kind: c.kind,
              amount: c.amount,
              at: new Date(c.at).toISOString(),
              note: c.note ?? null,
              settledAs: c.settledAs ?? null,
            }))}
          />

          {/* Moving or cancelling it, from where the patient first sees it --
              not only from the Sessions tab. Not once it has started. */}
          {upcoming.status !== "in_progress" && (
            <div className="mt-4 pt-3 border-t border-[var(--color-line)] flex justify-end gap-2 flex-wrap">
              <RescheduleSession
                bookingId={String(upcoming._id)}
                bookingNo={upcoming.bookingNo}
                scheduledAt={upcoming.scheduledAt.toISOString()}
                policy={policy}
              />
              <CancelSession
                bookingId={String(upcoming._id)}
                bookingNo={upcoming.bookingNo}
                scheduledAt={upcoming.scheduledAt.toISOString()}
                policy={policy}
              />
            </div>
          )}
        </div>
      ) : null}

      {/* ---------------- Your physician approval ----------------
          One card says where the patient stands and what to do next. With no
          session booked it carries the next step; with one booked it sits under
          it. It used to be two cards -- "Nothing booked yet" and this box --
          printing the same sentence twice. With no quiz at all, the "No
          assessment yet" card above is the only thing to say. */}
      {quiz && approval.status !== "none" && (
        <div
          className={`rounded-[var(--radius-md)] border px-4 py-3${upcoming ? " mt-4" : ""}`}
          style={{
            borderColor:
              approval.status === "valid"
                ? "var(--color-safe)"
                : approval.status === "expiring"
                  ? "var(--color-caution)"
                  : approval.status === "rejected"
                    ? "var(--color-critical)"
                    : "var(--color-line)",
            background:
              approval.status === "valid"
                ? "var(--color-safe-soft)"
                : approval.status === "expiring"
                  ? "var(--color-caution-soft)"
                  : approval.status === "rejected"
                    ? "var(--color-critical-soft)"
                    : "var(--color-surface-2)",
          }}
        >
          <span className="t-micro block mb-1">Your physician approval</span>
          <span className="t-body text-[var(--color-ink-2)]">{approval.message}</span>

          {/* With a session booked, the booking card above is the next step --
              except for a physician's question, which nothing moves without. */}
          {next && (!upcoming || approval.status === "info_needed") && (
            <div className="mt-3">
              <ButtonLink href={next.href}>{next.label}</ButtonLink>
            </div>
          )}

          {/* Retaking is a choice made here or on Profile, never by a website
              button. New answers replace any the physician has not decided on
              yet, so it is safe at any point. When the approval has lapsed it
              is the main button instead. */}
          {approval.status !== "expired" && (
            <Link href="/quiz?retake=1" className="t-body font-medium block mt-3">
              Retake the health quiz&nbsp;<Arrow />
            </Link>
          )}
        </div>
      )}
    </MobileShell>
  );
}

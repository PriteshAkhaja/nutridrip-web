import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { doctorNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { reviewQueue } from "@/lib/data/clinical";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, HealthQuiz, User } from "@/lib/models";
import { StatCard } from "@/components/ui/Card";
import { Pill, StatusPill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { recentFeedbackForDoctor } from "@/lib/data/session-feedback";
import { formatDate } from "@/lib/data/inventory";

export const metadata: Metadata = { title: "Approvals" };
export const dynamic = "force-dynamic";

const FLAG_TONE = { crit: "critical", warn: "caution", info: "info" } as const;

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

export default async function DoctorQueuePage() {
  const session = await requireRole("doctor", "superadmin");
  const nav = await doctorNav(session.sub);
  const queue = await reviewQueue();

  await connectDB();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const weekStart = daysAgo(7);

  const [approvedToday, declinedThisWeek, openAdverse, blockedVitals] = await Promise.all([
    HealthQuiz.countDocuments({ reviewStatus: "approved", reviewedAt: { $gte: dayStart } }),
    HealthQuiz.countDocuments({ reviewStatus: "rejected", reviewedAt: { $gte: weekStart } }),
    // Open means nobody has closed it — not merely that the session is unfinished.
    Booking.countDocuments({ adverseEvents: { $elemMatch: { acknowledgedAt: null } } }),
    Booking.countDocuments({
      "vitals.outOfRange.0": { $exists: true },
      vitalsClearedAt: null,
      status: { $in: ["nurse_assigned", "en_route", "in_progress"] },
    }),
  ]);
  const escalations = openAdverse + blockedVitals;

  const breaching = queue.filter((q) => q.msLeft < 3_600_000).length;

  // What patients said about this physician's sessions.
  const feedback = session.role === "doctor" ? await recentFeedbackForDoctor(session.sub) : null;

  // The nurses posted under this physician: who they are, where they work, and
  // what they are carrying right now. Only a physician has a team -- the super
  // admin, who can also open this page, does not.
  const OPEN = ["nurse_assigned", "en_route", "in_progress"];
  const team =
    session.role === "doctor"
      ? await User.find({ role: "nurse", "nurse.doctorId": session.sub })
          .select("name status nurse.serviceAreas")
          .sort({ name: 1 })
          .lean<Array<{ _id: unknown; name: string; status: string; nurse?: { serviceAreas?: string[] } }>>()
      : [];
  const openByNurse = new Map(
    (team.length
      ? await Booking.aggregate<{ _id: unknown; n: number }>([
          { $match: { nurseId: { $in: team.map((n) => n._id) }, status: { $in: OPEN } } },
          { $group: { _id: "$nurseId", n: { $sum: 1 } } },
        ])
      : []
    ).map((r) => [String(r._id), r.n])
  );

  return (
    <ConsoleShell
      session={session}
      roleLabel="Physician"
      nav={nav}
      activeHref="/doctor"
      breadcrumb={["Clinical", "Approvals"]}
      title="Approvals queue"
      meta={`${queue.length} waiting`}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard
          label="Pending approvals"
          value={String(queue.length)}
          pct={Math.min(100, queue.length * 12)}
          color="var(--color-caution)"
          note={breaching ? `${breaching} breaching within the hour` : "None breaching yet"}
        />
        <StatCard
          label="Approved today"
          value={String(approvedToday)}
          pct={Math.min(100, approvedToday * 8)}
          note="Every approval carries your registration number"
        />
        <StatCard
          label="Declined this week"
          value={String(declinedThisWeek)}
          pct={Math.min(100, declinedThisWeek * 15)}
          color="var(--color-critical)"
          note="Declines are recorded with a reason"
        />
        <StatCard
          label="Escalations"
          value={String(escalations)}
          pct={escalations ? 60 : 0}
          color="var(--color-critical)"
          note={
            blockedVitals
              ? `${blockedVitals} infusion${blockedVitals === 1 ? "" : "s"} blocked on vitals — your call`
              : openAdverse
                ? "Adverse events awaiting your determination"
                : "Nothing open"
          }
          href="/doctor/adverse"
        />
      </div>

      {queue.length === 0 ? (
        <EmptyState
          kind="cleared"
          title="Nothing left to approve"
          body="Every submission has been reviewed. The next one arrives with a notification, usually within the hour."
          actionLabel="View your patients"
          actionHref="/doctor/patients"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {queue.map((q) => {
            const urgent = q.msLeft < 3_600_000;
            return (
              <div
                key={q.quizId}
                className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-5 grid gap-4 lg:grid-cols-[1.4fr_1fr_auto] items-center"
                style={{ borderColor: urgent ? "var(--color-critical)" : "var(--color-line)" }}
              >
                {/* Who */}
                <div className="min-w-0">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <Link href={`/doctor/review/${q.quizId}`} className="t-h3 no-underline hover:no-underline">
                      {q.name}
                    </Link>
                    <span className="t-data text-[13px] text-[var(--color-ink-3)]">
                      {q.age} · {q.gender}
                      {q.bookingNo ? ` · ${q.bookingNo}` : ""}
                    </span>
                  </div>
                  {q.flags.length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-2">
                      {q.flags.map((f) => (
                        <Pill key={f.label} tone={FLAG_TONE[f.kind]} dot={f.kind === "crit"}>
                          {f.label}
                        </Pill>
                      ))}
                    </div>
                  )}
                </div>

                {/* What */}
                <div className="flex gap-6 flex-wrap">
                  <div className="flex flex-col">
                    <span className="t-micro">Requested</span>
                    <span className="t-body font-medium">{q.dripName ?? "No booking yet"}</span>
                    {q.slot && <span className="t-data text-[13px] text-[var(--color-ink-3)]">{q.slot}</span>}
                  </div>
                  <div className="flex flex-col">
                    <span className="t-micro">Vitality</span>
                    <span className="t-data text-[18px]">{q.vitalityScore}</span>
                  </div>
                </div>

                {/* SLA + action */}
                <div className="flex items-center gap-4 justify-end flex-wrap">
                  <div className="flex flex-col items-end gap-[6px] min-w-[110px]">
                    <span
                      className="t-data text-[13px]"
                      style={{ color: urgent ? "var(--color-critical)" : "var(--color-ink-2)" }}
                    >
                      {q.slaLabel}
                    </span>
                    <div className="w-[110px] h-[6px] rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${q.slaPct}%`,
                          background: urgent ? "var(--color-critical)" : "var(--color-caution)",
                        }}
                      />
                    </div>
                  </div>
                  <Link href={`/doctor/review/${q.quizId}`} className="no-underline hover:no-underline">
                    <Button variant={urgent ? "primary" : "secondary"}>Review</Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Where "… has joined your team" lands. Only for a physician. */}
      {session.role === "doctor" && (
        <section id="team" className="mt-10 scroll-mt-20">
          <div className="flex items-baseline justify-between gap-4 mb-3">
            <h2 className="t-h3">Your nurses</h2>
            <span className="t-data text-[13px] text-[var(--color-ink-3)]">{team.length} on your team</span>
          </div>
          {team.length === 0 ? (
            <p className="t-body text-[var(--color-ink-2)] max-w-[62ch]">
              No nurse is posted under you yet. The operations team adds nurses and chooses which physician each works
              under; you are told the moment one joins.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {team.map((n) => {
                const zones = n.nurse?.serviceAreas ?? [];
                const open = openByNurse.get(String(n._id)) ?? 0;
                return (
                  <div
                    key={String(n._id)}
                    className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 grid gap-3 lg:grid-cols-[1fr_1.4fr_260px] items-center"
                  >
                    <span className="t-h3">{n.name}</span>
                    <div className="flex gap-2 flex-wrap items-center">
                      {zones.length === 0 ? (
                        <span className="t-small text-[var(--color-ink-3)]">Offered for every zone</span>
                      ) : (
                        zones.map((z) => (
                          <Pill key={z} tone="neutral">
                            {z}
                          </Pill>
                        ))
                      )}
                    </div>
                    <div className="flex items-center gap-4 justify-between lg:justify-end">
                      <span className="t-small text-[var(--color-ink-2)]">
                        {open === 0 ? "No open sessions" : `${open} open session${open === 1 ? "" : "s"}`}
                      </span>
                      <StatusPill status={n.status} dot />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Where "Low rating on …" and every other rating can be read. */}
      {feedback && (
        <section id="feedback" className="mt-10 scroll-mt-20">
          <div className="flex items-baseline justify-between gap-4 mb-3 flex-wrap">
            <h2 className="t-h3">Patient feedback</h2>
            <span className="t-data text-[13px] text-[var(--color-ink-3)]">
              {feedback.lowLast30 === 0
                ? "No low ratings in the last 30 days"
                : `${feedback.lowLast30} low rating${feedback.lowLast30 === 1 ? "" : "s"} in the last 30 days`}
            </span>
          </div>
          {feedback.rows.length === 0 ? (
            <p className="t-body text-[var(--color-ink-2)] max-w-[62ch]">
              No feedback on your sessions yet. Patients are asked once a session is finished: about their nurse, and
              about how they felt afterwards.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {feedback.rows.map((f) => (
                <div
                  key={f.bookingId}
                  className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-5 grid gap-4 lg:grid-cols-[1fr_1.6fr] items-start"
                  style={{ borderColor: f.low ? "var(--color-caution)" : "var(--color-line)" }}
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/doctor/patients/${f.patientId}`} className="t-h3 no-underline hover:no-underline">
                        {f.patientName}
                      </Link>
                      {f.low && <Pill tone="caution">Low rating</Pill>}
                    </div>
                    <span className="t-small text-[var(--color-ink-2)]">
                      <span className="t-data text-[12.5px]">{f.bookingNo}</span>
                      {f.dripName ? ` · ${f.dripName}` : ""}
                      {f.feedback.givenAt ? ` · ${formatDate(f.feedback.givenAt)}` : ""}
                    </span>
                  </div>
                  {/* Each rating sits with its own label and comment. Spread to the
                      column's far edge, the nurse's score landed beside the word
                      "Session" and read as the session's. */}
                  <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
                    {(
                      [
                        [f.nurseName ? `Nurse · ${f.nurseName}` : "Nurse", f.feedback.nurse],
                        ["Session", f.feedback.session],
                      ] as const
                    ).map(([label, part]) =>
                      part ? (
                        <div key={label} className="flex flex-col gap-1 min-w-0">
                          <span className="t-micro">{label}</span>
                          <div className="flex items-baseline gap-3">
                            <span
                              className="t-data text-[16px] font-semibold flex-none"
                              style={{ color: part.rating <= 2 ? "var(--color-caution-text)" : "var(--color-ink)" }}
                            >
                              {part.rating}/5
                            </span>
                            {part.comment ? (
                              <span className="t-body min-w-0">{part.comment}</span>
                            ) : (
                              <span className="t-small text-[var(--color-ink-3)]">No comment</span>
                            )}
                          </div>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </ConsoleShell>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { doctorNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { reviewQueue } from "@/lib/data/clinical";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, HealthQuiz } from "@/lib/models";
import { StatCard } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";

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
    </ConsoleShell>
  );
}

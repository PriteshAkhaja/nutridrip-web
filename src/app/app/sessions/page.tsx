import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { MobileShell } from "@/components/layout/MobileShell";
import { patientSessions } from "@/lib/data/sessions";
import { connectDB } from "@/lib/db/mongoose";
import { HealthQuiz } from "@/lib/models";
import { StatusPill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/States";
import { FillBar } from "@/components/ui/Fill";
import { formatDate, formatTime } from "@/lib/data/inventory";
import { CancelSession, RescheduleSession } from "./SessionActions";
import { releasedDays } from "@/lib/clinical/slots";
import { PATIENT_TABS } from "../tabs";

export const metadata: Metadata = { title: "Sessions" };
export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const session = await requireRole("patient", "superadmin");
  const sessions = await patientSessions(session.sub);
  const days = releasedDays();

  await connectDB();
  // The vitality trend is only meaningful across more than one assessment.
  const quizzes = await HealthQuiz.find({ patientId: session.sub })
    .sort({ completedAt: 1 })
    .lean<Array<{ _id: unknown; vitalityScore: number; completedAt: Date }>>();

  const upcoming = sessions.filter((s) => !["completed", "cancelled"].includes(s.status));
  const past = sessions.filter((s) => ["completed", "cancelled"].includes(s.status));

  return (
    <MobileShell
      title="Your sessions"
      subtitle={`${past.length} completed · ${upcoming.length} upcoming`}
      tabs={PATIENT_TABS}
      activeHref="/app/sessions"
    >
      {quizzes.length > 1 && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-5">
          <span className="t-micro block mb-4">Vitality trend</span>
          <div className="flex flex-col gap-[14px]">
            {quizzes.map((q) => (
              <FillBar
                key={String(q._id)}
                label={formatDate(q.completedAt)}
                value={String(q.vitalityScore)}
                pct={q.vitalityScore}
                color="var(--color-accent)"
              />
            ))}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="mb-6">
          <span className="t-micro block mb-3">Upcoming</span>
          <div className="flex flex-col gap-3">
            {upcoming.map((s) => (
              <div
                key={s.id}
                className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/app/session/${s.id}`} className="min-w-0 no-underline hover:no-underline">
                    <span className="t-h3 block text-[var(--color-ink)]">{s.dripName}</span>
                    <span className="t-data text-[13px] text-[var(--color-ink-2)] block mt-1">
                      {formatDate(s.scheduledAt)} · {formatTime(s.scheduledAt)}
                    </span>
                    <span className="t-small text-[var(--color-ink-3)] block">{s.where}</span>
                  </Link>
                  <StatusPill status={s.status} dot />
                </div>
                {s.status !== "in_progress" && (
                  <div className="mt-3 pt-3 border-t border-[var(--color-line)] flex flex-col gap-2">
                    <div className="flex justify-end gap-2 flex-wrap">
                      <RescheduleSession
                        bookingId={s.id}
                        bookingNo={s.bookingNo}
                        scheduledAt={s.scheduledAt}
                        releasedDays={days}
                      />
                      <CancelSession bookingId={s.id} bookingNo={s.bookingNo} scheduledAt={s.scheduledAt} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <span className="t-micro block mb-3">Your history</span>
        {past.length === 0 ? (
          <EmptyState
            kind="first-run"
            title="No sessions yet"
            body="Once a physician approves a protocol, your sessions appear here with their full timeline."
            actionLabel="Take the health quiz"
            actionHref="/quiz"
          />
        ) : (
          <div className="flex flex-col gap-3">
            {past.map((s) => (
              <Link
                key={s.id}
                href={`/app/report/${s.id}`}
                className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 no-underline hover:no-underline hover:border-[var(--color-primary-line)] transition-colors duration-150"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="t-body font-semibold block">{s.dripName}</span>
                    <span className="t-data text-[13px] text-[var(--color-ink-2)] block mt-1">
                      {formatDate(s.scheduledAt)} · {s.bookingNo}
                    </span>
                    {s.batches.length > 0 && (
                      <span className="t-data text-[13px] text-[var(--color-ink-3)] block">
                        {s.batches.join(" · ")}
                      </span>
                    )}
                  </div>
                  <StatusPill status={s.status} dot />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </MobileShell>
  );
}

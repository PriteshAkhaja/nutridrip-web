import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { MobileShell } from "@/components/layout/MobileShell";
import { patientSessionsPaged } from "@/lib/data/sessions";
import { PagedResults, PagedView, Pagination } from "@/components/ui/Paged";
import { parsePaging } from "@/lib/pagination";
import { connectDB } from "@/lib/db/mongoose";
import { HealthQuiz } from "@/lib/models";
import { StatusPill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/States";
import { FillBar } from "@/components/ui/Fill";
import { formatDate, formatTime } from "@/lib/data/inventory";
import { CancelSession, RescheduleSession } from "./SessionActions";
import { PATIENT_TABS } from "../tabs";
import { quizCtaFor } from "@/lib/data/quiz-cta";
import { getLatePolicy } from "@/lib/billing/settings";
import { LateCharges } from "@/components/ui/LateCharges";
import { getClockFormat } from "@/lib/settings/clock";
import { SessionMoney } from "@/components/payments/SessionMoney";
import { paymentsEnabled, paymentsSetup } from "@/lib/payments/config";
import { sweepBookingMoney } from "@/lib/payments/money";

export const metadata: Metadata = { title: "Sessions" };
export const dynamic = "force-dynamic";

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const clockFmt = await getClockFormat();
  const session = await requireRole("patient", "superadmin");
  const { page, pageSize } = await searchParams;
  // Money a session is owed that an earlier run did not get to finish, before the list shows it.
  await sweepBookingMoney({ patientId: session.sub });
  const { upcoming, past, meta } = await patientSessionsPaged(session.sub, parsePaging({ page, pageSize }));
  // With no sessions yet, the way on depends on whether the quiz has been taken.
  const next = await quizCtaFor(session);
  const policy = await getLatePolicy();
  const payOnline = paymentsEnabled();
  const instantRefunds = paymentsSetup().refundSpeed === "optimum";

  await connectDB();
  // The vitality trend is only meaningful across more than one assessment.
  const quizzes = await HealthQuiz.find({ patientId: session.sub })
    .sort({ completedAt: 1 })
    .lean<Array<{ _id: unknown; vitalityScore: number; completedAt: Date }>>();

  return (
    <MobileShell
      title="Your sessions"
      subtitle={`${meta.total} past · ${upcoming.length} upcoming`}
      tabs={PATIENT_TABS}
      activeHref="/app/sessions"
      width="wide"
    >
      {/* On a desktop the trend sits beside the sessions and stays in view;
          on a phone or tablet it leads, as designed. Cards run two across
          from a tablet up. */}
      <div
        className={
          // The side column only when there is a trend to put in it.
          quizzes.length > 1 ? "@4xl:grid @4xl:grid-cols-[minmax(0,1fr)_320px] @4xl:gap-6 @4xl:items-start" : undefined
        }
      >
        {quizzes.length > 1 && (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-5 @4xl:mb-0 @4xl:order-2 @4xl:sticky @4xl:top-24">
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

        <div className="min-w-0 @4xl:order-1">
          {upcoming.length > 0 && (
            <section className="mb-6">
              <span className="t-micro block mb-3">Upcoming</span>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
                {upcoming.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 flex flex-col"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/app/session/${s.id}`} className="min-w-0 no-underline hover:no-underline">
                        <span className="t-h3 block text-[var(--color-ink)]">{s.dripName}</span>
                        <span className="t-data text-[13px] text-[var(--color-ink-2)] block mt-1">
                          {formatDate(s.scheduledAt)} · {formatTime(s.scheduledAt, clockFmt)}
                        </span>
                        <span className="t-small text-[var(--color-ink-3)] block">{s.where}</span>
                      </Link>
                      <StatusPill status={s.status} dot />
                    </div>
                    {/* Everything under the title sits at the foot of the card, so a row of
                        cards of different heights lines up and none ends in an empty band. */}
                    <div className="mt-auto">
                      {s.status !== "in_progress" && (
                        <div className="mt-3 pt-3 border-t border-[var(--color-line)] flex flex-col gap-2">
                          <div className="flex justify-end gap-2 flex-wrap">
                            <RescheduleSession
                              bookingId={s.id}
                              bookingNo={s.bookingNo}
                              scheduledAt={s.scheduledAt}
                              policy={policy}
                              payOnline={payOnline}
                            />
                            <CancelSession
                              bookingId={s.id}
                              bookingNo={s.bookingNo}
                              scheduledAt={s.scheduledAt}
                              policy={policy}
                              paidNet={Math.max(0, s.paidAmount - s.refundedAmount)}
                              instantRefunds={instantRefunds}
                            />
                          </div>
                        </div>
                      )}
                      <LateCharges charges={s.charges} />
                      <SessionMoney
                        instantRefunds={instantRefunds}
                        bookingId={s.id}
                        status={s.status}
                        paymentStatus={s.paymentStatus}
                        amount={s.amount}
                        paidAmount={s.paidAmount}
                        refundedAmount={s.refundedAmount}
                        owedFees={s.owedFees}
                        payOnline={payOnline}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <span className="t-micro block mb-3">Your history</span>
            {meta.total === 0 ? (
              <EmptyState
                kind="first-run"
                title="No sessions yet"
                body="Once a physician approves a protocol, your sessions appear here with their full timeline."
                actionLabel={next?.label ?? "Take the health quiz"}
                actionHref={next?.href ?? "/quiz"}
              />
            ) : (
              <PagedView>
                <PagedResults>
                  <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
                    {past.map((s) => (
                      <Link
                        key={s.id}
                        href={`/app/report/${s.id}`}
                        className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 flex flex-col no-underline hover:no-underline hover:border-[var(--color-primary-line)] transition-colors duration-150"
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
                        <div className="mt-auto">
                          <LateCharges charges={s.charges} />
                          <SessionMoney
                            instantRefunds={instantRefunds}
                            bookingId={s.id}
                            status={s.status}
                            paymentStatus={s.paymentStatus}
                            amount={s.amount}
                            paidAmount={s.paidAmount}
                            refundedAmount={s.refundedAmount}
                            payOnline={false}
                          />
                        </div>
                      </Link>
                    ))}
                  </div>
                </PagedResults>
                <Pagination
                  meta={meta}
                  basePath="/app/sessions"
                  params={{ pageSize }}
                  nouns={["session", "sessions"]}
                />
              </PagedView>
            )}
          </section>
        </div>
      </div>
    </MobileShell>
  );
}

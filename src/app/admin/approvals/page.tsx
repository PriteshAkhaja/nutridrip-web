import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { adminNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { reviewQueue, REVIEW_SLA_HOURS } from "@/lib/data/clinical";
import { connectDB } from "@/lib/db/mongoose";
import { HealthQuiz, User } from "@/lib/models";
import { DataTable, THead, TH, TR, TD } from "@/components/ui/Table";
import { Pill, StatusPill } from "@/components/ui/Pill";
import { StatCard } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import { formatDate, formatTime } from "@/lib/data/inventory";

export const metadata: Metadata = { title: "Approvals" };
export const dynamic = "force-dynamic";

const FLAG_TONE = { crit: "critical", warn: "caution", info: "info" } as const;

/**
 * The operations view of the physicians' queue. Admins watch the SLA; they do
 * not make the clinical call — a doctor login is a prescribing credential, so
 * the review itself stays in the physician console.
 */
export default async function AdminApprovalsPage() {
  const session = await requireRole("superadmin", "admin");
  const nav = await adminNav();
  const queue = await reviewQueue();

  await connectDB();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const [recent, reviewedThisWeek, doctors] = await Promise.all([
    HealthQuiz.find({ reviewStatus: { $ne: "pending" }, reviewedAt: { $gte: weekAgo } })
      .sort({ reviewedAt: -1 })
      .limit(20)
      .lean<Array<{ _id: unknown; patientId: unknown; reviewedBy?: unknown; reviewStatus: string; reviewedAt?: Date; vitalityScore: number }>>(),
    // The list below shows the twenty most recent; the figure must be the real
    // total, or a busy week silently reads as exactly twenty.
    HealthQuiz.countDocuments({ reviewStatus: { $ne: "pending" }, reviewedAt: { $gte: weekAgo } }),
    User.countDocuments({ role: "doctor", status: "active" }),
  ]);
  const people = await User.find({
    _id: { $in: [...recent.map((r) => r.patientId), ...recent.map((r) => r.reviewedBy).filter(Boolean)] },
  }).lean<Array<{ _id: unknown; name: string }>>();
  const nameById = new Map(people.map((p) => [String(p._id), p.name]));

  const breaching = queue.filter((q) => q.msLeft < 0).length;
  const withinHour = queue.filter((q) => q.msLeft >= 0 && q.msLeft < 3_600_000).length;

  return (
    <ConsoleShell
      session={session}
      roleLabel={session.role === "superadmin" ? "Super admin" : "Admin"}
      nav={nav}
      activeHref="/admin/approvals"
      breadcrumb={["Platform", "Approvals"]}
      title="Approvals"
      meta={`${queue.length} waiting on a physician`}
    >
      <p className="t-body text-[var(--color-ink-2)] max-w-[76ch] mb-6" style={{ textWrap: "pretty" }}>
        Every submission must be read by a registered physician within {REVIEW_SLA_HOURS} hours. This is the
        operations view of that queue — who is waiting, for how long, and whether the physicians are keeping up. The
        clinical decision itself is made in the physician console.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard
          label="Waiting"
          value={String(queue.length)}
          pct={Math.min(100, queue.length * 12)}
          color="var(--color-caution)"
          note={`${doctors} physician${doctors === 1 ? "" : "s"} active`}
        />
        <StatCard
          label="Breaching the SLA"
          value={String(breaching)}
          pct={breaching ? 100 : 0}
          color="var(--color-critical)"
          note={breaching ? "Past the review window — chase a physician" : "Nothing overdue"}
        />
        <StatCard
          label="Due within the hour"
          value={String(withinHour)}
          pct={Math.min(100, withinHour * 25)}
          color="var(--color-caution)"
        />
        <StatCard label="Reviewed this week" value={String(reviewedThisWeek)} pct={Math.min(100, reviewedThisWeek * 5)} />
      </div>

      {queue.length === 0 ? (
        <EmptyState
          kind="cleared"
          title="Nothing waiting"
          body="Every submission has been reviewed. New quizzes appear here the moment a patient submits one."
        />
      ) : (
        <DataTable>
          <THead>
            <TR>
              <TH>Patient</TH>
              <TH numeric>Vitality</TH>
              <TH>Flags</TH>
              <TH>Requested</TH>
              <TH>Submitted</TH>
              <TH>SLA</TH>
              {session.role === "superadmin" && <TH>Open</TH>}
            </TR>
          </THead>
          <tbody>
            {queue.map((q) => {
              const overdue = q.msLeft < 0;
              return (
                <TR key={q.quizId}>
                  <TD>
                    <div className="flex flex-col">
                      <span className="font-medium">{q.name}</span>
                      <span className="t-data text-[13px] text-[var(--color-ink-3)]">
                        {q.age} · {q.gender}
                        {q.bookingNo ? ` · ${q.bookingNo}` : ""}
                      </span>
                    </div>
                  </TD>
                  <TD numeric>{q.vitalityScore}</TD>
                  <TD>
                    <span className="flex gap-1 flex-wrap">
                      {q.flags.length === 0 ? (
                        <span className="t-small text-[var(--color-ink-3)]">—</span>
                      ) : (
                        q.flags.map((f) => (
                          <Pill key={f.label} tone={FLAG_TONE[f.kind]} dot={f.kind === "crit"}>
                            {f.label}
                          </Pill>
                        ))
                      )}
                    </span>
                  </TD>
                  <TD>{q.dripName ?? <span className="t-small text-[var(--color-ink-3)]">No booking yet</span>}</TD>
                  <TD mono>
                    {formatDate(q.submittedAt)} · {formatTime(q.submittedAt)}
                  </TD>
                  <TD>
                    <span
                      className="t-data text-[13px]"
                      style={{ color: overdue ? "var(--color-critical)" : q.msLeft < 3_600_000 ? "var(--color-caution)" : "var(--color-ink-2)" }}
                    >
                      {q.slaLabel}
                    </span>
                  </TD>
                  {session.role === "superadmin" && (
                    <TD>
                      <Link href={`/doctor/review/${q.quizId}`}>Review</Link>
                    </TD>
                  )}
                </TR>
              );
            })}
          </tbody>
        </DataTable>
      )}

      {recent.length > 0 && (
        <section className="mt-8">
          <h2 className="t-h3 mb-3">
            Reviewed in the last seven days
            {reviewedThisWeek > recent.length ? ` · showing the ${recent.length} most recent of ${reviewedThisWeek}` : ""}
          </h2>
          <DataTable>
            <THead>
              <TR>
                <TH>Patient</TH>
                <TH numeric>Vitality</TH>
                <TH>Decision</TH>
                <TH>Physician</TH>
                <TH>When</TH>
              </TR>
            </THead>
            <tbody>
              {recent.map((r) => (
                <TR key={String(r._id)}>
                  <TD>{nameById.get(String(r.patientId)) ?? "—"}</TD>
                  <TD numeric>{r.vitalityScore}</TD>
                  <TD>
                    <StatusPill status={r.reviewStatus} dot />
                  </TD>
                  <TD>{r.reviewedBy ? (nameById.get(String(r.reviewedBy)) ?? "—") : "—"}</TD>
                  <TD mono>{r.reviewedAt ? `${formatDate(r.reviewedAt)} · ${formatTime(r.reviewedAt)}` : "—"}</TD>
                </TR>
              ))}
            </tbody>
          </DataTable>
        </section>
      )}
    </ConsoleShell>
  );
}

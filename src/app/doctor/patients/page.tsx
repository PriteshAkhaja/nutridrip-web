import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { doctorNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, HealthQuiz, User } from "@/lib/models";
import { DataTable, THead, TH, TR, TD } from "@/components/ui/Table";
import { NameLink } from "@/components/ui/NameLink";
import { StatusPill, Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/States";
import { formatDate } from "@/lib/data/inventory";
import { riskColor } from "@/lib/models/types";
import { PagedResults, PagedView, Pagination } from "@/components/ui/Paged";
import { parsePaging } from "@/lib/pagination";
import { paginate } from "@/lib/pagination-db";

export const metadata: Metadata = { title: "Patients" };
export const dynamic = "force-dynamic";

export default async function DoctorPatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const session = await requireRole("doctor", "superadmin");
  const { page, pageSize } = await searchParams;
  const paging = parsePaging({ page, pageSize });
  const nav = await doctorNav(session.sub);
  await connectDB();

  // This list had no limit, and then loaded EVERY quiz and EVERY completed
  // booking for EVERY patient to pick each one's latest quiz and count their
  // sessions in JavaScript. One page of patients, and one summary row per
  // patient from the database, means the work follows the page, not the platform.
  type PatientRow = {
    _id: unknown;
    name: string;
    phone?: string;
    status: string;
    createdAt: Date;
    patient?: { vitalityScore?: number; allergies?: string; city?: string; lastQuizAt?: Date };
  };
  const { rows: patients, meta } = await paginate<PatientRow>(
    User,
    { role: "patient" },
    { sort: { createdAt: -1 }, paging }
  );

  const ids = patients.map((p) => p._id);
  type QuizSummary = { _id: unknown; reviewStatus: string; completedAt: Date };
  const [quizzes, sessions] = await Promise.all([
    // The newest quiz per patient: sorted and grouped by the database, so a
    // patient with forty quizzes sends one row, not forty.
    HealthQuiz.aggregate<QuizSummary>([
      { $match: { patientId: { $in: ids } } },
      { $sort: { completedAt: -1 } },
      { $group: { _id: "$patientId", reviewStatus: { $first: "$reviewStatus" }, completedAt: { $first: "$completedAt" } } },
    ]),
    Booking.aggregate<{ _id: unknown; n: number }>([
      { $match: { patientId: { $in: ids }, status: "completed" } },
      { $group: { _id: "$patientId", n: { $sum: 1 } } },
    ]),
  ]);

  const latestQuiz = new Map<string, QuizSummary>(quizzes.map((q) => [String(q._id), q]));
  const sessionCount = new Map<string, number>(sessions.map((s) => [String(s._id), s.n]));

  return (
    <ConsoleShell
      session={session}
      roleLabel="Physician"
      nav={nav}
      activeHref="/doctor/patients"
      breadcrumb={["Clinical", "Patients"]}
      title="Patients"
      meta={`${meta.total} on the platform`}
    >
      {patients.length === 0 ? (
        <EmptyState
          kind="first-run"
          title="No patients yet"
          body="Patients appear here as soon as they complete their first health quiz."
        />
      ) : (
        <PagedView>
        <PagedResults>
        <DataTable>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH numeric>Vitality</TH>
              <TH>Flags</TH>
              <TH numeric>Sessions</TH>
              <TH>Last quiz</TH>
              <TH>Review</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <tbody>
            {patients.map((p) => {
              const id = String(p._id);
              const quiz = latestQuiz.get(id);
              const score = p.patient?.vitalityScore;
              const allergies = p.patient?.allergies;

              return (
                <TR key={id}>
                  <TD nowrap>
                    <div className="flex flex-col">
                      <NameLink href={`/doctor/patients/${id}`}>{p.name}</NameLink>
                      <span className="t-data text-[13px] text-[var(--color-ink-3)]">
                        {p.phone ?? p.patient?.city ?? "—"}
                      </span>
                    </div>
                  </TD>
                  <TD numeric>
                    {score !== undefined ? (
                      <span style={{ color: riskColor(score) }}>{score}</span>
                    ) : (
                      <span className="text-[var(--color-ink-3)]">—</span>
                    )}
                  </TD>
                  <TD>
                    {allergies && allergies.toLowerCase() !== "none" ? (
                      <Pill tone="critical" dot>
                        {allergies}
                      </Pill>
                    ) : (
                      <span className="t-small text-[var(--color-ink-3)]">None declared</span>
                    )}
                  </TD>
                  <TD numeric>{sessionCount.get(id) ?? 0}</TD>
                  <TD mono nowrap>{quiz ? formatDate(quiz.completedAt) : "—"}</TD>
                  <TD>{quiz ? <StatusPill status={quiz.reviewStatus} dot /> : "—"}</TD>
                  <TD>
                    <StatusPill status={p.status} dot />
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </DataTable>
        </PagedResults>
        <Pagination meta={meta} basePath="/doctor/patients" params={{ pageSize }} nouns={["patient", "patients"]} />
        </PagedView>
      )}

      <p className="t-small text-[var(--color-ink-3)] mt-5">
        Reviews waiting on you are in the <Link href="/doctor">approvals queue</Link>.
      </p>
    </ConsoleShell>
  );
}

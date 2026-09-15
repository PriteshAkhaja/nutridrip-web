import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { doctorNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, HealthQuiz, User } from "@/lib/models";
import { DataTable, THead, TH, TR, TD } from "@/components/ui/Table";
import { StatusPill, Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/States";
import { formatDate } from "@/lib/data/inventory";
import { riskColor } from "@/lib/models/types";

export const metadata: Metadata = { title: "Patients" };
export const dynamic = "force-dynamic";

export default async function DoctorPatientsPage() {
  const session = await requireRole("doctor", "superadmin");
  const nav = await doctorNav(session.sub);
  await connectDB();

  const patients = await User.find({ role: "patient" }).sort({ createdAt: -1 }).lean<
    Array<{
      _id: unknown;
      name: string;
      phone?: string;
      status: string;
      createdAt: Date;
      patient?: { vitalityScore?: number; allergies?: string; city?: string; lastQuizAt?: Date };
    }>
  >();

  const ids = patients.map((p) => p._id);
  const [quizzes, sessions] = await Promise.all([
    HealthQuiz.find({ patientId: { $in: ids } })
      .sort({ completedAt: -1 })
      .lean<Array<{ patientId: unknown; reviewStatus: string; completedAt: Date }>>(),
    Booking.find({ patientId: { $in: ids }, status: "completed" }).lean<
      Array<{ patientId: unknown }>
    >(),
  ]);

  const latestQuiz = new Map<string, (typeof quizzes)[number]>();
  for (const q of quizzes) {
    const k = String(q.patientId);
    if (!latestQuiz.has(k)) latestQuiz.set(k, q);
  }

  const sessionCount = new Map<string, number>();
  for (const s of sessions) {
    const k = String(s.patientId);
    sessionCount.set(k, (sessionCount.get(k) ?? 0) + 1);
  }

  return (
    <ConsoleShell
      session={session}
      roleLabel="Physician"
      nav={nav}
      activeHref="/doctor/patients"
      breadcrumb={["Clinical", "Patients"]}
      title="Patients"
      meta={`${patients.length} on the platform`}
    >
      {patients.length === 0 ? (
        <EmptyState
          kind="first-run"
          title="No patients yet"
          body="Patients appear here as soon as they complete their first health quiz."
        />
      ) : (
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
                  <TD>
                    <div className="flex flex-col">
                      <span className="font-medium">{p.name}</span>
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
                  <TD mono>{quiz ? formatDate(quiz.completedAt) : "—"}</TD>
                  <TD>{quiz ? <StatusPill status={quiz.reviewStatus} dot /> : "—"}</TD>
                  <TD>
                    <StatusPill status={p.status} dot />
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </DataTable>
      )}

      <p className="t-small text-[var(--color-ink-3)] mt-5">
        Reviews waiting on you are in the <Link href="/doctor">approvals queue</Link>.
      </p>
    </ConsoleShell>
  );
}

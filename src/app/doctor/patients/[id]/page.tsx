import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { logRecordAccess } from "@/lib/auth/access-log";
import { doctorNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, HealthQuiz, LabReport, User } from "@/lib/models";
import { FillRing, FillBar } from "@/components/ui/Fill";
import { Card } from "@/components/ui/Card";
import { Pill, StatusPill } from "@/components/ui/Pill";
import { DataTable, THead, TH, TR, TD } from "@/components/ui/Table";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { formatDate, formatTime } from "@/lib/data/inventory";
import { formatInr } from "@/lib/inventory/units";
import { riskColor, riskBand } from "@/lib/models/types";
import { ageFrom } from "@/lib/data/clinical";
import { PagedResults, PagedView, Pagination } from "@/components/ui/Paged";
import { paginate } from "@/lib/pagination-db";
import { parsePaging } from "@/lib/pagination";
import { readFeedback, type FeedbackView, type StoredFeedback } from "@/lib/clinical/feedback";

export const metadata: Metadata = { title: "Patient" };
export const dynamic = "force-dynamic";

export default async function PatientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const session = await requireRole("doctor", "superadmin");
  const nav = await doctorNav(session.sub);
  const { id } = await params;
  const { page, pageSize } = await searchParams;

  await connectDB();
  const patient = await User.findById(id).lean<{
    _id: unknown;
    name: string;
    role: string;
    phone?: string;
    email?: string;
    status: string;
    createdAt: Date;
    patient?: {
      dob?: Date;
      gender?: string;
      bloodGroup?: string;
      heightCm?: number;
      weightKg?: number;
      address?: string;
      city?: string;
      pincode?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
      allergies?: string;
      chronicConditions?: string;
      currentMedications?: string;
      surgeries?: string;
      vitalityScore?: number;
    };
  } | null>();

  // The id comes from the URL, so it must be checked: without this, any staff
  // or admin record could be read through the patient screen.
  if (!patient || patient.role !== "patient") notFound();

  // Written only once the record is known to be openable, so a refusal is
  // never filed as a read.
  await logRecordAccess({
    session,
    kind: "patient chart",
    entity: "User",
    entityId: id,
    patientId: id,
  });

  const [quizzes, sessions, labs] = await Promise.all([
    HealthQuiz.find({ patientId: id })
      .sort({ completedAt: -1 })
      .lean<
        Array<{
          _id: unknown;
          vitalityScore: number;
          nutrientRisks: Array<{ name: string; pct: number }>;
          reviewStatus: string;
          completedAt: Date;
          doctorNotes?: string;
        }>
      >(),
    // One page of sessions. A patient on a long course builds up years of them,
    // and the two figures beside the heading are counts, so paging the table
    // must not turn them into "how many are on this page".
    paginate<{
      _id: unknown;
      bookingNo: string;
      dripName?: string;
      scheduledAt: Date;
      status: string;
      amount: number;
      adverseEvents?: Array<{ symptoms: string[] }>;
      vitals?: Array<{ outOfRange?: string[] }>;
      feedback?: StoredFeedback;
    }>(Booking, { patientId: id }, { sort: { scheduledAt: -1 }, paging: parsePaging({ page, pageSize }) }),
    LabReport.find({ patientId: id })
      .sort({ uploadedAt: -1 })
      .select({ fileName: 1, category: 1, notes: 1, uploadedAt: 1, hasFile: { $gt: [{ $strLenCP: { $ifNull: ["$fileUrl", ""] } }, 0] } })
      .lean<
        Array<{
          _id: unknown;
          fileName: string;
          category?: string;
          notes?: string;
          uploadedAt: Date;
          hasFile?: boolean;
        }>
      >(),
  ]);

  const p = patient.patient ?? {};
  const [completedCount, eventCount] = await Promise.all([
    Booking.countDocuments({ patientId: id, status: "completed" }),
    Booking.countDocuments({ patientId: id, "adverseEvents.0": { $exists: true } }),
  ]);

  const latest = quizzes[0];
  const lowest = latest ? [...latest.nutrientRisks].sort((a, b) => a.pct - b.pct).slice(0, 4) : [];

  const age = ageFrom(p.dob);

  return (
    <ConsoleShell
      session={session}
      roleLabel="Physician"
      nav={nav}
      activeHref="/doctor/patients"
      breadcrumb={["Clinical", "Patients", patient.name]}
      title={patient.name}
      meta={`${age} · ${p.gender ?? "—"}`}
      actions={
        latest?.reviewStatus === "pending" ? (
          <ButtonLink href={`/doctor/review/${String(latest._id)}`}>Review latest quiz</ButtonLink>
        ) : undefined
      }
    >
      {/* ---------------- Flags first, always ---------------- */}
      <div className="flex gap-2 flex-wrap mb-6">
        {p.allergies && p.allergies.toLowerCase() !== "none" ? (
          <Pill tone="critical" dot>
            {p.allergies} allergy
          </Pill>
        ) : (
          <Pill tone="neutral">No allergies declared</Pill>
        )}
        {p.chronicConditions && p.chronicConditions.toLowerCase() !== "none" && (
          <Pill tone="caution" dot>
            {p.chronicConditions}
          </Pill>
        )}
        {p.currentMedications && p.currentMedications.toLowerCase() !== "none" && (
          <Pill tone="info">On {p.currentMedications}</Pill>
        )}
        {eventCount > 0 && (
          <Pill tone="critical" dot>
            {eventCount} adverse event{eventCount === 1 ? "" : "s"} on record
          </Pill>
        )}
      </div>

      {/* Side by side only from 1760px. Below that the table takes the full width and this panel sits under it: with names and dates held on one line, the table does not fit beside the panel on a laptop or a 1536-1680px monitor (measured; the orders list beside its 400px composer needs about 1740px). */}
      <div className="grid grid-cols-1 gap-6 min-[1760px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] items-start">
        <div className="flex flex-col gap-6">
          {/* ---------------- Vitality ---------------- */}
          {latest ? (
            <Card padding="p-6">
              <div className="flex gap-8 items-center flex-wrap">
                <FillRing score={latest.vitalityScore} size={120} stroke={11} />
                <div className="flex-1 min-w-[240px]">
                  <div className="flex items-baseline justify-between gap-3 mb-3">
                    <span className="t-micro">Weakest markers</span>
                    <span className="t-small text-[var(--color-ink-3)]">
                      {formatDate(latest.completedAt)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-[14px]">
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
                </div>
              </div>
              {latest.doctorNotes && (
                <p className="t-body text-[var(--color-ink-2)] mt-5 pt-5 border-t border-[var(--color-line)]">
                  <span className="t-micro block mb-1">Last review note</span>
                  {latest.doctorNotes}
                </p>
              )}
            </Card>
          ) : (
            <EmptyState
              kind="first-run"
              title="No assessment on file"
              body="This patient has not completed a health quiz yet, so there is nothing to review."
            />
          )}

          {/* ---------------- Sessions ---------------- */}
          <section>
            <div className="flex items-baseline justify-between gap-4 mb-3">
              <h2 className="t-h3">Sessions</h2>
              <span className="t-data text-[13px] text-[var(--color-ink-3)]">
                {completedCount} completed of {sessions.meta.total}
              </span>
            </div>
            {sessions.meta.total === 0 ? (
              <EmptyState kind="first-run" title="No sessions yet" body="Nothing has been booked for this patient." />
            ) : (
              <PagedView>
              <PagedResults>
              <DataTable>
                <THead>
                  <TR>
                    <TH width="120px">Booking</TH>
                    <TH>Drip</TH>
                    <TH>When</TH>
                    <TH>Flags</TH>
                    <TH>Status</TH>
                    <TH>Feedback</TH>
                    <TH numeric>Amount</TH>
                  </TR>
                </THead>
                <tbody>
                  {sessions.rows.map((b) => {
                    const flagged = (b.vitals ?? []).some((v) => (v.outOfRange ?? []).length > 0);
                    const events = (b.adverseEvents ?? []).length;
                    return (
                      <TR key={String(b._id)}>
                        <TD mono nowrap>{b.bookingNo}</TD>
                        <TD nowrap>{b.dripName ?? "—"}</TD>
                        <TD mono nowrap>
                          {formatDate(b.scheduledAt)} · {formatTime(b.scheduledAt)}
                        </TD>
                        <TD>
                          <span className="flex gap-1 flex-wrap">
                            {flagged && <Pill tone="caution">Vitals</Pill>}
                            {events > 0 && <Pill tone="critical">AE</Pill>}
                            {!flagged && events === 0 && (
                              <span className="t-small text-[var(--color-ink-3)]">—</span>
                            )}
                          </span>
                        </TD>
                        <TD>
                          <StatusPill status={b.status} dot />
                        </TD>
                        <TD>
                          <SessionFeedback feedback={readFeedback(b.feedback)} />
                        </TD>
                        <TD numeric>{formatInr(b.amount ?? 0)}</TD>
                      </TR>
                    );
                  })}
                </tbody>
              </DataTable>
              </PagedResults>
              <Pagination
                meta={sessions.meta}
                basePath={`/doctor/patients/${id}`}
                params={{ pageSize }}
                nouns={["session", "sessions"]}
              />
              </PagedView>
            )}
          </section>

          {/* ---------------- Assessments over time ---------------- */}
          {quizzes.length > 1 && (
            <section>
              <h2 className="t-h3 mb-3">Vitality over time</h2>
              <Card padding="p-6" className="flex flex-col gap-[14px]">
                {[...quizzes].reverse().map((q) => (
                  <FillBar
                    key={String(q._id)}
                    label={
                      <Link href={`/doctor/review/${String(q._id)}`}>{formatDate(q.completedAt)}</Link>
                    }
                    value={String(q.vitalityScore)}
                    pct={q.vitalityScore}
                    color="var(--color-accent)"
                  />
                ))}
              </Card>
            </section>
          )}
        </div>

        {/* ---------------- Rail ---------------- */}
        <div className="flex flex-col gap-4">
          <Card padding="p-5">
            <span className="t-micro">History</span>
            <div className="flex flex-col gap-3 mt-4">
              {(
                [
                  ["Allergies", p.allergies || "None declared", Boolean(p.allergies && p.allergies.toLowerCase() !== "none")],
                  ["Conditions", p.chronicConditions || "None declared", false],
                  ["Medication", p.currentMedications || "None declared", false],
                  ["Past surgeries", p.surgeries || "None declared", false],
                ] as Array<[string, string, boolean]>
              ).map(([k, v, alert]) => (
                <div key={k} className="flex justify-between gap-4 items-baseline">
                  <span className="t-body text-[var(--color-ink-2)] flex-none">{k}</span>
                  <span
                    className="t-body font-medium text-right"
                    style={alert ? { color: "var(--color-critical)" } : undefined}
                  >
                    {v}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card padding="p-5">
            <span className="t-micro">Patient</span>
            <div className="flex flex-col gap-2 mt-4">
              {[
                ["Age · sex", `${age} · ${p.gender ?? "—"}`],
                ["Blood group", p.bloodGroup ?? "—"],
                ["Height · weight", p.heightCm ? `${p.heightCm} cm · ${p.weightKg ?? "—"} kg` : "—"],
                ["Phone", patient.phone ?? "—"],
                ["Area", [p.city, p.pincode].filter(Boolean).join(" · ") || "—"],
                ["On platform since", formatDate(patient.createdAt)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 items-baseline">
                  <span className="t-body text-[var(--color-ink-2)]">{k}</span>
                  <span className="t-data text-[14.5px] text-right">{v}</span>
                </div>
              ))}
            </div>
          </Card>

          {p.emergencyContactName && (
            <Card padding="p-5" tone="muted">
              <span className="t-micro">In an emergency</span>
              <div className="flex justify-between gap-4 items-baseline mt-3">
                <span className="t-body font-medium">{p.emergencyContactName}</span>
                <span className="t-data text-[14.5px]">{p.emergencyContactPhone ?? "—"}</span>
              </div>
            </Card>
          )}

          <Card padding="p-5">
            <span className="t-micro">Lab reports</span>
            {labs.length === 0 ? (
              <p className="t-body text-[var(--color-ink-2)] mt-3">
                Nothing uploaded. Iron protocols need a ferritin result inside 90 days before you can approve one.
              </p>
            ) : (
              <div className="flex flex-col gap-3 mt-3">
                {labs.map((l) => (
                  <div key={String(l._id)} className="flex flex-col">
                    {/* Openable, not just named. A list of file names a
                        physician cannot read is not a record. */}
                    {l.hasFile ? (
                      <a
                        href={`/api/lab-reports/${String(l._id)}/file`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="t-body font-medium"
                      >
                        {l.fileName}
                      </a>
                    ) : (
                      <span className="t-body font-medium text-[var(--color-ink-2)]">{l.fileName}</span>
                    )}
                    <span className="t-small text-[var(--color-ink-3)]">
                      {l.category ?? "Uncategorised"} · {formatDate(l.uploadedAt)}
                      {!l.hasFile ? " · no file attached" : ""}
                    </span>
                    {l.notes && <span className="t-small text-[var(--color-ink-2)] mt-1">{l.notes}</span>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </ConsoleShell>
  );
}

/** "Nurse 5/5 · Session 2/5" and what was said, for one row of the sessions table. */
function SessionFeedback({ feedback }: { feedback: FeedbackView | null }) {
  if (!feedback) return <span className="t-small text-[var(--color-ink-3)]">—</span>;
  const parts = (
    [
      ["Nurse", feedback.nurse],
      ["Session", feedback.session],
    ] as const
  ).filter(([, part]) => part);
  const said = [feedback.nurse?.comment, feedback.session?.comment].filter(Boolean).join(" · ");
  return (
    <span className="flex flex-col gap-[2px] min-w-[160px]">
      <span className="t-small whitespace-nowrap">
        {parts.map(([label, part], i) => (
          <span key={label}>
            {i > 0 ? " · " : ""}
            {label}{" "}
            <span
              className="t-data text-[13px]"
              style={{ color: (part?.rating ?? 5) <= 2 ? "var(--color-caution-text)" : "var(--color-ink)" }}
            >
              {part?.rating}/5
            </span>
          </span>
        ))}
      </span>
      {said && <span className="t-small text-[var(--color-ink-2)] max-w-[36ch]">{said}</span>}
    </span>
  );
}

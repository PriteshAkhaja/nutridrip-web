import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { logRecordAccess } from "@/lib/auth/access-log";
import { doctorNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { patientReview } from "@/lib/data/clinical";
import { FillRing, FillBar } from "@/components/ui/Fill";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { formatDate, formatTime } from "@/lib/data/inventory";
import { ReviewDecision } from "./Decision";
import { nurseChoicesFor } from "@/lib/data/nurse-choices";
import { listDrips } from "@/lib/data/drips";
import { HeaderCounts } from "@/components/layout/HeaderCounts";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Patient review" };
export const dynamic = "force-dynamic";

const FLAG_TONE = { crit: "critical", warn: "caution", info: "info" } as const;

export default async function PatientReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("doctor", "superadmin");
  const nav = await doctorNav(session.sub);
  const { id } = await params;

  const review = await patientReview(id);
  if (!review) notFound();

  await logRecordAccess({
    session,
    kind: "assessment",
    entity: "HealthQuiz",
    entityId: id,
    patientId: String(review.patient.id),
  });

  // Only worth loading while there is still a decision to make.
  const pending = review.reviewStatus === "pending";
  const [nurses, catalogue] = await Promise.all([
    pending ? nurseChoicesFor(review.location, session.sub) : Promise.resolve(null),
    pending ? listDrips() : Promise.resolve([]),
  ]);

  const lowest = [...review.markers].sort((a, b) => a.pct - b.pct).slice(0, 3);

  return (
    <ConsoleShell
      session={session}
      roleLabel="Physician"
      nav={nav}
      activeHref="/doctor"
      breadcrumb={["Clinical", "Approvals", review.patient.name]}
      title={review.patient.name}
      actions={
        <ButtonLink href={`/doctor/patients/${review.patient.id}`} variant="secondary">
          Patient record
        </ButtonLink>
      }
      meta={
        <HeaderCounts items={[`Submitted ${formatDate(review.submittedAt)}`, formatTime(review.submittedAt)]} />
      }
    >
      {/* Answers the patient has since corrected. Kept, because history is
          never deleted, but nobody should decide on them. */}
      {review.reviewStatus === "superseded" && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-line-2)] bg-[var(--color-surface-2)] px-4 py-3 mb-6 flex items-center justify-between gap-4 flex-wrap">
          <span className="t-body">
            <span className="font-semibold">Replaced by newer answers.</span>{" "}
            <span className="text-[var(--color-ink-2)]">
              The patient answered the quiz again before a decision, so these answers are no longer in the queue.
            </span>
          </span>
          {review.supersededBy && (
            <ButtonLink href={`/doctor/review/${review.supersededBy}`} variant="secondary" size="sm">
              Open the newer answers
            </ButtonLink>
          )}
        </div>
      )}

      {review.screening.length > 0 && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3 mb-6">
          <span className="t-body font-semibold text-[var(--color-critical-text)]">
            {review.screening.length === 1 ? "Screening answer" : `${review.screening.length} screening answers`} — check
            before approving
          </span>
          <ul className="mt-2 flex flex-col gap-1 list-disc pl-5">
            {review.screening.map((s) => (
              <li key={s} className="t-body text-[var(--color-ink)]">
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {review.flags.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-6">
          {review.flags.map((f) => (
            <Pill key={f.label} tone={FLAG_TONE[f.kind]} dot={f.kind === "crit"}>
              {f.label}
            </Pill>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] items-start">
        <div className="flex flex-col gap-6">
          {/* ---------------- Vitality + lowest markers ---------------- */}
          <Card padding="p-6">
            <div className="flex gap-8 items-center flex-wrap">
              <FillRing score={review.vitalityScore} size={132} stroke={12} />
              <div className="flex-1 min-w-[240px]">
                <span className="t-micro">Three lowest markers</span>
                <div className="flex flex-col gap-[14px] mt-3">
                  {lowest.map((m) => (
                    <FillBar
                      key={m.name}
                      label={
                        <span className="flex items-center gap-2">
                          {m.name}
                          <span className="t-small" style={{ color: m.color }}>
                            {m.band}
                          </span>
                        </span>
                      }
                      value={`${m.pct}%`}
                      pct={m.pct}
                      color={m.color}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* ---------------- All 16 markers ---------------- */}
          <section>
            <h2 className="t-h3 mb-1">Nutrient markers</h2>
            <p className="t-body text-[var(--color-ink-2)] mb-4">
              Sixteen markers derived from the quiz, banded against reference ranges. Under 35% is critical, under
              60% is low.
            </p>
            <Card padding="p-6">
              <div className="grid grid-cols-1 gap-x-8 gap-y-[14px] md:grid-cols-2">
                {review.markers.map((m) => (
                  <FillBar key={m.name} label={m.name} value={`${m.pct}%`} pct={m.pct} color={m.color} />
                ))}
              </div>
            </Card>
          </section>

          {/* ---------------- Quiz answers ---------------- */}
          {review.answers.length > 0 && (
            <section>
              <h2 className="t-h3 mb-3">What they told us</h2>
              <Card padding="p-0">
                {review.answers.map((a, i) => (
                  <div
                    key={i}
                    className="px-5 py-4 border-b border-[var(--color-line)] last:border-b-0 flex flex-col gap-1"
                  >
                    {a.section && <span className="t-micro">{a.section}</span>}
                    <span className="t-body text-[var(--color-ink-2)]">{a.question}</span>
                    <span className="t-body font-medium">
                      {/* A ticked list reads as a list; blank is shown as a dash, never as nothing. */}
                      {Array.isArray(a.answer) ? a.answer.join(", ") : String(a.answer ?? "") || "—"}
                    </span>
                  </div>
                ))}
              </Card>
            </section>
          )}
        </div>

        {/* ---------------- Rail ---------------- */}
        <div className="flex flex-col gap-4 xl:sticky xl:top-6">
          {/* Blood work the patient uploaded. On this screen because this is
              where the decision is made — it used to live only on a separate
              patient page, and only as file names nobody could open. */}
          <Card padding="p-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="t-micro">Reports they uploaded</span>
              <span className="t-small text-[var(--color-ink-3)]">{review.labReports.length}</span>
            </div>

            {review.labReports.length === 0 ? (
              <p className="t-small text-[var(--color-ink-2)] mt-3">
                Nothing uploaded. Absence of blood work is not evidence of anything — ask for it if you need it.
              </p>
            ) : (
              <div className="flex flex-col gap-3 mt-4">
                {review.labReports.map((l) => (
                  <div key={l.id} className="flex flex-col gap-[2px]">
                    {l.hasFile ? (
                      <a
                        href={`/api/lab-reports/${l.id}/file`}
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
                    {l.notes && <span className="t-small text-[var(--color-ink-2)]">{l.notes}</span>}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* The answer to a question this physician already asked. Shown
              above the decision, because it is the thing they were waiting
              for before they could make one. */}
          {review.infoAnswer && (
            <Card padding="p-5" tone="info">
              <span className="t-micro">You asked</span>
              <p className="t-body text-[var(--color-ink-2)] mt-1">{review.infoRequest}</p>
              <span className="t-micro block mt-4">They answered</span>
              <p className="t-body-lg mt-1">{review.infoAnswer}</p>
            </Card>
          )}

          <ReviewDecision
            quizId={review.quizId}
            reviewStatus={review.reviewStatus}
            suggestedDrips={review.suggestedDrips}
            allDrips={catalogue.map((d) => ({ id: d.id, name: d.name }))}
            nurses={nurses}
            bookedSessions={review.bookedSessions}
          />

          <Card padding="p-5">
            <span className="t-micro">History</span>
            <div className="flex flex-col gap-3 mt-4">
              {review.history.map((h) => (
                <div key={h.label} className="flex justify-between gap-4 items-baseline">
                  <span className="t-body text-[var(--color-ink-2)] flex-none">{h.label}</span>
                  <span
                    className={`text-right ${h.tone === "data" ? "t-data text-[14.5px]" : "t-body font-medium"}`}
                    style={h.tone === "alert" ? { color: "var(--color-critical)" } : undefined}
                  >
                    {h.value}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card padding="p-5">
            <span className="t-micro">Patient</span>
            <div className="flex flex-col gap-2 mt-4">
              {[
                ["Age · sex", `${review.patient.age} · ${review.patient.gender}`],
                ["Blood group", review.patient.bloodGroup ?? "—"],
                ["Height", review.patient.heightCm ? `${review.patient.heightCm} cm` : "—"],
                ["Phone", review.patient.phone ?? "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 items-baseline">
                  <span className="t-body text-[var(--color-ink-2)]">{k}</span>
                  <span className="t-data text-[14.5px]">{v}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </ConsoleShell>
  );
}

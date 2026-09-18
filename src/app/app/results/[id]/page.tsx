import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { logRecordAccess } from "@/lib/auth/access-log";
import { MobileShell } from "@/components/layout/MobileShell";
import { connectDB } from "@/lib/db/mongoose";
import { Drip, HealthQuiz, User } from "@/lib/models";
import { InfoAnswer } from "./InfoAnswer";
import { FillRing, FillBar } from "@/components/ui/Fill";
import { StatusPill } from "@/components/ui/Pill";
import { ButtonLink } from "@/components/ui/Button";
import { riskColor, riskBand, NUTRIENT_GROUPS } from "@/lib/models/types";
import { formatInr } from "@/lib/inventory/units";
import { PATIENT_TABS } from "../../tabs";

export const metadata: Metadata = { title: "Your vitality" };
export const dynamic = "force-dynamic";

const STRENGTH_LABEL: Record<string, string> = {
  strong: "Strongly recommended",
  recommended: "Recommended",
  optional: "Optional",
};

export default async function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ drip?: string }>;
}) {
  const session = await requireRole("patient", "superadmin");
  const { id } = await params;
  const { drip: preferred } = await searchParams;

  await connectDB();
  const quiz = await HealthQuiz.findById(id).lean<{
    patientId: unknown;
    vitalityScore: number;
    nutrientRisks: Array<{ name: string; group?: string; pct: number }>;
    suggestedDripIds: unknown[];
    recommendedDripIds?: unknown[];
    recommendationStrength?: string | null;
    reviewStatus: string;
    reviewedBy?: unknown;
    reviewedAt?: Date;
    patientNote?: string;
    declineReason?: string;
    infoRequest?: string;
    infoAnswer?: string;
    infoAnsweredAt?: Date;
    completedAt: Date;
  } | null>();

  if (!quiz) notFound();
  // A patient may only ever read their own results.
  if (String(quiz.patientId) !== session.sub && session.role !== "superadmin") notFound();

  await logRecordAccess({
    session,
    kind: "assessment",
    entity: "HealthQuiz",
    entityId: id,
    patientId: String(quiz.patientId),
  });

  /**
   * What the PHYSICIAN recommends wins over what the quiz suggested.
   *
   * Showing the quiz's own list after a physician changed it is the bug this
   * whole screen had: "approved with changes" arrived as a booking button
   * beside the untouched original suggestion.
   */
  const physicianChose = (quiz.recommendedDripIds ?? []).length > 0;
  const suggestedIds = physicianChose ? [...quiz.recommendedDripIds!] : [...quiz.suggestedDripIds];

  const physician = quiz.reviewedBy
    ? await User.findById(quiz.reviewedBy).lean<{
        name: string;
        doctor?: { registrationCouncil?: string; licenseNo?: string };
      } | null>()
    : null;
  const drips = await Drip.find({
    $or: [{ _id: { $in: suggestedIds } }, ...(preferred ? [{ slug: preferred }] : [])],
    isActive: true,
  }).lean<Array<{ _id: unknown; name: string; slug: string; description?: string; priceInr: number; durationMin: number }>>();

  const lowest = [...quiz.nutrientRisks].sort((a, b) => a.pct - b.pct).slice(0, 3);
  const grouped = NUTRIENT_GROUPS.map((g) => ({
    group: g,
    items: quiz.nutrientRisks.filter((r) => r.group === g),
  })).filter((g) => g.items.length > 0);

  return (
    <MobileShell
      title="Your vitality"
      subtitle={
        <span className="flex items-center gap-2">
          <StatusPill status={quiz.reviewStatus} dot />
        </span>
      }
      tabs={PATIENT_TABS}
      activeHref="/app"
    >
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 flex flex-col items-center gap-3 mb-4">
        <FillRing score={quiz.vitalityScore} size={150} stroke={13} caption="of 100" />
        <p className="t-body text-[var(--color-ink-2)] text-center max-w-[42ch]" style={{ textWrap: "pretty" }}>
          A single number built from sixteen markers. It is a starting point for the physician, not a diagnosis.
        </p>
      </div>

      {/* ---------------- Lowest three ---------------- */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-4">
        <span className="t-micro">Three lowest markers</span>
        <div className="flex flex-col gap-[14px] mt-4">
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

      {/* ---------------- Suggestions ---------------- */}
      {drips.length > 0 && (
        <div className="mb-4">
          {/* The heading has to follow the list. Once a physician has chosen,
              these are their choice — calling them "suggestions from your
              answers" told the patient to discount the one list they should
              trust. */}
          <span className="t-micro block mb-3">
            {physicianChose ? "What your physician recommends" : "Suggested for review"}
          </span>
          <div className="flex flex-col gap-3">
            {drips.map((d) => (
              <Link
                key={d.slug}
                href={`/drips/${d.slug}`}
                className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 no-underline hover:no-underline hover:border-[var(--color-primary-line)] transition-colors duration-150"
              >
                <h3 className="t-h3">{d.name}</h3>
                {d.description && <p className="t-body text-[var(--color-ink-2)] mt-1">{d.description}</p>}
                <div className="flex gap-5 mt-3 pt-3 border-t border-[var(--color-line)]">
                  <span className="t-data text-[14.5px]">{formatInr(d.priceInr)}</span>
                  <span className="t-data text-[14.5px] text-[var(--color-ink-3)]">{d.durationMin} min</span>
                </div>
              </Link>
            ))}
          </div>
          <p className="t-small text-[var(--color-ink-3)] mt-3">
            {physicianChose
              ? `${physician?.name ?? "Your physician"} chose ${drips.length === 1 ? "this" : "these"} for you after reading your answers — ${drips.length === 1 ? "it is" : "they are"} not what the quiz alone suggested.`
              : "These are suggestions from your answers. A physician decides what is actually prescribed, and may choose something else entirely."}
          </p>
        </div>
      )}

      {/* ---------------- All sixteen ---------------- */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-5">
        <span className="t-micro">All sixteen markers</span>
        <div className="flex flex-col gap-5 mt-4">
          {grouped.map((g) => (
            <div key={g.group}>
              <span className="t-small text-[var(--color-ink-3)] block mb-3">{g.group}</span>
              <div className="flex flex-col gap-[14px]">
                {g.items.map((m) => (
                  <FillBar
                    key={m.name}
                    label={m.name}
                    value={`${m.pct}%`}
                    pct={m.pct}
                    color={riskColor(m.pct)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ----------------- What the physician said -----------------
          Every outcome now says it here, on the page. The decline used to send
          the patient off to hunt through their notifications for the reason,
          and "approved with changes" said nothing at all. */}
      {quiz.reviewStatus === "pending" ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-info)] bg-[var(--color-info-soft)] p-5">
          <span className="t-body font-semibold">With a physician now</span>
          <p className="t-body text-[var(--color-ink-2)] mt-1">
            You can book once they approve — usually within two hours. If anything in your answers rules IV therapy
            out, they will tell you why.
          </p>
        </div>
      ) : quiz.reviewStatus === "info_needed" ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-info)] bg-[var(--color-info-soft)] p-5 flex flex-col gap-3">
          <div>
            <span className="t-body font-semibold">
              {physician?.name ?? "Your physician"} needs one more thing
            </span>
            <p className="t-body-lg mt-2">{quiz.infoRequest}</p>
          </div>
          {quiz.infoAnswer ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3">
              <span className="t-micro">You answered</span>
              <p className="t-body text-[var(--color-ink-2)] mt-1">{quiz.infoAnswer}</p>
              <span className="t-small text-[var(--color-ink-3)] block mt-2">
                Back with your physician now. Your slot is still held.
              </span>
            </div>
          ) : (
            <InfoAnswer quizId={id} />
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div
            className="rounded-[var(--radius-lg)] border p-5 flex flex-col gap-2"
            style={{
              borderColor:
                quiz.reviewStatus === "rejected" ? "var(--color-critical)" : "var(--color-safe)",
              background:
                quiz.reviewStatus === "rejected"
                  ? "var(--color-critical-soft)"
                  : "var(--color-safe-soft)",
            }}
          >
            <span className="t-body font-semibold">
              {quiz.reviewStatus === "rejected"
                ? "A physician declined this protocol"
                : quiz.reviewStatus === "modified"
                  ? "Approved, with changes"
                  : "Approved"}
            </span>

            {physician && (
              <span className="t-small text-[var(--color-ink-2)]">
                {physician.name}
                {physician.doctor?.licenseNo ? ` · ${physician.doctor.licenseNo}` : ""}
                {quiz.reviewedAt ? ` · ${new Date(quiz.reviewedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}` : ""}
              </span>
            )}

            {/* The reason first, then the physician's own words. Being told
                only that "a physician declined this protocol" left the patient
                to guess at why. */}
            {quiz.declineReason && <p className="t-body-lg mt-1">{quiz.declineReason}</p>}

            {quiz.patientNote ? (
              <p className={`t-body${quiz.declineReason ? " text-[var(--color-ink-2)]" : "-lg"} mt-1`}>
                {quiz.patientNote}
              </p>
            ) : quiz.reviewStatus === "rejected" ? (
              <p className="t-body text-[var(--color-ink-2)] mt-1">
                This is not a refusal of care — it usually means something in your history needs a different route.
                Your physician will be in touch.
              </p>
            ) : null}

            {physicianChose && quiz.reviewStatus === "modified" && (
              <span className="t-small text-[var(--color-ink-2)] mt-1">
                What they recommend is below, and it is not the same as the quiz suggested.
              </span>
            )}

            {quiz.recommendationStrength && quiz.reviewStatus !== "rejected" && (
              <span className="t-small text-[var(--color-ink-2)]">
                {STRENGTH_LABEL[quiz.recommendationStrength] ?? quiz.recommendationStrength}
              </span>
            )}
          </div>

          {quiz.reviewStatus !== "rejected" && (
            <ButtonLink href="/app/book" size="lg" block>
              Book a session
            </ButtonLink>
          )}
        </div>
      )}
    </MobileShell>
  );
}

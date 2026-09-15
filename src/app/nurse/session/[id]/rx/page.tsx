import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { nurseOwns } from "@/lib/auth/ownership";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, Drip, User } from "@/lib/models";
import { MobileShell } from "@/components/layout/MobileShell";
import { Pill } from "@/components/ui/Pill";
import { FillBar } from "@/components/ui/Fill";
import { canOpenPrescription, rxLockState } from "@/lib/clinical/prescription";
import { PrescriptionGate } from "../PrescriptionGate";
import { rxOverrideView } from "@/lib/data/rx-override-view";

export const metadata: Metadata = { title: "Prescription" };
export const dynamic = "force-dynamic";

const ROLE_TONE = {
  ACTIVE: "primary",
  FLUID: "info",
  PREMED: "caution",
  ADDITIVE: "neutral",
} as const;

const ROLE_MEANING: Record<string, string> = {
  ACTIVE: "The reason the drip exists",
  FLUID: "The carrier it runs in",
  PREMED: "Given before, to cover a reaction",
  ADDITIVE: "Supporting, added to the bag",
};

export default async function PrescriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("nurse", "superadmin");
  const { id } = await params;

  await connectDB();
  const booking = await Booking.findById(id).lean<{
    _id: unknown;
    bookingNo: string;
    patientId: unknown;
    nurseId?: unknown;
    doctorId?: unknown;
    dripId: unknown;
    dripName?: string;
    status: string;
    approvalNotes?: string;
    rxUnlockedAt?: Date;
    rxUnlockMethod?: string | null;
    rxOverride?: {
      requestedAt?: Date;
      lastAskedAt?: Date;
      reason?: string;
      identityCheckedBy?: string;
      deniedAt?: Date;
      deniedBy?: unknown;
      denyReason?: string;
    };
  } | null>();

  if (!booking || !nurseOwns(session, booking)) notFound();

  const patient = await User.findById(booking.patientId).lean<{ name: string } | null>();
  const patientName = patient?.name ?? "the patient";
  const lock = rxLockState(booking);

  const overrideView = await rxOverrideView(booking);

  /* ---------------- locked ---------------- */
  if (!lock.unlocked) {
    return (
      <MobileShell
        title="Prescription"
        subtitle={booking.bookingNo}
        back={{ href: `/nurse/session/${id}`, label: "Back to the checklist" }}
      >
        {canOpenPrescription(booking.status) ? (
          <PrescriptionGate
            bookingId={id}
            patientName={patientName}
            override={overrideView}
          />
        ) : (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-6">
            <span className="t-body text-[var(--color-ink-2)]">
              This session has no prescription to open — it has not been approved, or it was stood down.
            </span>
          </div>
        )}
      </MobileShell>
    );
  }

  /* ---------------- unlocked ---------------- */
  const drip = await Drip.findById(booking.dripId).lean<{
    name: string;
    tagline?: string;
    infusionNotes?: string;
    durationMin: number;
    ingredients: Array<{ name?: string; dose: number; unit: string; role: string; notes?: string }>;
  } | null>();

  const doctor = booking.doctorId
    ? await User.findById(booking.doctorId).lean<{
        name: string;
        doctor?: { registrationCouncil?: string; licenseNo?: string };
      } | null>()
    : null;

  const ingredients = drip?.ingredients ?? [];

  /**
   * Each bar is scaled against the largest dose **in its own unit**, never
   * against the formula as a whole. 500 ml of saline and 5,000 mg of ascorbic
   * acid are not the same kind of quantity, and scaling them together drew the
   * carrier — physically the biggest thing in the bag — as the smallest bar on
   * the screen. Millilitres are compared with millilitres.
   */
  const maxByUnit = new Map<string, number>();
  for (const i of ingredients) {
    maxByUnit.set(i.unit, Math.max(maxByUnit.get(i.unit) ?? 0, i.dose));
  }

  return (
    <MobileShell
      title="Prescription"
      subtitle={`${booking.bookingNo} · ${patientName}`}
      back={{ href: `/nurse/session/${id}`, label: "Back to the checklist" }}
    >
      <div className="flex flex-col gap-5">
        {/* How it was opened, said plainly — a prescription opened without the
            patient's code must never look like one that was. */}
        <div
          className="rounded-[var(--radius-md)] border px-4 py-3"
          style={{
            borderColor: lock.overridden ? "var(--color-caution)" : "var(--color-safe)",
            background: lock.overridden ? "var(--color-caution-soft)" : "var(--color-safe-soft)",
          }}
        >
          <span className="t-small text-[var(--color-ink-2)]">
            {lock.method === "break_glass"
              ? `Opened WITHOUT ${patientName}'s code at `
              : lock.method === "physician"
                ? "Opened on a physician's authorisation at "
                : `Opened with ${patientName}'s code at `}
            <span className="t-data text-[13px]">
              {lock.unlockedAt
                ? new Date(lock.unlockedAt).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  })
                : "—"}
            </span>
            . It stays open for this session.
          </span>

          {lock.overridden && booking.rxOverride?.reason && (
            <p className="t-small text-[var(--color-ink-2)] mt-2">
              Reason given: {booking.rxOverride.reason}
              {booking.rxOverride.identityCheckedBy
                ? ` · Identity checked by: ${booking.rxOverride.identityCheckedBy}`
                : ""}
            </p>
          )}
          {lock.overridden && (
            <p className="t-small text-[var(--color-ink-3)] mt-1">
              {patientName} has been told this was opened without their code.
            </p>
          )}
        </div>

        <div>
          <span className="t-micro">Prescribed</span>
          <h2 className="t-h3 mt-1">{drip?.name ?? booking.dripName ?? "—"}</h2>
          {drip?.tagline && <p className="t-body text-[var(--color-ink-2)] mt-1">{drip.tagline}</p>}
          <div className="flex gap-4 mt-3">
            <span className="t-data text-[13px] text-[var(--color-ink-3)]">{drip?.durationMin ?? 45} min</span>
            <span className="t-data text-[13px] text-[var(--color-ink-3)]">
              {ingredients.length} component{ingredients.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <section className="flex flex-col gap-4">
          <span className="t-micro">Every component, in order</span>
          {ingredients.map((i, n) => (
            <div
              key={`${i.name}-${n}`}
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-3">
                <span style={{ font: "600 16px/1.35 var(--font-sans)" }}>{i.name}</span>
                <Pill tone={ROLE_TONE[i.role as keyof typeof ROLE_TONE] ?? "neutral"}>{i.role}</Pill>
              </div>
              <FillBar
                label={ROLE_MEANING[i.role] ?? "Component"}
                value={`${i.dose.toLocaleString("en-IN")} ${i.unit}`}
                pct={Math.round((i.dose / (maxByUnit.get(i.unit) || i.dose || 1)) * 100)}
              />
              {i.notes && <span className="t-small text-[var(--color-ink-2)]">{i.notes}</span>}
            </div>
          ))}
        </section>

        {drip?.infusionNotes && (
          <section className="rounded-[var(--radius-md)] border border-[var(--color-caution)] bg-[var(--color-caution-soft)] p-4">
            <span className="t-micro text-[var(--color-caution-text)]">How it must run</span>
            <p className="t-body text-[var(--color-ink-2)] mt-2">{drip.infusionNotes}</p>
          </section>
        )}

        {booking.approvalNotes && (
          <section className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
            <span className="t-micro">The physician&rsquo;s note</span>
            <p className="t-body text-[var(--color-ink-2)] mt-2">{booking.approvalNotes}</p>
          </section>
        )}

        <section className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-4 flex flex-col gap-1">
          <span className="t-micro">Approved by</span>
          <span className="t-body">{doctor?.name ?? "—"}</span>
          {doctor?.doctor?.licenseNo && (
            <span className="t-data text-[13px] text-[var(--color-ink-3)]">
              {doctor.doctor.registrationCouncil ? `${doctor.doctor.registrationCouncil} · ` : ""}
              {doctor.doctor.licenseNo}
            </span>
          )}
        </section>
      </div>
    </MobileShell>
  );
}

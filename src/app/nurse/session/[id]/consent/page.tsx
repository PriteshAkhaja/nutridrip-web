import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { MobileShell } from "@/components/layout/MobileShell";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, Drip, User } from "@/lib/models";
import { ConsentCapture } from "./ConsentCapture";
import { nurseOwns } from "@/lib/auth/ownership";
import { consentDocument, currentConsentDocument } from "@/lib/clinical/consent";
import { canOpenPrescription, rxLockState } from "@/lib/clinical/prescription";
import { PrescriptionGate } from "../PrescriptionGate";
import { rxOverrideView } from "@/lib/data/rx-override-view";

export const metadata: Metadata = { title: "Consent" };
export const dynamic = "force-dynamic";

export default async function ConsentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("nurse", "superadmin");
  const { id } = await params;

  await connectDB();
  const booking = await Booking.findById(id).lean<{
    bookingNo: string;
    patientId: unknown;
    nurseId?: unknown;
    doctorId?: unknown;
    dripId: unknown;
    dripName?: string;
    status: string;
    rxUnlockedAt?: Date;
    rxUnlockMethod?: string | null;
    rxOverride?: {
      requestedAt?: Date;
      lastAskedAt?: Date;
      reason?: string;
      deniedAt?: Date;
      deniedBy?: unknown;
      denyReason?: string;
    };
    consent?: {
      givenAt?: Date;
      version?: string;
      affirmation?: string;
      risks?: string[];
      components?: Array<{ name: string; dose: number; unit: string }>;
    };
  } | null>();
  if (!booking || !nurseOwns(session, booking)) notFound();

  // This screen lists every drug and dose, so it opens on the same unlock as
  // the prescription and the kit check. Locking those two and not this one
  // would leave the drug list one tap away from anybody holding a booking id.
  if (!rxLockState(booking).unlocked) {
    const who = await User.findById(booking.patientId).lean<{ name: string } | null>();
    return (
      <MobileShell
        title="Consent"
        subtitle={booking.bookingNo}
        back={{ href: `/nurse/session/${id}`, label: "Back to checklist" }}
      >
        {canOpenPrescription(booking.status) ? (
          <PrescriptionGate
            bookingId={id}
            patientName={who?.name ?? "the patient"}
            override={await rxOverrideView(booking)}
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

  const [patient, drip] = await Promise.all([
    User.findById(booking.patientId).lean<{ name: string; phone?: string } | null>(),
    Drip.findById(booking.dripId).lean<{
      ingredients: Array<{ name?: string; dose: number; unit: string; role: string }>;
    } | null>(),
  ]);

  /**
   * Once consent is given this screen shows the RECORD, not today's values.
   *
   * That is the point of snapshotting it. Reading the recipe live meant a
   * physician editing a drip next month changed what a patient appeared to
   * have agreed to last month. Before capture there is nothing to show but the
   * current form and the current recipe — which is correct, because that is
   * what they are about to agree to.
   */
  const given = Boolean(booking.consent?.givenAt);
  const doc = given ? consentDocument(booking.consent?.version) : currentConsentDocument();

  const affirmation = booking.consent?.affirmation ?? doc?.affirmation ?? null;
  const risks = booking.consent?.risks?.length ? booking.consent.risks : (doc?.risks ?? []);
  const components = given
    ? (booking.consent?.components ?? [])
    : (drip?.ingredients ?? []).map((i) => ({
        name: i.name ?? "Unnamed",
        dose: i.dose,
        unit: i.unit,
      }));

  /** Captured before any of this was stored — say so rather than imply it is theirs. */
  const unrecoverable = given && !booking.consent?.affirmation;

  return (
    <MobileShell
      title="Consent"
      subtitle={<span className="t-data text-[13px]">{patient?.name}</span>}
      back={{ href: `/nurse/session/${id}`, label: "Back to checklist" }}
    >
      <p className="t-body text-[var(--color-ink-2)] mb-5">
        {given
          ? "This is the record of what the patient agreed to, as it stood when they agreed to it."
          : "Read the risks aloud, then capture the signature or send a code to the patient’s phone. A copy of this wording and these doses is kept on the record."}
      </p>

      {unrecoverable ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-caution)] bg-[var(--color-caution-soft)] px-4 py-3 mb-4">
          <span className="t-small text-[var(--color-ink-2)]">
            This consent was captured before the wording was kept on the record. It was given against
            version <span className="t-data text-[13px]">{booking.consent?.version ?? "unknown"}</span>,
            and the text below is that version as it stands today — not necessarily what was read out.
          </span>
        </div>
      ) : null}

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-4">
        <span className="t-micro">
          {given ? "They consented to" : "You are consenting to"} · {booking.dripName ?? "this drip"}
        </span>
        {components.length > 0 ? (
          <div className="flex flex-col gap-2 mt-3">
            {components.map((c, n) => (
              <div key={n} className="flex justify-between gap-4 items-baseline">
                <span className="t-body text-[var(--color-ink-2)]">{c.name}</span>
                <span className="t-data text-[14.5px]">
                  {c.dose?.toLocaleString("en-IN") ?? "—"} {c.unit}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="t-small text-[var(--color-ink-3)] mt-3">
            No doses were recorded against this consent.
          </p>
        )}
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-4">
        <span className="t-micro">Known risks</span>
        {risks.length > 0 ? (
          <ul className="flex flex-col gap-3 mt-3 list-none p-0 m-0">
            {risks.map((r) => (
              <li key={r} className="flex gap-[10px] items-start">
                <span className="w-[6px] h-[6px] rounded-full bg-[var(--color-ink-3)] flex-none mt-[7px]" />
                <span className="t-body text-[var(--color-ink-2)]">{r}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="t-small text-[var(--color-ink-3)] mt-3">
            The risk wording for version {booking.consent?.version ?? "—"} is not on this record.
          </p>
        )}
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-5 mb-5">
        <span className="t-micro">What they agree to</span>
        <p className="t-body text-[var(--color-ink-2)] mt-2">
          {affirmation ?? "The wording for this version is not on this record."}
        </p>
      </div>

      <ConsentCapture
        bookingId={id}
        alreadyGivenAt={booking.consent?.givenAt ? booking.consent.givenAt.toISOString() : null}
      />
    </MobileShell>
  );
}

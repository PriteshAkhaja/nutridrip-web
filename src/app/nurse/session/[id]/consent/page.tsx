import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { MobileShell } from "@/components/layout/MobileShell";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, Drip, User } from "@/lib/models";
import { ConsentCapture } from "./ConsentCapture";
import { nurseOwns } from "@/lib/auth/ownership";

export const metadata: Metadata = { title: "Consent" };
export const dynamic = "force-dynamic";

const RISKS = [
  "Bruising, swelling or discomfort at the cannulation site.",
  "A warm or flushed sensation during the infusion, most often with magnesium.",
  "Rarely, an allergic reaction. The nurse carries an anaphylaxis kit and is trained to use it.",
  "Very rarely, fluid overload or an electrolyte disturbance, which is why vitals are taken first.",
];

export default async function ConsentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("nurse", "superadmin");
  const { id } = await params;

  await connectDB();
  const booking = await Booking.findById(id).lean<{
    bookingNo: string;
    patientId: unknown;
    nurseId?: unknown;
    dripId: unknown;
    dripName?: string;
    consent?: { givenAt?: Date; version?: string };
  } | null>();
  if (!booking || !nurseOwns(session, booking)) notFound();

  const [patient, drip] = await Promise.all([
    User.findById(booking.patientId).lean<{ name: string; phone?: string } | null>(),
    Drip.findById(booking.dripId).lean<{
      ingredients: Array<{ name?: string; dose: number; unit: string; role: string }>;
    } | null>(),
  ]);

  return (
    <MobileShell
      title="Consent"
      subtitle={<span className="t-data text-[13px]">{patient?.name}</span>}
      back={{ href: `/nurse/session/${id}`, label: "Back to checklist" }}
    >
      <p className="t-body text-[var(--color-ink-2)] mb-5">
        Read the risks aloud, then capture the signature or send a code to the patient&apos;s phone. Consent is
        recorded against a version, so what they agreed to can always be reconstructed.
      </p>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-4">
        <span className="t-micro">You are consenting to · {booking.dripName}</span>
        <div className="flex flex-col gap-2 mt-3">
          {(drip?.ingredients ?? []).map((i, n) => (
            <div key={n} className="flex justify-between gap-4 items-baseline">
              <span className="t-body text-[var(--color-ink-2)]">{i.name}</span>
              <span className="t-data text-[14.5px]">
                {i.dose.toLocaleString("en-IN")} {i.unit}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-5">
        <span className="t-micro">Known risks</span>
        <ul className="flex flex-col gap-3 mt-3 list-none p-0 m-0">
          {RISKS.map((r) => (
            <li key={r} className="flex gap-[10px] items-start">
              <span className="w-[6px] h-[6px] rounded-full bg-[var(--color-ink-3)] flex-none mt-[7px]" />
              <span className="t-body text-[var(--color-ink-2)]">{r}</span>
            </li>
          ))}
        </ul>
      </div>

      <ConsentCapture
        bookingId={id}
        phone={patient?.phone}
        alreadyGivenAt={booking.consent?.givenAt ? booking.consent.givenAt.toISOString() : null}
      />
    </MobileShell>
  );
}

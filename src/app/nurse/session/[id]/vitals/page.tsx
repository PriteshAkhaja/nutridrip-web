import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { MobileShell } from "@/components/layout/MobileShell";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, User } from "@/lib/models";
import { VitalsForm } from "./VitalsForm";
import { nurseOwns } from "@/lib/auth/ownership";
import { vitalsReadingIndex } from "@/lib/clinical/checklist";

export const metadata: Metadata = { title: "Vitals" };
export const dynamic = "force-dynamic";

export default async function VitalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  /** `correct` names the checklist step whose reading is being corrected. */
  searchParams: Promise<{ correct?: string }>;
}) {
  const session = await requireRole("nurse", "superadmin");
  const { id } = await params;
  const { correct } = await searchParams;

  await connectDB();
  const booking = await Booking.findById(id).lean<{
    bookingNo: string;
    patientId: unknown;
    nurseId?: unknown;
    vitals: Array<{
      takenAt: Date;
      label?: string;
      systolic?: number;
      diastolic?: number;
      heartRate?: number;
      spo2?: number;
      temperatureF?: number;
      weightKg?: number;
      outOfRange?: string[];
    }>;
  } | null>();
  if (!booking || !nurseOwns(session, booking)) notFound();

  const patient = await User.findById(booking.patientId).lean<{
    name: string;
    patient?: { weightKg?: number };
  } | null>();

  const previous = booking.vitals?.[booking.vitals.length - 1];

  // Correcting: the reading this step recorded -- baseline for the first vitals
  // step, closing for the second. Asked for a reading that is not there yet,
  // the page simply records one, as it always has.
  const index = correct ? vitalsReadingIndex(correct) : -1;
  const reading = index >= 0 ? booking.vitals?.[index] : undefined;
  const which = index === 0 ? "baseline" : "closing";

  return (
    <MobileShell
      title={reading ? `Correct the ${which} reading` : "Baseline vitals"}
      subtitle={
        <span className="t-data text-[13px]">
          {patient?.name} · {booking.bookingNo}
        </span>
      }
      back={{ href: `/nurse/session/${id}`, label: "Back to checklist" }}
    >
      <p className="t-body text-[var(--color-ink-2)] mb-5">
        {reading
          ? "Fix the values that were entered wrongly and say why. The recorded reading is kept on the session, marked as corrected. If a reading was out of range, the physician is told straight away."
          : "BP, HR, SpO₂, temperature and weight before any cannulation. A reading outside its reference range blocks the infusion and escalates to the reviewing physician."}
      </p>

      <VitalsForm
        bookingId={id}
        defaultWeight={previous?.weightKg ?? patient?.patient?.weightKg}
        correcting={
          reading
            ? {
                index,
                which,
                takenAt: reading.takenAt.toISOString(),
                outOfRange: reading.outOfRange ?? [],
                systolic: reading.systolic,
                diastolic: reading.diastolic,
                heartRate: reading.heartRate,
                spo2: reading.spo2,
                temperatureF: reading.temperatureF,
                weightKg: reading.weightKg,
              }
            : null
        }
        previous={
          previous
            ? {
                takenAt: previous.takenAt.toISOString(),
                label: previous.label ?? "baseline",
                outOfRange: previous.outOfRange ?? [],
                systolic: previous.systolic,
                diastolic: previous.diastolic,
                heartRate: previous.heartRate,
                spo2: previous.spo2,
                temperatureF: previous.temperatureF,
              }
            : null
        }
      />
    </MobileShell>
  );
}

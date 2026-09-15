import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { MobileShell } from "@/components/layout/MobileShell";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, User } from "@/lib/models";
import { VitalsForm } from "./VitalsForm";
import { nurseOwns } from "@/lib/auth/ownership";

export const metadata: Metadata = { title: "Vitals" };
export const dynamic = "force-dynamic";

export default async function VitalsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("nurse", "superadmin");
  const { id } = await params;

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

  return (
    <MobileShell
      title="Baseline vitals"
      subtitle={
        <span className="t-data text-[13px]">
          {patient?.name} · {booking.bookingNo}
        </span>
      }
      back={{ href: `/nurse/session/${id}`, label: "Back to checklist" }}
    >
      <p className="t-body text-[var(--color-ink-2)] mb-5">
        BP, HR, SpO₂, temperature and weight before any cannulation. A reading outside its reference range blocks the
        infusion and escalates to the reviewing physician.
      </p>

      <VitalsForm
        bookingId={id}
        defaultWeight={previous?.weightKg ?? patient?.patient?.weightKg}
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

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { nurseOwns } from "@/lib/auth/ownership";
import { MobileShell } from "@/components/layout/MobileShell";
import { connectDB } from "@/lib/db/mongoose";
import { Booking } from "@/lib/models";
import { AdverseForm } from "./AdverseForm";

export const metadata: Metadata = { title: "Adverse event" };
export const dynamic = "force-dynamic";

export default async function AdversePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("nurse", "superadmin");
  const { id } = await params;

  await connectDB();
  const booking = await Booking.findById(id).lean<{ nurseId?: unknown; bookingNo: string } | null>();
  if (!booking || !nurseOwns(session, booking)) notFound();

  return (
    <MobileShell
      title="Adverse event"
      subtitle={<span className="t-data text-[13px]">{booking.bookingNo}</span>}
      back={{ href: `/nurse/session/${id}`, label: "Back to checklist" }}
    >
      <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3 mb-5">
        <span className="t-body font-semibold">Patient safety comes before this form</span>
        <p className="t-body text-[var(--color-ink-2)] mt-1">
          Stop the infusion, stay with the patient, and use the anaphylaxis kit if indicated. Fill this in once they
          are stable — nothing here is time-critical.
        </p>
      </div>

      <AdverseForm bookingId={id} />
    </MobileShell>
  );
}

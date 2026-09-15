import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { MobileShell } from "@/components/layout/MobileShell";
import { connectDB } from "@/lib/db/mongoose";
import { BatchLot, Booking, Drip, ProductMaster, SessionKit, User } from "@/lib/models";
import { KitCheck } from "./KitCheck";
import { formatDate } from "@/lib/data/inventory";
import type { Unit } from "@/lib/models/types";
import { nurseOwns } from "@/lib/auth/ownership";
import { canOpenPrescription, rxLockState } from "@/lib/clinical/prescription";
import { PrescriptionGate } from "../PrescriptionGate";
import { rxOverrideView } from "@/lib/data/rx-override-view";

export const metadata: Metadata = { title: "Kit check" };
export const dynamic = "force-dynamic";

/**
 * Step 7 of the checklist, scoped to this one session: every vial this drip
 * needs, the batch it will be drawn from, and its expiry — so the nurse checks
 * seals against a list rather than from memory.
 */
export default async function SessionKitPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("nurse", "superadmin");
  const { id } = await params;

  await connectDB();
  const booking = await Booking.findById(id).lean<{
    _id: unknown;
    bookingNo: string;
    patientId: unknown;
    nurseId?: unknown;
    dripId: unknown;
    dripName?: string;
    status: string;
    rxUnlockedAt?: Date;
    rxUnlockMethod?: string | null;
    doctorId?: unknown;
    rxOverride?: {
      requestedAt?: Date;
      lastAskedAt?: Date;
      reason?: string;
      deniedAt?: Date;
      deniedBy?: unknown;
      denyReason?: string;
    };
    checklist: Array<{ key: string; doneAt?: Date }>;
  } | null>();
  if (!booking || !nurseOwns(session, booking)) notFound();

  // This screen lists the same drugs and doses as the prescription, so locking
  // only the prescription screen would be theatre — a nurse would simply open
  // this one instead. One unlock, every screen that shows the drugs.
  if (!rxLockState(booking).unlocked) {
    const who = await User.findById(booking.patientId).lean<{ name: string } | null>();
    return (
      <MobileShell
        title="Kit check"
        subtitle={booking.bookingNo}
        back={{ href: `/nurse/session/${id}`, label: "Back to the checklist" }}
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
    User.findById(booking.patientId).lean<{ name: string } | null>(),
    Drip.findById(booking.dripId).lean<{
      withKit: boolean;
      kitId?: unknown;
      infusionNotes?: string;
      ingredients: Array<{ masterId: unknown; name?: string; dose: number; unit: Unit; role: string }>;
    } | null>(),
  ]);

  const kit = drip?.withKit
    ? await SessionKit.findOne(
        drip.kitId ? { _id: drip.kitId } : { isDefault: true, isActive: true }
      ).lean<{ name: string; items: Array<{ masterId: unknown; qty: number }> } | null>()
    : null;

  const masterIds = [
    ...(drip?.ingredients ?? []).map((i) => String(i.masterId)),
    ...(kit?.items ?? []).map((k) => String(k.masterId)),
  ];

  const masters = await ProductMaster.find({ _id: { $in: masterIds } }).lean<
    Array<{ _id: unknown; name: string; storageCondition?: string }>
  >();
  const masterById = new Map(masters.map((m) => [String(m._id), m]));

  // FEFO decides which batch will actually be opened, so that is the one to
  // check the seal on.
  const lots = await BatchLot.find({
    masterId: { $in: masterIds },
    isActive: true,
    isQuarantined: false,
    expiry: { $gt: new Date() },
  })
    .sort({ expiry: 1 })
    .lean<Array<{ masterId: unknown; batchNo: string; expiry: Date; qtyOnHand: number; qtyReserved: number }>>();

  const firstLot = new Map<string, (typeof lots)[number]>();
  for (const l of lots) {
    const k = String(l.masterId);
    if (!firstLot.has(k) && l.qtyOnHand - l.qtyReserved > 0) firstLot.set(k, l);
  }

  const rows = [
    ...(drip?.ingredients ?? []).map((i) => {
      const key = String(i.masterId);
      const lot = firstLot.get(key);
      return {
        key: `ing-${key}`,
        name: i.name ?? masterById.get(key)?.name ?? "Unknown",
        detail: `${i.dose.toLocaleString("en-IN")} ${i.unit}`,
        role: i.role,
        batchNo: lot?.batchNo ?? null,
        expiry: lot ? formatDate(lot.expiry) : null,
        storage: masterById.get(key)?.storageCondition ?? null,
        available: lot ? lot.qtyOnHand - lot.qtyReserved : 0,
      };
    }),
    ...(kit?.items ?? []).map((k) => {
      const key = String(k.masterId);
      const lot = firstLot.get(key);
      return {
        key: `kit-${key}`,
        name: masterById.get(key)?.name ?? "Kit item",
        detail: `${k.qty} per session`,
        role: "KIT",
        batchNo: lot?.batchNo ?? null,
        expiry: lot ? formatDate(lot.expiry) : null,
        storage: null,
        available: lot ? lot.qtyOnHand - lot.qtyReserved : 0,
      };
    }),
  ];

  const stepDone = Boolean(booking.checklist?.find((s) => s.key === "ps-07")?.doneAt);

  return (
    <MobileShell
      title="Kit check"
      subtitle={
        <span className="t-data text-[13px]">
          {patient?.name} · {booking.dripName}
        </span>
      }
      back={{ href: `/nurse/session/${id}`, label: "Back to checklist" }}
    >
      <p className="t-body text-[var(--color-ink-2)] mb-5">
        Confirm the seal and the expiry on every item below before you open anything. The batch shown is the one the
        pharmacy will have drawn — earliest expiry first.
      </p>

      <KitCheck bookingId={id} rows={rows} alreadyDone={stepDone} infusionNotes={drip?.infusionNotes} />
    </MobileShell>
  );
}

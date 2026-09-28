import { Booking } from "@/lib/models";
import { HOLDING_STATUSES, ownClash, type OwnSession } from "@/lib/clinical/slots";

export type HeldDrip = OwnSession & { _id: unknown; status: string };

const DAY_MS = 86_400_000;

/**
 * The patient's own session that a new one at `at` for `durationMin` would
 * overlap, or null. `excludeBookingId` is the session being moved, which does
 * not clash with itself.
 */
export async function patientClash(
  patientId: string,
  at: Date,
  durationMin: number,
  excludeBookingId?: string | null
): Promise<HeldDrip | null> {
  const sessions = await Booking.find({
    patientId,
    status: { $in: HOLDING_STATUSES },
    scheduledAt: { $gte: new Date(at.getTime() - DAY_MS), $lte: new Date(at.getTime() + DAY_MS) },
    ...(excludeBookingId ? { _id: { $ne: excludeBookingId } } : {}),
  })
    .select("bookingNo dripName scheduledAt durationMin status")
    .lean<HeldDrip[]>();
  return ownClash(sessions, at.getTime(), durationMin);
}

/**
 * The drip a patient holds while their answers wait for a physician, if any.
 * There is only ever one: it is the session the approval will confirm, and a
 * second would send a second nurse for the same decision.
 */
export async function heldDripOf(patientId: string): Promise<HeldDrip | null> {
  return Booking.findOne({ patientId, status: "awaiting_review", scheduledAt: { $gte: new Date() } })
    .sort({ scheduledAt: 1 })
    .select("bookingNo dripName scheduledAt durationMin status")
    .lean<HeldDrip | null>();
}

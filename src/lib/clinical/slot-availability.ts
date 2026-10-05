import { connectDB } from "@/lib/db/mongoose";
import { Booking, User } from "@/lib/models";
import { getZones } from "@/lib/zones-store";
import { zoneForPincode, type Zone } from "@/lib/zones";
import {
  DEFAULT_HOURS,
  HOLDING_STATUSES,
  istDateOf,
  istInstant,
  type Held,
  type SlotContext,
} from "@/lib/clinical/slots";
import { getNurseDayLimit } from "@/lib/settings/nurse-day";

/**
 * What the slot rules (lib/clinical/slots) need for one address: the zone's
 * hours, the nurses who can be sent there, every session already holding a
 * nurse's time around the dates asked about, the ones finished on those days
 * (they count towards a nurse's day), and the most sessions a nurse takes in one.
 *
 * The pool is the rule `pickNurse()` dispatches by: nurses who list the zone,
 * or list no zones at all. When nobody covers a zone, dispatch falls back to
 * the nearest nurse anywhere, so the pool does too — otherwise a zone with no
 * nurse of its own would show every time taken and nobody there could book.
 */
export async function slotContext(opts: {
  pincode: string | null | undefined;
  /** The dates the grid covers, "YYYY-MM-DD", to bound the bookings read. */
  from: Date;
  to: Date;
  /** A session being moved does not stand in its own way. */
  excludeBookingId?: string | null;
}): Promise<SlotContext & { zone: Zone | null }> {
  await connectDB();
  const zones = await getZones();
  const zone = zoneForPincode(opts.pincode, zones);

  // Every session of the whole India days asked about -- a nurse's day counts
  // all of them -- and half a day either side for the travel between sessions.
  const margin = 12 * 3_600_000;
  const dayStart = istInstant(istDateOf(opts.from.getTime()), "00:00").getTime();
  const dayEnd = istInstant(istDateOf(opts.to.getTime()), "00:00").getTime() + 24 * 3_600_000;
  const window = {
    $gte: new Date(Math.min(opts.from.getTime() - margin, dayStart)),
    $lt: new Date(Math.max(opts.to.getTime() + margin, dayEnd)),
  };
  const [nurses, bookings, finished, dayLimit] = await Promise.all([
    User.find({ role: "nurse", status: "active" })
      .select("nurse.serviceAreas")
      .lean<Array<{ _id: unknown; nurse?: { serviceAreas?: string[] } }>>(),
    Booking.find({
      status: { $in: HOLDING_STATUSES },
      scheduledAt: window,
      ...(opts.excludeBookingId ? { _id: { $ne: opts.excludeBookingId } } : {}),
    })
      .select("nurseId scheduledAt durationMin pincode")
      .lean<Array<{ _id: unknown; nurseId?: unknown; scheduledAt: Date; durationMin?: number; pincode?: string }>>(),
    // Done that day: no longer holding any time, but part of the nurse's day.
    Booking.find({ status: "completed", nurseId: { $ne: null }, scheduledAt: window })
      .select("nurseId scheduledAt")
      .lean<Array<{ nurseId: unknown; scheduledAt: Date }>>(),
    getNurseDayLimit(),
  ]);

  const covering = nurses.filter((n) => {
    const areas = n.nurse?.serviceAreas ?? [];
    return !zone || areas.length === 0 || areas.includes(zone.name);
  });
  const pool = (covering.length ? covering : nurses).map((n) => String(n._id));

  const held: Held[] = bookings.map((b) => ({
    id: String(b._id),
    nurseId: b.nurseId ? String(b.nurseId) : null,
    start: new Date(b.scheduledAt).getTime(),
    durationMin: b.durationMin ?? 45,
    zoneName: zoneForPincode(b.pincode, zones)?.name ?? null,
  }));

  return {
    zone,
    zoneName: zone?.name ?? null,
    hours: zone ? { opensAt: zone.opensAt, closesAt: zone.closesAt, slotMinutes: zone.slotMinutes } : DEFAULT_HOURS,
    pool,
    held,
    done: finished.map((b) => ({ nurseId: String(b.nurseId), start: new Date(b.scheduledAt).getTime() })),
    dayLimit,
  };
}

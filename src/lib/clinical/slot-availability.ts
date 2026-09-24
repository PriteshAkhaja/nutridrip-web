import { connectDB } from "@/lib/db/mongoose";
import { Booking, User } from "@/lib/models";
import { getZones } from "@/lib/zones-store";
import { zoneForPincode, type Zone } from "@/lib/zones";
import { DEFAULT_HOURS, HOLDING_STATUSES, type Held, type SlotContext } from "@/lib/clinical/slots";

/**
 * What the slot rules (lib/clinical/slots) need for one address: the zone's
 * hours, the nurses who can be sent there, and every session already holding a
 * nurse's time around the dates asked about.
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

  const margin = 12 * 3_600_000;
  const [nurses, bookings] = await Promise.all([
    User.find({ role: "nurse", status: "active" })
      .select("nurse.serviceAreas")
      .lean<Array<{ _id: unknown; nurse?: { serviceAreas?: string[] } }>>(),
    Booking.find({
      status: { $in: HOLDING_STATUSES },
      scheduledAt: { $gte: new Date(opts.from.getTime() - margin), $lte: new Date(opts.to.getTime() + margin) },
      ...(opts.excludeBookingId ? { _id: { $ne: opts.excludeBookingId } } : {}),
    })
      .select("nurseId scheduledAt durationMin pincode")
      .lean<Array<{ _id: unknown; nurseId?: unknown; scheduledAt: Date; durationMin?: number; pincode?: string }>>(),
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
  };
}

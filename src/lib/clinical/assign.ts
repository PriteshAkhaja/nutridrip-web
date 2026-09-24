import { connectDB } from "@/lib/db/mongoose";
import { Booking, User } from "@/lib/models";
import { zoneForPincode } from "@/lib/zones";
import { getZones } from "@/lib/zones-store";
import { NURSE_CAPACITY, distanceKm } from "./nurse-options";
import { HOLDING_STATUSES, busyNurses } from "./slots";

// Defined in nurse-options because that file must stay free of any database
// import — the admin form reaches it from the browser. Re-exported here so
// callers that have always read them from dispatch still can.
export { NURSE_CAPACITY, distanceKm } from "./nurse-options";

const OPEN_STATUSES = ["approved", "nurse_assigned", "en_route", "in_progress"];

export type NursePick = {
  nurseId: string;
  name: string;
  phone?: string;
  distanceKm: number;
  load: number;
  /** False when nobody covering the zone was free, so the nearest was taken. */
  coversZone: boolean;
  zoneName: string | null;
  /** True when a specific nurse was asked for but could not take it. */
  overridden: boolean;
  requestedNurseName: string | null;
};

/**
 * Pick the nearest active nurse who is still under capacity. If a specific
 * nurse was requested but cannot take it, fall back to the nearest one and say
 * so — never swap silently, because the doctor asked for a reason.
 *
 * Given the session's time, a nurse already busy then (another session, or the
 * travel after it) is not picked: the booking screen only offered the time
 * because somebody was free, and that somebody is who should go.
 */
export async function pickNurse(
  patient: { latitude?: number | null; longitude?: number | null; pincode?: string | null },
  opts: {
    requestedNurseId?: string | null;
    excludeNurseId?: string | null;
    /** The session being staffed; it does not clash with itself. */
    session?: { start: Date; durationMin: number; bookingId?: string | null };
  } = {}
): Promise<NursePick | null> {
  await connectDB();

  const [nurses, openBookings, zones] = await Promise.all([
    User.find({ role: "nurse", status: "active" }).lean<
      Array<{
        _id: unknown;
        name: string;
        phone?: string;
        nurse?: { latitude?: number; longitude?: number; serviceAreas?: string[] };
      }>
    >(),
    Booking.find({ status: { $in: HOLDING_STATUSES }, nurseId: { $ne: null } })
      .select("nurseId status scheduledAt durationMin")
      .lean<Array<{ _id: unknown; nurseId: unknown; status: string; scheduledAt: Date; durationMin?: number }>>(),
    getZones(),
  ]);

  const load = new Map<string, number>();
  for (const b of openBookings) {
    if (!OPEN_STATUSES.includes(b.status)) continue;
    const k = String(b.nurseId);
    load.set(k, (load.get(k) ?? 0) + 1);
  }

  const s = opts.session;
  const busy = s
    ? busyNurses(
        openBookings
          .filter((b) => String(b._id) !== String(s.bookingId ?? ""))
          .map((b) => ({
            id: String(b._id),
            nurseId: String(b.nurseId),
            start: new Date(b.scheduledAt).getTime(),
            durationMin: b.durationMin ?? 45,
            zoneName: null,
          })),
        s.start.getTime(),
        s.durationMin
      )
    : new Set<string>();

  // The zone the address falls in, so a nurse who does not cover it is not sent
  // there just because nobody has coordinates on file.
  const zone = zoneForPincode(patient.pincode ?? undefined, zones);

  const ranked = nurses
    .filter((n) => String(n._id) !== opts.excludeNurseId)
    .map((n) => {
      const hasGeo =
        patient.latitude != null &&
        patient.longitude != null &&
        n.nurse?.latitude != null &&
        n.nurse?.longitude != null;

      const areas = n.nurse?.serviceAreas ?? [];
      // No declared areas means no restriction; a declared list is a claim
      // about where this nurse works, and it is respected.
      const covers = !zone || areas.length === 0 || areas.includes(zone.name);

      return {
        nurse: n,
        load: load.get(String(n._id)) ?? 0,
        covers,
        // Without coordinates, fall back to whether the nurse covers the area
        // at all; an unknown distance must not beat a known one.
        km: hasGeo
          ? distanceKm(patient.latitude!, patient.longitude!, n.nurse!.latitude!, n.nurse!.longitude!)
          : 9999,
      };
    })
    .filter((r) => r.load < NURSE_CAPACITY && !busy.has(String(r.nurse._id)))
    // Whoever covers the zone comes first, then the nearest, then the least busy.
    .sort((a, b) =>
      a.covers !== b.covers ? (a.covers ? -1 : 1) : a.km !== b.km ? a.km - b.km : a.load - b.load
    );

  if (!ranked.length) return null;

  const requested = opts.requestedNurseId
    ? ranked.find((r) => String(r.nurse._id) === opts.requestedNurseId)
    : null;
  const chosen = requested ?? ranked[0];
  const overridden = Boolean(opts.requestedNurseId) && String(chosen.nurse._id) !== opts.requestedNurseId;

  return {
    nurseId: String(chosen.nurse._id),
    name: chosen.nurse.name,
    phone: chosen.nurse.phone,
    distanceKm: chosen.km === 9999 ? 0 : Math.round(chosen.km * 10) / 10,
    load: chosen.load,
    coversZone: chosen.covers,
    zoneName: zone?.name ?? null,
    overridden,
    requestedNurseName: overridden
      ? (nurses.find((n) => String(n._id) === opts.requestedNurseId)?.name ?? "the requested nurse")
      : null,
  };
}

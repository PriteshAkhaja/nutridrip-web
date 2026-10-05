import { connectDB } from "@/lib/db/mongoose";
import { Booking, User } from "@/lib/models";
import { nurseOptions, type NurseOptions, type PatientPoint } from "@/lib/clinical/nurse-options";
import { DAY_STATUSES } from "@/lib/clinical/assign";
import { istDateOf, istInstant } from "@/lib/clinical/slots";
import { getNurseDayLimit } from "@/lib/settings/nurse-day";
import { getZones } from "@/lib/zones-store";

/** What a nurse has open, when there is no session day to count. */
const OPEN_STATUSES = ["approved", "nurse_assigned", "en_route", "in_progress"];

/**
 * Load every active nurse with their load, ranked for one patient.
 *
 * `on` is the time of the session being approved: each nurse's load is then
 * their sessions that day, against the day limit dispatch uses, so the list
 * a physician reads and the choice the system would make cannot disagree.
 * Without a session there is no day to count, and the load is simply what
 * each nurse has open.
 *
 * Two queries, not one per nurse: the load comes from a single sweep of
 * bookings, counted in memory. The ranking itself is pure and lives in
 * `nurse-options.ts`, so this file is only the part that needs a database.
 */
export async function nurseChoicesFor(
  patient: PatientPoint,
  doctorId: string | null,
  on: Date | null = null
): Promise<NurseOptions> {
  await connectDB();

  const dayStart = on ? istInstant(istDateOf(on.getTime()), "00:00") : null;
  const [nurses, counted, zones, limit] = await Promise.all([
    User.find({ role: "nurse", status: "active" }).select("name nurse").lean<
      Array<{
        _id: unknown;
        name: string;
        nurse?: {
          serviceAreas?: string[];
          latitude?: number;
          longitude?: number;
          doctorId?: unknown;
        };
      }>
    >(),
    Booking.find(
      dayStart
        ? {
            status: { $in: DAY_STATUSES },
            nurseId: { $ne: null },
            scheduledAt: { $gte: dayStart, $lt: new Date(dayStart.getTime() + 24 * 3_600_000) },
          }
        : { status: { $in: OPEN_STATUSES }, nurseId: { $ne: null } }
    )
      .select("nurseId")
      .lean<Array<{ nurseId: unknown }>>(),
    getZones(),
    getNurseDayLimit(),
  ]);

  const load = new Map<string, number>();
  for (const b of counted) {
    const k = String(b.nurseId);
    load.set(k, (load.get(k) ?? 0) + 1);
  }

  return nurseOptions(
    nurses.map((n) => ({
      id: String(n._id),
      name: n.name,
      serviceAreas: n.nurse?.serviceAreas ?? [],
      latitude: n.nurse?.latitude ?? null,
      longitude: n.nurse?.longitude ?? null,
      doctorId: n.nurse?.doctorId ? String(n.nurse.doctorId) : null,
      load: load.get(String(n._id)) ?? 0,
    })),
    patient,
    doctorId,
    zones,
    dayStart ? { limit } : null
  );
}

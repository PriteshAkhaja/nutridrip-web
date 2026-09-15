import { connectDB } from "@/lib/db/mongoose";
import { Booking, User } from "@/lib/models";
import { nurseOptions, type NurseOptions, type PatientPoint } from "@/lib/clinical/nurse-options";

/** The statuses that count against a nurse's capacity — the same list dispatch uses. */
const OPEN_STATUSES = ["approved", "nurse_assigned", "en_route", "in_progress"];

/**
 * Load every active nurse with their current load, ranked for one patient.
 *
 * Two queries, not one per nurse: the load comes from a single sweep of open
 * bookings, counted in memory. The ranking itself is pure and lives in
 * `nurse-options.ts`, so this file is only the part that needs a database.
 */
export async function nurseChoicesFor(
  patient: PatientPoint,
  doctorId: string | null
): Promise<NurseOptions> {
  await connectDB();

  const [nurses, openBookings] = await Promise.all([
    User.find({ role: "nurse", status: "active" })
      .select("name nurse")
      .lean<
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
    Booking.find({ status: { $in: OPEN_STATUSES }, nurseId: { $ne: null } })
      .select("nurseId")
      .lean<Array<{ nurseId: unknown }>>(),
  ]);

  const load = new Map<string, number>();
  for (const b of openBookings) {
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
    doctorId
  );
}

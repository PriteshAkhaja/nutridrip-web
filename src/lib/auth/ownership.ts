import type { SessionPayload } from "./session";

/**
 * A nurse may only work sessions dispatched to them. The super admin may open
 * any session, because somebody has to be able to when a nurse's phone dies.
 */
export function nurseOwns(
  session: SessionPayload | null | undefined,
  booking: { nurseId?: unknown } | null | undefined
): boolean {
  if (!session || !booking) return false;
  if (session.role === "superadmin") return true;
  if (session.role !== "nurse") return false;
  return Boolean(booking.nurseId) && String(booking.nurseId) === session.sub;
}

/**
 * Who may arrange somebody else's session — cancel it, move it, reassign it.
 *
 * The role alone is not the answer. A clinic is a tenant: it may only touch
 * sessions booked into its own rooms, or one clinic could cancel another's
 * bookings simply by knowing an id. Physicians work a shared rota, so any
 * session is theirs to arrange; the platform roles see everything.
 */
export function canManageBooking(
  session: SessionPayload | null | undefined,
  booking: { patientId?: unknown; clinicId?: unknown } | null | undefined
): boolean {
  if (!session || !booking) return false;
  switch (session.role) {
    case "superadmin":
    case "admin":
      return true;
    case "doctor":
      return true;
    case "clinic":
      return Boolean(booking.clinicId) && String(booking.clinicId) === session.sub;
    case "patient":
      return Boolean(booking.patientId) && String(booking.patientId) === session.sub;
    default:
      return false;
  }
}

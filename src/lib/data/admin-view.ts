/**
 * What an Admin may see of a patient -- as an allow-list.
 *
 * An Admin runs the service: who is booked, where, with whom, for how much. They
 * do not read anyone's medical record; that belongs to the treating physician
 * (and the patient). The screens are written to that, but a screen is only half
 * of it -- the JSON APIs hand back whole documents to anyone with a session -- so
 * the same rule is applied here, once, and used by both.
 *
 * It is an ALLOW-list on purpose. A deny-list ("strip allergies, strip vitals")
 * is right on the day it is written and wrong the day someone adds a
 * `pregnancyStatus` field and forgets this file. An allow-list fails the other
 * way round: the new field stays hidden until someone decides it should not be.
 * tests/admin-view.test.ts holds the line from both sides.
 */

/** The parts of a patient's profile an Admin may read: contact and place. */
export const ADMIN_PATIENT_FIELDS = ["address", "city", "pincode"] as const;

/** A booking, less everything clinical: the session as a piece of scheduling. */
export const ADMIN_BOOKING_FIELDS = [
  "bookingNo",
  // Late-change fees: what the patient owes, not anything clinical.
  "charges",
  "patientId",
  "dripId",
  "dripName",
  "planId",
  "scheduledAt",
  "durationMin",
  "location",
  "address",
  "city",
  "pincode",
  "clinicId",
  "nurseId",
  "doctorId",
  "status",
  "approvedAt",
  "enRouteAt",
  "etaMinutes",
  "startedAt",
  "completedAt",
  "amount",
  "paymentStatus",
  "cancelledAt",
  "cancelReason",
  "rescheduledFrom",
  "rescheduleCount",
  "createdAt",
  "updatedAt",
] as const;

/** For `.select()`: only these leave the database for an Admin. */
export const ADMIN_BOOKING_SELECT = ADMIN_BOOKING_FIELDS.join(" ");


/**
 * A user as an Admin may see them. Staff records pass through untouched -- a
 * nurse's council number is not a patient's diagnosis -- and a patient's profile
 * is cut down to contact and place. Returns a copy; the input is not changed.
 */
export function adminSafeUser<T extends object>(user: T): T {
  const profile = (user as { patient?: Record<string, unknown> | null }).patient;
  if (!profile) return user;
  const kept: Record<string, unknown> = {};
  for (const key of ADMIN_PATIENT_FIELDS) {
    if (profile[key] !== undefined) kept[key] = profile[key];
  }
  return { ...user, patient: kept };
}

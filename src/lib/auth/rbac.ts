import type { Role } from "@/lib/models/types";

/**
 * Permission matrix transcribed from the requirements doc. Keys are the
 * capability names used by route guards and by conditional UI.
 */
export const PERMISSIONS = {
  "users.view": ["superadmin", "admin"],
  "users.manage": ["superadmin"],

  "inventory.view": ["superadmin", "admin"],
  "inventory.manage": ["superadmin"],
  "drips.build": ["superadmin"],
  "availability.check": ["superadmin", "admin"],
  "alerts.view": ["superadmin", "admin"],
  "recall.trace": ["superadmin", "admin"],

  "orders.view": ["superadmin", "admin", "doctor", "nurse", "clinic"],
  "orders.create": ["superadmin", "admin", "clinic"],
  "orders.update": ["superadmin", "admin"],
  "orders.dispatch": ["superadmin", "admin"],

  "plans.view": ["superadmin", "doctor", "nurse", "patient"],
  "plans.create": ["superadmin", "doctor"],
  "plans.share": ["superadmin", "doctor"],
  /**
   * A physician's own letterhead. Deliberately not superadmin: it is the
   * physician's identity on a document they answer for, so nobody edits it on
   * their behalf.
   */
  "letterhead.edit": ["doctor"],

  "infusion.prepare": ["superadmin", "nurse"],
  "infusion.complete": ["superadmin", "nurse"],

  "quiz.take": ["patient"],
  /** Reading the queue: operations watch the SLA. */
  "quiz.review": ["superadmin", "admin", "doctor"],
  /**
   * Making the call. Approving a protocol is a prescribing decision, so it
   * belongs to a registered physician — an ordinary admin watching the review
   * SLA must not be able to issue the approval they are waiting for.
   */
  "quiz.decide": ["superadmin", "doctor"],
  "quiz.manage": ["superadmin", "admin"],
  "content.manage": ["superadmin", "admin"],
  /**
   * Separate from content.manage though it holds the same roles today.
   *
   * Editing marketing copy and changing the GST registration invoices are
   * raised under are different acts, and the day one of them needs narrowing
   * it should not drag the other with it.
   */
  "billing.manage": ["superadmin", "admin"],
  /**
   * Reading the trail is its own capability.
   *
   * It carries who was refused what and when, across every role — closer to a
   * security log than to an admin screen, and the sign-in page and privacy
   * policy both promise the user it is kept.
   */
  "audit.view": ["superadmin", "admin"],
  "labs.upload": ["patient"],
  /**
   * A lab report is a patient's own medical document: the physician reads it, and
   * so does the patient. Operations staff do not, so an Admin is not listed here
   * even though the screens never showed it -- the API did, to anyone with a
   * session. `plans.view`, further up, is left out for the same reason.
   */
  "labs.view": ["superadmin", "doctor", "patient"],

  "bookings.create": ["patient"],
  "bookings.view": ["superadmin", "admin", "doctor", "nurse", "clinic", "patient"],
  "bookings.manage": ["superadmin", "admin", "clinic"],

  "approvals.view": ["superadmin", "admin", "doctor"],
  "approvals.act": ["superadmin", "admin", "doctor"],

  "clinic.view": ["superadmin", "admin", "clinic"],
  "clinic.update": ["superadmin", "clinic"],

  "ai.configure": ["superadmin"],
  "analytics.view": ["superadmin", "admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

/**
 * How much of a PATIENT's record a role may read.
 *
 *  - "full"    the whole clinical record: answers, history, allergies, labs, plans.
 *  - "limited" who they are, where they are, and their sessions -- what running
 *              the service needs -- and nothing clinical. An Admin's view.
 *  - "none"    not a screen this role opens.
 *
 * Every physician reads every patient for now: that was decided, and it is the
 * client's to tighten. When they do, this is the ONE place: make "doctor" depend
 * on whether that physician reviewed, treated or is on call for the patient, and
 * every screen and test that asks this question follows.
 */
export type PatientRecordView = "full" | "limited" | "none";

export function patientRecordView(role: Role | undefined): PatientRecordView {
  if (role === "superadmin" || role === "doctor") return "full";
  if (role === "admin") return "limited";
  return "none";
}

export function can(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

/** Where each role lands after signing in. */
export const HOME_FOR_ROLE: Record<Role, string> = {
  superadmin: "/admin",
  admin: "/admin",
  doctor: "/doctor",
  nurse: "/nurse",
  clinic: "/clinic",
  patient: "/app",
};

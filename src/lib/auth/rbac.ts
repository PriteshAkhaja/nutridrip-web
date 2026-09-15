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

  "plans.view": ["superadmin", "admin", "doctor", "nurse", "patient"],
  "plans.create": ["superadmin", "doctor"],
  "plans.share": ["superadmin", "doctor"],

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
  "labs.upload": ["patient"],
  "labs.view": ["superadmin", "admin", "doctor", "patient"],

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

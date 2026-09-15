import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "./session";
import { can, type Permission } from "./rbac";
import type { Role } from "@/lib/models/types";

/**
 * The sign-in page and the privacy policy both tell people that a refused
 * access attempt is written to the audit log. This is what makes that true.
 *
 * It must never be the reason a refusal fails to happen, so a logging error is
 * swallowed — the redirect is the security control, the record is the promise.
 */
async function recordRefusal(session: SessionPayload, wanted: string) {
  try {
    const { connectDB } = await import("@/lib/db/mongoose");
    const { AuditLog } = await import("@/lib/models");
    const headerList = await headers();
    await connectDB();
    await AuditLog.create({
      actorId: session.sub,
      actorRole: session.role,
      action: "access.refused",
      entity: "Route",
      entityId: wanted,
      ip: headerList.get("x-forwarded-for") ?? undefined,
    });
  } catch (err) {
    console.error("could not record a refused access attempt:", err);
  }
}

/** Server-component guard: returns the session or sends the visitor to login. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireRole(...roles: Role[]): Promise<SessionPayload> {
  const session = await requireSession();
  if (!roles.includes(session.role)) {
    await recordRefusal(session, `role:${roles.join("|")}`);
    redirect("/login?e=forbidden");
  }
  return session;
}

export async function requirePermission(permission: Permission): Promise<SessionPayload> {
  const session = await requireSession();
  if (!can(session.role, permission)) {
    await recordRefusal(session, `permission:${permission}`);
    redirect("/login?e=forbidden");
  }
  return session;
}

import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Zone } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getZones, seedZones } from "@/lib/zones-store";
import { ok, fail, handleError } from "@/lib/api";
import { ZoneBody, auditView, checkZone, staleServer } from "./input";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!can(session?.role, "zones.manage")) return fail("Not permitted", 403);
    return ok({ zones: await getZones() });
  } catch (err) {
    return handleError(err);
  }
}

/** A new zone, added at the end of the list. */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "zones.manage")) return fail("Not permitted", 403);
    const input = ZoneBody.parse(await req.json());
    await connectDB();
    const stale = staleServer();
    if (stale) return stale;
    // The launch zones are written first, so adding one never hides the other fourteen.
    await seedZones();

    const checked = checkZone(input, await getZones());
    if ("error" in checked) return checked.error;

    const last = await Zone.findOne({}).sort({ position: -1 }).select("position").lean<{ position?: number } | null>();
    const created = await Zone.create({ ...checked.zone, position: (last?.position ?? 0) + 1, updatedBy: session!.sub });

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "zone.create",
      entity: "Zone",
      entityId: String(created._id),
      after: auditView(checked.zone),
    });
    return ok({ id: String(created._id) }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

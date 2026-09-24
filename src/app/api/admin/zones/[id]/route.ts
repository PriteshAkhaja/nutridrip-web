import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, User, Zone } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getZones } from "@/lib/zones-store";
import { ok, fail, handleError } from "@/lib/api";
import { ZoneBody, auditView, checkZone, nursesCovering, staleServer } from "../input";

export const dynamic = "force-dynamic";

type ZoneRow = { _id: unknown; name: string; pincodes: string[]; opensAt: string; closesAt: string; slotMinutes?: number; status: string };

/**
 * Change a zone: its name, pincodes, hours or status. A new name is carried
 * onto every nurse who covers the zone, in the same request, so no nurse
 * silently stops covering it because it was renamed.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "zones.manage")) return fail("Not permitted", 403);
    const { id } = await params;
    const input = ZoneBody.parse(await req.json());
    await connectDB();
    const stale = staleServer();
    if (stale) return stale;

    const before = await Zone.findById(id).lean<ZoneRow | null>();
    if (!before) return fail("That zone does not exist", 404);

    const others = (await getZones()).filter((z) => z.id !== id);
    const checked = checkZone(input, others);
    if ("error" in checked) return checked.error;

    await Zone.updateOne({ _id: id }, { $set: { ...checked.zone, updatedBy: session!.sub } });

    let nursesMoved = 0;
    if (checked.zone.name !== before.name) {
      const res = await User.updateMany(
        { role: "nurse", "nurse.serviceAreas": before.name },
        { $set: { "nurse.serviceAreas.$[area]": checked.zone.name } },
        { arrayFilters: [{ area: before.name }] }
      );
      nursesMoved = res.modifiedCount;
    }

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "zone.update",
      entity: "Zone",
      entityId: id,
      before: auditView(before),
      after: { ...auditView(checked.zone), ...(nursesMoved ? { nursesRenamed: nursesMoved } : {}) },
    });
    return ok({ id, nursesRenamed: nursesMoved });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Remove a zone. Only one nobody covers: while a nurse still lists it, it is
 * paused instead, so a nurse's coverage never disappears behind their back.
 * The last zone cannot go either — with none, nobody could book at all.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "zones.manage")) return fail("Not permitted", 403);
    const { id } = await params;
    await connectDB();

    const zone = await Zone.findById(id).lean<ZoneRow | null>();
    if (!zone) return fail("That zone does not exist", 404);

    const nurses = await nursesCovering(zone.name);
    if (nurses > 0) {
      return fail(
        `${nurses} ${nurses === 1 ? "nurse covers" : "nurses cover"} ${zone.name}. Pause it instead, or take it off their zones in People first.`,
        409
      );
    }
    if ((await Zone.countDocuments()) <= 1) {
      return fail("This is the last zone. Pause it instead — with no zones, nobody could book.", 409);
    }

    await Zone.deleteOne({ _id: id });
    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "zone.delete",
      entity: "Zone",
      entityId: id,
      before: auditView(zone),
    });
    return ok({ id });
  } catch (err) {
    return handleError(err);
  }
}

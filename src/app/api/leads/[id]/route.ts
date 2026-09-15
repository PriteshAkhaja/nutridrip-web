import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Lead } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { ok, fail, handleError } from "@/lib/api";

const Patch = z.object({
  status: z.enum(["new", "contacted", "qualified", "converted", "closed"]).optional(),
  notes: z.string().max(2000).optional(),
});

/** Moving an enquiry along: new → contacted → qualified → converted or closed. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "users.view")) return fail("Not permitted", 403);

    const { id } = await params;
    const input = Patch.parse(await req.json());
    await connectDB();

    const lead = await Lead.findById(id);
    if (!lead) return fail("Enquiry not found", 404);

    const before = { status: lead.status };
    if (input.status) lead.status = input.status;
    if (input.notes !== undefined) lead.notes = input.notes;
    if (!lead.ownerId) lead.ownerId = session!.sub;
    await lead.save();

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "lead.update",
      entity: "Lead",
      entityId: id,
      before,
      after: { status: lead.status },
    });

    return ok({ id, status: lead.status, notes: lead.notes ?? "" });
  } catch (err) {
    return handleError(err);
  }
}

import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, TreatmentPlan, User } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { notify } from "@/lib/notify";
import { PLAN_STATUS } from "@/lib/models/types";
import { ok, fail, handleError } from "@/lib/api";

const Patch = z.object({
  sharedWithNurse: z.boolean().optional(),
  nurseId: z.string().optional(),
  status: z.enum(PLAN_STATUS).optional(),
  diagnosis: z.string().max(500).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "plans.share")) return fail("Not permitted", 403);

    const { id } = await params;
    const input = Patch.parse(await req.json());
    await connectDB();

    const plan = await TreatmentPlan.findById(id);
    if (!plan) return fail("Plan not found", 404);
    // A plan is a prescribing act signed by one physician. Another physician
    // may read it, but changing whose doses a nurse will draw is not theirs.
    if (session!.role === "doctor" && String(plan.doctorId) !== session!.sub) {
      return fail("Another physician wrote this plan. Ask them to change it.", 403);
    }

    const wasShared = plan.sharedWithNurse;
    if (input.diagnosis !== undefined) plan.diagnosis = input.diagnosis;
    if (input.nurseId) plan.nurseId = input.nurseId;
    if (input.sharedWithNurse !== undefined) plan.sharedWithNurse = input.sharedWithNurse;
    if (input.status) plan.status = input.status;

    // Sharing is what turns a draft into something a nurse can act on.
    if (plan.sharedWithNurse && plan.status === "draft") plan.status = "active";
    await plan.save();

    if (plan.sharedWithNurse && !wasShared && plan.nurseId) {
      const patient = await User.findById(plan.patientId).lean<{ name: string } | null>();
      await notify(
        String(plan.nurseId),
        `Treatment plan shared · ${patient?.name ?? "a patient"}`,
        `${plan.totalWeeks} weeks of sessions to run.`,
        "info",
        "/nurse/schedule"
      );
    }

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "plan.update",
      entity: "TreatmentPlan",
      entityId: id,
      after: { shared: plan.sharedWithNurse, status: plan.status },
    });

    return ok({ id, sharedWithNurse: plan.sharedWithNurse, status: plan.status });
  } catch (err) {
    return handleError(err);
  }
}

import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, BillingSettings } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getLatePolicy } from "@/lib/billing/settings";
import { ok, fail, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

const Save = z.object({
  windowHours: z.number().int("Whole hours").min(1, "At least 1 hour").max(72, "At most 72 hours"),
  rescheduleFee: z.number().int("Whole rupees").min(0).max(100_000),
  cancelFee: z.number().int("Whole rupees").min(0).max(100_000),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!can(session?.role, "billing.manage")) return fail("Not permitted", 403);
    return ok({ policy: await getLatePolicy() });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Change the late window and fees. Takes effect at once: the patient's screens,
 * the public pages that state the rule, and the charge itself all read it.
 * A fee already charged keeps the amount it was charged at.
 */
export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "billing.manage")) return fail("Not permitted", 403);
    const input = Save.parse(await req.json());
    await connectDB();

    // A server started before these fields existed would accept the save and keep nothing.
    if (!BillingSettings.schema.path("lateWindowHours")) {
      return fail("The server is running an older version and would not keep this. Restart it (stop it and run npm run dev again).", 500);
    }

    const before = await getLatePolicy();
    await BillingSettings.findOneAndUpdate(
      { singleton: "billing" },
      {
        $set: {
          lateWindowHours: input.windowHours,
          lateRescheduleFee: input.rescheduleFee,
          lateCancelFee: input.cancelFee,
          updatedBy: session!.sub,
        },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
    const after = await getLatePolicy();

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "billing.late_policy.update",
      entity: "BillingSettings",
      entityId: "billing",
      before,
      after,
    });

    return ok({ policy: after });
  } catch (err) {
    return handleError(err);
  }
}

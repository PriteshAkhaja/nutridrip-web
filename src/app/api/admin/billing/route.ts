import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, BillingSettings } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getBillingConfig } from "@/lib/billing/settings";
import { checkGstin, stateCodeFromGstin, stateName } from "@/lib/billing/gst";
import { ok, fail, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

const Save = z.object({
  gstEnabled: z.boolean(),
  gstin: z.string().max(20),
  address: z.string().max(400),
  terms: z.string().max(600),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!can(session?.role, "billing.manage")) return fail("Not permitted", 403);
    return ok({ config: await getBillingConfig() });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "billing.manage")) return fail("Not permitted", 403);

    const input = Save.parse(await req.json());
    const gstin = input.gstin.trim().toUpperCase();

    // Refused at the boundary rather than silently producing bills of supply:
    // switching GST on without a registration number would look like it
    // worked and quietly charge nothing on every invoice afterwards.
    if (input.gstEnabled && !gstin) {
      return fail("Enter your GSTIN before switching GST on — a supplier without one cannot charge it.", 422);
    }
    // Hard errors only. A failing check digit is a warning the form shows —
    // a validator that wrongly refuses a real registration would leave a
    // business unable to enter its own number, with no way past.
    const verdict = checkGstin(gstin);
    if (verdict.error) return fail(verdict.error, 422);

    await connectDB();
    const before = await getBillingConfig();

    await BillingSettings.findOneAndUpdate(
      { singleton: "billing" },
      {
        $set: {
          gstEnabled: input.gstEnabled,
          gstin,
          address: input.address.trim(),
          terms: input.terms.trim(),
          updatedBy: session!.sub,
        },
      },
      { upsert: true }
    );

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "billing.update",
      entity: "BillingSettings",
      entityId: "billing",
      // Every field the form writes, not just the two that felt important.
      // All four are printed on a legal tax invoice — the registered address
      // and the payment terms as much as the GSTIN — so a change to any of
      // them has to be answerable later. Recording a subset meant editing the
      // address left a row saying nothing had changed at all.
      before: {
        gstEnabled: before.gstEnabled,
        gstin: before.gstin,
        address: before.address,
        terms: before.terms,
      },
      after: {
        gstEnabled: input.gstEnabled,
        gstin,
        address: input.address.trim(),
        terms: input.terms.trim(),
      },
    });

    return ok({
      config: await getBillingConfig(),
      stateName: stateName(stateCodeFromGstin(gstin)),
    });
  } catch (err) {
    return handleError(err);
  }
}

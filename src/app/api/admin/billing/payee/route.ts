import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, BillingSettings } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getPayee } from "@/lib/billing/settings";
import { ok, fail, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

const blank = z.literal("");
const Save = z.object({
  upiId: z.union([blank, z.string().trim().regex(/^[\w.-]{2,}@[a-zA-Z]{2,}$/, "A UPI ID looks like name@bank")]),
  accountName: z.string().trim().max(80),
  bankName: z.string().trim().max(80),
  accountNo: z.union([blank, z.string().trim().regex(/^\d{6,20}$/, "Digits only, 6 to 20")]),
  ifsc: z.union([blank, z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "An IFSC is 11 characters, like HDFC0001234")]),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!can(session?.role, "billing.manage")) return fail("Not permitted", 403);
    return ok({ payee: await getPayee() });
  } catch (err) {
    return handleError(err);
  }
}

/** Where clinics pay for their orders. Shown to them on every order waiting for payment. */
export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "billing.manage")) return fail("Not permitted", 403);
    const input = Save.parse(await req.json());
    await connectDB();

    if (!BillingSettings.schema.path("payeeUpiId")) {
      return fail("The server is running an older version and would not keep this. Restart it (stop it and run npm run dev again).", 500);
    }
    // A bank account is no use without the rest of it.
    if (input.accountNo && (!input.ifsc || !input.accountName)) {
      return fail("Add the account name and IFSC for the bank account, or leave the account number blank", 422);
    }

    const before = await getPayee();
    await BillingSettings.findOneAndUpdate(
      { singleton: "billing" },
      {
        $set: {
          payeeUpiId: input.upiId,
          payeeAccountName: input.accountName,
          payeeBankName: input.bankName,
          payeeAccountNo: input.accountNo,
          payeeIfsc: input.ifsc,
          updatedBy: session!.sub,
        },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
    const after = await getPayee();

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "billing.payee.update",
      entity: "BillingSettings",
      entityId: "billing",
      before,
      after,
    });
    return ok({ payee: after });
  } catch (err) {
    return handleError(err);
  }
}

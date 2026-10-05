import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Invoice } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { notify } from "@/lib/notify";
import { PAY_METHODS, PAY_METHOD_LABEL, referenceProblem } from "@/lib/billing/order-payment";
import { ok, fail, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

const Input = z.object({
  method: z.enum(PAY_METHODS),
  reference: z.string().trim().max(40),
  /** YYYY-MM-DD, the day the money arrived. */
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date it was paid"),
});

/**
 * The team records a credit invoice paid outside the app -- NEFT, UPI to the
 * bank account, a cheque. (Paid online, an invoice marks itself paid.) The
 * route's id is the order's, as the invoice page's is.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "billing.manage")) return fail("Not permitted", 403);
    const { id } = await params;
    const input = Input.parse(await req.json());
    const problem = referenceProblem(input.reference);
    if (problem) return fail(problem, 422);
    const paidAt = new Date(`${input.paidOn}T12:00:00+05:30`);
    if (paidAt.getTime() > Date.now() + 86_400_000) return fail("The payment date cannot be in the future", 422);

    await connectDB();
    const invoice = await Invoice.findOneAndUpdate(
      { orderId: id, "payment.state": { $ne: "paid" } },
      {
        $set: {
          payment: {
            state: "paid",
            method: input.method,
            reference: input.reference.trim(),
            paidAt,
            recordedBy: session!.sub,
          },
        },
      },
      { new: true }
    ).lean<{ _id: unknown; invoiceNo: string; clinicId?: unknown; grandTotal?: number } | null>();
    if (!invoice) {
      const exists = await Invoice.exists({ orderId: id });
      return fail(
        exists ? "This invoice is already paid." : "Open the invoice first — it is raised when first opened.",
        409
      );
    }

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "invoice.payment.recorded",
      entity: "Invoice",
      entityId: String(invoice._id),
      after: {
        invoiceNo: invoice.invoiceNo,
        method: PAY_METHOD_LABEL[input.method],
        reference: input.reference.trim(),
        paidOn: input.paidOn,
      },
    });
    if (invoice.clinicId) {
      await notify(
        String(invoice.clinicId),
        `Invoice paid · ${invoice.invoiceNo}`,
        `Your ${PAY_METHOD_LABEL[input.method]} payment, ref ${input.reference.trim()}, has been received.`,
        "success",
        `/invoice/${id}`
      );
    }
    return ok({ invoice: { state: "paid" } });
  } catch (err) {
    return handleError(err);
  }
}

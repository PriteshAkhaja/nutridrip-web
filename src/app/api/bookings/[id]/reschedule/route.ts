import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Booking } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { canManageBooking } from "@/lib/auth/ownership";
import { inr } from "@/lib/billing/late-policy";
import { ok, fail, handleError } from "@/lib/api";
import { moveSlot, planMove } from "@/lib/booking/move";
import { paymentsEnabled } from "@/lib/payments/config";

const Input = z.object({
  scheduledAt: z.string().datetime(),
  /** The patient has seen the late fee and agreed to it. Required inside the window. */
  acceptFee: z.boolean().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);

    const { id } = await params;
    const { scheduledAt, acceptFee } = Input.parse(await req.json());
    await connectDB();

    const booking = await Booking.findById(id);
    if (!booking) return fail("Session not found", 404);
    if (!canManageBooking(session, booking)) return fail("Not permitted", 403);

    const planned = await planMove(session, booking, new Date(scheduledAt));
    if ("error" in planned) return fail(planned.error, planned.status);
    const { plan } = planned;

    if (plan.fee > 0) {
      // With online payment on, a late move is paid for first (POST
      // /api/payments, purpose "reschedule_fee"), and the move is made when the
      // fee arrives. Without it the fee is recorded as owed, once agreed to.
      if (paymentsEnabled()) {
        return fail(
          `Your slot is less than ${plan.windowHours} hours away, so moving it now costs ${inr(plan.fee)} — pay it to move.`,
          402,
          { code: "payment_required", fee: plan.fee, windowHours: plan.windowHours }
        );
      }
      if (!acceptFee) {
        return fail(
          `Your slot is less than ${plan.windowHours} hours away, so moving it now costs ${inr(plan.fee)} — the nurse is already on their way with your batch drawn.`,
          409,
          { fee: plan.fee, windowHours: plan.windowHours }
        );
      }
      // A server started before charges existed would move the session and lose the fee.
      if (!Booking.schema.path("charges")) {
        return fail(
          "The server is running an older version and would not record the fee. Restart it (stop it and run npm run dev again).",
          500
        );
      }
    }

    // Every rule is checked again inside the move itself: the time may have
    // gone, or the late window opened, since the check above.
    const moved = await moveSlot(session, id, new Date(scheduledAt), { acceptedFee: plan.fee > 0 ? plan.fee : 0 });
    if ("error" in moved) {
      const fee = Number(moved.extra?.fee ?? 0);
      if (fee > 0 && paymentsEnabled()) {
        return fail(`${moved.error} Pay it to move.`, 402, { ...moved.extra, code: "payment_required" });
      }
      return fail(moved.error, moved.status, moved.extra);
    }
    return ok({ scheduledAt: moved.scheduledAt.toISOString(), rescheduleCount: moved.rescheduleCount, fee: moved.fee });
  } catch (err) {
    return handleError(err);
  }
}

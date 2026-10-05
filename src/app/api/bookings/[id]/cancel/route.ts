import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Booking } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { canManageBooking } from "@/lib/auth/ownership";
import { notify } from "@/lib/notify";
import { ok, fail, handleError } from "@/lib/api";

import { getLatePolicy } from "@/lib/billing/settings";
import { lateFee } from "@/lib/billing/late-policy";
import { syncBookingMoney } from "@/lib/payments/money";

const Input = z.object({ reason: z.string().max(500).optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);

    const { id } = await params;
    const { reason } = Input.parse(await req.json().catch(() => ({})));
    await connectDB();

    const booking = await Booking.findById(id);
    if (!booking) return fail("Session not found", 404);

    const isOwner = session.role === "patient" && String(booking.patientId) === session.sub;
    if (!canManageBooking(session, booking)) return fail("Not permitted", 403);

    if (["completed", "in_progress"].includes(booking.status)) {
      return fail("A session that has started cannot be cancelled", 409);
    }
    if (booking.status === "cancelled") return ok({ alreadyCancelled: true, fee: 0, refunded: 0 });
    // Declined by the physician: already ended, and already refunded in full. A
    // cancel now would mark it the patient's own late cancellation -- a late
    // fee on a session they were never going to have.
    if (booking.status === "rejected") {
      return fail("This session was declined by the physician and has already ended. Nothing to cancel.", 409);
    }

    // Once the slot is inside the window the nurse is dispatched with the batch
    // drawn, and that stays true after the slot time passes — a negative
    // hoursOut is the latest possible cancellation, not an early one.
    //
    // The fee is the patient's for their own late cancellation. A clinic or the
    // team cancelling is their decision, not the patient's, and costs the
    // patient nothing. It is recorded on the booking now -- it used to be worked
    // out and then kept nowhere but the audit trail.
    const hoursOut = (booking.scheduledAt.getTime() - Date.now()) / 3_600_000;
    const fee = isOwner ? lateFee(await getLatePolicy(), hoursOut, "late_cancel") : 0;

    // A server started before charges existed would cancel and lose the fee.
    if (fee > 0 && !Booking.schema.path("charges")) {
      return fail(
        "The server is running an older version and would not record the fee. Restart it (stop it and run npm run dev again).",
        500
      );
    }

    booking.status = "cancelled";
    booking.cancelledAt = new Date();
    booking.cancelReason = reason;
    // Whose decision it was decides the refund: a patient's own late cancel keeps the fee.
    booking.cancelledByRole = session.role;
    if (fee > 0) {
      booking.charges = [
        ...(booking.charges ?? []),
        { kind: "late_cancel", amount: fee, at: new Date(), byId: session.sub, note: reason || undefined },
      ];
    }
    await booking.save();

    // Whatever was paid for it goes back now (less a late fee the patient
    // incurred). A refund that cannot be made this minute does not undo the
    // cancellation: it is recorded, the admins are told, and it is retried.
    const money = await syncBookingMoney(id, { byId: session.sub }).catch((err) => {
      console.error("[cancel] refund:", err);
      return null;
    });

    // The nurse has this on their route; they need to know it is off.
    await notify(
      booking.nurseId ? String(booking.nurseId) : null,
      `Session cancelled · ${booking.bookingNo}`,
      reason || "The patient cancelled.",
      "warning",
      "/nurse"
    );
    if (!isOwner) {
      await notify(
        String(booking.patientId),
        `Your session was cancelled · ${booking.bookingNo}`,
        `${reason || "Contact us if this was not expected."}${
          money?.refunded ? " Everything you paid for it is being refunded." : ""
        }`,
        "warning",
        "/app/sessions"
      );
    }

    await AuditLog.create({
      actorId: session.sub,
      actorRole: session.role,
      action: "booking.cancel",
      entity: "Booking",
      entityId: id,
      after: { reason, fee, ...(money?.refunded ? { refundedPaise: money.refunded } : {}) },
    });

    return ok({
      cancelled: true,
      fee,
      hoursOut: Math.round(hoursOut * 10) / 10,
      /** Paise on their way back, and whether a refund could not be made yet. */
      refunded: money?.refunded ?? 0,
      refundFailed: money?.refundFailed ?? false,
    });
  } catch (err) {
    return handleError(err);
  }
}

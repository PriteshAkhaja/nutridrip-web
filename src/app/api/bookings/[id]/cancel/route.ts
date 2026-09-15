import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Booking } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { canManageBooking } from "@/lib/auth/ownership";
import { notify } from "@/lib/notify";
import { ok, fail, handleError } from "@/lib/api";

const Input = z.object({ reason: z.string().max(500).optional() });

import { LATE_CHANGE_HOURS as LATE_CANCEL_HOURS, LATE_CANCEL_FEE_INR as LATE_CANCEL_FEE } from "@/lib/clinical/slots";

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
    if (booking.status === "cancelled") return ok({ alreadyCancelled: true, fee: 0 });

    // Once the slot is inside the window the nurse is dispatched with the batch
    // drawn, and that stays true after the slot time passes — a negative
    // hoursOut is the latest possible cancellation, not an early one.
    const hoursOut = (booking.scheduledAt.getTime() - Date.now()) / 3_600_000;
    const fee = hoursOut < LATE_CANCEL_HOURS ? LATE_CANCEL_FEE : 0;

    booking.status = "cancelled";
    booking.cancelledAt = new Date();
    booking.cancelReason = reason;
    if (fee > 0) booking.paymentStatus = "unpaid";
    await booking.save();

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
        reason || "Contact us if this was not expected.",
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
      after: { reason, fee },
    });

    return ok({ cancelled: true, fee, hoursOut: Math.round(hoursOut * 10) / 10 });
  } catch (err) {
    return handleError(err);
  }
}

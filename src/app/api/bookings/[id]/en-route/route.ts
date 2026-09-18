import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Booking, User } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { nurseOwns } from "@/lib/auth/ownership";
import { etaBetween, etaLabel } from "@/lib/clinical/nurse-options";
import { notify } from "@/lib/notify";
import { ok, fail, handleError } from "@/lib/api";

/** Only a session that has not started yet can be set off towards. */
const CAN_SET_OFF = ["approved", "nurse_assigned"];

/**
 * The nurse says they have left for the patient.
 *
 * `en_route` existed in the status list and on the patient's timeline from the
 * beginning, and nothing ever wrote it — so that stage could never light up and
 * the patient went straight from "Nurse assigned" to the nurse arriving. This
 * is the missing half.
 *
 * The distance is worked out here rather than sent by the phone: a browser can
 * claim any position, and this figure is shown to a patient as how long they
 * are waiting.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "infusion.prepare")) return fail("Not permitted", 403);

    const { id } = await params;
    await connectDB();

    const booking = await Booking.findById(id);
    if (!booking) return fail("Session not found", 404);
    if (!nurseOwns(session, booking)) return fail("This session is not on your route", 403);

    if (booking.status === "en_route") {
      // Pressed twice, or pressed on a phone that had queued it offline.
      return ok({ alreadyEnRoute: true, etaMinutes: booking.etaMinutes ?? null });
    }
    if (!CAN_SET_OFF.includes(booking.status)) {
      return fail(
        booking.status === "in_progress"
          ? "This session has already started."
          : "That session is not one you can set off for.",
        409
      );
    }

    const [nurse, patient] = await Promise.all([
      User.findById(booking.nurseId).select("nurse.latitude nurse.longitude").lean<{
        nurse?: { latitude?: number; longitude?: number };
      } | null>(),
      User.findById(booking.patientId).select("name patient.latitude patient.longitude").lean<{
        name?: string;
        patient?: { latitude?: number; longitude?: number };
      } | null>(),
    ]);

    // Null when either end has no coordinates. The stage still shows; it just
    // carries no number, which beats inventing one.
    const etaMinutes = etaBetween(nurse?.nurse, patient?.patient);

    booking.status = "en_route";
    booking.enRouteAt = new Date();
    if (etaMinutes !== null) booking.etaMinutes = etaMinutes;
    await booking.save();

    await notify(
      String(booking.patientId),
      "Your nurse is on the way",
      `${booking.dripName ?? "Your session"} · ${etaLabel(etaMinutes)}.`,
      "info",
      "/app"
    );

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "session.en_route",
      entity: "Booking",
      entityId: id,
      after: { bookingNo: booking.bookingNo, etaMinutes: etaMinutes ?? null },
    });

    return ok({ status: booking.status, etaMinutes: etaMinutes ?? null });
  } catch (err) {
    return handleError(err);
  }
}

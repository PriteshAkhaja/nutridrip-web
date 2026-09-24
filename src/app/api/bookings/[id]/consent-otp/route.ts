import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Booking, User } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { nurseOwns } from "@/lib/auth/ownership";
import { notify } from "@/lib/notify";
import { CODE_FOR, issueSessionCode, sessionCodesReady } from "@/lib/clinical/session-code";
import { RX_OTP_TTL_MS } from "@/lib/clinical/prescription";
import { ok, fail, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Send the patient a consent code.
 *
 * Consent "by code" used to be the last four digits of the patient's own phone
 * number, typed by the nurse -- who had the number on screen. Nothing reached
 * the patient and nothing was checked, so it recorded the nurse's say-so as the
 * patient's consent. Now a code goes to the patient, appears on their home
 * screen, and only the six digits they read out record their consent (checked
 * in the consent route).
 *
 * Not queued offline: the nurse needs the answer now to keep working.
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
    if (["completed", "cancelled", "rejected"].includes(booking.status)) {
      return fail("That session is closed — its consent record is part of the report now", 409);
    }
    if (booking.consent?.givenAt) return fail("Consent has already been captured for this session", 409);
    // Consent is read aloud from the drugs and doses, so it waits for the same
    // proof of presence as the prescription.
    if (!booking.rxUnlockedAt) {
      return fail("Open the prescription first — ask the patient to read out the code sent to their phone", 409);
    }
    if (!sessionCodesReady()) {
      return fail(
        "The server is running an older version and cannot send consent codes yet. Restart it (stop it and run npm run dev again), then try again.",
        500
      );
    }

    const patient = await User.findById(booking.patientId).lean<{ name: string; phone?: string } | null>();
    if (!patient?.phone) {
      return fail("This patient has no phone number on file, so a code cannot be sent. Use the signature instead.", 409);
    }

    const issued = await issueSessionCode({ bookingId: booking._id, phone: patient.phone, purpose: "consent" });
    if ("error" in issued) return fail(issued.error, issued.status);

    // No SMS gateway yet: the code reaches the patient through their app -- the
    // card on their home screen, and the bell.
    await notify(
      String(booking.patientId),
      "Your nurse is asking for your consent code",
      `Read this code to the nurse ${CODE_FOR.consent}: ${issued.code}`,
      "info",
      "/app"
    );
    if (process.env.NODE_ENV !== "production") console.log(`[consent-otp] ${booking.bookingNo} → ${patient.phone} → ${issued.code}`);

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "consent.code.sent",
      entity: "Booking",
      entityId: id,
      after: { bookingNo: booking.bookingNo },
    });

    return ok({
      sent: true,
      sentTo: patient.phone.replace(/.(?=.{4})/g, "•"),
      expiresInSec: RX_OTP_TTL_MS / 1000,
    });
  } catch (err) {
    return handleError(err);
  }
}

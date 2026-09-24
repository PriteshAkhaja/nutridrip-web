import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Booking, Drip, User } from "@/lib/models";
import { checkSessionCode } from "@/lib/clinical/session-code";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { nurseOwns } from "@/lib/auth/ownership";
import {
  componentsForConsent,
  consentDocument,
  CURRENT_CONSENT_VERSION,
} from "@/lib/clinical/consent";
import { ok, fail, handleError } from "@/lib/api";

const Input = z.object({
  signatureDataUrl: z.string().max(500_000).optional(),
  /** The six digits the patient read out from their own screen. */
  viaOtp: z.string().regex(/^\d{6}$/, "Enter the six digits the patient reads out").optional(),
  /**
   * Which wording the screen showed. Only the *name* of the document is taken
   * from the caller — the text itself is looked up here, so a crafted request
   * cannot file a record claiming the patient agreed to something else.
   */
  version: z.string().default(CURRENT_CONSENT_VERSION),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "infusion.prepare")) return fail("Not permitted", 403);

    const { id } = await params;
    await connectDB();

    // Authorise before validating: someone with no business here should be
    // told that, not handed a description of the schema.
    const booking = await Booking.findById(id);
    if (!booking) return fail("Session not found", 404);
    if (!nurseOwns(session, booking)) return fail("This session is not on your route", 403);
    if (["completed", "cancelled", "rejected"].includes(booking.status)) {
      return fail("That session is closed — its consent record is part of the report now", 409);
    }
    if (booking.consent?.givenAt) {
      return fail("Consent has already been captured for this session", 409);
    }
    // Consent is read aloud from the drugs and doses, and freezes them onto the
    // record — so it waits for the same proof of presence as the prescription.
    if (!booking.rxUnlockedAt) {
      return fail(
        "Open the prescription first — ask the patient to read out the code sent to their phone",
        409
      );
    }

    const input = Input.parse(await req.json());
    // Neither a signature nor a verified code is not consent.
    if (!input.signatureDataUrl && !input.viaOtp) {
      return fail("Consent needs either a signature or a verified code", 422);
    }

    /**
     * A code is consent only if it is the one sent to this patient for this
     * session. It used to be any four digits -- the last four of the patient's
     * number, which the nurse had on screen -- and nothing checked it.
     */
    if (input.viaOtp && !input.signatureDataUrl) {
      const patient = await User.findById(booking.patientId).select("phone").lean<{ phone?: string } | null>();
      if (!patient?.phone) return fail("This patient has no phone number on file. Use the signature instead.", 409);
      const checked = await checkSessionCode({
        bookingId: booking._id,
        phone: patient.phone,
        purpose: "consent",
        code: input.viaOtp,
      });
      if (!checked.ok) return fail(checked.error, checked.status);
    }

    const doc = consentDocument(input.version);
    if (!doc) {
      // The screen sent a version this server does not publish — it is running
      // older or newer code. Refusing beats filing a record whose wording
      // nobody can produce.
      return fail("That consent form is not one this server knows. Reload and try again.", 422);
    }

    // The doses as they stand right now, frozen onto the record. Read here and
    // not taken from the request for the same reason as the text above.
    const drip = await Drip.findById(booking.dripId).lean<{
      ingredients?: Array<{ name?: string; dose: number; unit: string }>;
    } | null>();

    booking.consent = {
      ...input,
      // That a checked code was given, not the code itself: it is spent, and
      // the record says how consent was given, not a secret.
      viaOtp: input.viaOtp && !input.signatureDataUrl ? "verified" : undefined,
      version: doc.version,
      affirmation: doc.affirmation,
      risks: doc.risks,
      components: componentsForConsent(drip?.ingredients),
      givenAt: new Date(),
    };
    await booking.save();

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "consent.captured",
      entity: "Booking",
      entityId: id,
      after: {
        version: doc.version,
        method: input.viaOtp ? "otp" : "signature",
        components: booking.consent.components?.length ?? 0,
      },
    });

    return ok({ consentAt: booking.consent.givenAt });
  } catch (err) {
    return handleError(err);
  }
}

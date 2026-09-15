import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Booking } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { nurseOwns } from "@/lib/auth/ownership";
import { ok, fail, handleError } from "@/lib/api";

const Input = z.object({
  signatureDataUrl: z.string().max(500_000).optional(),
  viaOtp: z.string().max(8).optional(),
  version: z.string().default("v2.1"),
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

    const input = Input.parse(await req.json());
    // Neither a signature nor a verified code is not consent.
    if (!input.signatureDataUrl && !input.viaOtp) {
      return fail("Consent needs either a signature or a verified code", 422);
    }

    booking.consent = { ...input, givenAt: new Date() };
    await booking.save();

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "consent.captured",
      entity: "Booking",
      entityId: id,
      after: { version: input.version, method: input.viaOtp ? "otp" : "signature" },
    });

    return ok({ consentAt: booking.consent.givenAt });
  } catch (err) {
    return handleError(err);
  }
}

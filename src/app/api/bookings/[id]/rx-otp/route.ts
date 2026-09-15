import { z } from "zod";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Booking, OtpToken, User } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { nurseOwns } from "@/lib/auth/ownership";
import { notify } from "@/lib/notify";
import { canOpenPrescription, RX_OTP_MAX_ATTEMPTS, RX_OTP_TTL_MS } from "@/lib/clinical/prescription";
import { ok, fail, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

const Input = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("request") }),
  z.object({ mode: z.literal("verify"), code: z.string().length(6) }),
]);

/** One live code at a time per number; asking again replaces the last. */
const RATE_WINDOW_MS = 10 * 60_000;
const RATE_LIMIT = 6;

/**
 * The patient's code, which opens the prescription for one session.
 *
 * Sent to the patient's own phone — they read it to the nurse standing in
 * front of them. That is the whole control: it proves the nurse is where they
 * say they are before the drugs and doses are shown.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "infusion.prepare")) return fail("Not permitted", 403);

    const { id } = await params;
    await connectDB();

    // Authorise before parsing: somebody with no business on this session gets
    // told that, not a description of the request body.
    const booking = await Booking.findById(id);
    if (!booking) return fail("Session not found", 404);
    if (!nurseOwns(session, booking)) return fail("This session is not on your route", 403);
    if (!canOpenPrescription(booking.status)) {
      return fail("That session has no prescription to open", 409);
    }

    const patient = await User.findById(booking.patientId).lean<{
      name: string;
      phone?: string;
    } | null>();
    if (!patient?.phone) {
      return fail("This patient has no phone number on file, so a code cannot be sent", 409);
    }

    const input = Input.parse(await req.json());

    /* ---------------- request a code ---------------- */
    if (input.mode === "request") {
      if (booking.rxUnlockedAt) return ok({ alreadyUnlocked: true });

      const recent = await OtpToken.countDocuments({
        phone: patient.phone,
        purpose: "prescription",
        createdAt: { $gt: new Date(Date.now() - RATE_WINDOW_MS) },
      });
      if (recent >= RATE_LIMIT) {
        return fail("Too many codes requested for this patient. Wait a few minutes.", 429);
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));
      await OtpToken.create({
        phone: patient.phone,
        purpose: "prescription",
        bookingId: booking._id,
        codeHash: await bcrypt.hash(code, 10),
        expiresAt: new Date(Date.now() + RX_OTP_TTL_MS),
      });

      // No SMS gateway yet, so the code reaches the patient through the bell in
      // their own app, and is logged server-side. In development it is echoed
      // back so the flow can be walked end to end.
      await notify(
        String(booking.patientId),
        "Your nurse is asking for your code",
        `Read this code to the nurse to open your prescription: ${code}`,
        "info",
        `/app/session/${String(booking._id)}`
      );
      if (process.env.NODE_ENV !== "production") {
        console.log(`[rx-otp] ${booking.bookingNo} → ${patient.phone} → ${code}`);
      }

      return ok({
        sent: true,
        sentTo: patient.phone.replace(/.(?=.{4})/g, "•"),
        expiresInSec: RX_OTP_TTL_MS / 1000,
        devCode: process.env.NODE_ENV === "production" ? undefined : code,
      });
    }

    /* ---------------- verify it ---------------- */
    if (booking.rxUnlockedAt) return ok({ unlocked: true, alreadyUnlocked: true });

    /**
     * Every code still alive for this session is accepted, not only the newest.
     *
     * Pressing Resend leaves two codes sitting in the patient's notifications,
     * and reading out the older one is the natural mistake — it is right there
     * on the screen. Accepting only the latest turned that into "that code is
     * not right", which is both untrue and sends the nurse round the loop
     * again, adding a third code.
     *
     * Scoped to this booking, so a code for another session — or a sign-in code
     * for the same phone — still cannot open this prescription.
     */
    const live = await OtpToken.find({
      phone: patient.phone,
      purpose: "prescription",
      bookingId: booking._id,
      consumedAt: null,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (live.length === 0) return fail("That code has expired — send a new one", 400);

    // The newest token carries the attempt count for the session, so guessing
    // cannot be reset simply by asking for another code.
    const newest = live[0];
    if (newest.attempts >= RX_OTP_MAX_ATTEMPTS) {
      return fail("Too many attempts. Send the patient a new code.", 429);
    }

    let matched: (typeof live)[number] | null = null;
    for (const candidate of live) {
      if (await bcrypt.compare(input.code, candidate.codeHash)) {
        matched = candidate;
        break;
      }
    }

    if (!matched) {
      newest.attempts += 1;
      await newest.save();
      return fail("That code is not right", 401);
    }

    matched.consumedAt = new Date();
    await matched.save();

    // One code opens the session; the spares die with it rather than lingering.
    await OtpToken.updateMany(
      {
        purpose: "prescription",
        bookingId: booking._id,
        consumedAt: null,
      },
      { $set: { consumedAt: new Date() } }
    );

    booking.rxUnlockedAt = new Date();
    booking.rxUnlockedBy = session!.sub;
    // Recorded explicitly, even though it is the default reading: rxLockState's
    // fallback to "code" exists for rows written before the field did, and it
    // can only ever be retired if new rows stop landing in that same bucket.
    booking.rxUnlockMethod = "code";
    await booking.save();

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "prescription.unlocked",
      entity: "Booking",
      entityId: id,
      after: { bookingNo: booking.bookingNo, patient: patient.name },
    });

    return ok({ unlocked: true, unlockedAt: booking.rxUnlockedAt });
  } catch (err) {
    return handleError(err);
  }
}

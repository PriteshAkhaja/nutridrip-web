import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Booking, User } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { nurseOwns } from "@/lib/auth/ownership";
import { notify, notifyRole } from "@/lib/notify";
import { canOpenPrescription, describeWait, RX_OVERRIDE_MIN_REASON } from "@/lib/clinical/prescription";
import { ok, fail, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

const Ask = z.object({
  mode: z.literal("ask"),
  reason: z.string().min(RX_OVERRIDE_MIN_REASON).max(500),
});

const Decide = z.object({
  mode: z.literal("decide"),
  decision: z.enum(["grant", "deny"]),
  note: z.string().max(500).optional(),
});

/** The nurse proceeding on their own. Both fields are the price of doing so. */
const BreakGlass = z.object({
  mode: z.literal("break-glass"),
  reason: z.string().min(RX_OVERRIDE_MIN_REASON).max(500),
  identityCheckedBy: z.string().min(3).max(200),
});

const Input = z.discriminatedUnion("mode", [Ask, Decide, BreakGlass]);

/**
 * Opening a prescription when the patient cannot give a code.
 *
 * A flat battery must not stop a nurse treating somebody, so there are two
 * ways through: a physician authorises it, or — if no physician answers — the
 * nurse proceeds under their own name. The second is not hidden, but it is
 * expensive: it demands a reason and how identity was checked instead, and it
 * tells the physician, the admins and the patient that it happened.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);

    const { id } = await params;
    await connectDB();

    const booking = await Booking.findById(id);
    if (!booking) return fail("Session not found", 404);
    if (!canOpenPrescription(booking.status)) {
      return fail("That session has no prescription to open", 409);
    }

    const input = Input.parse(await req.json());
    const patient = await User.findById(booking.patientId).lean<{ name: string } | null>();
    const patientName = patient?.name ?? "the patient";

    /* ---------------- nurse asks a physician ---------------- */
    if (input.mode === "ask") {
      if (!nurseOwns(session, booking)) return fail("This session is not on your route", 403);
      if (booking.rxUnlockedAt) return ok({ alreadyUnlocked: true });

      /**
       * Chasing an unanswered request must not restart the clock. The
       * physician's queue is ordered by requestedAt, so moving it on every nudge
       * would send the nurse who has waited longest to the back of the queue —
       * exactly backwards. The first ask stands; the nudge is recorded beside it.
       */
      const chasing = Boolean(booking.rxOverride?.requestedAt) && !booking.rxOverride?.deniedAt;
      const now = new Date();
      booking.rxOverride = {
        ...(booking.rxOverride ?? {}),
        requestedAt: chasing ? booking.rxOverride!.requestedAt : now,
        requestedBy: chasing ? booking.rxOverride!.requestedBy : session.sub,
        lastAskedAt: now,
        reason: input.reason,
        // A fresh ask clears any previous refusal.
        deniedAt: undefined,
        deniedBy: undefined,
        denyReason: undefined,
      };
      await booking.save();

      /**
       * The first ask goes to the physician who owns the session. A CHASE goes
       * to everybody.
       *
       * A nurse presses chase because the first person did not answer, so
       * ringing that same person again is the one thing that cannot help. The
       * escalations queue was always visible to every physician; what was
       * missing was anyone being told to look at it. Admins are copied because
       * a nurse standing in a front room with no physician reachable is an
       * operational problem as much as a clinical one.
       */
      const nurse = await User.findById(session.sub).lean<{ name: string } | null>();
      const who = nurse?.name ?? "A nurse";
      const waited = describeWait(booking.rxOverride?.requestedAt);

      if (chasing) {
        await notifyRole(
          ["doctor", "admin", "superadmin"],
          `No physician has answered · ${booking.bookingNo}`,
          `${who} is with ${patientName}, who cannot give a code${waited ? `, and has been ${waited}` : ""}. ${input.reason}`,
          "error",
          "/doctor/adverse"
        );
      } else {
        const title = `Prescription override requested · ${booking.bookingNo}`;
        const body = `${patientName} cannot give a code. ${input.reason}`;
        if (booking.doctorId) await notify(String(booking.doctorId), title, body, "warning", "/doctor/adverse");
        else await notifyRole("doctor", title, body, "warning", "/doctor/adverse");
      }

      await AuditLog.create({
        actorId: session.sub,
        actorRole: session.role,
        action: chasing ? "prescription.override.chased" : "prescription.override.requested",
        entity: "Booking",
        entityId: id,
        after: { reason: input.reason },
      });

      return ok({ requested: true, chased: chasing });
    }

    /* ---------------- physician decides ---------------- */
    if (input.mode === "decide") {
      if (!["doctor", "superadmin"].includes(session.role)) {
        return fail("Only a physician can authorise this", 403);
      }
      if (!booking.rxOverride?.requestedAt) return fail("Nothing has been requested on this session", 409);
      if (booking.rxUnlockedAt) return ok({ alreadyUnlocked: true });

      if (input.decision === "deny") {
        booking.rxOverride = {
          ...(booking.rxOverride ?? {}),
          deniedAt: new Date(),
          deniedBy: session.sub,
          denyReason: input.note,
        };
        await booking.save();

        await notify(
          booking.nurseId ? String(booking.nurseId) : null,
          `Override refused · ${booking.bookingNo}`,
          input.note || "Ask the patient for their code, or stand the session down.",
          "error",
          `/nurse/session/${id}/rx`
        );
        await AuditLog.create({
          actorId: session.sub,
          actorRole: session.role,
          action: "prescription.override.denied",
          entity: "Booking",
          entityId: id,
          after: { note: input.note },
        });
        return ok({ denied: true });
      }

      booking.rxUnlockedAt = new Date();
      booking.rxUnlockedBy = session.sub;
      booking.rxUnlockMethod = "physician";
      booking.rxOverride = {
        ...(booking.rxOverride ?? {}),
        grantedAt: new Date(),
        grantedBy: session.sub,
      };
      await booking.save();

      const doctor = await User.findById(session.sub).lean<{ name: string } | null>();
      await notify(
        booking.nurseId ? String(booking.nurseId) : null,
        `Prescription opened · ${booking.bookingNo}`,
        `${doctor?.name ?? "The physician"} authorised it without a code.`,
        "success",
        `/nurse/session/${id}/rx`
      );
      await notify(
        String(booking.patientId),
        "Your prescription was opened by your physician",
        `${doctor?.name ?? "Your physician"} authorised your nurse to see it without your code.`,
        "info",
        `/app/session/${id}`
      );

      await AuditLog.create({
        actorId: session.sub,
        actorRole: session.role,
        action: "prescription.override.granted",
        entity: "Booking",
        entityId: id,
        after: { reason: booking.rxOverride?.reason },
      });

      return ok({ unlocked: true, method: "physician" });
    }

    /* ---------------- nurse proceeds alone ---------------- */
    if (!nurseOwns(session, booking)) return fail("This session is not on your route", 403);
    if (booking.rxUnlockedAt) return ok({ alreadyUnlocked: true });

    booking.rxUnlockedAt = new Date();
    booking.rxUnlockedBy = session.sub;
    booking.rxUnlockMethod = "break_glass";
    booking.rxOverride = {
      ...(booking.rxOverride ?? {}),
      requestedAt: booking.rxOverride?.requestedAt ?? new Date(),
      requestedBy: booking.rxOverride?.requestedBy ?? session.sub,
      reason: input.reason,
      identityCheckedBy: input.identityCheckedBy,
      grantedAt: new Date(),
      grantedBy: session.sub,
    };
    await booking.save();

    const nurse = await User.findById(session.sub).lean<{ name: string } | null>();
    const who = nurse?.name ?? "A nurse";
    const summary = `${who} opened it without a code. ${input.reason} Identity checked by: ${input.identityCheckedBy}`;

    // Everyone with a reason to know, including the patient — it is their record.
    if (booking.doctorId) {
      await notify(String(booking.doctorId), `Prescription opened without a code · ${booking.bookingNo}`, summary, "error", "/doctor/adverse");
    } else {
      await notifyRole("doctor", `Prescription opened without a code · ${booking.bookingNo}`, summary, "error", "/doctor/adverse");
    }
    await notifyRole(["admin", "superadmin"], `Prescription opened without a code · ${booking.bookingNo}`, summary, "error", "/admin");
    await notify(
      String(booking.patientId),
      "Your prescription was opened without your code",
      `${who} could not take a code from you, so they proceeded and recorded why: ${input.reason}`,
      "warning",
      `/app/session/${id}`
    );

    await AuditLog.create({
      actorId: session.sub,
      actorRole: session.role,
      action: "prescription.override.break_glass",
      entity: "Booking",
      entityId: id,
      after: { reason: input.reason, identityCheckedBy: input.identityCheckedBy, patient: patientName },
    });

    return ok({ unlocked: true, method: "break_glass" });
  } catch (err) {
    return handleError(err);
  }
}

import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Booking } from "@/lib/models";
import { notify, notifyRole } from "@/lib/notify";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { nurseOwns } from "@/lib/auth/ownership";
import { ok, fail, handleError } from "@/lib/api";

const Input = z.object({
  symptoms: z.array(z.string()).min(1),
  severity: z.enum(["mild", "moderate", "severe"]),
  actionsTaken: z.array(z.string()).default([]),
  infusionStopped: z.boolean().default(false),
  notes: z.string().max(4000).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "infusion.prepare")) return fail("Not permitted", 403);

    const { id } = await params;
    const input = Input.parse(await req.json());
    await connectDB();

    const booking = await Booking.findById(id);
    if (!booking) return fail("Session not found", 404);
    if (!nurseOwns(session, booking)) return fail("This session is not on your route", 403);
    // An event is filed against the session it happened in. A session that was
    // cancelled or declined never ran, so nothing can have happened during it.
    if (["cancelled", "rejected", "awaiting_review"].includes(booking.status)) {
      return fail("That session did not run, so there is nothing to report against it", 409);
    }

    booking.adverseEvents.push({
      ...input,
      at: new Date(),
      reportedBy: session!.sub,
      escalatedToDoctorId: booking.doctorId,
    });
    // Stopping the infusion ends the session; the physician takes it from here.
    // Stopping the infusion ends the session; the physician takes it from here.
    // A session already closed keeps the time it actually closed.
    if (input.infusionStopped && booking.status !== "completed") {
      booking.status = "completed";
      booking.completedAt = booking.completedAt ?? new Date();
    }
    await booking.save();

    const summary = `${input.symptoms.join(", ")}${input.infusionStopped ? " · infusion stopped" : ""}`;
    if (booking.doctorId) {
      await notify(
        String(booking.doctorId),
        `Adverse event · ${booking.bookingNo}`,
        summary,
        "error",
        "/doctor/adverse"
      );
    } else {
      await notifyRole("doctor", `Adverse event · ${booking.bookingNo}`, summary, "error", "/doctor/adverse");
    }
    if (input.severity === "severe") {
      await notifyRole("admin", `Severe adverse event · ${booking.bookingNo}`, summary, "error", "/doctor/adverse");
    }

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "adverse.reported",
      entity: "Booking",
      entityId: id,
      after: input,
    });

    return ok({ reported: true, escalatedTo: booking.doctorId ? String(booking.doctorId) : null });
  } catch (err) {
    return handleError(err);
  }
}

const Acknowledge = z.object({
  eventId: z.string(),
  determination: z.string().min(1).max(2000),
});

/**
 * The physician's determination on a filed event. This is what closes it, and
 * what takes it off the escalations queue — a nurse cannot mark one resolved.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !["doctor", "superadmin"].includes(session.role)) {
      return fail("Only a physician can close an adverse event", 403);
    }

    const { id } = await params;
    const { eventId, determination } = Acknowledge.parse(await req.json());
    await connectDB();

    const booking = await Booking.findById(id);
    if (!booking) return fail("Session not found", 404);

    const event = booking.adverseEvents?.id(eventId);
    if (!event) return fail("That report is not on this session", 404);
    if (event.acknowledgedAt) return fail("That report has already been closed", 409);

    event.determination = determination;
    event.acknowledgedAt = new Date();
    event.acknowledgedBy = session.sub;
    await booking.save();

    await notify(
      booking.nurseId ? String(booking.nurseId) : null,
      `Your report was reviewed · ${booking.bookingNo}`,
      determination,
      "info",
      `/nurse/session/${id}/report`
    );

    await AuditLog.create({
      actorId: session.sub,
      actorRole: session.role,
      action: "adverse.closed",
      entity: "Booking",
      entityId: id,
      after: { eventId, determination },
    });

    return ok({ closed: true, eventId });
  } catch (err) {
    return handleError(err);
  }
}

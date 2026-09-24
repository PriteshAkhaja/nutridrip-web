import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Booking } from "@/lib/models";
import { notify } from "@/lib/notify";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { nurseOwns } from "@/lib/auth/ownership";
import { componentsForDrip } from "@/lib/clinical/components";
import { blockedByVitals, needsPrescription } from "@/lib/clinical/checklist";
import { labelFor } from "@/components/ui/Pill";
import { ok, fail, handleError } from "@/lib/api";

const Input = z.object({ key: z.string(), done: z.boolean().default(true) });

/** A session can only be worked once a physician has approved it and it has an owner. */
const WORKABLE = ["approved", "nurse_assigned", "en_route", "in_progress", "completed"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "infusion.prepare")) return fail("Not permitted", 403);

    const { id } = await params;
    const { key, done } = Input.parse(await req.json());
    await connectDB();

    const booking = await Booking.findById(id);
    if (!booking) return fail("Session not found", 404);
    if (!nurseOwns(session, booking)) return fail("This session is not on your route", 403);
    if (!WORKABLE.includes(booking.status)) {
      return fail(`This session is ${labelFor(booking.status).toLowerCase()} — the checklist opens once a physician approves it`, 409);
    }

    const index = booking.checklist.findIndex((s: { key: string }) => s.key === key);
    if (index === -1) return fail("Step not found on this session", 404);

    // Before the sequence rule, so a nurse is told the real reason: past the
    // doorstep checks nothing moves until the patient's code has been read.
    // Reopening a step is still allowed — undoing a tick needs no proof.
    if (done && needsPrescription(key) && !booking.rxUnlockedAt) {
      return fail(
        "Open the prescription first — ask the patient to read out the code sent to their phone",
        409
      );
    }

    // The checklist is a sequence: a step cannot be ticked while an earlier
    // mandatory one is still open.
    const blocking = booking.checklist
      .slice(0, index)
      .find((s: { mandatory: boolean; doneAt?: Date }) => s.mandatory && !s.doneAt);
    if (done && blocking) {
      return fail(`Complete "${blocking.label}" first`, 409);
    }

    const step = booking.checklist[index];

    // A step that opens a sub-screen is a record, not a tick. Closing it
    // without the record would let a nurse skip the very thing the step exists
    // for — and for baseline vitals that is the whole safety gate, because a
    // session with no readings on file has nothing to be out of range.
    if (done && step.opens) {
      // The Nth step opening a screen needs the Nth record: baseline vitals
      // before cannulation, closing vitals after.
      const nth = booking.checklist
        .slice(0, index + 1)
        .filter((s: { opens?: string | null }) => s.opens === step.opens).length;

      const recorded: Record<string, number> = {
        vitals: (booking.vitals ?? []).length,
        consent: booking.consent?.givenAt ? 1 : 0,
        observation: (booking.observations ?? []).length,
      };
      const needed: Record<string, string> = {
        vitals: nth > 1 ? "Record the closing vitals first" : "Record the baseline vitals first",
        consent: "Capture consent first",
        observation: "Log at least one observation first",
      };

      if (step.opens in recorded && recorded[step.opens] < nth) {
        return fail(needed[step.opens], 409);
      }
    }

    // Out-of-range vitals stop the infusion before it starts — and before the
    // cannula goes in, which is the point at which it stops being reversible.
    if (done && blockedByVitals(step)) {
      const flagged = (booking.vitals ?? []).some(
        (v: { outOfRange?: string[] }) => (v.outOfRange ?? []).length > 0
      );
      if (flagged && !booking.vitalsClearedAt) {
        return fail("Out-of-range vitals block this step — the reviewing physician has been asked to clear it. Do not cannulate.", 409);
      }
    }

    step.doneAt = done ? new Date() : undefined;
    step.doneBy = done ? session!.sub : undefined;
    step.stamp = done ? "synced" : undefined;

    // Confirming the kit seals is the moment the batches are fixed, so that is
    // when they are written against the session.
    if (done && key === "ps-07" && (booking.componentsGiven ?? []).length === 0) {
      booking.componentsGiven = await componentsForDrip(booking.dripId);
    }

    // First tick starts the session; the last one closes it. Reopening a step
    // on a closed session reopens the session.
    const allDone = booking.checklist.every((s: { doneAt?: Date }) => s.doneAt);
    if (done && !booking.startedAt) {
      booking.startedAt = new Date();
    }
    if (done && booking.status !== "completed") booking.status = "in_progress";
    if (allDone) {
      if ((booking.componentsGiven ?? []).length === 0) {
        booking.componentsGiven = await componentsForDrip(booking.dripId);
      }
      booking.completedAt = new Date();
      booking.status = "completed";
    } else if (!done && booking.status === "completed") {
      booking.completedAt = undefined;
      booking.status = "in_progress";
    }

    await booking.save();

    if (allDone) {
      await notify(
        String(booking.patientId),
        "Your session report is ready",
        `${booking.dripName ?? "Your drip"} · vitals, doses, batch numbers and aftercare. Tell us how it went.`,
        "success",
        `/app/report/${String(booking._id)}`
      );
      await notify(
        booking.doctorId ? String(booking.doctorId) : null,
        `Session completed · ${booking.bookingNo}`,
        "All 29 steps closed.",
        "success",
        "/doctor/schedule"
      );
    }

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: done ? "checklist.complete" : "checklist.reopen",
      entity: "Booking",
      entityId: id,
      after: { key, label: step.label },
    });

    return ok({
      key,
      doneAt: step.doneAt,
      status: booking.status,
      remaining: booking.checklist.filter((s: { doneAt?: Date }) => !s.doneAt).length,
    });
  } catch (err) {
    return handleError(err);
  }
}

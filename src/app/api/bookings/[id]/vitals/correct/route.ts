import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Booking, User } from "@/lib/models";
import { notify, notifyRole } from "@/lib/notify";
import { CORRECTION_REASONS, VITAL_RANGES, correctReading, vitalsLine, type VitalsReading } from "@/lib/clinical/checklist";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { nurseOwns } from "@/lib/auth/ownership";
import { labelFor } from "@/components/ui/Pill";
import { ok, fail, handleError } from "@/lib/api";

/** The same bands as recording a reading: a correction is held to the same standard. */
const Input = z.object({
  /** Which reading: 0 baseline, 1 closing (see vitalsReadingIndex). */
  index: z.number().int().min(0),
  reason: z.enum(CORRECTION_REASONS),
  /** Required when the reason is "Other". */
  note: z.string().trim().max(200).optional(),
  systolic: z.number().min(40).max(300),
  diastolic: z.number().min(20).max(200),
  heartRate: z.number().min(20).max(250),
  spo2: z.number().min(50).max(100),
  temperatureF: z.number().min(90).max(110),
  weightKg: z.number().min(1).max(400).optional(),
});

/** A reading can be corrected while the session can still be worked. */
const WORKABLE = ["approved", "nurse_assigned", "en_route", "in_progress"];

/**
 * Correct a vitals reading a nurse entered wrongly.
 *
 * The reading is fixed in place and what it said before is kept on it, with who,
 * when and why. Whether it blocks the infusion is worked out again from the new
 * values: a reading corrected into range stops blocking, one corrected out of
 * range starts, and an out-of-range correction needs a fresh physician
 * clearance like any fresh out-of-range reading. Any correction that touches an
 * out-of-range reading -- before or after -- is sent to the physician at once,
 * so a block lifted by a correction is never lifted unseen.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "infusion.prepare")) return fail("Not permitted", 403);

    const { id } = await params;
    await connectDB();

    const booking = await Booking.findById(id);
    if (!booking) return fail("Session not found", 404);
    if (!nurseOwns(session, booking)) return fail("This session is not on your route", 403);
    if (!WORKABLE.includes(booking.status)) {
      return fail(`This session is ${labelFor(booking.status).toLowerCase()} — its readings can no longer be changed`, 409);
    }

    const input = Input.parse(await req.json());
    if (input.reason === "Other" && !input.note) return fail("Say why the reading is being corrected", 422);

    const current = (booking.vitals ?? [])[input.index] as VitalsReading | undefined;
    if (!current) return fail("That reading has not been recorded yet", 404);

    // A server started before corrections existed would save the new values and
    // silently drop the history -- the one thing a correction must keep.
    const vitalsPath = Booking.schema.path("vitals") as unknown as { schema?: { path(p: string): unknown } };
    if (!vitalsPath.schema?.path("corrections")) {
      return fail(
        "The server is running an older version of the session record and would lose the correction history. Restart it (stop it and run npm run dev again), then save again.",
        500
      );
    }

    const reason = input.reason === "Other" ? input.note! : input.reason;
    // A database sub-document, turned into plain values once: spreading it would
    // copy its internals rather than the reading.
    const before = JSON.parse(JSON.stringify(current)) as VitalsReading;
    const fixed = correctReading(before, input, reason, session!.sub);

    booking.vitals[input.index] = fixed;
    booking.markModified("vitals");
    // A reading corrected out of range needs a fresh look, as a fresh reading does.
    if ((fixed.outOfRange ?? []).length) {
      booking.vitalsClearedAt = undefined;
      booking.vitalsClearedBy = undefined;
      booking.vitalsClearanceNote = undefined;
    }
    await booking.save();

    const which = input.index === 0 ? "Baseline" : "Closing";
    const stillBlocked = (booking.vitals ?? []).some((v: { outOfRange?: string[] }) => (v.outOfRange ?? []).length > 0) && !booking.vitalsClearedAt;
    const touchedRange = (before.outOfRange ?? []).length > 0 || (fixed.outOfRange ?? []).length > 0;

    if (touchedRange) {
      const nurse = await User.findById(session!.sub).select("name").lean<{ name: string } | null>();
      const flagged = (fixed.outOfRange ?? []) as Array<keyof typeof VITAL_RANGES>;
      const title = `Vitals corrected · ${booking.bookingNo}`;
      const body =
        `${which} reading ${vitalsLine(before)} → ${vitalsLine(fixed)} · ${reason} · by ${nurse?.name ?? "the nurse"}. ` +
        (flagged.length
          ? `Still out of range (${flagged.map((k) => VITAL_RANGES[k]?.label ?? k).join(", ")}) — the infusion stays blocked pending your call.`
          : stillBlocked
            ? "Another reading is still out of range — the infusion stays blocked."
            : "Now in range, so the block has lifted.");
      if (booking.doctorId) await notify(String(booking.doctorId), title, body, flagged.length ? "error" : "warning", "/doctor/adverse");
      else await notifyRole("doctor", title, body, flagged.length ? "error" : "warning", "/doctor/adverse");
    }

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "vitals.corrected",
      entity: "Booking",
      entityId: id,
      before: { reading: which.toLowerCase(), values: vitalsLine(before), outOfRange: (before.outOfRange ?? []).join(", ") || "none" },
      after: {
        reading: which.toLowerCase(),
        values: vitalsLine(fixed),
        outOfRange: (fixed.outOfRange ?? []).join(", ") || "none",
        reason,
        blocksInfusion: stillBlocked,
      },
    });

    return ok({ corrected: true, outOfRange: fixed.outOfRange ?? [], blocksInfusion: stillBlocked });
  } catch (err) {
    return handleError(err);
  }
}

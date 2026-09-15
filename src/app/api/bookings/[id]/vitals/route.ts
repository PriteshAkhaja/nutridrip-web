import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Booking } from "@/lib/models";
import { notify, notifyRole } from "@/lib/notify";
import { VITAL_RANGES, outOfRange } from "@/lib/clinical/checklist";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { nurseOwns } from "@/lib/auth/ownership";
import { ok, fail, handleError } from "@/lib/api";

/**
 * Every band the checklist gates on must be present. An empty reading would
 * satisfy "vitals are on file" while having nothing to be out of range — which
 * would turn the safety gate into a formality.
 */
const Input = z.object({
  label: z.string().default("baseline"),
  systolic: z.number().min(40).max(300),
  diastolic: z.number().min(20).max(200),
  heartRate: z.number().min(20).max(250),
  spo2: z.number().min(50).max(100),
  temperatureF: z.number().min(90).max(110),
  weightKg: z.number().min(1).max(400).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "infusion.prepare")) return fail("Not permitted", 403);

    const { id } = await params;
    await connectDB();

    // Authorise before validating: someone with no business here should be
    // told that, not handed a field-by-field description of the schema.
    const booking = await Booking.findById(id);
    if (!booking) return fail("Session not found", 404);
    if (!nurseOwns(session, booking)) return fail("This session is not on your route", 403);

    const input = Input.parse(await req.json());

    const flagged = outOfRange(input);
    booking.vitals.push({ ...input, takenAt: new Date(), outOfRange: flagged });
    // A fresh out-of-range reading needs a fresh look; an earlier clearance
    // does not carry over to it.
    if (flagged.length) {
      booking.vitalsClearedAt = undefined;
      booking.vitalsClearedBy = undefined;
      booking.vitalsClearanceNote = undefined;
    }
    await booking.save();

    if (flagged.length) {
      const detail = flagged
        .map((k) => `${VITAL_RANGES[k].label} ${input[k]} ${VITAL_RANGES[k].unit}`)
        .join(", ");
      const title = `Vitals out of range · ${booking.bookingNo}`;
      const body = `${detail}. The infusion is blocked pending your call.`;
      if (booking.doctorId) await notify(String(booking.doctorId), title, body, "error", "/doctor/adverse");
      else await notifyRole("doctor", title, body, "error", "/doctor/adverse");
    }

    return ok({
      recorded: true,
      outOfRange: flagged,
      /** The caller shows a hard stop rather than letting the nurse proceed. */
      blocksInfusion: flagged.length > 0,
    });
  } catch (err) {
    return handleError(err);
  }
}

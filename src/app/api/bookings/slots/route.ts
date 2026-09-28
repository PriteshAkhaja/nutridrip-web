import { connectDB } from "@/lib/db/mongoose";
import { Booking, Drip, User } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { canManageBooking } from "@/lib/auth/ownership";
import { slotContext } from "@/lib/clinical/slot-availability";
import { istInstant, releasedDates, slotGrid, stepLabel } from "@/lib/clinical/slots";
import { ok, fail, handleError } from "@/lib/api";
import { openCallFor } from "@/lib/data/calls";
import { earliestDrip } from "@/lib/clinical/calls";
import { clockText } from "@/lib/time";
import { getClockFormat } from "@/lib/settings/clock";

type SlotBooking = {
  _id: unknown;
  patientId?: unknown;
  clinicId?: unknown;
  pincode?: string;
  durationMin?: number;
  status?: string;
};

export const dynamic = "force-dynamic";

/**
 * The days and times on offer for one address, each free, taken or too soon.
 *
 * Two ways in:
 *   ?booking=<id>                        moving a session — its own address and length, and it
 *                                        does not stand in its own way;
 *   ?dripId=&location=&pincode=&clinicId= booking a new one.
 *
 * A drip held for a patient who has a call booked with a physician starts no
 * earlier than 2 hours after the call; `after=<ISO>` pushes that later still,
 * for a call being moved (the new time is not saved yet).
 */
export async function GET(req: Request) {
  const clockFmt = await getClockFormat();
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);
    const params = new URL(req.url).searchParams;
    await connectDB();

    let pincode: string | undefined;
    let durationMin = 45;
    let excludeBookingId: string | null = null;
    let patientId: string | null = session.role === "patient" ? session.sub : null;
    let held = true;

    const bookingId = params.get("booking");
    if (bookingId) {
      const booking = await Booking.findById(bookingId)
        .select("patientId clinicId pincode durationMin status")
        .lean<SlotBooking | null>();
      if (!booking) return fail("Session not found", 404);
      if (!canManageBooking(session, booking)) return fail("Not permitted", 403);
      pincode = booking.pincode;
      durationMin = booking.durationMin ?? 45;
      excludeBookingId = String(booking._id);
      patientId = booking.patientId ? String(booking.patientId) : null;
      // Only a drip still waiting for the physician waits for the call.
      held = booking.status === "awaiting_review";
    } else {
      if (!can(session.role, "bookings.create")) return fail("Not permitted", 403);
      const dripId = params.get("dripId");
      if (dripId) {
        const drip = await Drip.findById(dripId).select("durationMin").lean<{ durationMin?: number } | null>();
        durationMin = drip?.durationMin ?? durationMin;
      }
      if (params.get("location") === "clinic") {
        const clinic = await User.findOne({ _id: params.get("clinicId"), role: "clinic", status: "active" })
          .select("clinic.pincode")
          .lean<{ clinic?: { pincode?: string } } | null>();
        if (!clinic) return fail("That clinic is not taking bookings", 422);
        pincode = clinic.clinic?.pincode;
      } else {
        pincode = (params.get("pincode") ?? "").replace(/\D/g, "");
        if (pincode.length !== 6) return ok({ served: false, zone: null, days: [] });
      }
    }

    const dates = releasedDates();
    const ctx = await slotContext({
      pincode,
      from: istInstant(dates[0], "00:00"),
      to: istInstant(dates[dates.length - 1], "23:59"),
      excludeBookingId,
    });

    // A home visit outside every zone is a straight no, said by the pincode
    // note; a clinic's rooms run the default hours wherever they are.
    if (!ctx.zone && params.get("location") !== "clinic" && !bookingId) {
      return ok({ served: false, zone: null, days: [] });
    }

    const call = held && patientId ? await openCallFor(patientId) : null;
    const after = params.get("after") ? new Date(params.get("after")!).getTime() : NaN;
    const notBefore = Math.max(
      call ? earliestDrip(new Date(call.startAt).getTime(), call.minutes) : 0,
      Number.isFinite(after) ? after : 0
    );

    return ok({
      served: true,
      zone: ctx.zone
        ? { name: ctx.zone.name, window: clockText(ctx.zone.window, clockFmt), every: stepLabel(ctx.hours.slotMinutes) }
        : null,
      days: slotGrid(ctx, durationMin, dates, Date.now(), notBefore || null),
    });
  } catch (err) {
    return handleError(err);
  }
}

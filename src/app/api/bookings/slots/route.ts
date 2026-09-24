import { connectDB } from "@/lib/db/mongoose";
import { Booking, Drip, User } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { canManageBooking } from "@/lib/auth/ownership";
import { slotContext } from "@/lib/clinical/slot-availability";
import { istInstant, releasedDates, slotGrid, stepLabel } from "@/lib/clinical/slots";
import { ok, fail, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * The days and times on offer for one address, each free, taken or too soon.
 *
 * Two ways in:
 *   ?booking=<id>                        moving a session — its own address and length, and it
 *                                        does not stand in its own way;
 *   ?dripId=&location=&pincode=&clinicId= booking a new one.
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);
    const params = new URL(req.url).searchParams;
    await connectDB();

    let pincode: string | undefined;
    let durationMin = 45;
    let excludeBookingId: string | null = null;

    const bookingId = params.get("booking");
    if (bookingId) {
      const booking = await Booking.findById(bookingId)
        .select("patientId clinicId pincode durationMin")
        .lean<{ _id: unknown; patientId?: unknown; clinicId?: unknown; pincode?: string; durationMin?: number } | null>();
      if (!booking) return fail("Session not found", 404);
      if (!canManageBooking(session, booking)) return fail("Not permitted", 403);
      pincode = booking.pincode;
      durationMin = booking.durationMin ?? 45;
      excludeBookingId = String(booking._id);
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

    return ok({
      served: true,
      zone: ctx.zone
        ? { name: ctx.zone.name, window: ctx.zone.window, every: stepLabel(ctx.hours.slotMinutes) }
        : null,
      days: slotGrid(ctx, durationMin, dates),
    });
  } catch (err) {
    return handleError(err);
  }
}

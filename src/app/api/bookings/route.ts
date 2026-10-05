import { connectDB } from "@/lib/db/mongoose";
import { Booking } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { paginate } from "@/lib/pagination-db";
import { pageInfo, parsePaging } from "@/lib/pagination";
import { ADMIN_BOOKING_SELECT } from "@/lib/data/admin-view";
import { ok, fail, handleError } from "@/lib/api";
import { CreateBooking, bookSlot, planBooking } from "@/lib/booking/create";
import { paymentsEnabled } from "@/lib/payments/config";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "bookings.view")) return fail("Not permitted", 403);

    await connectDB();
    const filter: Record<string, unknown> = {};
    if (session!.role === "patient") filter.patientId = session!.sub;
    if (session!.role === "nurse") filter.nurseId = session!.sub;
    if (session!.role === "clinic") filter.clinicId = session!.sub;
    if (session!.role === "doctor") filter.doctorId = session!.sub;

    const params = new URL(req.url).searchParams;
    const paging = parsePaging({ page: params.get("page"), pageSize: params.get("pageSize") });
    // An Admin schedules sessions; they do not read the clinical record inside one
    // (vitals, checklist, reactions, consent, doses). Those fields never leave the
    // database for that role -- see lib/data/admin-view.ts.
    const { rows: bookings, meta } = await paginate(Booking, filter, {
      sort: { scheduledAt: -1 },
      paging,
      ...(session!.role === "admin" ? { select: ADMIN_BOOKING_SELECT } : {}),
    });
    return ok({ bookings, pagination: pageInfo(meta) });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "bookings.create")) return fail("Not permitted", 403);

    const input = CreateBooking.parse(await req.json());

    // Every rule first, so an impossible booking says why whichever way it is made.
    const planned = await planBooking(session!.sub, input);
    if ("error" in planned) return fail(planned.error, planned.status);

    // With online payment switched on, a session is booked by paying for it
    // (POST /api/payments, purpose "booking"): the booking is written when the
    // money arrives. Booking here without paying would be a free session.
    if (paymentsEnabled()) {
      return fail("Pay to book this session.", 402, { code: "payment_required" });
    }

    // Checked again inside the booking itself: the time may have gone since.
    const made = await bookSlot(session!.sub, input, { id: session!.sub, role: session!.role });
    if ("error" in made) return fail(made.error, made.status);
    return ok({ booking: made.booking }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

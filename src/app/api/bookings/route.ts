import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Booking, Drip, HealthQuiz, User } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { CHECKLIST_STEPS } from "@/lib/clinical/checklist";
import { approvalState } from "@/lib/clinical/validity";
import { checkAvailability } from "@/lib/inventory/availability";
import { LOCATIONS } from "@/lib/models/types";
import { notify, notifyRole } from "@/lib/notify";
import { pickNurse } from "@/lib/clinical/assign";
import { nextReference, createWithReference } from "@/lib/sequence";
import { zoneForPincode } from "@/lib/zones";
import { paginate } from "@/lib/pagination-db";
import { pageInfo, parsePaging } from "@/lib/pagination";
import { ADMIN_BOOKING_SELECT } from "@/lib/data/admin-view";
import { ok, fail, handleError } from "@/lib/api";

const CreateBooking = z.object({
  dripId: z.string(),
  scheduledAt: z.string().datetime(),
  location: z.enum(LOCATIONS),
  address: z.string().max(300).optional(),
  pincode: z.string().max(10).optional(),
  /** Required when the session runs in a partner clinic's rooms. */
  clinicId: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

/** Slots inside this window cannot be booked — the nurse needs the lead time. */
const MIN_LEAD_MS = 60 * 60_000;

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
    await connectDB();

    const drip = await Drip.findById(input.dripId).lean<{
      _id: unknown;
      name: string;
      priceInr: number;
      durationMin: number;
      isActive: boolean;
    } | null>();
    if (!drip || !drip.isActive) return fail("That drip is no longer available", 404);

    const when = new Date(input.scheduledAt);
    if (when.getTime() - Date.now() < MIN_LEAD_MS) return fail("Pick a slot at least an hour from now", 422);

    // A slot is only real if the stock behind it is real — and a booking does
    // not reserve, so the sessions already promised have to be counted too.
    // Without that, ten patients could each pass a check for the same last
    // preparable drip.
    const { results } = await checkAvailability([{ dripId: input.dripId, quantity: 1 }], true);
    const preparable = results[0]?.wholeVialAvailability ?? 0;
    const alreadyPromised = await Booking.countDocuments({
      dripId: drip._id,
      status: { $in: ["awaiting_review", "approved", "nurse_assigned", "en_route", "in_progress"] },
    });

    if (preparable < 1) {
      return fail(
        `${drip.name} cannot be prepared right now${
          results[0]?.bottleneck ? ` — ${results[0].bottleneck.ingredient} is out` : ""
        }`,
        409
      );
    }
    if (preparable <= alreadyPromised) {
      return fail(
        `${drip.name} is fully committed — every unit we can prepare is already promised to a booked session. Try another drip, or come back once the pharmacy has restocked.`,
        409
      );
    }

    const patient = await User.findById(session!.sub).lean<{
      patient?: {
        address?: string;
        city?: string;
        pincode?: string;
        latitude?: number;
        longitude?: number;
      };
    } | null>();

    // Where the nurse goes: a partner clinic's rooms, or an address inside a
    // zone we actually cover. The site promises a straight yes or no on the
    // pincode, so the no is given here rather than by a nurse who cannot come.
    let clinic: { _id: unknown; name: string; clinic?: { pincode?: string; city?: string } } | null = null;
    let pincode = input.pincode?.replace(/\D/g, "") || patient?.patient?.pincode || undefined;

    if (input.location === "clinic") {
      if (!input.clinicId) return fail("Choose the clinic you will visit", 422);
      clinic = await User.findOne({ _id: input.clinicId, role: "clinic", status: "active" }).lean<{
        _id: unknown;
        name: string;
        clinic?: { pincode?: string; city?: string };
      } | null>();
      if (!clinic) return fail("That clinic is not taking bookings", 422);
      pincode = clinic.clinic?.pincode ?? pincode;
    } else {
      if (!pincode) return fail("Add your pincode so we can check a nurse can reach you", 422);
      const zone = zoneForPincode(pincode);
      if (!zone) {
        return fail(`We do not serve pincode ${pincode} yet. The zones we cover are listed under Zones.`, 409);
      }
    }

    // A booking is only approved once a physician has read a quiz that is
    // still inside its review window.
    const quiz = await HealthQuiz.findOne({ patientId: session!.sub })
      .sort({ completedAt: -1 })
      .lean<{ reviewStatus: string; reviewedAt?: Date; reviewedBy?: unknown; completedAt: Date } | null>();
    const approval = approvalState(quiz);
    // Pending is the one blocked state a patient may still hold a slot against.
    if (!approval.canBook && approval.status !== "pending") {
      return fail(approval.message, 409);
    }

    const booking = await createWithReference(
      (bookingNo) =>
        Booking.create({
          bookingNo,
          patientId: session!.sub,
          dripId: drip._id,
          dripName: drip.name,
          scheduledAt: when,
          durationMin: drip.durationMin,
          location: input.location,
          address: clinic ? clinic.name : (input.address ?? patient?.patient?.address),
          city: clinic?.clinic?.city ?? patient?.patient?.city,
          pincode,
          clinicId: clinic?._id,
          // The physician who approved the standing protocol owns this session.
          doctorId: approval.canBook && quiz?.reviewedBy ? quiz.reviewedBy : undefined,
          status: approval.status === "pending" ? "awaiting_review" : "approved",
          approvedAt: approval.status === "pending" ? undefined : new Date(),
          checklist: CHECKLIST_STEPS.map((s) => ({ ...s })),
          amount: drip.priceInr,
          paymentStatus: "unpaid",
        }),
      (attempt) =>
        nextReference(
          Booking,
          "bookingNo",
          (n) => `ND-${4400 + n}`,
          (ref) => Number(ref.split("-")[1] ?? 0) - 4400,
          attempt
        )
    );

    const slotLabel = when.toLocaleString("en-IN", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true,
    });

    if (booking.status === "awaiting_review") {
      await notifyRole(
        ["doctor"],
        "A slot is held pending your review",
        `${drip.name} · ${slotLabel}`,
        "info",
        "/doctor"
      );
    } else {
      // Already-approved patients skip the queue, so dispatch a nurse now.
      const pick = await pickNurse({
        latitude: patient?.patient?.latitude,
        longitude: patient?.patient?.longitude,
        pincode,
      });
      if (pick) {
        booking.nurseId = pick.nurseId;
        booking.status = "nurse_assigned";
        await booking.save();
        await notify(
          pick.nurseId,
          `New session assigned · ${booking.bookingNo}`,
          `${drip.name}${pick.distanceKm ? ` · ${pick.distanceKm} km away` : ""}`,
          "info",
          "/nurse"
        );
      }
    }

    if (clinic) {
      await notify(
        String(clinic._id),
        `Session booked into your rooms · ${booking.bookingNo}`,
        `${drip.name} · ${slotLabel}`,
        "info",
        "/clinic/bookings"
      );
    }

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "booking.create",
      entity: "Booking",
      entityId: String(booking._id),
      after: {
        bookingNo: booking.bookingNo,
        dripName: booking.dripName,
        scheduledAt: booking.scheduledAt,
        location: booking.location,
      },
    });

    return ok({ booking: booking.toObject() }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

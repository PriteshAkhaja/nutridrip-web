import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, User } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { notify } from "@/lib/notify";
import { ok, fail, handleError } from "@/lib/api";

const Input = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "patient") return fail("Not permitted", 403);

    const { id } = await params;
    const { rating, comment } = Input.parse(await req.json());
    await connectDB();

    const booking = await Booking.findById(id);
    if (!booking) return fail("Session not found", 404);
    if (String(booking.patientId) !== session.sub) return fail("Not permitted", 403);
    if (booking.status !== "completed") return fail("Rate a session once it is finished", 409);

    booking.feedback = { rating, comment, givenAt: new Date() };
    await booking.save();

    // A poor rating is something the physician should see, not just a number.
    if (rating <= 2 && booking.doctorId) {
      await notify(
        String(booking.doctorId),
        `Low rating on ${booking.bookingNo}`,
        comment || `${rating}/5, no comment left.`,
        "warning",
        "/doctor/schedule"
      );
    }

    /**
     * Tell the nurse. The patient is thanked with "your nurse sees this on
     * their record", and a rating that reached only the physician — and only
     * when it was bad — made that untrue twice over: the nurse never heard the
     * good ones at all, and heard the bad ones second-hand or not at all.
     */
    if (booking.nurseId) {
      const patient = await User.findById(booking.patientId).lean<{ name: string } | null>();
      const who = patient?.name ?? "A patient";
      await notify(
        String(booking.nurseId),
        `${who} rated ${booking.bookingNo} · ${rating}/5`,
        comment?.trim() || "No comment left.",
        rating <= 2 ? "warning" : "success",
        `/nurse/session/${id}/report`
      );
    }

    return ok({ rating, comment });
  } catch (err) {
    return handleError(err);
  }
}

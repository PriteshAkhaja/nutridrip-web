import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Booking } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { nurseOwns } from "@/lib/auth/ownership";
import { ok, fail, handleError } from "@/lib/api";

const Input = z.object({
  text: z.string().min(1).max(2000),
  remainingMl: z.number().min(0).max(5000).optional(),
  rateMlHr: z.number().min(0).max(1000).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "infusion.prepare")) return fail("Not permitted", 403);

    const { id } = await params;
    await connectDB();

    const booking = await Booking.findById(id);
    if (!booking) return fail("Session not found", 404);
    if (!nurseOwns(session, booking)) return fail("This session is not on your route", 403);

    const { text, remainingMl, rateMlHr } = Input.parse(await req.json());

    booking.observations.push({ at: new Date(), text, byId: session!.sub });
    if (remainingMl !== undefined) booking.remainingMl = remainingMl;
    if (rateMlHr !== undefined) booking.rateMlHr = rateMlHr;
    await booking.save();

    return ok({ observations: booking.observations.length });
  } catch (err) {
    return handleError(err);
  }
}

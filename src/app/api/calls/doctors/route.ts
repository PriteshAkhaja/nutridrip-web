import { getSession } from "@/lib/auth/session";
import { bookableDoctors } from "@/lib/data/calls";
import { ok, fail, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

/** The physicians a patient can book a call with, and when each is next free. */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);
    return ok({ doctors: await bookableDoctors() });
  } catch (err) {
    return handleError(err);
  }
}

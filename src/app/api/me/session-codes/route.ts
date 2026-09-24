import { getSession } from "@/lib/auth/session";
import { liveCodesFor } from "@/lib/data/session-codes";
import { ok, fail, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * The signed-in patient's own live codes, for the card on their home screen,
 * which asks every few seconds while a session is on. Patients only: a code
 * proves the person reading it out is the patient.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return fail("Sign in", 401);
    if (session.role !== "patient") return fail("Not permitted", 403);
    const codes = await liveCodesFor(session.sub);
    return ok({ codes }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return handleError(err);
  }
}

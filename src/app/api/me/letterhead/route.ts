import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, User } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { ok, fail, handleError } from "@/lib/api";
import {
  LetterheadInput,
  hasLetterhead,
  letterheadChanges,
  normaliseLetterhead,
} from "@/lib/clinical/letterhead";

export const dynamic = "force-dynamic";

type DoctorRecord = {
  name: string;
  doctor?: {
    specialization?: string;
    licenseNo?: string;
    registrationCouncil?: string;
    letterhead?: unknown;
  };
};

/** The caller's own letterhead, plus the credentials that print beside it. */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);
    if (!can(session.role, "letterhead.edit")) return fail("Only a physician has a letterhead", 403);

    await connectDB();
    const me = await User.findById(session.sub).select("name doctor").lean<DoctorRecord | null>();
    if (!me) return fail("Account not found", 404);

    return ok({
      letterhead: normaliseLetterhead(me.doctor?.letterhead),
      // Shown so the physician can see what prints regardless. Read-only here.
      credentials: {
        name: me.name,
        specialization: me.doctor?.specialization ?? null,
        licenseNo: me.doctor?.licenseNo ?? null,
        registrationCouncil: me.doctor?.registrationCouncil ?? null,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Replace the caller's letterhead.
 *
 * A PUT of the whole thing rather than a patch of parts: the form always holds
 * every field, and "clear the phone number" is then just an empty string, not a
 * question of whether a missing key means unchanged or means removed.
 *
 * Only the caller's own record is ever touched — the id comes from the session,
 * never from the request — and only the six presentation fields are read. A
 * body that also carries a licence number or a council is not an error, but
 * nothing in it is used: credentials are not this route's to change.
 */
export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);
    if (!can(session.role, "letterhead.edit")) return fail("Only a physician has a letterhead", 403);

    const input = LetterheadInput.parse(await req.json());

    await connectDB();
    const user = await User.findById(session.sub);
    if (!user) return fail("Account not found", 404);

    const before = normaliseLetterhead(user.doctor?.letterhead);
    const after = normaliseLetterhead(input);

    // Nothing to do — and nothing to record. A save that changed nothing must
    // not leave a row in the trail saying something did.
    const changes = letterheadChanges(before, after);
    if (Object.keys(changes.before).length === 0 && Object.keys(changes.after).length === 0) {
      return ok({ letterhead: after, changed: false });
    }

    // An empty letterhead is removed, not stored as an object of blanks.
    user.set("doctor.letterhead", Object.keys(after).length ? after : undefined);
    await user.save();

    // Read it back before saying so. Mongoose silently drops a field its
    // compiled schema does not know — which is exactly what a long-running
    // server does after a schema change until it is restarted — and a save that
    // reports success while storing nothing, then writes an audit row for a
    // change that never happened, is worse than an honest failure.
    const stored = await User.findById(session.sub)
      .select("doctor.letterhead")
      .lean<{ doctor?: { letterhead?: unknown } } | null>();
    const kept = normaliseLetterhead(stored?.doctor?.letterhead);
    if (JSON.stringify(letterheadChanges(kept, after)) !== JSON.stringify({ before: {}, after: {} })) {
      console.error("[letterhead] the save reported success but the record does not hold it", { kept, after });
      return fail(
        "Your letterhead could not be saved, and nothing was changed. Please try again — if it keeps happening, tell support.",
        500
      );
    }

    await AuditLog.create({
      actorId: session.sub,
      actorRole: session.role,
      action: "profile.letterhead",
      entity: "User",
      entityId: session.sub,
      before: changes.before,
      after: changes.after,
    });

    return ok({ letterhead: after, changed: true, printed: hasLetterhead(after) });
  } catch (err) {
    return handleError(err);
  }
}

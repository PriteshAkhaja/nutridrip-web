import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, PlatformSettings } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getClockFormat } from "@/lib/settings/clock";
import { getNurseDayLimit } from "@/lib/settings/nurse-day";
import { NURSE_DAY_LIMIT_MAX, NURSE_DAY_LIMIT_MIN } from "@/lib/clinical/nurse-options";
import { ok, fail, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Each setting on its own: a form sends only the one it changes. */
const Save = z
  .object({
    clockFormat: z.enum(["12h", "24h"]).optional(),
    nurseDayLimit: z
      .number()
      .int("A whole number of sessions")
      .min(NURSE_DAY_LIMIT_MIN, `At least ${NURSE_DAY_LIMIT_MIN} session a day`)
      .max(NURSE_DAY_LIMIT_MAX, `At most ${NURSE_DAY_LIMIT_MAX} sessions a day`)
      .optional(),
  })
  .refine((s) => s.clockFormat !== undefined || s.nurseDayLimit !== undefined, "Nothing to save");

export async function GET() {
  try {
    const session = await getSession();
    if (!can(session?.role, "settings.manage")) return fail("Not permitted", 403);
    const [clockFormat, nurseDayLimit] = await Promise.all([getClockFormat(), getNurseDayLimit()]);
    return ok({ clockFormat, nurseDayLimit });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "settings.manage")) return fail("Not permitted", 403);

    const input = Save.parse(await req.json());
    // A dev server started before this setting existed would save nothing and say "Saved".
    if (input.nurseDayLimit !== undefined && !PlatformSettings.schema.path("nurseDayLimit")) {
      return fail(
        "The server is running an older version and would not keep this. Restart it (stop it and run npm run dev again).",
        500
      );
    }
    const before = { clockFormat: await getClockFormat(), nurseDayLimit: await getNurseDayLimit() };

    await connectDB();
    await PlatformSettings.findOneAndUpdate(
      { singleton: "platform" },
      {
        $set: {
          ...(input.clockFormat !== undefined ? { clockFormat: input.clockFormat } : {}),
          ...(input.nurseDayLimit !== undefined ? { nurseDayLimit: input.nurseDayLimit } : {}),
          updatedBy: session!.sub,
        },
      },
      { upsert: true, runValidators: true }
    );

    // Only what actually changed, so the audit trail reads as decisions made.
    const changed = (Object.keys(before) as Array<keyof typeof before>).filter(
      (k) => input[k] !== undefined && input[k] !== before[k]
    );
    if (changed.length) {
      await AuditLog.create({
        actorId: session!.sub,
        actorRole: session!.role,
        action: "settings.update",
        entity: "PlatformSettings",
        entityId: "platform",
        before: Object.fromEntries(changed.map((k) => [k, before[k]])),
        after: Object.fromEntries(changed.map((k) => [k, input[k]])),
      });
    }

    return ok({
      clockFormat: input.clockFormat ?? before.clockFormat,
      nurseDayLimit: input.nurseDayLimit ?? before.nurseDayLimit,
    });
  } catch (err) {
    return handleError(err);
  }
}

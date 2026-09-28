import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, PlatformSettings } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getClockFormat } from "@/lib/settings/clock";
import { ok, fail, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

const Save = z.object({
  clockFormat: z.enum(["12h", "24h"]),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!can(session?.role, "settings.manage")) return fail("Not permitted", 403);
    return ok({ clockFormat: await getClockFormat() });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "settings.manage")) return fail("Not permitted", 403);

    const input = Save.parse(await req.json());
    const before = await getClockFormat();

    await connectDB();
    await PlatformSettings.findOneAndUpdate(
      { singleton: "platform" },
      { $set: { clockFormat: input.clockFormat, updatedBy: session!.sub } },
      { upsert: true }
    );

    if (before !== input.clockFormat) {
      await AuditLog.create({
        actorId: session!.sub,
        actorRole: session!.role,
        action: "settings.update",
        entity: "PlatformSettings",
        entityId: "platform",
        before: { clockFormat: before },
        after: { clockFormat: input.clockFormat },
      });
    }

    return ok({ clockFormat: input.clockFormat });
  } catch (err) {
    return handleError(err);
  }
}

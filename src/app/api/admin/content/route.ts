import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, ContentBlock } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { CONTENT_DEFAULTS, getContent, type ContentKey } from "@/lib/content";
import { ok, fail, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

const Save = z.object({
  key: z.string(),
  /** Empty reverts to the bundled default rather than blanking the page. */
  value: z.string().max(4000),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!can(session?.role, "content.manage")) return fail("Not permitted", 403);
    return ok({ content: await getContent(), defaults: CONTENT_DEFAULTS });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "content.manage")) return fail("Not permitted", 403);

    const { key, value } = Save.parse(await req.json());
    if (!(key in CONTENT_DEFAULTS)) return fail(`"${key}" is not a known content key`, 422);

    await connectDB();

    if (!value.trim()) {
      await ContentBlock.deleteOne({ key });
      await AuditLog.create({
        actorId: session!.sub,
        actorRole: session!.role,
        action: "content.revert",
        entity: "ContentBlock",
        entityId: key,
      });
      return ok({ key, value: CONTENT_DEFAULTS[key as ContentKey], reverted: true });
    }

    await ContentBlock.findOneAndUpdate(
      { key },
      { $set: { value, updatedBy: session!.sub } },
      { upsert: true }
    );

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "content.update",
      entity: "ContentBlock",
      entityId: key,
      after: { value: value.slice(0, 200) },
    });

    return ok({ key, value, reverted: false });
  } catch (err) {
    return handleError(err);
  }
}

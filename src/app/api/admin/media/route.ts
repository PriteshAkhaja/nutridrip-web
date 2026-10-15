import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Drip, SiteMedia } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { dripSlugOf, isSlotKey } from "@/lib/media/slots";
import { focalPoint } from "@/lib/media/rules";
import { processUpload, UploadError } from "@/lib/media/process";
import { retireFile } from "@/lib/media/retire";
import { ok, fail, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * The website's photographs (Admin → Site images), super admin only.
 *   POST   multipart: slot, file, alt, position?  replace the photo
 *   PATCH  json: slot, alt?, position?            change what it says or where its subject sits
 *   DELETE ?slot=                                  restore the original
 * Each is recorded in the audit trail.
 */

const Alt = z.string().trim().min(3, "Describe the photo in a few words.").max(300);

/** A known slot, or a drip that exists (with its slug, for the folder name). */
async function checkSlot(slot: string): Promise<{ ok: true; dripSlug: string | null } | { ok: false; msg: string }> {
  if (isSlotKey(slot)) return { ok: true, dripSlug: null };
  const slug = dripSlugOf(slot);
  if (!slug) return { ok: false, msg: `"${slot}" is not a photo on the site` };
  return (await Drip.exists({ slug }))
    ? { ok: true, dripSlug: slug }
    : { ok: false, msg: "That drip no longer exists" };
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "settings.manage")) return fail("Not permitted", 403);

    const form = await req.formData();
    const slot = String(form.get("slot") ?? "");
    const file = form.get("file");
    if (!(file instanceof File)) return fail("Choose a photo to upload", 422);
    const alt = Alt.parse(String(form.get("alt") ?? ""));
    const rawPosition = form.get("position");
    const position = rawPosition ? focalPoint(rawPosition) : "50% 50%";
    if (!position) return fail("The focus point is not valid", 422);

    await connectDB();
    const target = await checkSlot(slot);
    if (!target.ok) return fail(target.msg, 422);

    let saved;
    try {
      saved = await processUpload(Buffer.from(await file.arrayBuffer()), slot, target.dripSlug);
    } catch (err) {
      if (err instanceof UploadError) return fail(err.message, 422);
      throw err;
    }

    const before = await SiteMedia.findOne({ slot }).select("file").lean<{ file?: string | null } | null>();
    await SiteMedia.findOneAndUpdate(
      { slot },
      {
        $set: {
          ...saved,
          alt,
          position,
          originalName: file.name.slice(0, 200),
          updatedBy: session!.sub,
        },
      },
      { upsert: true }
    );
    // The photo it replaces is out of use now: its grace period starts.
    if (before?.file && before.file !== saved.file) await retireFile(before.file, slot, "replaced");
    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "media.replace",
      entity: "SiteMedia",
      entityId: slot,
      before: { file: before?.file ?? null },
      after: { file: saved.file, width: saved.width, height: saved.height },
    });
    return ok({ slot, ...saved, alt, position });
  } catch (err) {
    return handleError(err);
  }
}

const Details = z.object({
  slot: z.string(),
  alt: Alt.optional(),
  position: z.string().optional(),
});

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "settings.manage")) return fail("Not permitted", 403);
    const body = Details.parse(await req.json());
    const position = body.position === undefined ? undefined : focalPoint(body.position);
    if (position === null) return fail("The focus point is not valid", 422);

    await connectDB();
    const target = await checkSlot(body.slot);
    if (!target.ok) return fail(target.msg, 422);

    const set: Record<string, unknown> = { updatedBy: session!.sub };
    if (body.alt !== undefined) set.alt = body.alt;
    if (position !== undefined) set.position = position;
    await SiteMedia.findOneAndUpdate({ slot: body.slot }, { $set: set }, { upsert: true });
    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "media.details",
      entity: "SiteMedia",
      entityId: body.slot,
      after: { alt: body.alt, position },
    });
    return ok({ slot: body.slot, alt: body.alt, position });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "settings.manage")) return fail("Not permitted", 403);
    const slot = new URL(req.url).searchParams.get("slot") ?? "";

    await connectDB();
    const target = await checkSlot(slot);
    if (!target.ok) return fail(target.msg, 422);

    // The row goes; the file stays in storage for the grace period (npm run clean-media),
    // so a mistake can still be undone by hand.
    const row = await SiteMedia.findOneAndDelete({ slot }).lean<{ file?: string | null } | null>();
    await retireFile(row?.file, slot, "restored");
    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "media.restore",
      entity: "SiteMedia",
      entityId: slot,
      before: { file: row?.file ?? null },
    });
    return ok({ slot, restored: true });
  } catch (err) {
    return handleError(err);
  }
}

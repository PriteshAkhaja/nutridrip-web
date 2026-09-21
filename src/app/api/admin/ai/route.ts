import { connectDB } from "@/lib/db/mongoose";
import { AIModel, AuditLog } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { ok, fail, handleError } from "@/lib/api";
import { AiConfigCreate, escapeRegExp } from "@/lib/ai/config";
import { aiView } from "@/lib/ai/view";
import { AI_STUDIO_ENABLED } from "@/lib/ai/enabled";

export const dynamic = "force-dynamic";

/** Every saved configuration, the Active one first. */
export async function GET() {
  try {
    if (!AI_STUDIO_ENABLED) return fail("Not found", 404); // switched off — see lib/ai/enabled.ts
    const session = await getSession();
    if (!can(session?.role, "ai.configure")) return fail("Not permitted", 403);

    await connectDB();
    const rows = await AIModel.find({}).sort({ status: 1, updatedAt: -1 }).lean<Array<Record<string, unknown>>>();
    // "active" sorts before "test", so the live one leads without a second pass.
    return ok({ models: rows.map(aiView) });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Save a new configuration. It always starts in Test: making one the active
 * model is a separate act, done on purpose and recorded on its own.
 */
export async function POST(req: Request) {
  try {
    if (!AI_STUDIO_ENABLED) return fail("Not found", 404); // switched off — see lib/ai/enabled.ts
    const session = await getSession();
    if (!session || !can(session.role, "ai.configure")) return fail("Not permitted", 403);

    const input = AiConfigCreate.parse(await req.json());
    await connectDB();

    // Case-insensitive, so "Draft" and "draft" cannot both exist and be told
    // apart only by somebody squinting at a list. The unique index is the
    // backstop; this is the message a person can act on.
    const clash = await AIModel.findOne({ name: new RegExp(`^${escapeRegExp(input.name)}$`, "i") })
      .select("_id")
      .lean();
    if (clash) return fail("There is already a model with that name — choose another.", 409);

    const doc = await AIModel.create({ ...input, status: "test", updatedBy: session.sub });

    await AuditLog.create({
      actorId: session.sub,
      actorRole: session.role,
      action: "ai.create",
      entity: "AIModel",
      entityId: String(doc._id),
      after: { ...input },
    });

    return ok({ model: aiView(doc.toObject()) }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

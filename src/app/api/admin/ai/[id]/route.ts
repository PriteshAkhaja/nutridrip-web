import { connectDB } from "@/lib/db/mongoose";
import { AIModel, AuditLog } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { ok, fail, handleError } from "@/lib/api";
import { AI_FIELDS, AiConfigPatch, aiChanges, escapeRegExp, type AiConfig } from "@/lib/ai/config";
import { aiView } from "@/lib/ai/view";
import { AI_STUDIO_ENABLED } from "@/lib/ai/enabled";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Edit a configuration and/or move it between Test and Active.
 *
 * Making one Active moves whichever was Active back to Test in the same request
 * — there is at most one, and the database enforces that with a partial unique
 * index, so two people activating at once cannot leave two live. The demotion
 * runs first: if the request dies between the two writes the result is no active
 * model, which is safe, rather than two, which is not.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    if (!AI_STUDIO_ENABLED) return fail("Not found", 404); // switched off — see lib/ai/enabled.ts
    const session = await getSession();
    if (!session || !can(session.role, "ai.configure")) return fail("Not permitted", 403);

    const { id } = await params;
    const patch = AiConfigPatch.parse(await req.json());
    await connectDB();

    const doc = await AIModel.findById(id);
    if (!doc) return fail("That model no longer exists", 404);

    const { status, ...fields } = patch;
    const current = doc.toObject() as AiConfig & { status: string };

    /* ---- the fields ---- */
    const changes = aiChanges(current, fields as Partial<AiConfig>);
    const fieldsChanged = Object.keys(changes.after).length > 0;

    if (fields.name !== undefined && fields.name !== current.name) {
      const clash = await AIModel.findOne({
        _id: { $ne: doc._id },
        name: new RegExp(`^${escapeRegExp(fields.name)}$`, "i"),
      })
        .select("_id")
        .lean();
      if (clash) return fail("There is already a model with that name — choose another.", 409);
    }

    for (const key of AI_FIELDS) {
      const v = (fields as Partial<AiConfig>)[key];
      if (v !== undefined) doc.set(key, v);
    }

    /* ---- the status ---- */
    let activated = false;
    let deactivated = false;
    let replaced: string | null = null;

    if (status && status !== current.status) {
      if (status === "active") {
        // Judged on what the record WILL hold, so writing a prompt and switching
        // it on in one request is fine.
        const willHave = fields.systemPrompt !== undefined ? fields.systemPrompt : current.systemPrompt;
        if (!willHave || !willHave.trim()) {
          return fail("Write a system prompt before making this the active model.", 409);
        }
        const previous = await AIModel.findOne({ status: "active", _id: { $ne: doc._id } })
          .select("name")
          .lean<{ name?: string } | null>();
        if (previous) {
          replaced = previous.name ?? null;
          await AIModel.updateMany({ status: "active", _id: { $ne: doc._id } }, { $set: { status: "test" } });
        }
        activated = true;
      } else {
        deactivated = true;
      }
      doc.set("status", status);
    }

    if (!fieldsChanged && !activated && !deactivated) return ok({ model: aiView(doc.toObject()), changed: false });

    doc.set("updatedBy", session.sub);
    try {
      await doc.save();
    } catch (err) {
      // Somebody else activated a model between our check and our write.
      if ((err as { code?: number })?.code === 11000 && activated) {
        return fail("Another model was made active at the same moment. Refresh the page and try again.", 409);
      }
      throw err;
    }

    /* ---- the trail: one row per act, so each reads on its own ---- */
    const base = {
      actorId: session.sub,
      actorRole: session.role,
      entity: "AIModel",
      entityId: id,
    };
    if (fieldsChanged) {
      await AuditLog.create({ ...base, action: "ai.update", before: changes.before, after: changes.after });
    }
    if (activated) {
      await AuditLog.create({
        ...base,
        action: "ai.activate",
        before: { status: "test" },
        after: { status: "active", name: current.name, ...(replaced ? { replaced } : {}) },
      });
    }
    if (deactivated) {
      await AuditLog.create({
        ...base,
        action: "ai.deactivate",
        before: { status: "active" },
        after: { status: "test", name: current.name },
      });
    }

    return ok({ model: aiView(doc.toObject()), changed: true, replaced });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Remove a configuration.
 *
 * Unlike a drip or a session, this is not a clinical record — it is settings —
 * so it can be deleted. Two limits: the Active one cannot, because somebody is
 * relying on it and it has to be moved off first, and the full row goes into
 * the trail, so a deleted prompt is never simply gone.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    if (!AI_STUDIO_ENABLED) return fail("Not found", 404); // switched off — see lib/ai/enabled.ts
    const session = await getSession();
    if (!session || !can(session.role, "ai.configure")) return fail("Not permitted", 403);

    const { id } = await params;
    await connectDB();

    const doc = await AIModel.findById(id);
    if (!doc) return fail("That model no longer exists", 404);
    if (doc.status === "active") {
      return fail("This is the active model. Move it to Test first, then delete it.", 409);
    }

    const snapshot = aiView(doc.toObject());
    await doc.deleteOne();

    await AuditLog.create({
      actorId: session.sub,
      actorRole: session.role,
      action: "ai.delete",
      entity: "AIModel",
      entityId: id,
      before: {
        name: snapshot.name,
        model: snapshot.model,
        temperature: snapshot.temperature,
        maxTokens: snapshot.maxTokens,
        systemPrompt: snapshot.systemPrompt,
        userPromptTemplate: snapshot.userPromptTemplate,
      },
    });

    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}

import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Booking, Drip, Order } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { DripInput, durationRangeError, resolveIngredients } from "@/lib/inventory/drip-input";
import { ok, fail, handleError } from "@/lib/api";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "drips.build")) return fail("Not permitted", 403);

    const { id } = await params;
    /**
     * `.partial()` makes a field optional; it does NOT strip its `.default()`.
     * So a PATCH carrying only a tagline still parses with durationMin 45,
     * priceInr 0 and isActive true — and writing those back renamed a drip
     * while quietly zeroing its price and un-retiring it.
     *
     * The request body is kept so only keys the caller actually sent are
     * written. Validation still runs through the schema; what changes is which
     * of its output is trusted.
     */
    const body = (await req.json()) as Record<string, unknown>;
    const sent = new Set(Object.keys(body ?? {}));
    const input = DripInput.partial().parse(body);
    await connectDB();

    const drip = await Drip.findById(id);
    if (!drip) return fail("Drip not found", 404);

    // Both the formula and whether a session kit rides with it decide what was
    // reserved, so both are locked while a confirmed order holds those units.
    const changesWhatIsDrawn =
      sent.has("ingredients") || (sent.has("withKit") && input.withKit !== drip.withKit);

    if (changesWhatIsDrawn) {
      let resolved: Awaited<ReturnType<typeof resolveIngredients>>["resolved"] | null = null;
      if (sent.has("ingredients") && input.ingredients) {
        const outcome = await resolveIngredients(input.ingredients);
        if (outcome.slips.length) return fail(outcome.slips.join(". "), 422);
        resolved = outcome.resolved;
      }

      // Changing a recipe under a confirmed order would mean the reserved
      // vials no longer match what will be prepared.
      const openOrders = await Order.countDocuments({
        status: "CONFIRMED",
        "lines.dripId": id,
      });
      if (openOrders > 0) {
        return fail(
          `${openOrders} confirmed order${openOrders === 1 ? "" : "s"} already reserved stock against this recipe. Dispatch or cancel them before changing it.`,
          409
        );
      }
      if (resolved) drip.ingredients = resolved;
    }

    // Against the values that will END UP on the record, not just what was
    // sent: an edit that raises only the short end has to be caught too.
    const badRange = durationRangeError(
      input.durationMin ?? drip.durationMin,
      input.durationToMin !== undefined ? input.durationToMin : drip.durationToMin
    );
    if (badRange) return fail(badRange, 422);

    // A fixed list, so anything the schema gains has to be named here too —
    // a field left off is accepted by the API and silently discarded on save.
    for (const key of [
      "name", "tagline", "description", "infusionNotes", "durationMin",
      "priceInr", "category", "withKit", "isPublic", "requiresApproval", "isActive",
      "bestFor", "goodToKnow",
      "volumeMl", "durationToMin", "tags", "icon", "isPopular", "benefits",
      "hsnCode", "gstRate",
    ] as const) {
      if (sent.has(key) && input[key] !== undefined) (drip as Record<string, unknown>)[key] = input[key];
    }

    // Cleared deliberately means "use the default kit", so an empty string is
    // not the same as not sending the field at all.
    if (sent.has("kitId")) drip.kitId = input.kitId || undefined;

    await drip.save();

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "drip.update",
      entity: "Drip",
      entityId: id,
      after: { name: drip.name, isActive: drip.isActive },
    });

    return ok({ id, name: drip.name, isActive: drip.isActive });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "drips.build")) return fail("Not permitted", 403);

    const { id } = await params;
    await connectDB();

    const drip = await Drip.findById(id);
    if (!drip) return fail("Drip not found", 404);

    // Retiring first, because it is always the safe outcome: the document stays,
    // so old reports still name it and an open order still resolves. Only the
    // hard delete can leave something dangling, so only it needs refusing.
    const given = await Booking.countDocuments({ dripId: id });
    if (given > 0) {
      drip.isActive = false;
      drip.isPublic = false;
      await drip.save();
      await AuditLog.create({
        actorId: session!.sub,
        actorRole: session!.role,
        action: "drip.retire",
        entity: "Drip",
        entityId: id,
        after: { given },
      });
      return ok({
        retired: true,
        given,
        message: `${given} session${given === 1 ? " has" : "s have"} used this recipe, so it was retired rather than deleted — those reports still name it.`,
      });
    }

    // Nothing has been given, but an open order still names it. Deleting now
    // would leave that order pointing at nothing, and its line would price and
    // prepare as blank.
    const onOrders = await Order.countDocuments({
      status: { $in: ["DRAFT", "CONFIRMED"] },
      "lines.dripId": id,
    });
    if (onOrders > 0) {
      return fail(
        `${onOrders} open order${onOrders === 1 ? "" : "s"} still name this recipe. Dispatch or cancel them first, or deactivate the drip instead of removing it.`,
        409
      );
    }

    await Drip.deleteOne({ _id: id });
    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "drip.delete",
      entity: "Drip",
      entityId: id,
    });
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}

import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, ProductMaster, SessionKit } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { KitInput } from "@/lib/inventory/kit-input";
import { paginate } from "@/lib/pagination-db";
import { pageInfo, parsePaging } from "@/lib/pagination";
import { ok, fail, handleError } from "@/lib/api";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "inventory.view")) return fail("Not permitted", 403);
    await connectDB();
    const q = new URL(req.url).searchParams;
    const { rows: kits, meta } = await paginate<{
      _id: unknown;
      name: string;
      description?: string;
      items: Array<{ masterId: unknown; qty: number }>;
      isDefault: boolean;
      isActive: boolean;
    }>(SessionKit, {}, {
      sort: { isDefault: -1, name: 1 },
      paging: parsePaging({ page: q.get("page"), pageSize: q.get("pageSize") }),
    });
    const masterIds = kits.flatMap((k) => (k.items ?? []).map((i) => String(i.masterId)));
    const masters = await ProductMaster.find({ _id: { $in: masterIds } }).lean<Array<{ _id: unknown; name: string }>>();
    const nameById = new Map(masters.map((m) => [String(m._id), m.name]));
    return ok({
      kits: kits.map((k) => ({
        id: String(k._id),
        name: k.name,
        description: k.description,
        isDefault: k.isDefault,
        isActive: k.isActive,
        items: (k.items ?? []).map((i) => ({ masterId: String(i.masterId), name: nameById.get(String(i.masterId)) ?? "Unknown", qty: i.qty })),
      })),
      pagination: pageInfo(meta),
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "drips.build")) return fail("Not permitted", 403);
    const input = KitInput.parse(await req.json());
    await connectDB();

    if (await SessionKit.exists({ name: input.name })) return fail(`A kit is already called "${input.name}"`, 409);
    const found = await ProductMaster.countDocuments({ _id: { $in: input.items.map((i) => i.masterId) } });
    if (found !== new Set(input.items.map((i) => i.masterId)).size) return fail("One of the kit items no longer exists", 422);

    if (input.isDefault) await SessionKit.updateMany({ isDefault: true }, { $set: { isDefault: false } });
    const kit = await SessionKit.create(input);

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "kit.create",
      entity: "SessionKit",
      entityId: String(kit._id),
      after: { name: input.name, items: input.items.length },
    });
    return ok({ id: String(kit._id), name: kit.name }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

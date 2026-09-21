import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, ProductMaster } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { CATEGORIES, UNITS } from "@/lib/models/types";
import { pageInfo, parsePaging } from "@/lib/pagination";
import { listMastersPage } from "@/lib/data/inventory";
import { ok, fail, handleError } from "@/lib/api";

const CreateMaster = z.object({
  name: z.string().min(1).max(160),
  molecule: z.string().max(160).optional(),
  hsnCode: z.string().min(4).max(20),
  gstRate: z.number().min(0).max(28).default(12),
  category: z.enum(CATEGORIES),
  canonicalUnit: z.enum(UNITS),
  reorderLevel: z.number().int().min(0).max(100000).default(0),
  /** Multidose vials carry their remainder forward; single-use ones waste it. */
  isMultidose: z.boolean().default(false),
  storageCondition: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
});

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "inventory.view")) return fail("Not permitted", 403);
    const params = new URL(req.url).searchParams;
    const category = params.get("category");
    // One page, from the database; stock is worked out for that page's products only.
    const { rows: masters, meta } = await listMastersPage({
      category: (category as (typeof CATEGORIES)[number]) || undefined,
      q: params.get("q") ?? undefined,
      paging: parsePaging({ page: params.get("page"), pageSize: params.get("pageSize") }),
    });
    return ok({ masters, pagination: pageInfo(meta) });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "inventory.manage")) return fail("Not permitted", 403);

    const input = CreateMaster.parse(await req.json());
    await connectDB();

    if (await ProductMaster.exists({ hsnCode: input.hsnCode })) {
      return fail("A product with that HSN code already exists", 409);
    }

    const master = await ProductMaster.create({ ...input, isActive: true });

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "master.create",
      entity: "ProductMaster",
      entityId: String(master._id),
      after: { name: input.name, hsnCode: input.hsnCode },
    });

    return ok({ master: { id: String(master._id), name: master.name } }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Drip, Order, User } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { nextReference, createWithReference } from "@/lib/sequence";
import { paginate } from "@/lib/pagination-db";
import { pageInfo, parsePaging } from "@/lib/pagination";
import { ok, fail, handleError } from "@/lib/api";

const CreateOrder = z.object({
  patientRef: z.string().max(64).optional(),
  patientName: z.string().max(120).optional(),
  /**
   * Which clinic the order is for. A clinic never sets this — its own id is
   * used — but the pharmacy raising one on a clinic's behalf must, or the
   * clinic would never see the order and the confirmation would go nowhere.
   */
  clinicId: z.string().optional(),
  includeKits: z.boolean().default(true),
  notes: z.string().max(2000).optional(),
  scheduledDelivery: z.string().datetime().optional(),
  lines: z
    .array(z.object({ dripId: z.string(), quantity: z.number().int().min(1).max(500), withKit: z.boolean().default(true) }))
    .min(1),
});

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "orders.view")) return fail("Not permitted", 403);

    await connectDB();
    const params = new URL(req.url).searchParams;
    const status = params.get("status");
    const filter: Record<string, unknown> = {};
    if (status && status !== "all") filter.status = status.toUpperCase();
    // A clinic only ever sees its own orders.
    if (session!.role === "clinic") filter.clinicId = session!.sub;

    const paging = parsePaging({ page: params.get("page"), pageSize: params.get("pageSize") });
    const { rows: orders, meta } = await paginate(Order, filter, { sort: { createdAt: -1 }, paging });
    return ok({ orders, pagination: pageInfo(meta) });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "orders.create")) return fail("Not permitted", 403);

    const input = CreateOrder.parse(await req.json());
    await connectDB();

    // A clinic's order is always its own; only the platform roles may attribute
    // one to somebody else.
    let clinicId: string | undefined;
    // The clinic's terms today: paid first, unless it is on credit.
    let onCredit: boolean | undefined;
    if (session!.role === "clinic") {
      clinicId = session!.sub;
      const me = await User.findById(clinicId).select("clinic.onCredit").lean<{ clinic?: { onCredit?: boolean } } | null>();
      onCredit = me?.clinic?.onCredit ?? false;
    } else if (input.clinicId) {
      const clinic = await User.findOne({ _id: input.clinicId, role: "clinic", status: "active" })
        .select("_id clinic.onCredit")
        .lean<{ _id: unknown; clinic?: { onCredit?: boolean } } | null>();
      if (!clinic) return fail("That is not an active partner clinic", 422);
      clinicId = input.clinicId;
      onCredit = clinic.clinic?.onCredit ?? false;
    }

    const drips = await Drip.find({ _id: { $in: input.lines.map((l) => l.dripId) } }).lean<
      Array<{ _id: unknown; name: string; priceInr: number }>
    >();
    const dripById = new Map(drips.map((d) => [String(d._id), d]));

    const lines = input.lines.map((l) => {
      const drip = dripById.get(l.dripId);
      if (!drip) throw new Error(`Drip ${l.dripId} not found`);
      return {
        dripId: l.dripId,
        dripName: drip.name,
        quantity: l.quantity,
        withKit: l.withKit,
        unitPrice: drip.priceInr,
      };
    });

    const amount = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    const year = new Date().getFullYear();
    const order = await createWithReference(
      (orderNo) =>
        Order.create({
          orderNo,
          patientRef: input.patientRef,
          patientName: input.patientName,
          clinicId,
          orderedBy: session!.sub,
          status: "DRAFT",
          includeKits: input.includeKits,
          lines,
          amount,
          // Kept on the order: a clinic moved on or off credit later does not
          // change what was agreed for orders already placed.
          ...(clinicId ? { onCredit, ...(onCredit ? {} : { payment: { state: "awaiting" } }) } : {}),
          notes: input.notes,
          scheduledDelivery: input.scheduledDelivery ? new Date(input.scheduledDelivery) : undefined,
        }),
      (attempt) =>
        nextReference(
          Order,
          "orderNo",
          (n) => `PO-${year}-${String(n).padStart(4, "0")}`,
          (ref) => Number(ref.split("-")[2] ?? 0),
          attempt
        )
    );

    return ok({ order: order.toObject() }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

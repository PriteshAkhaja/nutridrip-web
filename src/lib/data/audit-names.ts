import { connectDB } from "@/lib/db/mongoose";
import {
  BatchLot,
  Booking,
  Drip,
  HealthQuiz,
  Order,
  ProductMaster,
  TreatmentPlan,
  User,
} from "@/lib/models";

/**
 * The ids in an audit row, turned into what a person calls the thing.
 *
 * An audit trail is keyed on ids because names change and records get removed,
 * but nobody reads an id. Bookings and orders already carry a human reference
 * (ND-4417, PO-2026-0113) and most other records carry a name, so the column
 * can say what it is about without giving up the id underneath.
 *
 * Treatment plans are the exception: they have no reference of their own, so
 * they are named by the patient they were written for, which is what somebody
 * scanning the trail is looking for anyway.
 *
 * One query per *kind* of record on the page, never one per row — a fifty-row
 * page costs at most a handful of indexed `$in` lookups, and a page with only
 * refused-access rows on it costs none at all.
 */

const HEX = /^[0-9a-f]{24}$/;

/** `Entity:id`, so one map can hold every kind at once. */
export const nameKey = (entity: string, id: string) => `${entity}:${id}`;

type Row = { entity?: string; entityId?: string };

export async function nameEntities(
  rows: Row[],
  /** Actor ids, resolved in the same User query rather than a second one. */
  actorIds: Array<string | null | undefined> = []
): Promise<Map<string, string>> {
  const out = new Map<string, string>();

  const byEntity = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.entity || !r.entityId || !HEX.test(r.entityId)) continue;
    const set = byEntity.get(r.entity) ?? new Set<string>();
    set.add(r.entityId);
    byEntity.set(r.entity, set);
  }

  const ids = (entity: string) => [...(byEntity.get(entity) ?? [])];
  const wanted = (entity: string) => ids(entity).length > 0;

  const actors = actorIds.filter((v): v is string => typeof v === "string" && HEX.test(v));
  if (byEntity.size === 0 && actors.length === 0) return out;

  await connectDB();

  // Plans resolve in two steps — plan to patient, patient to name — so they go
  // first and their patients join the single User query below.
  const planPatient = new Map<string, string>();
  if (wanted("TreatmentPlan")) {
    const plans = await TreatmentPlan.find({ _id: { $in: ids("TreatmentPlan") } })
      .select("patientId")
      .lean<Array<{ _id: unknown; patientId?: unknown }>>();
    for (const p of plans) {
      if (p?.patientId) planPatient.set(String(p._id), String(p.patientId));
    }
  }

  const userIds = [...new Set([...ids("User"), ...actors, ...planPatient.values()])];

  const [users, bookings, orders, drips, masters, lots, quizzes] = await Promise.all([
    userIds.length
      ? User.find({ _id: { $in: userIds } })
          .select("name")
          .lean<Array<{ _id: unknown; name?: string }>>()
      : [],
    wanted("Booking")
      ? Booking.find({ _id: { $in: ids("Booking") } })
          .select("bookingNo")
          .lean<Array<{ _id: unknown; bookingNo?: string }>>()
      : [],
    wanted("Order")
      ? Order.find({ _id: { $in: ids("Order") } })
          .select("orderNo")
          .lean<Array<{ _id: unknown; orderNo?: string }>>()
      : [],
    wanted("Drip")
      ? Drip.find({ _id: { $in: ids("Drip") } })
          .select("name")
          .lean<Array<{ _id: unknown; name?: string }>>()
      : [],
    wanted("ProductMaster")
      ? ProductMaster.find({ _id: { $in: ids("ProductMaster") } })
          .select("name")
          .lean<Array<{ _id: unknown; name?: string }>>()
      : [],
    wanted("BatchLot")
      ? BatchLot.find({ _id: { $in: ids("BatchLot") } })
          .select("batchNo")
          .lean<Array<{ _id: unknown; batchNo?: string }>>()
      : [],
    wanted("HealthQuiz")
      ? HealthQuiz.find({ _id: { $in: ids("HealthQuiz") } })
          .select("name")
          .lean<Array<{ _id: unknown; name?: string }>>()
      : [],
  ]);

  const userName = new Map<string, string>();
  for (const u of users) if (u?.name) userName.set(String(u._id), u.name);

  for (const [id, name] of userName) out.set(nameKey("User", id), name);
  for (const b of bookings) if (b?.bookingNo) out.set(nameKey("Booking", String(b._id)), b.bookingNo);
  for (const o of orders) if (o?.orderNo) out.set(nameKey("Order", String(o._id)), o.orderNo);
  for (const d of drips) if (d?.name) out.set(nameKey("Drip", String(d._id)), d.name);
  for (const m of masters) if (m?.name) out.set(nameKey("ProductMaster", String(m._id)), m.name);
  for (const l of lots) {
    if (l?.batchNo) out.set(nameKey("BatchLot", String(l._id)), `Batch ${l.batchNo}`);
  }
  for (const q of quizzes) {
    if (q?.name) out.set(nameKey("HealthQuiz", String(q._id)), `${q.name}'s quiz`);
  }

  for (const [planId, patientId] of planPatient) {
    const name = userName.get(patientId);
    if (name) out.set(nameKey("TreatmentPlan", planId), `${name}'s plan`);
  }

  return out;
}

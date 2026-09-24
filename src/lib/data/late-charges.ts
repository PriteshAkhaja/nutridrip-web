import { connectDB } from "@/lib/db/mongoose";
import { Booking, User } from "@/lib/models";
import type { LateKind } from "@/lib/billing/late-policy";

export type Settled = "paid" | "waived" | null;
export type PaidMethod = "cash" | "upi" | "card" | "bank_transfer";

export type LateChargeRow = {
  bookingId: string;
  bookingNo: string;
  patientName: string;
  kind: LateKind;
  amount: number;
  at: string;
  note: string | null;
  settledAs: Settled;
  settledAt: string | null;
  paidMethod: PaidMethod | null;
};

type RawCharge = {
  kind: LateKind;
  amount: number;
  at: Date;
  note?: string;
  settledAs?: "paid" | "waived";
  settledAt?: Date;
  paidMethod?: PaidMethod;
};

/**
 * The latest late-change fees across all sessions -- unpaid first, then newest
 * -- and what is still owed in total. Who owes what, and what came in.
 */
export async function recentLateCharges(limit = 10): Promise<{ rows: LateChargeRow[]; owed: { count: number; amount: number } }> {
  await connectDB();
  const [rows, owedAgg] = await Promise.all([
    Booking.aggregate<{ _id: unknown; bookingNo: string; patientId: unknown; charge: RawCharge }>([
      { $match: { "charges.0": { $exists: true } } },
      { $unwind: "$charges" },
      { $addFields: { unsettled: { $cond: [{ $ifNull: ["$charges.settledAs", false] }, 1, 0] } } },
      { $sort: { unsettled: 1, "charges.at": -1 } },
      { $limit: limit },
      { $project: { bookingNo: 1, patientId: 1, charge: "$charges" } },
    ]),
    Booking.aggregate<{ count: number; amount: number }>([
      { $match: { "charges.0": { $exists: true } } },
      { $unwind: "$charges" },
      { $match: { "charges.settledAs": { $exists: false } } },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$charges.amount" } } },
    ]),
  ]);
  const people = await User.find({ _id: { $in: rows.map((r) => r.patientId) } })
    .select("name")
    .lean<Array<{ _id: unknown; name: string }>>();
  const nameOf = new Map(people.map((p) => [String(p._id), p.name]));
  return {
    rows: rows.map((r) => ({
      bookingId: String(r._id),
      bookingNo: r.bookingNo,
      patientName: nameOf.get(String(r.patientId)) ?? "A patient",
      kind: r.charge.kind,
      amount: r.charge.amount,
      at: new Date(r.charge.at).toISOString(),
      note: r.charge.note?.trim() || null,
      settledAs: r.charge.settledAs ?? null,
      settledAt: r.charge.settledAt ? new Date(r.charge.settledAt).toISOString() : null,
      paidMethod: r.charge.paidMethod ?? null,
    })),
    owed: { count: owedAgg[0]?.count ?? 0, amount: owedAgg[0]?.amount ?? 0 },
  };
}

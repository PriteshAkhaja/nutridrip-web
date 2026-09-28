import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Booking, Consultation, DoctorHours, HealthQuiz, User } from "@/lib/models";
import { notify } from "@/lib/notify";
import { istInstant, istParts } from "@/lib/clinical/slots";
import {
  callClash,
  callDates,
  callGrid,
  earliestDrip,
  hoursSummary,
  isOverdue,
  nextFreeCall,
  type BookedCall,
  type CallStatus,
  type DoctorHours as Hours,
} from "@/lib/clinical/calls";
import { getClockFormat } from "@/lib/settings/clock";

/**
 * The database side of phone calls with a physician. The rules live in
 * lib/clinical/calls; this reads what they need.
 */

type HoursRow = {
  weekly?: Array<{ day: number; start: string; end: string }>;
  callMinutes?: number;
  daysOff?: string[];
};

function toHours(row: HoursRow | null): Hours | null {
  if (!row) return null;
  return {
    weekly: (row.weekly ?? []).map((w) => ({ day: w.day, start: w.start, end: w.end })),
    callMinutes: row.callMinutes ?? 15,
    daysOff: [...(row.daysOff ?? [])],
  };
}

/**
 * The unique indexes that stop double booking must exist before the first
 * write -- Mongoose builds them in the background otherwise, and two bookings
 * racing a fresh database could both get in. Resolves at once after the first call.
 */
export function ensureCallIndexes(): Promise<unknown> {
  return Consultation.init();
}

export async function hoursOf(doctorId: string): Promise<Hours | null> {
  await connectDB();
  return toHours(await DoctorHours.findOne({ doctorId }).lean<HoursRow | null>());
}

/** A physician's booked calls between two moments, as the rules want them. */
export async function bookedCalls(
  doctorId: string,
  from: Date,
  to: Date,
  excludeId?: string | null
): Promise<BookedCall[]> {
  await connectDB();
  const rows = await Consultation.find({
    doctorId,
    status: "booked",
    startAt: { $gte: new Date(from.getTime() - 3 * 3_600_000), $lte: to },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
    .select("startAt minutes")
    .lean<Array<{ startAt: Date; minutes: number }>>();
  return rows.map((r) => ({ start: new Date(r.startAt).getTime(), minutes: r.minutes }));
}

/** The 7-day window calls are offered in, as moments. */
export function callWindow(now = new Date()) {
  const dates = callDates(now);
  return { dates, from: istInstant(dates[0], "00:00"), to: istInstant(dates[dates.length - 1], "23:59") };
}

/** One physician's call times for the next 7 days. `excludeCallId`: the call being moved does not block itself. */
export async function callGridFor(doctorId: string, excludeCallId?: string | null) {
  const [hours, doctor] = await Promise.all([
    hoursOf(doctorId),
    User.findOne({ _id: doctorId, role: "doctor", status: "active" }).select("name").lean<{ name: string } | null>(),
  ]);
  if (!hours || !doctor) return null;
  const { dates, from, to } = callWindow();
  const booked = await bookedCalls(doctorId, from, to, excludeCallId);
  return { doctorName: doctor.name, hours, days: callGrid(hours, booked, dates) };
}

export type BookableDoctor = {
  id: string;
  name: string;
  specialization: string | null;
  callMinutes: number;
  hours: string;
  /** The first free call, ISO, or null when the week is full. */
  nextFree: string | null;
};

/** Every active physician with hours set, and when they can next take a call. */
export async function bookableDoctors(): Promise<BookableDoctor[]> {
  const clockFmt = await getClockFormat();
  await connectDB();
  const doctors = await User.find({ role: "doctor", status: "active" })
    .select("name doctor.specialization")
    .sort({ name: 1 })
    .lean<Array<{ _id: unknown; name: string; doctor?: { specialization?: string } }>>();
  const all = await DoctorHours.find({ doctorId: { $in: doctors.map((d) => d._id) } }).lean<
    Array<HoursRow & { doctorId: unknown }>
  >();
  const hoursById = new Map(all.map((h) => [String(h.doctorId), toHours(h)!]));
  const { dates, from, to } = callWindow();

  const out: BookableDoctor[] = [];
  for (const d of doctors) {
    const hours = hoursById.get(String(d._id));
    // No hours, no calls: a physician who has not said when they are free is not offered.
    if (!hours || hours.weekly.length === 0) continue;
    const booked = await bookedCalls(String(d._id), from, to);
    out.push({
      id: String(d._id),
      name: d.name,
      specialization: d.doctor?.specialization ?? null,
      callMinutes: hours.callMinutes,
      hours: hoursSummary(hours, clockFmt),
      nextFree: nextFreeCall(callGrid(hours, booked, dates)),
    });
  }
  return out;
}

export type CallView = {
  id: string;
  callNo: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  startAt: string;
  minutes: number;
  phone: string;
  status: CallStatus;
  overdue: boolean;
  outcomeAt: string | null;
};

type CallRow = {
  _id: unknown;
  callNo: string;
  patientId: unknown;
  doctorId: unknown;
  startAt: Date;
  minutes: number;
  phone: string;
  status: CallStatus;
  outcomeAt?: Date;
};

async function view(rows: CallRow[]): Promise<CallView[]> {
  const doctors = await User.find({ _id: { $in: rows.map((r) => r.doctorId) } })
    .select("name")
    .lean<Array<{ _id: unknown; name: string }>>();
  const nameOf = new Map(doctors.map((d) => [String(d._id), d.name]));
  return rows.map((r) => ({
    id: String(r._id),
    callNo: r.callNo,
    patientId: String(r.patientId),
    doctorId: String(r.doctorId),
    doctorName: nameOf.get(String(r.doctorId)) ?? "your physician",
    startAt: new Date(r.startAt).toISOString(),
    minutes: r.minutes,
    phone: r.phone,
    status: r.status,
    overdue: isOverdue(r),
    outcomeAt: r.outcomeAt ? new Date(r.outcomeAt).toISOString() : null,
  }));
}

/** The patient's booked call, if any. There is at most one (the database enforces it). */
export async function openCallFor(patientId: string): Promise<CallView | null> {
  await connectDB();
  const row = await Consultation.findOne({ patientId, status: "booked" }).lean<CallRow | null>();
  return row ? (await view([row]))[0] : null;
}

/** The patient's latest call, whatever became of it. */
export async function lastCallFor(patientId: string): Promise<CallView | null> {
  await connectDB();
  const row = await Consultation.findOne({ patientId }).sort({ createdAt: -1 }).lean<CallRow | null>();
  return row ? (await view([row]))[0] : null;
}

/**
 * May a patient who still needs an approval hold a drip, and from when?
 *
 * Yes with a call booked (the drip then waits until 2 hours after it), or when
 * the call already happened for these answers (a physician's question, say).
 * Otherwise they book the call first.
 */
export async function callGate(
  patientId: string,
  quizCompletedAt: Date
): Promise<{ ok: true; call: CallView | null; notBefore: number | null } | { ok: false; message: string }> {
  const call = await openCallFor(patientId);
  if (call) return { ok: true, call, notBefore: earliestDrip(new Date(call.startAt).getTime(), call.minutes) };
  const had = await Consultation.exists({ patientId, status: "done", outcomeAt: { $gte: quizCompletedAt } });
  if (had) return { ok: true, call: null, notBefore: null };
  return {
    ok: false,
    message: "Book your phone call with a physician first. Your drip is held from two hours after the call.",
  };
}

/** Unanswered calls since the patient's latest answers. */
export async function unansweredSince(patientId: string, since: Date): Promise<number> {
  await connectDB();
  return Consultation.countDocuments({ patientId, status: "no_answer", outcomeAt: { $gte: since } });
}

/**
 * Held drips whose time passed without a physician's approval are released.
 *
 * Nothing in the app runs on a timer, so this runs whenever a screen that
 * shows them is opened (Home, Sessions, the physician's queue, the calls
 * pages). A held drip an hour past its time is called off, and the patient is
 * told to pick a new time once approved.
 */
export async function expireStaleHolds(patientId?: string): Promise<number> {
  await connectDB();
  const stale = await Booking.find({
    status: "awaiting_review",
    scheduledAt: { $lt: new Date(Date.now() - 60 * 60_000) },
    ...(patientId ? { patientId } : {}),
  })
    .select("bookingNo patientId scheduledAt")
    .lean<Array<{ _id: unknown; bookingNo: string; patientId: unknown; scheduledAt: Date }>>();
  for (const b of stale) {
    // Claimed on status, so two screens opening at once release it once.
    const res = await Booking.updateOne(
      { _id: b._id, status: "awaiting_review" },
      {
        $set: {
          status: "cancelled",
          cancelledAt: new Date(),
          cancelReason: "The time passed before a physician approved it.",
        },
      }
    );
    if (!res.modifiedCount) continue;
    await notify(
      String(b.patientId),
      `Your held session lapsed · ${b.bookingNo}`,
      "Its time passed before a physician approved your answers. Pick a new time once they have.",
      "warning",
      "/app"
    );
    await AuditLog.create({
      actorRole: "system",
      action: "booking.hold_lapsed",
      entity: "Booking",
      entityId: String(b._id),
      before: { status: "awaiting_review", scheduledAt: b.scheduledAt },
      after: { status: "cancelled" },
    }).catch(() => {});
  }
  return stale.length;
}

export type BoardRow = {
  id: string;
  callNo: string;
  patientId: string;
  patientName: string;
  phone: string;
  doctorId: string;
  doctorName: string;
  startAt: string;
  minutes: number;
  status: CallStatus;
  overdue: boolean;
  /** Close enough to its time to be marked called or unanswered. */
  due: boolean;
  /** Falls on today's date in India. */
  today: boolean;
  /** The call no longer fits the physician's hours (a day off added, hours shortened). */
  clash: string | null;
  /** The answers the call is about, still undecided. */
  quizId: string | null;
  held: { bookingNo: string; scheduledAt: string } | null;
  outcomeAt: string | null;
};

/**
 * The calls screens' rows: booked calls up to a week ahead (overdue ones
 * included, however old), and calls marked in the last day. One physician's,
 * or everyone's.
 */
export async function callsBoard(doctorId?: string): Promise<BoardRow[]> {
  await connectDB();
  const now = Date.now();
  const rows = await Consultation.find({
    ...(doctorId ? { doctorId } : {}),
    $or: [
      { status: "booked", startAt: { $lte: new Date(now + 8 * 86_400_000) } },
      { status: { $in: ["done", "no_answer"] }, outcomeAt: { $gte: new Date(now - 86_400_000) } },
    ],
  })
    .sort({ startAt: 1 })
    .lean<CallRow[]>();
  if (rows.length === 0) return [];

  const patientIds = rows.map((r) => r.patientId);
  const doctorIds = [...new Set(rows.map((r) => String(r.doctorId)))];
  const [people, quizzes, held, allHours] = await Promise.all([
    User.find({ _id: { $in: [...patientIds, ...doctorIds] } })
      .select("name")
      .lean<Array<{ _id: unknown; name: string }>>(),
    HealthQuiz.find({ patientId: { $in: patientIds }, reviewStatus: { $in: ["pending", "info_needed"] } })
      .select("patientId completedAt")
      .sort({ completedAt: -1 })
      .lean<Array<{ _id: unknown; patientId: unknown }>>(),
    Booking.find({ patientId: { $in: patientIds }, status: "awaiting_review", scheduledAt: { $gte: new Date() } })
      .select("patientId bookingNo scheduledAt")
      .sort({ scheduledAt: 1 })
      .lean<Array<{ patientId: unknown; bookingNo: string; scheduledAt: Date }>>(),
    DoctorHours.find({ doctorId: { $in: doctorIds } }).lean<Array<HoursRow & { doctorId: unknown }>>(),
  ]);
  const nameOf = new Map(people.map((p) => [String(p._id), p.name]));
  const quizOf = new Map<string, string>();
  for (const q of quizzes) if (!quizOf.has(String(q.patientId))) quizOf.set(String(q.patientId), String(q._id));
  const heldOf = new Map<string, { bookingNo: string; scheduledAt: string }>();
  for (const b of held) {
    if (!heldOf.has(String(b.patientId)))
      heldOf.set(String(b.patientId), { bookingNo: b.bookingNo, scheduledAt: new Date(b.scheduledAt).toISOString() });
  }
  const hoursOfDoctor = new Map(allHours.map((h) => [String(h.doctorId), toHours(h)!]));

  return rows.map((r) => {
    const hours = hoursOfDoctor.get(String(r.doctorId));
    return {
      id: String(r._id),
      callNo: r.callNo,
      patientId: String(r.patientId),
      patientName: nameOf.get(String(r.patientId)) ?? "Patient",
      phone: r.phone,
      doctorId: String(r.doctorId),
      doctorName: nameOf.get(String(r.doctorId)) ?? "Physician",
      startAt: new Date(r.startAt).toISOString(),
      minutes: r.minutes,
      status: r.status,
      overdue: isOverdue(r),
      due: now >= new Date(r.startAt).getTime() - 15 * 60_000,
      today: istParts(new Date(r.startAt)).date === istParts(new Date(now)).date,
      clash:
        r.status === "booked" && hours && new Date(r.startAt).getTime() > now
          ? callClash(hours, r.startAt, r.minutes)
          : null,
      quizId: quizOf.get(String(r.patientId)) ?? null,
      held: heldOf.get(String(r.patientId)) ?? null,
      outcomeAt: r.outcomeAt ? new Date(r.outcomeAt).toISOString() : null,
    };
  });
}

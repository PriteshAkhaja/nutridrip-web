import { connectDB } from "@/lib/db/mongoose";
import { Booking, User } from "@/lib/models";
import { paginate } from "@/lib/pagination-db";
import type { PageMeta, Paging } from "@/lib/pagination";
import { phaseProgress, type PhaseProgress } from "@/lib/clinical/checklist";
import type { BookingStatus, SessionLocation } from "@/lib/models/types";

export type SessionCard = {
  id: string;
  bookingNo: string;
  patientName: string;
  patientId: string;
  dripName: string;
  scheduledAt: string;
  endsAt: string;
  timeRange: string;
  where: string;
  location: SessionLocation;
  status: BookingStatus;
  batches: string[];
  progress: PhaseProgress[];
  stepsDone: number;
  stepsTotal: number;
};

function timeOf(d: Date): string {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

type LeanBooking = {
  _id: unknown;
  bookingNo: string;
  patientId: unknown;
  dripName?: string;
  scheduledAt: Date;
  durationMin: number;
  address?: string;
  city?: string;
  location: SessionLocation;
  status: BookingStatus;
  componentsGiven?: Array<{ batchNo?: string }>;
  checklist: Array<{ phase: string; doneAt?: Date }>;
};

function toCard(b: LeanBooking, patientName: string): SessionCard {
  const endsAt = new Date(b.scheduledAt.getTime() + (b.durationMin ?? 45) * 60_000);
  const progress = phaseProgress(b.checklist ?? []);

  return {
    id: String(b._id),
    bookingNo: b.bookingNo,
    patientName,
    patientId: String(b.patientId),
    dripName: b.dripName ?? "—",
    scheduledAt: b.scheduledAt.toISOString(),
    endsAt: endsAt.toISOString(),
    timeRange: `${timeOf(b.scheduledAt)} – ${timeOf(endsAt)}`,
    where: b.address ?? b.city ?? "—",
    location: b.location,
    status: b.status,
    batches: [...new Set((b.componentsGiven ?? []).map((c) => c.batchNo).filter(Boolean) as string[])],
    progress,
    stepsDone: progress.reduce((s, p) => s + p.done, 0),
    stepsTotal: progress.reduce((s, p) => s + p.total, 0),
  };
}

async function withPatientNames(bookings: LeanBooking[]): Promise<SessionCard[]> {
  const patients = await User.find({ _id: { $in: bookings.map((b) => b.patientId) } }).lean<
    Array<{ _id: unknown; name: string }>
  >();
  const nameById = new Map(patients.map((p) => [String(p._id), p.name]));
  return bookings.map((b) => toCard(b, nameById.get(String(b.patientId)) ?? "Unknown patient"));
}

/** A nurse's route for one day, in the order they will drive it. */
export async function nurseRoute(nurseId: string, day = new Date()): Promise<SessionCard[]> {
  await connectDB();
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);

  const bookings = await Booking.find({
    nurseId,
    scheduledAt: { $gte: start, $lte: end },
    status: { $ne: "cancelled" },
  })
    .sort({ scheduledAt: 1 })
    .lean<LeanBooking[]>();

  return withPatientNames(bookings);
}

export async function getSessionCard(bookingId: string): Promise<SessionCard | null> {
  await connectDB();
  const b = await Booking.findById(bookingId).lean<LeanBooking | null>();
  if (!b) return null;
  const [card] = await withPatientNames([b]);
  return card;
}

export async function patientSessions(patientId: string): Promise<SessionCard[]> {
  await connectDB();
  const bookings = await Booking.find({ patientId }).sort({ scheduledAt: -1 }).lean<LeanBooking[]>();
  return withPatientNames(bookings);
}

const FINISHED = ["completed", "cancelled"];

/**
 * A patient's sessions, split the way their screen shows them.
 *
 * Upcoming sessions are returned whole: they are what the patient may still
 * cancel or move, so none can sit on page 2, and there are only ever a few.
 * History only grows, so it is one page from the database. Both halves keep the
 * order the screen always had (newest first).
 */
export async function patientSessionsPaged(
  patientId: string,
  paging: Paging
): Promise<{ upcoming: SessionCard[]; past: SessionCard[]; meta: PageMeta }> {
  await connectDB();
  const [upcomingBookings, history] = await Promise.all([
    Booking.find({ patientId, status: { $nin: FINISHED } }).sort({ scheduledAt: -1 }).lean<LeanBooking[]>(),
    paginate<LeanBooking>(Booking, { patientId, status: { $in: FINISHED } }, { sort: { scheduledAt: -1 }, paging }),
  ]);
  const cards = await withPatientNames([...upcomingBookings, ...history.rows]);
  return {
    upcoming: cards.slice(0, upcomingBookings.length),
    past: cards.slice(upcomingBookings.length),
    meta: history.meta,
  };
}

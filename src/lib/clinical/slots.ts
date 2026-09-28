/**
 * The times a patient can book, and whether a nurse can actually come.
 *
 * Slots are not a fixed list. Each zone has opening hours and a step (set by
 * the super admin on Service zones): Koramangala, 07:00–20:00 every hour, offers
 * 07:00 … 19:00. A time is only offered while a nurse who works that zone is
 * free for it — the session itself, plus travel to the next door. Otherwise it
 * is shown taken, so a patient never books a time nobody can attend.
 *
 * Pure, and every clock reading is India time whatever the server's timezone,
 * so the booking screen, the server's check and the tests agree on what
 * "10:00 on Friday" means. The database side is lib/clinical/slot-availability.ts.
 */

import { clock, dateIN, type ClockFormat } from "@/lib/time";

/** Inside this window the nurse is already dispatched with the batch drawn. */
export const LATE_CHANGE_HOURS = 4;
export const LATE_CANCEL_FEE_INR = 500;

/** Slots inside this window cannot be booked — the nurse needs the lead time. */
export const MIN_LEAD_MS = 60 * 60_000;

/** How many days ahead, from tomorrow, a patient can book. */
export const DAYS_RELEASED = 5;

/**
 * Between one session ending and the next starting, a nurse travels. The same
 * figure the public Zones page quotes ("45 min typical nurse travel").
 */
export const BETWEEN_SESSIONS_MIN = 45;

/** The steps a super admin can choose for a zone. */
export const SLOT_STEPS = [30, 45, 60, 90, 120] as const;
export const DEFAULT_SLOT_MINUTES = 60;

/**
 * Bookings that hold a nurse's time: everything booked and not yet over. A
 * held slot waiting on the physician counts too — the patient was promised it.
 */
export const HOLDING_STATUSES = ["awaiting_review", "approved", "nurse_assigned", "en_route", "in_progress"];

/** One of the patient's own sessions, as far as the overlap rule needs it. */
export type OwnSession = {
  bookingNo: string;
  dripName?: string | null;
  scheduledAt: Date | string;
  durationMin?: number | null;
};

/**
 * The first of a patient's own sessions that a new one from `start`, lasting
 * `durationMin`, would overlap. One person cannot be on two drips at once, and
 * each booking sends a nurse and draws stock, so a clash is refused rather
 * than left for the nurse to discover at the door.
 */
export function ownClash<T extends OwnSession>(sessions: T[], start: number, durationMin: number): T | null {
  const end = start + durationMin * 60_000;
  for (const s of sessions) {
    const from = new Date(s.scheduledAt).getTime();
    const to = from + (s.durationMin ?? 45) * 60_000;
    if (start < to && from < end) return s;
  }
  return null;
}

/** "You already have ND-4421 (Myers' Revive) on 30 Sept, 10:00 AM–10:45 AM. …" */
export function ownClashMessage(s: OwnSession, fmt: ClockFormat): string {
  const from = new Date(s.scheduledAt).getTime();
  const to = from + (s.durationMin ?? 45) * 60_000;
  const when = `${dateIN(from, { year: undefined })}, ${clock(from, fmt)}–${clock(to, fmt)}`;
  return `You already have ${s.bookingNo}${s.dripName ? ` (${s.dripName})` : ""} on ${when}. Pick a time that does not overlap it.`;
}

export type Hours = { opensAt: string; closesAt: string; slotMinutes: number };

/** A place outside every zone (a partner clinic's rooms, say) runs these. */
export const DEFAULT_HOURS: Hours = { opensAt: "08:00", closesAt: "20:00", slotMinutes: DEFAULT_SLOT_MINUTES };

// ---------------------------------------------------------------- clock

const IST = "Asia/Kolkata";

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const hhmmOf = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

/** "2026-09-25" + "10:00" → that moment in India. */
export function istInstant(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+05:30`);
}

/** A moment, as India reads it: { date: "2026-09-25", time: "10:00" }. */
export function istParts(at: Date): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: IST,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/** The bookable dates, tomorrow onwards in India, as "YYYY-MM-DD". */
export function releasedDates(count = DAYS_RELEASED, now = new Date()): string[] {
  const today = istParts(now).date;
  const base = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  return Array.from({ length: count }, (_, i) => new Date(base + (i + 1) * 86_400_000).toISOString().slice(0, 10));
}

// ---------------------------------------------------------------- the grid

/**
 * The start times a zone offers: from opening, every `slotMinutes`, for as long
 * as a slot still fits before closing. 07:00–20:00 hourly → 07:00 … 19:00.
 */
export function slotTimes(hours: Hours): string[] {
  const open = minutesOf(hours.opensAt);
  const close = minutesOf(hours.closesAt);
  const step = hours.slotMinutes > 0 ? hours.slotMinutes : DEFAULT_SLOT_MINUTES;
  const out: string[] = [];
  for (let t = open; t + step <= close; t += step) out.push(hhmmOf(t));
  return out;
}

/** "every hour", "every 30 min", "every 1 h 30 min". */
export function stepLabel(slotMinutes: number): string {
  if (slotMinutes === 60) return "every hour";
  if (slotMinutes < 60) return `every ${slotMinutes} min`;
  const h = Math.floor(slotMinutes / 60);
  const m = slotMinutes % 60;
  return m ? `every ${h} h ${m} min` : `every ${h} hours`;
}

/** A booking that holds a nurse's time. `nurseId` null: not yet given to anyone. */
export type Held = {
  id: string;
  nurseId: string | null;
  start: number;
  durationMin: number;
  /** The zone its address falls in, so an unassigned one is charged to the right zone. */
  zoneName: string | null;
};

/** Two sessions clash when one starts before the other has ended and the nurse has travelled on. */
export function clashes(aStart: number, aMin: number, bStart: number, bMin: number): boolean {
  const gap = BETWEEN_SESSIONS_MIN * 60_000;
  return aStart < bStart + bMin * 60_000 + gap && bStart < aStart + aMin * 60_000 + gap;
}

/** The nurses already busy at this time. */
export function busyNurses(held: Held[], start: number, durationMin: number): Set<string> {
  return new Set(
    held.filter((h) => h.nurseId && clashes(start, durationMin, h.start, h.durationMin)).map((h) => h.nurseId!)
  );
}

/**
 * How many nurses who work the zone are still free at this time.
 *
 * The pool's nurses, minus those busy then, minus the zone's sessions booked
 * for then that have no nurse yet (each will need one of those free nurses).
 */
export function freeNurses(opts: {
  pool: string[];
  held: Held[];
  zoneName: string | null;
  start: number;
  durationMin: number;
}): number {
  const busy = busyNurses(opts.held, opts.start, opts.durationMin);
  const free = opts.pool.filter((n) => !busy.has(n)).length;
  const waiting = opts.held.filter(
    (h) => !h.nurseId && h.zoneName === opts.zoneName && clashes(opts.start, opts.durationMin, h.start, h.durationMin)
  ).length;
  return free - waiting;
}

/**
 * free · taken (nobody free) · too_soon (inside the lead hour) · before_call
 * (a held drip must come 2 hours after the patient's call with the physician).
 */
export type SlotState = "free" | "taken" | "too_soon" | "before_call";
export type SlotCell = { time: string; at: string; state: SlotState };
export type SlotDay = {
  date: string;
  weekday: string;
  day: number;
  month: string;
  slots: SlotCell[];
  freeCount: number;
  /** Why a day has no times at all, e.g. "Day off". */
  note?: string;
};

/** "Fri", 26, "Sept" for a "YYYY-MM-DD" date, whatever the server's timezone. */
export function dayLabel(date: string): Pick<SlotDay, "weekday" | "day" | "month"> {
  const label = new Date(`${date}T00:00:00Z`);
  return {
    weekday: label.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }),
    day: label.getUTCDate(),
    month: label.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" }),
  };
}

export type SlotContext = {
  hours: Hours;
  /** Nurse ids who can be sent to this address. */
  pool: string[];
  held: Held[];
  zoneName: string | null;
};

/**
 * The days and times a patient is offered, each marked free, taken or too soon.
 * `notBefore` (ms): nothing earlier is offered — a held drip waits 2 hours after
 * the patient's call with the physician.
 */
export function slotGrid(
  ctx: SlotContext,
  durationMin: number,
  dates: string[],
  now = Date.now(),
  notBefore?: number | null
): SlotDay[] {
  const times = slotTimes(ctx.hours);
  return dates.map((date) => {
    const slots = times.map((time): SlotCell => {
      const at = istInstant(date, time);
      const start = at.getTime();
      const state: SlotState =
        start - now < MIN_LEAD_MS
          ? "too_soon"
          : notBefore && start < notBefore
            ? "before_call"
            : freeNurses({ pool: ctx.pool, held: ctx.held, zoneName: ctx.zoneName, start, durationMin }) > 0
              ? "free"
              : "taken";
      return { time, at: at.toISOString(), state };
    });
    return { date, ...dayLabel(date), slots, freeCount: slots.filter((s) => s.state === "free").length };
  });
}

/**
 * The server's check on a chosen time: on the zone's grid, inside its hours,
 * and a nurse free for it. Null when it can be booked; otherwise what to say,
 * and the status to say it with.
 */
export function slotProblem(
  ctx: SlotContext,
  at: Date,
  durationMin: number,
  now = Date.now()
): { error: string; status: 409 | 422 } | null {
  if (at.getTime() - now < MIN_LEAD_MS) return { error: "Pick a slot at least an hour from now", status: 422 };
  const { time } = istParts(at);
  const times = slotTimes(ctx.hours);
  if (!times.includes(time)) {
    const where = ctx.zoneName ?? "This area";
    return {
      error: `${time} is not a bookable time. ${where} takes bookings ${stepLabel(ctx.hours.slotMinutes)} from ${times[0] ?? ctx.hours.opensAt} to ${times[times.length - 1] ?? ctx.hours.closesAt}.`,
      status: 422,
    };
  }
  const free = freeNurses({ pool: ctx.pool, held: ctx.held, zoneName: ctx.zoneName, start: at.getTime(), durationMin });
  if (free <= 0) {
    return { error: "No nurse is free at that time any more. Pick another time.", status: 409 };
  }
  return null;
}

/**
 * Phone calls with a physician, booked by the patient before their first drip.
 *
 * A patient who needs an approval (first time, a retake, or an approval that
 * ran out) chooses a physician and a time from that physician's own hours. The
 * physician reads the answers, phones the patient, and decides. The drip the
 * patient holds must come at least two hours after the call, so the decision
 * can be made before the nurse sets off.
 *
 * Pure, and in India time like lib/clinical/slots, so the booking screen, the
 * server's checks and the tests all agree. The database side is
 * lib/data/calls.ts.
 */
import { dayLabel, istInstant, istParts, type SlotCell, type SlotDay, type SlotState } from "./slots";
import { clockOf, dayClock, type ClockFormat } from "@/lib/time";

/** 0 = Sunday … 6 = Saturday, as Date.getUTCDay() counts. */
export type HoursWindow = { day: number; start: string; end: string };

/** A physician's hours for calls. */
export type DoctorHours = {
  weekly: HoursWindow[];
  /** How long one call is. */
  callMinutes: number;
  /** "YYYY-MM-DD" dates with no calls. */
  daysOff: string[];
};

export const CALL_LENGTHS = [10, 15, 20, 30];
export const DEFAULT_CALL_MINUTES = 15;

/** A call is booked at least this far ahead, so the physician can read the answers first. */
export const CALL_LEAD_MS = 60 * 60_000;

/** A held drip starts at least this long after the call ends. */
export const DRIP_AFTER_CALL_MIN = 120;

/** A call still marked booked this long after it should have ended reads as overdue. */
export const OVERDUE_AFTER_MIN = 15;

/** After this many unanswered calls the held drip is called off. */
export const MAX_NO_ANSWER = 2;

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type CallStatus = "booked" | "done" | "no_answer" | "cancelled";

export const CALL_STATUS_LABEL: Record<CallStatus, string> = {
  booked: "Booked",
  done: "Called",
  no_answer: "No answer",
  cancelled: "Cancelled",
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const mins = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const hhmm = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

/** The weekday of an India date, 0 = Sunday. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** How many days of calls a patient can choose from, today included. */
export const CALL_DAYS = 7;

/** Today and the next six days, in India, as "YYYY-MM-DD". Calls can be booked for later today. */
export function callDates(now = new Date(), count = CALL_DAYS): string[] {
  const today = istParts(now).date;
  const base = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  return Array.from({ length: count }, (_, i) => new Date(base + i * 86_400_000).toISOString().slice(0, 10));
}

/** The call start times a physician offers on a date: every call length, while a call still fits the window. */
export function callTimes(h: DoctorHours, date: string): string[] {
  if (h.daysOff.includes(date)) return [];
  const len = h.callMinutes > 0 ? h.callMinutes : DEFAULT_CALL_MINUTES;
  const day = weekdayOf(date);
  const out: string[] = [];
  for (const w of [...h.weekly].filter((w) => w.day === day).sort((a, b) => mins(a.start) - mins(b.start))) {
    for (let t = mins(w.start); t + len <= mins(w.end); t += len) out.push(hhmm(t));
  }
  return out;
}

/** A call already on the books: its start (ms) and length. */
export type BookedCall = { start: number; minutes: number };

/** Whether two calls overlap. Calls are back to back, with no travel between them. */
export function callsOverlap(aStart: number, aMin: number, bStart: number, bMin: number): boolean {
  return aStart < bStart + bMin * 60_000 && bStart < aStart + aMin * 60_000;
}

/** The days and times a patient can book a call with this physician. */
export function callGrid(h: DoctorHours, booked: BookedCall[], dates: string[], now = Date.now()): SlotDay[] {
  return dates.map((date) => {
    const slots = callTimes(h, date).map((time): SlotCell => {
      const at = istInstant(date, time);
      const start = at.getTime();
      const state: SlotState =
        start - now < CALL_LEAD_MS
          ? "too_soon"
          : booked.some((b) => callsOverlap(start, h.callMinutes, b.start, b.minutes))
            ? "taken"
            : "free";
      return { time, at: at.toISOString(), state };
    });
    const note = h.daysOff.includes(date)
      ? "Day off"
      : !h.weekly.some((w) => w.day === weekdayOf(date))
        ? "No calls"
        : undefined;
    return {
      date,
      ...dayLabel(date),
      slots,
      freeCount: slots.filter((s) => s.state === "free").length,
      ...(note ? { note } : {}),
    };
  });
}

/** The first free call time in the grid, or null. */
export function nextFreeCall(days: SlotDay[]): string | null {
  for (const d of days) for (const s of d.slots) if (s.state === "free") return s.at;
  return null;
}

/** The server's check on a chosen call time. Null when it can be booked. */
export function callProblem(
  h: DoctorHours,
  booked: BookedCall[],
  at: Date,
  now = Date.now()
): { error: string; status: 409 | 422 } | null {
  if (at.getTime() - now < CALL_LEAD_MS) {
    return {
      error: "Pick a call at least an hour from now, so the physician can read your answers first.",
      status: 422,
    };
  }
  const { date, time } = istParts(at);
  if (h.daysOff.includes(date))
    return { error: "The physician is not taking calls that day. Pick another day.", status: 422 };
  if (!callTimes(h, date).includes(time)) {
    return { error: `${time} is not one of this physician's call times. Pick a time from the list.`, status: 422 };
  }
  if (booked.some((b) => callsOverlap(at.getTime(), h.callMinutes, b.start, b.minutes))) {
    return { error: "That call time was just taken. Pick another.", status: 409 };
  }
  return null;
}

/** The earliest a held drip may start after a call (ms). */
export function earliestDrip(callStart: number, callMinutes: number): number {
  return callStart + (callMinutes + DRIP_AFTER_CALL_MIN) * 60_000;
}

/** Overdue: still booked, and past its end by more than the grace period. */
export function isOverdue(
  call: { status: string; startAt: Date | string; minutes: number },
  now = Date.now()
): boolean {
  return (
    call.status === "booked" && now > new Date(call.startAt).getTime() + (call.minutes + OVERDUE_AFTER_MIN) * 60_000
  );
}

/**
 * Why a booked call no longer fits the physician's hours, or null. A physician
 * who adds a day off or shortens their hours keeps the calls already booked;
 * they are listed with this reason to move or hand over.
 */
export function callClash(h: DoctorHours, startAt: Date | string, minutes: number): string | null {
  const { date, time } = istParts(new Date(startAt));
  if (h.daysOff.includes(date)) return "On your day off";
  const t = mins(time);
  const inWindow = h.weekly.some((w) => w.day === weekdayOf(date) && t >= mins(w.start) && t + minutes <= mins(w.end));
  return inWindow ? null : "Outside your hours";
}

/** Everything wrong with a set of hours as entered, or null. */
export function hoursProblem(h: DoctorHours): string | null {
  if (!CALL_LENGTHS.includes(h.callMinutes)) return `A call is ${CALL_LENGTHS.join(", ")} minutes long`;
  for (const w of h.weekly) {
    if (!Number.isInteger(w.day) || w.day < 0 || w.day > 6) return "A day of the week is missing";
    if (!TIME.test(w.start) || !TIME.test(w.end)) return `${WEEKDAYS[w.day] ?? "A day"}: times as HH:MM`;
    if (mins(w.end) - mins(w.start) < h.callMinutes) {
      return `${WEEKDAYS[w.day]} ${w.start}–${w.end}: shorter than one ${h.callMinutes}-minute call`;
    }
  }
  for (let d = 0; d < 7; d++) {
    const day = h.weekly.filter((w) => w.day === d).sort((a, b) => mins(a.start) - mins(b.start));
    for (let i = 1; i < day.length; i++) {
      if (mins(day[i].start) < mins(day[i - 1].end)) {
        return `${WEEKDAYS[d]}: ${day[i - 1].start}–${day[i - 1].end} and ${day[i].start}–${day[i].end} overlap`;
      }
    }
  }
  for (const d of h.daysOff) if (!DATE.test(d)) return `${d} is not a date`;
  return null;
}

/** "Mon–Fri 10:00–13:00, 17:00–19:00 · Sat 10:00–13:00" for a summary line, in the chosen clock format. */
export function hoursSummary(h: DoctorHours, fmt: ClockFormat): string {
  const byDay = WEEKDAYS.map((_, d) =>
    h.weekly
      .filter((w) => w.day === d)
      .sort((a, b) => mins(a.start) - mins(b.start))
      .map((w) => `${clockOf(w.start, fmt)}–${clockOf(w.end, fmt)}`)
      .join(", ")
  );
  // Monday first, runs of identical days joined.
  const order = [1, 2, 3, 4, 5, 6, 0];
  const parts: string[] = [];
  let i = 0;
  while (i < order.length) {
    const text = byDay[order[i]];
    let j = i;
    while (j + 1 < order.length && byDay[order[j + 1]] === text) j++;
    if (text) parts.push(`${WEEKDAYS[order[i]]}${j > i ? `–${WEEKDAYS[order[j]]}` : ""} ${text}`);
    i = j + 1;
  }
  return parts.join(" · ") || "No hours set";
}

/** "Fri 26 Sept, 10:30 AM" in India time. */
export function callWhen(at: Date | string, fmt: ClockFormat): string {
  return dayClock(at, fmt);
}

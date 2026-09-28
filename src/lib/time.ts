/**
 * How every clock time and date in the product is written: one place, one
 * timezone, one choice of 12- or 24-hour.
 *
 * India time, always. NutriDrip runs in Bengaluru and a session at 10:00 is at
 * 10:00 in Bengaluru, whatever the server or the browser is set to. Every
 * formatter here names the timezone, so a server running in UTC (as most cloud
 * hosts do) or a patient's phone set to Dubai cannot move a time by hours.
 * `src/instrumentation.ts` also pins the server's own clock to it, for the
 * "today" and "this month" arithmetic that is not formatting.
 *
 * The 12- or 24-hour choice is the super admin's (Admin → Settings). Stored
 * times are always 24-hour ("17:00") and instants are always Dates; only what
 * is shown changes. Pure, so client and server share it.
 */

export const APP_TIME_ZONE = "Asia/Kolkata";

export type ClockFormat = "12h" | "24h";
export const CLOCK_FORMATS: ClockFormat[] = ["12h", "24h"];
export const DEFAULT_CLOCK: ClockFormat = "12h";

export const CLOCK_LABEL: Record<ClockFormat, string> = {
  "12h": "12-hour",
  "24h": "24-hour",
};

const pad = (n: number) => String(n).padStart(2, "0");

/** The hour and minute of a moment, in India. */
function istHourMinute(at: Date): { h: number; m: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { h: get("hour") % 24, m: get("minute") };
}

/** 17, 5 → "5:05 PM" or "17:05". */
function write(h: number, m: number, fmt: ClockFormat): string {
  if (fmt === "24h") return `${pad(h)}:${pad(m)}`;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
}

/** A moment's clock time in India: "5:00 PM" or "17:00". Empty for anything that is not a date. */
export function clock(value: Date | string | number | null | undefined, fmt: ClockFormat): string {
  if (value === null || value === undefined || value === "") return "";
  const at = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(at.getTime())) return "";
  const { h, m } = istHourMinute(at);
  return write(h, m, fmt);
}

/** A stored "HH:MM" (24-hour) time: "17:00" → "5:00 PM" or "17:00". Anything else is returned as it came. */
export function clockOf(hhmm: string | null | undefined, fmt: ClockFormat): string {
  const x = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm ?? "");
  return x ? write(Number(x[1]), Number(x[2]), fmt) : (hhmm ?? "");
}

/** "07:00", "20:00" → "7:00 AM – 8:00 PM" or "07:00 – 20:00". */
export function clockRange(from: string, to: string, fmt: ClockFormat): string {
  return `${clockOf(from, fmt)} – ${clockOf(to, fmt)}`;
}

/** Any "HH:MM" inside a sentence, written in the chosen format: "Mon–Sat 10:00–13:00" → "Mon–Sat 10:00 AM–1:00 PM". */
export function clockText(text: string, fmt: ClockFormat): string {
  if (fmt === "24h") return text;
  return text.replace(/\b([01]\d|2[0-3]):([0-5]\d)\b/g, (_, h, m) => write(Number(h), Number(m), fmt));
}

/** A date in India, the way dates are written here: "25 Sept 2026". */
export function dateIN(value: Date | string | number | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (value === null || value === undefined || value === "") return "";
  const at = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(at.getTime())) return "";
  return at.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...opts,
    timeZone: APP_TIME_ZONE,
  });
}

/** "Fri 26 Sept, 5:00 PM" — a day and a time, for appointments. */
export function dayClock(value: Date | string | number, fmt: ClockFormat): string {
  const day = dateIN(value, { weekday: "short", day: "numeric", month: "short", year: undefined });
  return `${day}, ${clock(value, fmt)}`;
}

/** "25 Sept, 5:00 PM" — a short date and a time. */
export function shortDateClock(value: Date | string | number, fmt: ClockFormat): string {
  return `${dateIN(value, { year: undefined })}, ${clock(value, fmt)}`;
}

/** "25 Sept 2026, 5:00 PM" — a date and a time in full, for records. */
export function dateTime(value: Date | string | number, fmt: ClockFormat): string {
  return `${dateIN(value)}, ${clock(value, fmt)}`;
}

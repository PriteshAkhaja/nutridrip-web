/**
 * The audit trail, made readable.
 *
 * Rows were written from thirty-one places and read from none, so nothing ever
 * had to decide what they should look like. Two things make them legible: an
 * action belongs to a group somebody can filter by, and `before`/`after` are
 * shown as the fields that actually moved rather than two blobs of JSON.
 *
 * The shaping is pure and lives apart from the page so it can be tested — a
 * trail that mis-reports what changed is worse than none, because it would be
 * believed.
 */

export const AUDIT_GROUPS = ["Access", "Clinical", "Inventory", "Accounts", "Admin"] as const;
export type AuditGroup = (typeof AUDIT_GROUPS)[number];

/** Which group an action belongs to, by its prefix. */
const GROUP_BY_PREFIX: Record<string, AuditGroup> = {
  access: "Access",
  auth: "Access",
  record: "Access",
  // Downloading the trail is an act of reading it, so it files beside the
  // other reads rather than under Admin.
  audit: "Access",
  quiz: "Clinical",
  consent: "Clinical",
  vitals: "Clinical",
  adverse: "Clinical",
  prescription: "Clinical",
  checklist: "Clinical",
  plan: "Clinical",
  booking: "Clinical",
  session: "Clinical",
  lab: "Clinical",
  drip: "Inventory",
  kit: "Inventory",
  master: "Inventory",
  lot: "Inventory",
  order: "Inventory",
  user: "Accounts",
  profile: "Accounts",
  content: "Admin",
  billing: "Admin",
  // AI Studio. Unlisted prefixes read as Admin in groupFor(), but the group
  // FILTER is built from this map, so an action left out here would be labelled
  // Admin and then never turn up when somebody filters by it.
  ai: "Admin",
  lead: "Admin",
};

export function groupFor(action: string): AuditGroup {
  return GROUP_BY_PREFIX[action.split(".")[0]] ?? "Admin";
}

/**
 * Actions worth a second look.
 *
 * Not "errors" — a refused access is the guard working. But somebody scanning
 * a thousand rows for what matters should not have to know which prefixes are
 * the security-relevant ones.
 */
/*
 * `record.opened` is deliberately NOT here. A routine read is exactly what is
 * expected to happen, and with eight log points and no deduplication it will
 * be among the highest-volume actions once the app is in real use — flagging
 * it would tint the whole table and leave the rows that do deserve a second
 * look indistinguishable from the ones that do not.
 */
const NOTABLE = new Set([
  "access.refused",
  "prescription.override.break_glass",
  "prescription.override.denied",
  "quiz.rejected",
  "adverse.reported",
  "drip.delete",
  "drip.retire",
  // Removing a patient's medical document. The file goes with the row.
  "lab.delete",
  "quiz.reset",
]);

export function isNotable(action: string): boolean {
  return NOTABLE.has(action);
}

/** "prescription.override.break_glass" → "Prescription override break glass" */
export function actionLabel(action: string): string {
  const words = action
    .replace(/[._]/g, " ")
    .trim()
    // "ai" is an acronym, not a word: "Ai delete" reads as a typo.
    .replace(/\bai\b/gi, "AI");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export type FieldChange = { field: string; from?: string; to?: string };

/**
 * Never shown, whatever a caller happened to put in `before` or `after`.
 *
 * The trail is read by admins, and a row that quietly carried a hash or a
 * token would spread the secret rather than record it. Matched loosely on
 * purpose — a new field named `resetToken` should be caught without anyone
 * remembering to add it here.
 */
const SECRET = /pass|hash|secret|token|otp|code|signature|key/i;

/**
 * Field names that trip the pattern above without being secrets. `maxTokens`
 * is a length limit on a model, and hiding it would make an AI Studio change
 * unreadable in the one place it is recorded. Exact names only: a loose
 * exemption would be a way for a real `resetToken` to slip through.
 */
// `pincode` contains "code", and hiding it would make a clinic's move unreadable.
const NOT_SECRET = new Set(["maxTokens", "pincode"]);

/**
 * Actions whose before/after carry what a patient told a physician, or what a
 * physician found: the symptoms on a reaction report, the question and answer
 * when a patient replies to a doctor, the file name of a lab report, the readings
 * that were out of range.
 *
 * The Admin reads the trail -- it is a security log, and that is a fair use of it
 * -- but is not meant to read anyone's medical record, and this is the back door
 * a limited patient page would otherwise leave open. So for an Admin the row is
 * still there (who, what, when, to which record) and the clinical text is not.
 * The super admin, who may read the record, sees it.
 */
const CLINICAL_DETAIL = /^(adverse\.|vitals\.|lab\.|quiz\.submitted$|quiz\.info\.)/;

export const CLINICAL_WITHHELD = "Clinical detail: for the treating physician";

export function withholdsDetail(role: string | undefined, action: string): boolean {
  return role === "admin" && CLINICAL_DETAIL.test(action);
}

const readable = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") return v.toLocaleString("en-IN");
  if (typeof v === "string") return v.length > 90 ? `${v.slice(0, 90)}…` : v;
  if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? "" : "s"}`;
  if (v instanceof Date) return v.toISOString().slice(0, 16).replace("T", " ");
  if (typeof v === "object") {
    const keys = Object.keys(v as object);
    return `${keys.length} field${keys.length === 1 ? "" : "s"}`;
  }
  return String(v);
};

/** "name: Emma → Emma F", one line per field that actually moved. */
export function describeChange(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): FieldChange[] {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].sort();
  const out: FieldChange[] = [];

  for (const field of keys) {
    if (SECRET.test(field) && !NOT_SECRET.has(field)) {
      out.push({ field, to: "hidden" });
      continue;
    }
    const from = before?.[field];
    const to = after?.[field];

    // Nothing moved — say nothing. A row listing fifteen unchanged fields
    // buries the one that did.
    if (before && after && readable(from) === readable(to)) continue;

    out.push({
      field,
      ...(before && field in before ? { from: readable(from) } : {}),
      ...(after && field in after ? { to: readable(to) } : {}),
    });
  }
  return out;
}

/** The action prefixes that make up a group — the inverse of `groupFor`. */
export function prefixesForGroup(group: AuditGroup): string[] {
  return Object.entries(GROUP_BY_PREFIX)
    .filter(([, g]) => g === group)
    .map(([prefix]) => prefix);
}

/**
 * A Mongo filter matching every action in a group.
 *
 * Built from the prefixes rather than stored on each row: which group an
 * action belongs to is a reading decision that may change, and a stored one
 * would freeze today's opinion into a year of history.
 */
export function groupFilter(group: AuditGroup): RegExp {
  const prefixes = prefixesForGroup(group);
  // The literal dot matters: without escaping it, "user" would also match
  // "username.*" and any other prefix that merely starts the same way.
  return new RegExp(`^(${prefixes.join("|")})\\.`);
}

/**
 * The kind of record, written the way a person would say it.
 *
 * These are Mongoose model names, so they arrive in the trail as
 * `TreatmentPlan` and `BatchLot`. Splitting on the capitals is enough — no
 * table to keep in step with the models, and a model added tomorrow reads
 * correctly without anyone remembering this function exists.
 *
 * `Route` is left alone: it is not a record at all. An `access.refused` row
 * puts the route or the permission that was refused in the id field, and that
 * string is the useful part.
 */
export function entityLabel(entity: string): string {
  // "TreatmentPlan" splits at lower-to-upper; "AIModel" also at the end of a
  // run of capitals ("AI" | "Model"), or the acronym would be read as one word.
  const words = entity
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  // Lower-case every word except an acronym (two or more capitals).
  return words
    .split(" ")
    .map((w, i) => {
      const keep = /^[A-Z]{2,}$/.test(w);
      const word = keep ? w : w.toLowerCase();
      return i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word;
    })
    .join(" ");
}

/* ------------------------------------------------------------------ dates */

/**
 * "What happened on 12 March" is the first question anyone asks a trail, so
 * the window is a filter like any other: it lives in the URL, and it is
 * applied by the database rather than by hiding rows that were already sent.
 *
 * Every date here is handled in the **server's own timezone**, deliberately.
 * Rows are rendered with `toLocaleDateString` and no `timeZone` option, which
 * is also server-local, so a row that *displays* as 12 March is exactly a row
 * the 12 March filter returns. Those two have to move together: pin the
 * display to IST one day and this must be pinned with it, or the page will
 * quietly contradict itself for rows near midnight.
 */

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A Date as the calendar day it falls on locally.
 *
 * Not `toISOString().slice(0, 10)`: that is UTC, and India runs 5½ hours
 * ahead, so between midnight and 5:30am every date would come out as the day
 * before — including "today", for the first few hours of every morning.
 */
export function toDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The parts of a YYYY-MM-DD, or null if it is not a real calendar date. */
function dayParts(value?: string): { y: number; m: number; d: number } | null {
  const m = DAY.exec(value?.trim() ?? "");
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  // "2026-02-31" parses happily and lands on 3 March. Round-trip it so a date
  // that does not exist is rejected rather than silently moved.
  const probe = new Date(y, mo - 1, d);
  if (probe.getFullYear() !== y || probe.getMonth() !== mo - 1 || probe.getDate() !== d) return null;
  return { y, m: mo, d };
}

/** Local midnight at the start of the named day. */
export function dayStart(value?: string): Date | null {
  const p = dayParts(value);
  return p ? new Date(p.y, p.m - 1, p.d, 0, 0, 0, 0) : null;
}

/**
 * The last instant of the named day, so `to` includes the day it names.
 * A range of 12 March to 12 March must return 12 March, not nothing.
 */
export function dayEnd(value?: string): Date | null {
  const p = dayParts(value);
  return p ? new Date(p.y, p.m - 1, p.d, 23, 59, 59, 999) : null;
}

/**
 * The Mongo condition for a date window, or null when neither end is a usable
 * date — so a mistyped URL shows the whole trail rather than an empty page.
 */
export function auditRange(from?: string, to?: string): { $gte?: Date; $lte?: Date } | null {
  const a = dayStart(from);
  const b = dayEnd(to);
  if (!a && !b) return null;

  // Picked backwards. Take what they meant instead of returning nothing —
  // an empty table looks like "nothing happened", which would be a lie.
  if (a && b && a > b) {
    return { $gte: dayStart(to) as Date, $lte: dayEnd(from) as Date };
  }
  return { ...(a ? { $gte: a } : {}), ...(b ? { $lte: b } : {}) };
}

export type DatePreset = { label: string; from: string; to: string };

/**
 * The windows people actually ask for. `now` is passed in rather than read,
 * so this stays pure and so a client component never has to call `new Date()`
 * during render.
 */
export function presetsFor(now: Date): DatePreset[] {
  const today = toDay(now);
  const back = (days: number) =>
    toDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days));
  return [
    { label: "Today", from: today, to: today },
    { label: "Last 7 days", from: back(6), to: today },
    { label: "Last 30 days", from: back(29), to: today },
    { label: "This month", from: toDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: today },
  ];
}

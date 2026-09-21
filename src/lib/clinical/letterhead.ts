import { z } from "zod";

/**
 * A physician's own letterhead on the prescriptions they issue.
 *
 * What it is: the practice name, the qualifications line, an address, a way to
 * reach them, and a closing note. What it is not: their credentials. The
 * registration number and the council are edited by an administrator and are
 * printed from that record on every prescription whether or not a letterhead
 * exists, and nothing here can replace or hide them. A prescription is a legal
 * document, and the line that says who is answerable for it cannot be a
 * free-text field the answerable person controls.
 *
 * Pure and imports no model, so the form, the route, the print page and the
 * tests all share one definition of what a letterhead is.
 */

export type Letterhead = {
  practiceName?: string;
  qualifications?: string;
  /** Up to four lines, separated by newlines. */
  address?: string;
  phone?: string;
  email?: string;
  footerNote?: string;
};

export const LETTERHEAD_LIMITS = {
  practiceName: 120,
  qualifications: 160,
  address: 240,
  phone: 24,
  email: 120,
  footerNote: 200,
} as const;

export const ADDRESS_MAX_LINES = 4;

/** Digits and the punctuation people actually type into a phone number. */
const PHONE = /^[+(\d][\d\s\-()]{4,}$/;

/**
 * Punctuation alone is not a number: "(---)" fits the pattern above. Six digits
 * is the shortest a local number gets, and anything with fewer is a typo.
 */
const MIN_DIGITS = 6;
const digitsIn = (s: string) => (s.match(/\d/g) ?? []).length;

const trimmed = (max: number) =>
  z
    .string()
    .max(max, `Keep this under ${max} characters`)
    .transform((s) => s.replace(/[ \t]+/g, " ").trim())
    .optional();

export const LetterheadInput = z.object({
  practiceName: trimmed(LETTERHEAD_LIMITS.practiceName),
  qualifications: trimmed(LETTERHEAD_LIMITS.qualifications),
  address: z
    .string()
    .max(LETTERHEAD_LIMITS.address, `Keep the address under ${LETTERHEAD_LIMITS.address} characters`)
    .transform((s) =>
      s
        .split(/\r?\n/)
        .map((l) => l.replace(/[ \t]+/g, " ").trim())
        .filter(Boolean)
        .join("\n")
    )
    .refine((s) => s === "" || s.split("\n").length <= ADDRESS_MAX_LINES, {
      message: `An address is at most ${ADDRESS_MAX_LINES} lines`,
    })
    .optional(),
  phone: z
    .string()
    .max(LETTERHEAD_LIMITS.phone, "That phone number is too long")
    .transform((s) => s.trim())
    .refine((s) => s === "" || (PHONE.test(s) && digitsIn(s) >= MIN_DIGITS), {
      message: "That does not look like a phone number",
    })
    .optional(),
  email: z
    .string()
    .max(LETTERHEAD_LIMITS.email, "That email is too long")
    .transform((s) => s.trim().toLowerCase())
    .refine((s) => s === "" || z.string().email().safeParse(s).success, {
      message: "That does not look like an email address",
    })
    .optional(),
  footerNote: trimmed(LETTERHEAD_LIMITS.footerNote),
});

/** The fields a letterhead has, in the order they are written and shown. */
export const LETTERHEAD_FIELDS = [
  "practiceName",
  "qualifications",
  "address",
  "phone",
  "email",
  "footerNote",
] as const satisfies ReadonlyArray<keyof Letterhead>;

/**
 * Whatever is stored, reduced to a letterhead: only known fields, only strings,
 * nothing blank. A row written by an older version, or by hand, or half-filled,
 * never reaches the print page as `undefined` in the middle of a sentence.
 */
export function normaliseLetterhead(raw: unknown): Letterhead {
  const out: Letterhead = {};
  if (!raw || typeof raw !== "object") return out;
  const src = raw as Record<string, unknown>;
  for (const key of LETTERHEAD_FIELDS) {
    const v = src[key];
    if (typeof v === "string" && v.trim()) out[key] = v.trim();
  }
  return out;
}

/** True when there is anything at all to print above the prescription. */
export function hasLetterhead(l: Letterhead | null | undefined): boolean {
  const n = normaliseLetterhead(l);
  return Boolean(n.practiceName || n.qualifications || n.address || n.phone || n.email);
}

export type LetterheadView = {
  /** The bold first line. Falls back to the physician's own name. */
  title: string;
  qualifications: string | null;
  addressLines: string[];
  /** "080 4000 0000 · dr@example.com", or null when neither is given. */
  contact: string | null;
  footerNote: string | null;
};

/**
 * What the print page draws. The physician's name is passed in, never read
 * from the letterhead: a practice name is optional, and a letterhead with only
 * a phone number should still be headed by the person who signed it.
 */
export function letterheadView(l: Letterhead | null | undefined, physicianName: string): LetterheadView {
  const n = normaliseLetterhead(l);
  return {
    title: n.practiceName || physicianName,
    qualifications: n.qualifications ?? null,
    addressLines: n.address ? n.address.split("\n").slice(0, ADDRESS_MAX_LINES) : [],
    contact: [n.phone, n.email].filter(Boolean).join(" · ") || null,
    footerNote: n.footerNote ?? null,
  };
}

/** The fields that differ between two letterheads — what the audit row records. */
export function letterheadChanges(
  before: Letterhead | null | undefined,
  after: Letterhead | null | undefined
): { before: Letterhead; after: Letterhead } {
  const b = normaliseLetterhead(before);
  const a = normaliseLetterhead(after);
  const outB: Letterhead = {};
  const outA: Letterhead = {};
  for (const key of LETTERHEAD_FIELDS) {
    if ((b[key] ?? "") !== (a[key] ?? "")) {
      if (b[key] !== undefined) outB[key] = b[key];
      if (a[key] !== undefined) outA[key] = a[key];
    }
  }
  return { before: outB, after: outA };
}

/**
 * Live coverage. A zone we cannot staff reliably is listed as limited rather
 * than hidden, and a pincode outside every zone gets a straight no at booking
 * instead of a waitlist — which is what the public site promises.
 *
 * The zones themselves are edited by the super admin (Service zones) and live
 * in the database; `lib/zones-store.ts` loads them. This file stays pure — it
 * imports nothing — so a client component, a test and the booking route all
 * apply the same rules to whatever list they were handed.
 */
export type ZoneStatus = "open" | "limited" | "paused";

export type Zone = {
  /** The database id, once the zone has been saved. */
  id?: string;
  name: string;
  pincodes: string[];
  /** "07:00", 24-hour. */
  opensAt: string;
  closesAt: string;
  /** "07:00 – 20:00", for display. */
  window: string;
  /** A bookable time every this many minutes, from opening (lib/clinical/slots). */
  slotMinutes: number;
  /**
   * open: full cover. limited: we serve it, with shorter hours.
   * paused: kept, with its nurses, but not offered — a booking there is refused
   * and the public site does not list it. A zone is paused, not deleted, while
   * any nurse still covers it.
   */
  status: ZoneStatus;
};

export const ZONE_STATUSES: ZoneStatus[] = ["open", "limited", "paused"];

export const ZONE_STATUS_LABEL: Record<ZoneStatus, string> = {
  open: "Full cover",
  limited: "Limited",
  paused: "Paused",
};

export function windowFor(opensAt: string, closesAt: string): string {
  return `${opensAt} – ${closesAt}`;
}

const z = (name: string, pincodes: string[], opensAt: string, closesAt: string, status: ZoneStatus = "open"): Zone => ({
  name,
  pincodes,
  opensAt,
  closesAt,
  window: windowFor(opensAt, closesAt),
  slotMinutes: 60,
  status,
});

/**
 * The zones NutriDrip launched with. Written to the database the first time
 * the zones are read, and used as-is if the database cannot be reached, so a
 * patient is never told "we do not serve you" because of an outage.
 */
export const ZONE_DEFAULTS: Zone[] = [
  z("Koramangala", ["560034", "560095"], "07:00", "20:00"),
  z("HSR Layout", ["560102", "560103"], "07:00", "20:00"),
  z("Indiranagar", ["560038", "560008"], "07:00", "20:00"),
  z("Ejipura", ["560047"], "08:00", "19:00"),
  z("Domlur", ["560071"], "08:00", "19:00"),
  z("Jayanagar", ["560011", "560041"], "08:00", "19:00"),
  z("JP Nagar", ["560078"], "08:00", "19:00"),
  z("BTM Layout", ["560068", "560076"], "08:00", "19:00"),
  z("Richmond Town", ["560025"], "08:00", "18:00"),
  z("Frazer Town", ["560005"], "08:00", "18:00"),
  z("Sadashivanagar", ["560080"], "08:00", "18:00"),
  z("Whitefield", ["560066"], "09:00", "18:00", "limited"),
  z("Sarjapur Road", ["560035"], "09:00", "18:00", "limited"),
  z("Hebbal", ["560024"], "09:00", "17:00", "limited"),
];

/** The zones a patient can book in: everything not paused. */
export function servedZones(zones: Zone[]): Zone[] {
  return zones.filter((z) => z.status !== "paused");
}

/** Just the names, for pickers that let somebody choose a zone. */
export function zoneNames(zones: Zone[]): string[] {
  return zones.map((z) => z.name);
}

/** Digits only, so "560 034" and "560034" are the same pincode. */
export function cleanPincode(pincode: string | null | undefined): string {
  return (pincode ?? "").replace(/\D/g, "");
}

/**
 * The zone a pincode falls in, or null when no nurse can be sent there yet.
 * A paused zone counts as not served.
 */
export function zoneForPincode(pincode: string | null | undefined, zones: Zone[]): Zone | null {
  const pin = cleanPincode(pincode);
  if (pin.length !== 6) return null;
  return servedZones(zones).find((z) => z.pincodes.includes(pin)) ?? null;
}

// ---------------------------------------------------------------- editing

export type ZoneInput = {
  name: string;
  /** As typed: separated by commas, spaces or new lines. */
  pincodes: string | string[];
  opensAt: string;
  closesAt: string;
  slotMinutes: number;
  status: ZoneStatus;
};

/** The steps a super admin can choose. Mirrors SLOT_STEPS in lib/clinical/slots, kept here so this file imports nothing. */
export const ZONE_SLOT_STEPS = [30, 45, 60, 90, 120];

/** "560034, 560095\n560102" → ["560034", "560095", "560102"], in order, no repeats. */
export function parsePincodes(input: string | string[]): string[] {
  const parts = Array.isArray(input) ? input : input.split(/[\s,;]+/);
  const out: string[] = [];
  for (const p of parts) {
    const pin = p.trim();
    if (pin && !out.includes(pin)) out.push(pin);
  }
  return out;
}

/** An Indian PIN code: six digits, and the first is never 0. */
export function isPincode(pin: string): boolean {
  return /^[1-9]\d{5}$/.test(pin);
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Everything wrong with a zone as entered, keyed by field, or an empty object.
 *
 * `others` are the other saved zones (not the one being edited), so a name or
 * a pincode already taken is caught with the zone that holds it — one pincode
 * in two zones would make "which nurse covers this door" ambiguous.
 */
export function zoneProblems(input: ZoneInput, others: Zone[]): Partial<Record<keyof ZoneInput, string>> {
  const problems: Partial<Record<keyof ZoneInput, string>> = {};

  const name = input.name.trim();
  if (name.length < 2) problems.name = "Give the zone a name";
  else if (name.length > 40) problems.name = "Keep the name under 40 characters";
  else if (others.some((o) => o.name.trim().toLowerCase() === name.toLowerCase())) {
    problems.name = `There is already a zone called ${name}`;
  }

  const pins = parsePincodes(input.pincodes);
  const bad = pins.filter((p) => !isPincode(p));
  if (pins.length === 0) problems.pincodes = "Add at least one pincode";
  else if (bad.length) {
    problems.pincodes = `${bad.join(", ")} ${bad.length === 1 ? "is not a pincode" : "are not pincodes"} — six digits, not starting with 0`;
  } else {
    const taken = pins
      .map((p) => ({ p, zone: others.find((o) => o.pincodes.includes(p)) }))
      .filter((t) => t.zone);
    if (taken.length) {
      problems.pincodes = taken.map((t) => `${t.p} is already in ${t.zone!.name}`).join("; ");
    }
  }

  if (!TIME.test(input.opensAt)) problems.opensAt = "Opening time as HH:MM";
  if (!TIME.test(input.closesAt)) problems.closesAt = "Closing time as HH:MM";
  else if (TIME.test(input.opensAt) && input.closesAt <= input.opensAt) {
    problems.closesAt = "Closes after it opens";
  }

  if (!ZONE_SLOT_STEPS.includes(Number(input.slotMinutes))) {
    problems.slotMinutes = "Choose 30, 45, 60, 90 or 120 minutes";
  } else if (!problems.opensAt && !problems.closesAt) {
    const [oh, om] = input.opensAt.split(":").map(Number);
    const [ch, cm] = input.closesAt.split(":").map(Number);
    if (ch * 60 + cm - (oh * 60 + om) < Number(input.slotMinutes)) {
      problems.slotMinutes = "The hours are shorter than one slot";
    }
  }

  if (!ZONE_STATUSES.includes(input.status)) problems.status = "Choose open, limited or paused";

  return problems;
}

// ---------------------------------------------------------------- site copy

/** Written into copy where the number of zones goes, and filled in when the page is drawn. */
export const ZONE_COUNT_TOKEN = "{{zone-count}}";

/** "We cover {{zone-count}} zones" → "We cover 14 zones", counting only zones a patient can book. */
export function fillZoneCount(text: string, zones: Zone[]): string {
  if (!text.includes(ZONE_COUNT_TOKEN)) return text;
  const n = servedZones(zones).length;
  return text.replaceAll(`${ZONE_COUNT_TOKEN} zones`, n === 1 ? "1 zone" : `${n} zones`).replaceAll(ZONE_COUNT_TOKEN, String(n));
}

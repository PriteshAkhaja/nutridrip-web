import { zoneForPincode } from "@/lib/zones";

/**
 * The nurses a physician is offered when approving a protocol.
 *
 * The ordering is the same claim `pickNurse()` makes when it chooses on its
 * own — covers the zone, then nearest, then least busy — so the list a
 * physician reads and the choice the system would have made cannot disagree.
 * What this adds is the physician's own team at the top and a reason printed
 * beside every name, because a dropdown of bare names is not a decision aid.
 *
 * Pure on purpose, and that is load-bearing rather than tidy: the admin form
 * is a client component and reads ZONE_NAMES through this area. Importing
 * anything here that touches Mongoose puts the driver in the browser bundle,
 * which fails at module evaluation with "Cannot read properties of undefined".
 * So the capacity rule and the distance maths live HERE, and `assign.ts` — the
 * side that does talk to the database — imports them from this file.
 */

/** A nurse runs at most this many open sessions before they stop being offered. */
export const NURSE_CAPACITY = 6;

/** Great-circle distance, which is close enough for dispatch inside one city. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type NurseRow = {
  id: string;
  name: string;
  serviceAreas?: string[];
  latitude?: number | null;
  longitude?: number | null;
  /** The physician this nurse works under, if any. */
  doctorId?: string | null;
  /** Open sessions already on them. */
  load: number;
};

export type PatientPoint = {
  latitude?: number | null;
  longitude?: number | null;
  pincode?: string | null;
};

export type NurseOption = {
  id: string;
  name: string;
  /** "covers Jayanagar · 3.2 km · 2 of 6" — the whole reason, in one line. */
  detail: string;
  /**
   * The same reason as separate pieces, so a narrow screen wraps BETWEEN them
   * rather than inside one — "0" on one line and "km" on the next is not a
   * measurement any more.
   */
  detailBits: string[];
  coversZone: boolean;
  /** Null when either side has no coordinates on file. */
  distanceKm: number | null;
  load: number;
  atCapacity: boolean;
  /** True when this nurse works under the physician doing the approving. */
  mine: boolean;
};

export type NurseOptions = {
  /** The zone the patient's pincode falls in, or null if we do not serve it. */
  zoneName: string | null;
  /** This physician's own nurses, best first. */
  mine: NurseOption[];
  /** Everyone else, best first. Shown only when the physician has no team. */
  others: NurseOption[];
  /**
   * True when the physician has no nurses linked to them at all, so the list
   * falls back to everybody rather than leaving them unable to choose.
   */
  noTeam: boolean;
};

function describe(o: {
  coversZone: boolean;
  distanceKm: number | null;
  load: number;
  atCapacity: boolean;
  zoneName: string | null;
}): string[] {
  const bits: string[] = [];

  if (o.zoneName) bits.push(o.coversZone ? `covers ${o.zoneName}` : `does not cover ${o.zoneName}`);
  if (o.distanceKm !== null) bits.push(`${o.distanceKm} km`);
  else bits.push("distance unknown");

  // Said as a fraction, so "2" is never mistaken for "nearly full".
  bits.push(o.atCapacity ? `full · ${o.load} of ${NURSE_CAPACITY}` : `${o.load} of ${NURSE_CAPACITY}`);

  return bits;
}

/**
 * Rank nurses for one patient, splitting the physician's own team from the
 * rest. Nurses at capacity are kept in the list, marked and sorted last: a
 * physician deserves to see that somebody is full rather than find them
 * missing and wonder why.
 */
export function nurseOptions(
  nurses: NurseRow[],
  patient: PatientPoint,
  doctorId: string | null
): NurseOptions {
  const zone = zoneForPincode(patient.pincode ?? undefined);

  const rank = (n: NurseRow): NurseOption => {
    const hasGeo =
      patient.latitude != null &&
      patient.longitude != null &&
      n.latitude != null &&
      n.longitude != null;

    const areas = n.serviceAreas ?? [];
    // An empty list is not a claim about anywhere, so it restricts nothing —
    // the same reading `pickNurse` uses, deliberately.
    const coversZone = !zone || areas.length === 0 || areas.includes(zone.name);
    const km = hasGeo
      ? Math.round(distanceKm(patient.latitude!, patient.longitude!, n.latitude!, n.longitude!) * 10) / 10
      : null;
    const atCapacity = n.load >= NURSE_CAPACITY;
    const bits = describe({ coversZone, distanceKm: km, load: n.load, atCapacity, zoneName: zone?.name ?? null });

    return {
      id: n.id,
      name: n.name,
      coversZone,
      distanceKm: km,
      load: n.load,
      atCapacity,
      mine: Boolean(doctorId) && String(n.doctorId ?? "") === doctorId,
      detail: bits.join(" · "),
      detailBits: bits,
    };
  };

  const byBest = (a: NurseOption, b: NurseOption) => {
    // Somebody who is full is never a better answer than somebody who is not.
    if (a.atCapacity !== b.atCapacity) return a.atCapacity ? 1 : -1;
    if (a.coversZone !== b.coversZone) return a.coversZone ? -1 : 1;
    // An unknown distance must not beat a known one.
    const ak = a.distanceKm ?? Number.POSITIVE_INFINITY;
    const bk = b.distanceKm ?? Number.POSITIVE_INFINITY;
    if (ak !== bk) return ak - bk;
    if (a.load !== b.load) return a.load - b.load;
    return a.name.localeCompare(b.name);
  };

  const ranked = nurses.map(rank);
  const mine = ranked.filter((n) => n.mine).sort(byBest);
  const others = ranked.filter((n) => !n.mine).sort(byBest);

  return {
    zoneName: zone?.name ?? null,
    mine,
    others,
    noTeam: mine.length === 0,
  };
}

/**
 * The parts of an account that are worth a before-and-after in the audit trail.
 *
 * The trail used to record only a person's name and status on an edit, so a change
 * to who a nurse works under, the zones she covers, a clinic's GSTIN or a doctor's
 * council number was saved and left no trace of what it had been. The GSTIN is the
 * sharp case: it decides whether an invoice carries CGST + SGST or IGST, so "who
 * changed it, and from what" is exactly the question a trail exists to answer.
 *
 * Every value is a string or a number, on purpose. The trail's diff compares what
 * two values would LOOK like, and a list reads as "2 items" -- so swapping one zone
 * for another looked like nothing changing. Zones are joined into one string.
 *
 * Pure: it takes an account document and returns fields. The route decides when.
 */

type Trackable = {
  name?: string;
  status?: string;
  phone?: string;
  doctor?: { specialization?: string; licenseNo?: string; registrationCouncil?: string };
  nurse?: {
    licenseNo?: string;
    doctorId?: unknown;
    serviceAreas?: string[];
    latitude?: number;
    longitude?: number;
  };
  clinic?: {
    address?: string;
    city?: string;
    pincode?: string;
    gstin?: string;
    monthlyVolumeTarget?: number;
  };
};

export type TrackedFields = Record<string, string | number>;

/** Only what is set: a field that was never filled in is absent, not "undefined". */
function present(entries: Array<[string, string | number | undefined | null]>): TrackedFields {
  const out: TrackedFields = {};
  for (const [k, v] of entries) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = v;
  }
  return out;
}

/**
 * `worksUnder` is returned as the physician's id. It becomes a name once the
 * caller has looked the names up -- see `withDoctorName`.
 */
export function trackedFields(u: Trackable): TrackedFields {
  return present([
    ["name", u.name],
    ["status", u.status],
    ["phone", u.phone],
    ["specialization", u.doctor?.specialization],
    ["councilNumber", u.doctor?.licenseNo ?? u.nurse?.licenseNo],
    ["council", u.doctor?.registrationCouncil],
    ["worksUnder", u.nurse?.doctorId ? String(u.nurse.doctorId) : undefined],
    ["zones", u.nurse?.serviceAreas?.length ? [...u.nurse.serviceAreas].sort().join(", ") : undefined],
    ["homeLatitude", u.nurse?.latitude],
    ["homeLongitude", u.nurse?.longitude],
    ["address", u.clinic?.address],
    ["city", u.clinic?.city],
    ["pincode", u.clinic?.pincode],
    ["gstin", u.clinic?.gstin],
    ["monthlyTarget", u.clinic?.monthlyVolumeTarget],
  ]);
}

/** A physician's id, written the way a person would read it: their name. */
export function withDoctorName(fields: TrackedFields, names: Record<string, string | undefined>): TrackedFields {
  const id = fields.worksUnder;
  if (typeof id !== "string") return fields;
  return { ...fields, worksUnder: names[id] ?? "a physician who no longer exists" };
}

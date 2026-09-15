/**
 * Live coverage. A zone we cannot staff reliably is listed as limited rather
 * than hidden, and a pincode outside every zone gets a straight no at booking
 * instead of a waitlist — which is what the public site promises.
 */
export type Zone = {
  name: string;
  pincodes: string[];
  window: string;
  status: "open" | "limited";
};

export const ZONES: Zone[] = [
  { name: "Koramangala", pincodes: ["560034", "560095"], window: "07:00 – 20:00", status: "open" },
  { name: "HSR Layout", pincodes: ["560102", "560103"], window: "07:00 – 20:00", status: "open" },
  { name: "Indiranagar", pincodes: ["560038", "560008"], window: "07:00 – 20:00", status: "open" },
  { name: "Ejipura", pincodes: ["560047"], window: "08:00 – 19:00", status: "open" },
  { name: "Domlur", pincodes: ["560071"], window: "08:00 – 19:00", status: "open" },
  { name: "Jayanagar", pincodes: ["560011", "560041"], window: "08:00 – 19:00", status: "open" },
  { name: "JP Nagar", pincodes: ["560078"], window: "08:00 – 19:00", status: "open" },
  { name: "BTM Layout", pincodes: ["560068", "560076"], window: "08:00 – 19:00", status: "open" },
  { name: "Richmond Town", pincodes: ["560025"], window: "08:00 – 18:00", status: "open" },
  { name: "Frazer Town", pincodes: ["560005"], window: "08:00 – 18:00", status: "open" },
  { name: "Sadashivanagar", pincodes: ["560080"], window: "08:00 – 18:00", status: "open" },
  { name: "Whitefield", pincodes: ["560066"], window: "09:00 – 18:00", status: "limited" },
  { name: "Sarjapur Road", pincodes: ["560035"], window: "09:00 – 18:00", status: "limited" },
  { name: "Hebbal", pincodes: ["560024"], window: "09:00 – 17:00", status: "limited" },
];

/**
 * Just the names, for pickers that let somebody choose a zone.
 *
 * Exported from HERE rather than from anything that touches dispatch: this
 * file imports nothing, so a client component can read it without dragging
 * Mongoose into the browser bundle.
 */
export const ZONE_NAMES: string[] = ZONES.map((z) => z.name);

/** The zone a pincode falls in, or null when no nurse can be sent there yet. */
export function zoneForPincode(pincode: string | null | undefined): Zone | null {
  const pin = (pincode ?? "").replace(/\D/g, "");
  if (pin.length !== 6) return null;
  return ZONES.find((z) => z.pincodes.includes(pin)) ?? null;
}

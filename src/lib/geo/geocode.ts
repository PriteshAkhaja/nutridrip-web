/**
 * Address lookup, behind one interface.
 *
 * The key lives ONLY on the server. A browser-visible key can be lifted from
 * the page and spent by anyone, and geocoding is billed per call — so the
 * suggestion and lookup calls go out from our own routes, not from the client.
 *
 * We call the REST APIs rather than embedding Google's JavaScript widget: the
 * legacy `places.Autocomplete` class is not available to projects created
 * after March 2025, and the replacement web component has changed its event
 * names more than once. REST is stable, and it keeps the provider swappable —
 * Mappls or Ola Maps would slot in here without touching a screen.
 *
 * TWO GENERATIONS OF THE PLACES API, and a project has one, the other, or both:
 *
 *   Places API (New)   places.googleapis.com/v1        POST, field masks
 *   Places API         maps.googleapis.com/maps/api    GET, the classic one
 *
 * They are separate products in the Google Cloud console and are enabled
 * separately. Asking for the wrong one gets a 403 SERVICE_DISABLED with a key
 * that is otherwise perfectly good — which reads like a broken key and is not.
 * So we try the new one and fall back to the classic, rather than insisting a
 * particular checkbox be ticked before the address form works at all.
 *
 * With no key configured every function returns "nothing found" rather than
 * throwing, so the address form falls back to typing it by hand.
 */

const PLACES = "https://places.googleapis.com/v1";
const LEGACY_PLACES = "https://maps.googleapis.com/maps/api/place";
const GEOCODE = "https://maps.googleapis.com/maps/api/geocode/json";

/** Bias and restrict lookups to India — this is a Bengaluru service. */
const REGION = "in";

export type Suggestion = {
  /** Opaque provider id, exchanged for coordinates by `resolvePlace()`. */
  id: string;
  /** "Brigade Towers, 7th Cross" */
  label: string;
  /** "Koramangala, Bengaluru, Karnataka" */
  detail: string;
};

/**
 * A failed lookup is NOT an empty one.
 *
 * Returning [] for both meant a disabled API, an expired card and a genuine
 * "nothing matched" were the same thing on screen: no dropdown, no message, no
 * way for anyone to tell which. `unavailable` is what lets the form say so.
 */
export type SuggestResult = {
  suggestions: Suggestion[];
  /** Neither generation of the API would answer — not "no matches". */
  unavailable: boolean;
};

export type ResolvedAddress = {
  latitude: number;
  longitude: number;
  /** Everything the provider knows, as one line. */
  formatted: string;
  /** Street-level part, for the address field. */
  line1: string;
  city: string;
  pincode: string;
};

function serverKey(): string | null {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY?.trim();
  return key ? key : null;
}

/** Whether address search is wired up at all. Screens use this to decide what to show. */
export function geocodingConfigured(): boolean {
  return serverKey() !== null;
}

/**
 * Remembered so a project that has only the classic API does not pay a failing
 * round trip on every keystroke. Ten minutes, so enabling the new API in the
 * console takes effect on its own without a redeploy.
 */
const RETRY_NEW_AFTER_MS = 10 * 60_000;
let newPlacesOffUntil = 0;

const newPlacesOff = () => Date.now() < newPlacesOffUntil;
function markNewPlacesOff(why: string) {
  if (!newPlacesOff()) {
    console.warn(
      `[geocode] Places API (New) is not answering, using the classic Places API instead. ` +
        `Re-checking in ${RETRY_NEW_AFTER_MS / 60_000} minutes. Google said: ${why.slice(0, 300)}`
    );
  }
  newPlacesOffUntil = Date.now() + RETRY_NEW_AFTER_MS;
}

/* ------------------------------------------------------------------ */
/* Address-component parsing                                           */
/* ------------------------------------------------------------------ */

type Component = { longText?: string; shortText?: string; types?: string[] };

/** The classic APIs speak snake_case; everything below works in the new shape. */
type LegacyComponent = { long_name?: string; short_name?: string; types?: string[] };
const fromLegacy = (components: LegacyComponent[] = []): Component[] =>
  components.map((c) => ({ longText: c.long_name, shortText: c.short_name, types: c.types }));

function pick(components: Component[], type: string): string {
  return components.find((c) => c.types?.includes(type))?.longText ?? "";
}

/**
 * The first postal code anywhere in a reverse-geocode response.
 *
 * Google answers a coordinate with a ladder of results, from the exact
 * building up to the country, and the pincode is often not on the first rung —
 * a plus-code or a neighbourhood carries no postal_code while the street two
 * results later does. Reading only results[0] threw the pincode away.
 */
function pincodeAmong(results: Array<{ address_components?: LegacyComponent[] }>): string {
  for (const r of results) {
    const found = pick(fromLegacy(r.address_components), "postal_code").replace(/\D/g, "");
    if (found) return found;
  }
  return "";
}

/** Same ladder, for the city. */
function cityAmong(results: Array<{ address_components?: LegacyComponent[] }>): string {
  for (const r of results) {
    const c = fromLegacy(r.address_components);
    const found =
      pick(c, "locality") || pick(c, "administrative_area_level_3") || pick(c, "administrative_area_level_2");
    if (found) return found;
  }
  return "";
}

/**
 * Indian addresses rarely carry a clean street number, so the street line is
 * assembled from whatever the provider did return, most specific first.
 */
function toAddress(
  components: Component[],
  formatted: string,
  latitude: number,
  longitude: number
): ResolvedAddress {
  const streetBits = [
    pick(components, "street_number"),
    pick(components, "route"),
    pick(components, "sublocality_level_2"),
    pick(components, "sublocality_level_1"),
  ].filter(Boolean);

  // A locality is the city proper; the district is the fallback when Google
  // has no locality for the area, which happens on Bengaluru's outskirts.
  const city =
    pick(components, "locality") ||
    pick(components, "administrative_area_level_3") ||
    pick(components, "administrative_area_level_2");

  return {
    latitude,
    longitude,
    formatted,
    line1: streetBits.join(", ") || formatted.split(",")[0]?.trim() || "",
    city,
    pincode: pick(components, "postal_code").replace(/\D/g, ""),
  };
}

/* ------------------------------------------------------------------ */
/* Suggestions                                                         */
/* ------------------------------------------------------------------ */

/** null means "this API would not answer"; [] means "it answered, nothing matched". */
async function suggestViaNewPlaces(query: string, key: string): Promise<Suggestion[] | null> {
  try {
    const res = await fetch(`${PLACES}/places:autocomplete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
      body: JSON.stringify({ input: query, includedRegionCodes: [REGION] }),
      cache: "no-store",
    });
    if (!res.ok) {
      markNewPlacesOff(await res.text().catch(() => `HTTP ${res.status}`));
      return null;
    }
    const json = (await res.json()) as {
      suggestions?: Array<{
        placePrediction?: {
          placeId?: string;
          text?: { text?: string };
          structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
        };
      }>;
    };
    return (json.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
      .map((p) => ({
        id: p.placeId!,
        label: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        detail: p.structuredFormat?.secondaryText?.text ?? "",
      }))
      .filter((s) => s.label);
  } catch (err) {
    markNewPlacesOff(String(err));
    return null;
  }
}

async function suggestViaLegacyPlaces(query: string, key: string): Promise<Suggestion[] | null> {
  try {
    const params = new URLSearchParams({
      input: query,
      components: `country:${REGION}`,
      key,
    });
    const res = await fetch(`${LEGACY_PLACES}/autocomplete/json?${params}`, { cache: "no-store" });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      status?: string;
      error_message?: string;
      predictions?: Array<{
        place_id?: string;
        description?: string;
        structured_formatting?: { main_text?: string; secondary_text?: string };
      }>;
    };

    // ZERO_RESULTS is an answer. Anything else that is not OK is a refusal.
    if (json.status === "ZERO_RESULTS") return [];
    if (json.status !== "OK") {
      console.error(
        `[geocode] classic Places autocomplete refused: ${json.status}` +
          (json.error_message ? ` — ${json.error_message}` : "")
      );
      return null;
    }

    return (json.predictions ?? [])
      .filter((p) => p.place_id)
      .map((p) => ({
        id: p.place_id!,
        label: p.structured_formatting?.main_text ?? p.description ?? "",
        detail: p.structured_formatting?.secondary_text ?? "",
      }))
      .filter((s) => s.label);
  } catch (err) {
    console.error("[geocode] classic Places autocomplete could not be reached:", err);
    return null;
  }
}

/** Type-ahead suggestions, and whether either provider actually answered. */
export async function suggestAddresses(query: string): Promise<SuggestResult> {
  const key = serverKey();
  if (!key) return { suggestions: [], unavailable: true };
  if (query.trim().length < 3) return { suggestions: [], unavailable: false };

  if (!newPlacesOff()) {
    const modern = await suggestViaNewPlaces(query, key);
    if (modern) return { suggestions: modern, unavailable: false };
  }

  const classic = await suggestViaLegacyPlaces(query, key);
  if (classic) return { suggestions: classic, unavailable: false };

  return { suggestions: [], unavailable: true };
}

/* ------------------------------------------------------------------ */
/* Turning a chosen suggestion into coordinates                        */
/* ------------------------------------------------------------------ */

async function resolveViaNewPlaces(placeId: string, key: string): Promise<ResolvedAddress | null> {
  try {
    const res = await fetch(`${PLACES}/places/${encodeURIComponent(placeId)}`, {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "location,formattedAddress,addressComponents",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      markNewPlacesOff(await res.text().catch(() => `HTTP ${res.status}`));
      return null;
    }
    const json = (await res.json()) as {
      location?: { latitude?: number; longitude?: number };
      formattedAddress?: string;
      addressComponents?: Component[];
    };
    const lat = json.location?.latitude;
    const lng = json.location?.longitude;
    if (typeof lat !== "number" || typeof lng !== "number") return null;

    return toAddress(json.addressComponents ?? [], json.formattedAddress ?? "", lat, lng);
  } catch (err) {
    markNewPlacesOff(String(err));
    return null;
  }
}

async function resolveViaLegacyPlaces(placeId: string, key: string): Promise<ResolvedAddress | null> {
  try {
    const params = new URLSearchParams({
      place_id: placeId,
      fields: "formatted_address,geometry,address_components",
      key,
    });
    const res = await fetch(`${LEGACY_PLACES}/details/json?${params}`, { cache: "no-store" });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      status?: string;
      error_message?: string;
      result?: {
        formatted_address?: string;
        geometry?: { location?: { lat?: number; lng?: number } };
        address_components?: LegacyComponent[];
      };
    };
    if (json.status !== "OK" || !json.result) {
      console.error(
        `[geocode] classic place details refused: ${json.status}` +
          (json.error_message ? ` — ${json.error_message}` : "")
      );
      return null;
    }

    const lat = json.result.geometry?.location?.lat;
    const lng = json.result.geometry?.location?.lng;
    if (typeof lat !== "number" || typeof lng !== "number") return null;

    return toAddress(
      fromLegacy(json.result.address_components),
      json.result.formatted_address ?? "",
      lat,
      lng
    );
  } catch (err) {
    console.error("[geocode] classic place details could not be reached:", err);
    return null;
  }
}

/**
 * Turn a chosen suggestion into coordinates and a split-out address.
 *
 * Place ids are shared between the two generations, so a suggestion from
 * either can be resolved by either — which is what makes the fallback safe
 * when one API goes off midway through somebody filling the form in.
 */
export async function resolvePlace(placeId: string): Promise<ResolvedAddress | null> {
  const key = serverKey();
  if (!key || !placeId) return null;

  const resolved = newPlacesOff()
    ? await resolveViaLegacyPlaces(placeId, key)
    : ((await resolveViaNewPlaces(placeId, key)) ?? (await resolveViaLegacyPlaces(placeId, key)));

  if (!resolved) return null;

  /**
   * Pick a neighbourhood — "Jayanagar", "Koramangala" — and Google returns a
   * locality, which has no postal_code on it at all. The patient then has a
   * blank pincode field on a form whose whole point was not typing this out,
   * and the booking guard reads that pincode to decide whether we serve them.
   *
   * The coordinates always know. One extra lookup, only when something is
   * missing, and only when a suggestion is actually chosen — never per
   * keystroke.
   */
  if (resolved.pincode && resolved.city) return resolved;

  const fromPoint = await reverseGeocode(resolved.latitude, resolved.longitude);
  if (!fromPoint) return resolved;

  return {
    ...resolved,
    city: resolved.city || fromPoint.city,
    pincode: resolved.pincode || fromPoint.pincode,
  };
}

/* ------------------------------------------------------------------ */
/* Reverse                                                             */
/* ------------------------------------------------------------------ */

/** What is at this point — used when the patient drags the pin. */
export async function reverseGeocode(lat: number, lng: number): Promise<ResolvedAddress | null> {
  const key = serverKey();
  if (!key) return null;

  try {
    const url = `${GEOCODE}?latlng=${lat},${lng}&region=${REGION}&key=${key}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      status?: string;
      results?: Array<{ formatted_address?: string; address_components?: LegacyComponent[] }>;
    };
    const results = json.results ?? [];
    const first = results[0];
    if (json.status !== "OK" || !first) return null;

    // Shape comes from the most specific result; the pincode and city are
    // taken from wherever in the ladder Google actually put them.
    const address = toAddress(fromLegacy(first.address_components), first.formatted_address ?? "", lat, lng);
    return {
      ...address,
      city: address.city || cityAmong(results),
      pincode: address.pincode || pincodeAmong(results),
    };
  } catch (err) {
    console.error("[geocode] reverse threw:", err);
    return null;
  }
}

import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import {
  geocodingConfigured,
  resolvePlace,
  reverseGeocode,
  suggestAddresses,
} from "@/lib/geo/geocode";
import { ok, fail, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Address lookup for the signed-in user's own address form.
 *
 * Every call is billed against our key, so this is behind a session: an open
 * endpoint here is somebody else's autocomplete running on our account. It is
 * deliberately not restricted to patients — staff edit addresses too.
 */

const Suggest = z.object({ mode: z.literal("suggest"), query: z.string().min(1).max(200) });
const Place = z.object({ mode: z.literal("place"), placeId: z.string().min(1).max(400) });
const Reverse = z.object({
  mode: z.literal("reverse"),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const Input = z.discriminatedUnion("mode", [Suggest, Place, Reverse]);

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);

    // Not an error — the form simply falls back to typing the address by hand.
    if (!geocodingConfigured()) {
      return ok({ configured: false, suggestions: [], address: null });
    }

    const input = Input.parse(await req.json());

    if (input.mode === "suggest") {
      const { suggestions, unavailable } = await suggestAddresses(input.query);
      return ok({ configured: true, suggestions, unavailable });
    }
    if (input.mode === "place") {
      return ok({ configured: true, address: await resolvePlace(input.placeId) });
    }
    return ok({ configured: true, address: await reverseGeocode(input.lat, input.lng) });
  } catch (err) {
    return handleError(err);
  }
}

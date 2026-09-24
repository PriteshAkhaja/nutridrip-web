import { describe, expect, it } from "vitest";
import {
  ZONE_COUNT_TOKEN,
  ZONE_DEFAULTS,
  fillZoneCount,
  parsePincodes,
  servedZones,
  zoneForPincode,
  zoneProblems,
  type Zone,
  type ZoneInput,
} from "@/lib/zones";

const ZONES = ZONE_DEFAULTS;

describe("service zones", () => {
  it("resolves a served pincode to its zone", () => {
    expect(zoneForPincode("560095", ZONES)?.name).toBe("Koramangala");
    expect(zoneForPincode("560102", ZONES)?.name).toBe("HSR Layout");
  });

  it("returns null for a pincode nobody can be sent to", () => {
    // The public site promises a straight yes or no, so an unknown pincode must
    // fail rather than fall through to a booking a nurse cannot attend.
    expect(zoneForPincode("110001", ZONES)).toBeNull();
    expect(zoneForPincode("56009", ZONES)).toBeNull();
    expect(zoneForPincode("", ZONES)).toBeNull();
    expect(zoneForPincode(undefined, ZONES)).toBeNull();
  });

  it("treats a paused zone as not served", () => {
    const zones = ZONES.map((z) => (z.name === "Koramangala" ? { ...z, status: "paused" as const } : z));
    expect(zoneForPincode("560095", zones)).toBeNull();
    expect(servedZones(zones)).toHaveLength(ZONES.length - 1);
  });

  it("serves a pincode the moment it is added to a zone", () => {
    const zones = ZONES.map((z) => (z.name === "Hebbal" ? { ...z, pincodes: [...z.pincodes, "560092"] } : z));
    expect(zoneForPincode("560092", ZONES)).toBeNull();
    expect(zoneForPincode("560092", zones)?.name).toBe("Hebbal");
  });

  it("launches with fourteen zones and no pincode claimed twice", () => {
    expect(ZONES.length).toBe(14);
    const all = ZONES.flatMap((z) => z.pincodes);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("editing a zone", () => {
  const input = (over: Partial<ZoneInput> = {}): ZoneInput => ({
    name: "Yelahanka",
    pincodes: "560064, 560063",
    opensAt: "08:00",
    closesAt: "18:00",
    slotMinutes: 60,
    status: "open",
    ...over,
  });

  it("accepts a well-formed zone", () => {
    expect(zoneProblems(input(), ZONES)).toEqual({});
  });

  it("reads pincodes separated by commas, spaces or lines, once each", () => {
    expect(parsePincodes("560064, 560063\n560064  560065")).toEqual(["560064", "560063", "560065"]);
  });

  it("refuses a pincode already in another zone, and names that zone", () => {
    expect(zoneProblems(input({ pincodes: "560064 560034" }), ZONES).pincodes).toBe("560034 is already in Koramangala");
  });

  it("refuses something that is not a pincode", () => {
    expect(zoneProblems(input({ pincodes: "56006, 060064" }), ZONES).pincodes).toMatch(/56006, 060064 are not pincodes/);
    expect(zoneProblems(input({ pincodes: " " }), ZONES).pincodes).toBe("Add at least one pincode");
  });

  it("refuses a name already taken, whatever the case", () => {
    expect(zoneProblems(input({ name: "hsr layout" }), ZONES).name).toMatch(/already a zone called/);
  });

  it("lets a zone keep its own name and pincodes when edited", () => {
    const hebbal = ZONES.find((z) => z.name === "Hebbal")!;
    const others = ZONES.filter((z) => z !== hebbal);
    expect(zoneProblems({ ...hebbal, pincodes: hebbal.pincodes }, others)).toEqual({});
  });

  it("wants a step from the list, and hours long enough for one slot", () => {
    expect(zoneProblems(input({ slotMinutes: 50 }), ZONES).slotMinutes).toMatch(/30, 45, 60, 90 or 120/);
    expect(zoneProblems(input({ opensAt: "08:00", closesAt: "09:00", slotMinutes: 90 }), ZONES).slotMinutes).toBe(
      "The hours are shorter than one slot"
    );
  });

  it("wants hours that close after they open", () => {
    expect(zoneProblems(input({ opensAt: "18:00", closesAt: "08:00" }), ZONES).closesAt).toBe("Closes after it opens");
    expect(zoneProblems(input({ opensAt: "8am" }), ZONES).opensAt).toBeTruthy();
  });
});

describe("the zone count in site copy", () => {
  const zones: Zone[] = [ZONES[0], ZONES[1], { ...ZONES[2], status: "paused" }];

  it("counts only the zones a patient can book", () => {
    expect(fillZoneCount(`We cover ${ZONE_COUNT_TOKEN} zones across Bengaluru.`, zones)).toBe("We cover 2 zones across Bengaluru.");
    expect(fillZoneCount(ZONE_COUNT_TOKEN, zones)).toBe("2");
  });

  it("says one zone, not one zones", () => {
    expect(fillZoneCount(`${ZONE_COUNT_TOKEN} zones`, [ZONES[0]])).toBe("1 zone");
  });

  it("leaves copy an editor has overwritten alone", () => {
    expect(fillZoneCount("20", zones)).toBe("20");
  });
});

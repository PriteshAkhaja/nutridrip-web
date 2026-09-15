import { describe, expect, it } from "vitest";
import { ZONES, zoneForPincode } from "@/lib/zones";

describe("service zones", () => {
  it("resolves a served pincode to its zone", () => {
    expect(zoneForPincode("560095")?.name).toBe("Koramangala");
    expect(zoneForPincode("560102")?.name).toBe("HSR Layout");
  });

  it("returns null for a pincode nobody can be sent to", () => {
    // The public site promises a straight yes or no, so an unknown pincode must
    // fail rather than fall through to a booking a nurse cannot attend.
    expect(zoneForPincode("110001")).toBeNull();
    expect(zoneForPincode("56009")).toBeNull();
    expect(zoneForPincode("")).toBeNull();
    expect(zoneForPincode(undefined)).toBeNull();
  });

  it("has no pincode claimed by two zones", () => {
    const all = ZONES.flatMap((z) => z.pincodes);
    expect(new Set(all).size).toBe(all.length);
  });

  it("advertises fourteen zones, as the site says", () => {
    expect(ZONES.length).toBe(14);
  });
});

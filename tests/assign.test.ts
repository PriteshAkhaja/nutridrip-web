import { describe, expect, it } from "vitest";
import { distanceKm, NURSE_CAPACITY } from "@/lib/clinical/assign";
import { nurseOwns } from "@/lib/auth/ownership";
import type { SessionPayload } from "@/lib/auth/session";

describe("great-circle distance", () => {
  it("is zero for the same point", () => {
    expect(distanceKm(12.9352, 77.6245, 12.9352, 77.6245)).toBe(0);
  });

  it("puts two Bengaluru neighbourhoods within a few kilometres", () => {
    const km = distanceKm(12.9352, 77.6245, 12.9784, 77.6408);
    expect(km).toBeGreaterThan(3);
    expect(km).toBeLessThan(8);
  });

  it("is symmetric", () => {
    const a = distanceKm(12.9, 77.6, 13.0, 77.7);
    const b = distanceKm(13.0, 77.7, 12.9, 77.6);
    expect(a).toBeCloseTo(b, 9);
  });

  it("caps a nurse's open sessions", () => {
    expect(NURSE_CAPACITY).toBeGreaterThan(0);
  });
});

describe("nurse ownership", () => {
  const nurse = (id: string): SessionPayload => ({ sub: id, role: "nurse", name: "Nurse" });

  it("lets the assigned nurse work the session", () => {
    expect(nurseOwns(nurse("n1"), { nurseId: "n1" })).toBe(true);
  });

  it("refuses a nurse the session was not dispatched to", () => {
    expect(nurseOwns(nurse("n2"), { nurseId: "n1" })).toBe(false);
  });

  it("refuses an unassigned session", () => {
    expect(nurseOwns(nurse("n1"), {})).toBe(false);
    expect(nurseOwns(nurse("n1"), { nurseId: null })).toBe(false);
  });

  it("lets the super admin open any session, because somebody must be able to", () => {
    expect(nurseOwns({ sub: "a1", role: "superadmin", name: "Owner" }, { nurseId: "n1" })).toBe(true);
  });

  it("refuses every other role and a signed-out visitor", () => {
    expect(nurseOwns({ sub: "d1", role: "doctor", name: "Dr" }, { nurseId: "d1" })).toBe(false);
    expect(nurseOwns(null, { nurseId: "n1" })).toBe(false);
    expect(nurseOwns(nurse("n1"), null)).toBe(false);
  });

  it("compares ids as strings, since Mongo hands back ObjectIds", () => {
    expect(nurseOwns(nurse("507f1f77bcf86cd799439011"), { nurseId: { toString: () => "507f1f77bcf86cd799439011" } })).toBe(true);
  });
});

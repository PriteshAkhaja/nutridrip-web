import { describe, expect, it } from "vitest";
import { ownClash, ownClashMessage, type OwnSession } from "@/lib/clinical/slots";

// ND-4421, 30 Sept 10:00–10:45 in India (04:30–05:15 UTC).
const HELD: OwnSession = {
  bookingNo: "ND-4421",
  dripName: "Myers' Revive",
  scheduledAt: new Date("2026-09-30T04:30:00Z"),
  durationMin: 45,
};
const at = (ist: string) => new Date(`2026-09-30T${ist}:00+05:30`).getTime();

describe("a patient's own sessions do not overlap", () => {
  it("refuses the same time — the reported case, two drips at 10:00", () => {
    expect(ownClash([HELD], at("10:00"), 45)).toBe(HELD);
  });

  it("refuses any overlap, from either side", () => {
    expect(ownClash([HELD], at("09:30"), 45)).toBe(HELD); // ends 10:15, inside
    expect(ownClash([HELD], at("10:30"), 45)).toBe(HELD); // starts inside
    expect(ownClash([HELD], at("09:00"), 120)).toBe(HELD); // covers it
  });

  it("allows back-to-back sessions, and anything clear of it", () => {
    expect(ownClash([HELD], at("09:15"), 45)).toBeNull(); // ends exactly at 10:00
    expect(ownClash([HELD], at("10:45"), 45)).toBeNull(); // starts exactly at the end
    expect(ownClash([HELD], at("14:00"), 45)).toBeNull();
    expect(ownClash([], at("10:00"), 45)).toBeNull();
  });

  it("takes 45 minutes when a session has no length recorded", () => {
    const noLength = { ...HELD, durationMin: null };
    expect(ownClash([noLength], at("10:40"), 30)).toBe(noLength);
    expect(ownClash([noLength], at("10:45"), 30)).toBeNull();
  });

  it("names the session and its time in India, in the chosen clock", () => {
    expect(ownClashMessage(HELD, "12h")).toBe(
      "You already have ND-4421 (Myers' Revive) on 30 Sept, 10:00 AM–10:45 AM. Pick a time that does not overlap it."
    );
    expect(ownClashMessage(HELD, "24h")).toContain("10:00–10:45");
  });
});

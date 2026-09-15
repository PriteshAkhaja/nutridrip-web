import { describe, expect, it } from "vitest";
import { SLOTS, nextDays, slotDate, LATE_CHANGE_HOURS, LATE_CANCEL_FEE_INR } from "@/lib/clinical/slots";

describe("booking slots", () => {
  it("offers slots inside a plausible working day", () => {
    for (const s of SLOTS) {
      const [h] = s.split(":").map(Number);
      expect(h).toBeGreaterThanOrEqual(7);
      expect(h).toBeLessThanOrEqual(20);
    }
    expect(new Set(SLOTS).size).toBe(SLOTS.length);
  });

  it("releases days starting tomorrow, never today", () => {
    const from = new Date("2026-09-07T15:00:00");
    const days = nextDays(5, from);
    expect(days.length).toBe(5);
    expect(days[0].getDate()).toBe(8);
    expect(days[0].getHours()).toBe(0);
    for (let i = 1; i < days.length; i++) {
      expect(days[i].getTime()).toBeGreaterThan(days[i - 1].getTime());
    }
  });

  it("combines a day and a slot into the moment the nurse arrives", () => {
    const when = slotDate(new Date("2026-09-08T00:00:00"), "13:30");
    expect(when.getHours()).toBe(13);
    expect(when.getMinutes()).toBe(30);
    expect(when.getDate()).toBe(8);
  });

  it("states the late-change window and fee once, for everyone to share", () => {
    expect(LATE_CHANGE_HOURS).toBe(4);
    expect(LATE_CANCEL_FEE_INR).toBe(500);
  });
});

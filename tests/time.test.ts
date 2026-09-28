import { describe, expect, it } from "vitest";
import { clock, clockOf, clockRange, clockText, dateIN, dayClock, shortDateClock } from "@/lib/time";
import { callWhen } from "@/lib/clinical/calls";

// 25 Sept 2026, 11:30 UTC = 17:00 in India. The same instant must read 17:00
// whatever timezone the machine running the test is in.
const FIVE_PM_IST = new Date("2026-09-25T11:30:00.000Z");
// 18:45 UTC on the 25th is already 00:15 on the 26th in India.
const PAST_MIDNIGHT_IST = new Date("2026-09-25T18:45:00.000Z");

describe("clock", () => {
  it("writes an instant in India time, 12-hour or 24-hour", () => {
    expect(clock(FIVE_PM_IST, "12h")).toBe("5:00 PM");
    expect(clock(FIVE_PM_IST, "24h")).toBe("17:00");
    expect(clock(FIVE_PM_IST.toISOString(), "12h")).toBe("5:00 PM");
  });

  it("gets midnight and noon right in 12-hour", () => {
    expect(clock(PAST_MIDNIGHT_IST, "12h")).toBe("12:15 AM");
    expect(clock(PAST_MIDNIGHT_IST, "24h")).toBe("00:15");
    expect(clock(new Date("2026-09-25T06:30:00.000Z"), "12h")).toBe("12:00 PM");
  });

  it("shows nothing for a missing or broken value rather than 'Invalid Date'", () => {
    expect(clock(null, "12h")).toBe("");
    expect(clock(undefined, "24h")).toBe("");
    expect(clock("not a date", "12h")).toBe("");
  });
});

describe("stored HH:MM times", () => {
  it("converts a stored time without moving it", () => {
    expect(clockOf("17:00", "12h")).toBe("5:00 PM");
    expect(clockOf("00:30", "12h")).toBe("12:30 AM");
    expect(clockOf("12:00", "12h")).toBe("12:00 PM");
    expect(clockOf("07:05", "24h")).toBe("07:05");
    expect(clockRange("07:00", "20:00", "12h")).toBe("7:00 AM – 8:00 PM");
  });

  it("leaves anything that is not a time as it came", () => {
    expect(clockOf("", "12h")).toBe("");
    expect(clockOf("25:00", "12h")).toBe("25:00");
    expect(clockOf(undefined, "12h")).toBe("");
  });

  it("rewrites the times inside a sentence and nothing else", () => {
    expect(clockText("Koramangala takes bookings every 30 min from 08:00 to 19:30.", "12h")).toBe(
      "Koramangala takes bookings every 30 min from 8:00 AM to 7:30 PM."
    );
    expect(clockText("Mon–Fri 09:00–12:00 · ND-4417 · 2026-09-25", "12h")).toBe(
      "Mon–Fri 9:00 AM–12:00 PM · ND-4417 · 2026-09-25"
    );
    expect(clockText("from 08:00 to 19:30", "24h")).toBe("from 08:00 to 19:30");
  });
});

describe("dates", () => {
  it("reads the calendar day in India, not on the machine", () => {
    expect(dateIN(PAST_MIDNIGHT_IST)).toBe("26 Sept 2026");
    expect(dateIN(FIVE_PM_IST, { year: undefined })).toBe("25 Sept");
  });

  it("writes a day and a time together", () => {
    expect(dayClock(FIVE_PM_IST, "12h")).toBe("Fri, 25 Sept, 5:00 PM");
    expect(shortDateClock(FIVE_PM_IST, "24h")).toBe("25 Sept, 17:00");
    expect(callWhen(FIVE_PM_IST, "12h")).toBe(dayClock(FIVE_PM_IST, "12h"));
  });
});

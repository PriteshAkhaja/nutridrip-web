import { describe, expect, it } from "vitest";
import {
  BETWEEN_SESSIONS_MIN,
  LATE_CANCEL_FEE_INR,
  LATE_CHANGE_HOURS,
  clashes,
  freeNurses,
  istInstant,
  istParts,
  releasedDates,
  slotGrid,
  slotProblem,
  slotTimes,
  stepLabel,
  type Held,
  type SlotContext,
} from "@/lib/clinical/slots";

const HOUR = 3_600_000;
/** Thursday 24 Sept 2026, 15:00 in India. */
const NOW = istInstant("2026-09-24", "15:00").getTime();

const held = (over: Partial<Held>): Held => ({
  id: "b",
  nurseId: null,
  start: istInstant("2026-09-25", "10:00").getTime(),
  durationMin: 60,
  zoneName: "Koramangala",
  ...over,
});

const ctx = (over: Partial<SlotContext> = {}): SlotContext => ({
  hours: { opensAt: "07:00", closesAt: "20:00", slotMinutes: 60 },
  pool: ["asha", "bina"],
  held: [],
  zoneName: "Koramangala",
  ...over,
});

describe("the times a zone offers", () => {
  it("runs from opening, every step, while a slot still fits before closing", () => {
    const hourly = slotTimes({ opensAt: "07:00", closesAt: "20:00", slotMinutes: 60 });
    expect(hourly[0]).toBe("07:00");
    expect(hourly[hourly.length - 1]).toBe("19:00");
    expect(hourly).toHaveLength(13);
    expect(slotTimes({ opensAt: "09:00", closesAt: "17:00", slotMinutes: 90 })).toEqual([
      "09:00", "10:30", "12:00", "13:30", "15:00",
    ]);
  });

  it("names the step plainly", () => {
    expect(stepLabel(60)).toBe("every hour");
    expect(stepLabel(30)).toBe("every 30 min");
    expect(stepLabel(90)).toBe("every 1 h 30 min");
    expect(stepLabel(120)).toBe("every 2 hours");
  });
});

describe("India time, whatever the server's clock", () => {
  it("reads a moment back as the date and time a patient in India sees", () => {
    const at = istInstant("2026-09-25", "10:00");
    expect(at.toISOString()).toBe("2026-09-25T04:30:00.000Z");
    expect(istParts(at)).toEqual({ date: "2026-09-25", time: "10:00" });
  });

  it("releases days from tomorrow, never today — even late at night", () => {
    expect(releasedDates(5, new Date(NOW))).toEqual(["2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29"]);
    // 23:30 in India is 18:00 UTC: still "today" in India, so tomorrow is the 25th.
    expect(releasedDates(1, istInstant("2026-09-24", "23:30"))).toEqual(["2026-09-25"]);
  });
});

describe("whether a nurse is free", () => {
  it("counts the session and the travel after it", () => {
    const ten = istInstant("2026-09-25", "10:00").getTime();
    // A 60-minute session at 10:00 keeps the nurse until 11:45.
    expect(clashes(ten, 60, ten + 1 * HOUR, 60)).toBe(true);
    expect(clashes(ten, 60, ten + 1.75 * HOUR, 60)).toBe(false);
    // And a session can't start so close before another that the nurse can't make it.
    expect(clashes(ten, 60, ten - 1.25 * HOUR, 45)).toBe(true);
    expect(clashes(ten, 60, ten - 1.5 * HOUR, 45)).toBe(false);
    expect(BETWEEN_SESSIONS_MIN).toBe(45);
  });

  it("takes away nurses busy then, and the zone's sessions still waiting for a nurse", () => {
    const start = istInstant("2026-09-25", "10:00").getTime();
    const base = { pool: ["asha", "bina"], zoneName: "Koramangala", start, durationMin: 60 };
    expect(freeNurses({ ...base, held: [] })).toBe(2);
    expect(freeNurses({ ...base, held: [held({ nurseId: "asha" })] })).toBe(1);
    expect(freeNurses({ ...base, held: [held({ nurseId: "asha" }), held({ id: "c" })] })).toBe(0);
    // Another zone's unassigned session is not this zone's problem.
    expect(freeNurses({ ...base, held: [held({ zoneName: "Hebbal" })] })).toBe(2);
    // A nurse from outside the pool being busy changes nothing here.
    expect(freeNurses({ ...base, held: [held({ nurseId: "chitra" })] })).toBe(2);
  });
});

describe("the grid a patient sees", () => {
  it("marks each time free, taken or too soon", () => {
    const tomorrow = slotGrid(ctx({ pool: ["asha"], held: [held({ nurseId: "asha" })] }), 60, ["2026-09-25"], NOW)[0];
    const state = (t: string) => tomorrow.slots.find((s) => s.time === t)?.state;
    expect(state("08:00")).toBe("free"); // ends 09:00, travel to 09:45 — before 10:00
    expect(state("09:00")).toBe("taken"); // would run into the 10:00 session
    expect(state("10:00")).toBe("taken");
    expect(state("11:00")).toBe("taken"); // the nurse is still travelling
    expect(state("12:00")).toBe("free");
    expect(tomorrow.freeCount).toBe(13 - 3);
    expect(tomorrow.weekday).toBe("Fri");
    expect(tomorrow.day).toBe(25);
  });

  it("shows a time inside the lead hour as too soon, not taken", () => {
    const today = slotGrid(ctx(), 60, ["2026-09-24"], NOW)[0];
    expect(today.slots.find((s) => s.time === "15:00")?.state).toBe("too_soon");
    // Exactly an hour ahead is enough.
    expect(today.slots.find((s) => s.time === "16:00")?.state).toBe("free");
  });
});

describe("the server's check on a chosen time", () => {
  const at = (t: string) => istInstant("2026-09-25", t);

  it("accepts a free time on the grid", () => {
    expect(slotProblem(ctx(), at("10:00"), 60, NOW)).toBeNull();
  });

  it("refuses a time the zone does not offer, and says when it does", () => {
    const hebbal = ctx({ hours: { opensAt: "09:00", closesAt: "17:00", slotMinutes: 60 }, zoneName: "Hebbal" });
    const early = slotProblem(hebbal, at("08:00"), 60, NOW);
    expect(early?.status).toBe(422);
    expect(early?.error).toBe("08:00 is not a bookable time. Hebbal takes bookings every hour from 09:00 to 16:00.");
    expect(slotProblem(ctx(), at("10:30"), 60, NOW)?.status).toBe(422);
  });

  it("refuses a time every nurse is busy for", () => {
    const full = ctx({ pool: ["asha"], held: [held({ nurseId: "asha" })] });
    expect(slotProblem(full, at("10:00"), 60, NOW)).toEqual({
      error: "No nurse is free at that time any more. Pick another time.",
      status: 409,
    });
  });
});

it("states the late-change window and fee once, for everyone to share", () => {
  expect(LATE_CHANGE_HOURS).toBe(4);
  expect(LATE_CANCEL_FEE_INR).toBe(500);
});

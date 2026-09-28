import { describe, expect, it } from "vitest";
import {
  callClash,
  callDates,
  callGrid,
  callProblem,
  callTimes,
  callsOverlap,
  earliestDrip,
  hoursProblem,
  hoursSummary,
  isOverdue,
  nextFreeCall,
  type DoctorHours,
} from "@/lib/clinical/calls";
import { istInstant, slotGrid, type SlotContext } from "@/lib/clinical/slots";

/** Thursday 24 Sept 2026, 15:00 in India. */
const NOW = istInstant("2026-09-24", "15:00").getTime();
const MIN = 60_000;

// Mon–Sat mornings and early evenings, 15-minute calls; Fri 25 Sept is a working day.
const hours = (over: Partial<DoctorHours> = {}): DoctorHours => ({
  weekly: [1, 2, 3, 4, 5, 6].flatMap((day) => [
    { day, start: "10:00", end: "13:00" },
    { day, start: "17:00", end: "19:00" },
  ]),
  callMinutes: 15,
  daysOff: [],
  ...over,
});

describe("a physician's call times", () => {
  it("steps through each window by the call length, while a call still fits", () => {
    const fri = callTimes(hours(), "2026-09-25");
    expect(fri.slice(0, 3)).toEqual(["10:00", "10:15", "10:30"]);
    expect(fri).toContain("12:45");
    expect(fri).not.toContain("13:00");
    expect(fri).toContain("17:00");
    expect(fri[fri.length - 1]).toBe("18:45");
    expect(fri).toHaveLength(12 + 8);
  });

  it("has none on a day off, or on a day with no window", () => {
    expect(callTimes(hours({ daysOff: ["2026-09-25"] }), "2026-09-25")).toEqual([]);
    expect(callTimes(hours(), "2026-09-27")).toEqual([]); // Sunday
  });

  it("offers today and the next six days", () => {
    expect(callDates(new Date(NOW))).toEqual([
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
    ]);
  });
});

describe("the grid a patient picks a call from", () => {
  it("marks booked calls taken, near ones too soon, and says why a day is empty", () => {
    const booked = [{ start: istInstant("2026-09-25", "10:30").getTime(), minutes: 15 }];
    const days = callGrid(
      hours({ daysOff: ["2026-09-26"] }),
      booked,
      ["2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"],
      NOW
    );
    const at = (d: number, t: string) => days[d].slots.find((s) => s.time === t)?.state;
    expect(at(0, "17:00")).toBe("free"); // today, two hours away
    expect(at(0, "12:00")).toBe("too_soon"); // already past
    expect(at(1, "10:15")).toBe("free");
    expect(at(1, "10:30")).toBe("taken");
    expect(at(1, "10:45")).toBe("free");
    expect(days[2].note).toBe("Day off");
    expect(days[3].note).toBe("No calls");
    expect(nextFreeCall(days)).toBe(istInstant("2026-09-24", "17:00").toISOString());
  });

  it("a call booked when calls were 30 minutes long still blocks the 15-minute times it covers", () => {
    const booked = [{ start: istInstant("2026-09-25", "10:00").getTime(), minutes: 30 }];
    const fri = callGrid(hours(), booked, ["2026-09-25"], NOW)[0];
    expect(fri.slots.filter((s) => s.state === "taken").map((s) => s.time)).toEqual(["10:00", "10:15"]);
  });
});

describe("the server's check on a call time", () => {
  const at = (t: string, d = "2026-09-25") => istInstant(d, t);

  it("accepts a free time on the physician's grid", () => {
    expect(callProblem(hours(), [], at("10:30"), NOW)).toBeNull();
  });

  it("refuses less than an hour ahead, a day off, and a time off the grid", () => {
    expect(callProblem(hours(), [], istInstant("2026-09-24", "15:30"), NOW)?.status).toBe(422);
    expect(callProblem(hours({ daysOff: ["2026-09-25"] }), [], at("10:30"), NOW)?.error).toMatch(
      /not taking calls that day/
    );
    expect(callProblem(hours(), [], at("10:05"), NOW)?.error).toMatch(/not one of this physician's call times/);
    expect(callProblem(hours(), [], at("14:00"), NOW)?.status).toBe(422);
  });

  it("refuses a time already booked (409, so the screen reloads the times)", () => {
    const booked = [{ start: at("10:30").getTime(), minutes: 15 }];
    expect(callProblem(hours(), booked, at("10:30"), NOW)).toEqual({
      error: "That call time was just taken. Pick another.",
      status: 409,
    });
  });

  it("calls back to back do not overlap; overlapping ones do", () => {
    const t = at("10:00").getTime();
    expect(callsOverlap(t, 15, t + 15 * MIN, 15)).toBe(false);
    expect(callsOverlap(t, 30, t + 15 * MIN, 15)).toBe(true);
  });
});

describe("the drip after the call", () => {
  it("is held from two hours after the call ends", () => {
    const call = istInstant("2026-09-25", "10:30").getTime();
    expect(new Date(earliestDrip(call, 15)).toISOString()).toBe(istInstant("2026-09-25", "12:45").toISOString());
  });

  it("the drip grid marks earlier times 'before call', and later ones as usual", () => {
    const ctx: SlotContext = {
      hours: { opensAt: "07:00", closesAt: "20:00", slotMinutes: 60 },
      pool: ["asha"],
      held: [],
      zoneName: "Koramangala",
    };
    const from = earliestDrip(istInstant("2026-09-25", "10:30").getTime(), 15);
    const fri = slotGrid(ctx, 45, ["2026-09-25"], NOW, from)[0];
    const state = (t: string) => fri.slots.find((s) => s.time === t)?.state;
    expect(state("12:00")).toBe("before_call");
    expect(state("13:00")).toBe("free");
    expect(fri.freeCount).toBe(7); // 13:00 … 19:00
  });
});

describe("after the call time", () => {
  it("a call still booked 15 minutes after it should have ended is overdue", () => {
    const call = { status: "booked", startAt: istInstant("2026-09-24", "14:00"), minutes: 15 };
    expect(isOverdue(call, istInstant("2026-09-24", "14:29").getTime())).toBe(false);
    expect(isOverdue(call, istInstant("2026-09-24", "14:31").getTime())).toBe(true);
    expect(isOverdue({ ...call, status: "done" }, NOW)).toBe(false);
  });

  it("a booked call is flagged when a day off or shorter hours no longer cover it", () => {
    const at = istInstant("2026-09-25", "17:30");
    expect(callClash(hours(), at, 15)).toBeNull();
    expect(callClash(hours({ daysOff: ["2026-09-25"] }), at, 15)).toBe("On your day off");
    expect(callClash(hours({ weekly: [{ day: 5, start: "10:00", end: "13:00" }] }), at, 15)).toBe("Outside your hours");
  });
});

describe("editing hours", () => {
  it("accepts sensible hours and summarises them Monday first", () => {
    expect(hoursProblem(hours())).toBeNull();
    expect(hoursSummary(hours(), "24h")).toBe("Mon–Sat 10:00–13:00, 17:00–19:00");
    expect(hoursSummary(hours(), "12h")).toBe("Mon–Sat 10:00 AM–1:00 PM, 5:00 PM–7:00 PM");
    expect(hoursSummary(hours({ weekly: [] }), "12h")).toBe("No hours set");
  });

  it("refuses overlapping windows, a window shorter than a call, and odd call lengths", () => {
    expect(
      hoursProblem(
        hours({
          weekly: [
            { day: 1, start: "10:00", end: "12:00" },
            { day: 1, start: "11:30", end: "13:00" },
          ],
        })
      )
    ).toMatch(/Mon: 10:00–12:00 and 11:30–13:00 overlap/);
    expect(hoursProblem(hours({ weekly: [{ day: 2, start: "10:00", end: "10:10" }] }))).toMatch(
      /shorter than one 15-minute call/
    );
    expect(hoursProblem(hours({ callMinutes: 25 }))).toMatch(/10, 15, 20, 30/);
    expect(hoursProblem(hours({ daysOff: ["26 Sept"] }))).toMatch(/is not a date/);
  });
});

import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  clampISO,
  display,
  fromISO,
  iso,
  monthOpen,
  parseTyped,
  yearOptions,
} from "@/components/ui/DatePicker";

describe("date arithmetic in the picker", () => {
  it("round-trips a date without drifting across the timezone", () => {
    // The whole reason the helpers exist: `new Date("2026-09-16")` is parsed
    // as UTC, which in IST is 05:30 on the 16th — but any timezone west of
    // Greenwich lands on the 15th, and the picker would ring the wrong cell.
    for (const s of ["2026-09-16", "2026-01-01", "2026-12-31", "2024-02-29"]) {
      expect(iso(fromISO(s)!)).toBe(s);
    }
  });

  it("refuses a day that does not exist rather than rolling it forward", () => {
    expect(fromISO("2026-02-30")).toBeNull();
    expect(fromISO("2026-04-31")).toBeNull();
    expect(fromISO("2025-02-29")).toBeNull(); // not a leap year
    expect(fromISO("2024-02-29")).not.toBeNull(); // this one is
  });

  it("refuses anything that is not a whole ISO date", () => {
    for (const bad of ["", "2026-9-16", "16-09-2026", "2026-09", "nonsense", null, undefined]) {
      expect(fromISO(bad as string)).toBeNull();
    }
    expect(fromISO("2026-13-01")).toBeNull();
    expect(fromISO("2026-00-10")).toBeNull();
  });

  it("shows dd-mm-yyyy, which is how a date is read here", () => {
    expect(display("2026-09-16")).toBe("16-09-2026");
    expect(display("2026-01-05")).toBe("05-01-2026");
    expect(display("")).toBe("");
    expect(display("garbage")).toBe("");
  });

  it("clamps a month step instead of overflowing into the next one", () => {
    // 31 March back one month is 28 February, not 3 March. Getting this wrong
    // makes the header skip a month as you page through it.
    expect(iso(addMonths(new Date(2026, 2, 31), -1))).toBe("2026-02-28");
    expect(iso(addMonths(new Date(2024, 2, 31), -1))).toBe("2024-02-29");
    expect(iso(addMonths(new Date(2026, 0, 31), 1))).toBe("2026-02-28");
    expect(iso(addMonths(new Date(2026, 4, 31), 1))).toBe("2026-06-30");
  });

  it("steps a year with the shifted page keys and keeps the day", () => {
    expect(iso(addMonths(new Date(2026, 8, 16), 12))).toBe("2027-09-16");
    expect(iso(addMonths(new Date(2026, 8, 16), -12))).toBe("2025-09-16");
    // 29 Feb in a leap year, a year later, has to land somewhere real.
    expect(iso(addMonths(new Date(2024, 1, 29), 12))).toBe("2025-02-28");
  });

  it("crosses month and year boundaries a day at a time", () => {
    expect(iso(addDays(new Date(2026, 8, 30), 1))).toBe("2026-10-01");
    expect(iso(addDays(new Date(2026, 11, 31), 1))).toBe("2027-01-01");
    expect(iso(addDays(new Date(2026, 0, 1), -1))).toBe("2025-12-31");
    expect(iso(addDays(new Date(2026, 8, 16), 7))).toBe("2026-09-23");
  });
});

describe("what somebody types into the box", () => {
  it("takes the separators people actually use", () => {
    for (const typed of ["16-09-2026", "16/09/2026", "16.09.2026", "16 09 2026"]) {
      expect(parseTyped(typed)).toBe("2026-09-16");
    }
  });

  it("takes a single-digit day or month", () => {
    expect(parseTyped("5-1-2026")).toBe("2026-01-05");
    expect(parseTyped("05-1-2026")).toBe("2026-01-05");
  });

  it("ignores surrounding whitespace", () => {
    expect(parseTyped("  16-09-2026  ")).toBe("2026-09-16");
  });

  it("returns empty for anything half-typed or impossible", () => {
    // A half-finished field is not an error, it is unfinished — the caller
    // puts the last good value back rather than showing a validation shout.
    for (const bad of [
      "",
      "16",
      "16-09",
      "16-09-20",
      "1692026",
      "aa-bb-cccc",
      "32-01-2026",
      "16-13-2026",
      "30-02-2026",
    ]) {
      expect(parseTyped(bad), bad).toBe("");
    }
  });

  it("does not quietly read a US-ordered date as a local one", () => {
    // 09/16/2026 is month-first. There is no 16th month, so it is refused
    // rather than silently becoming a different day.
    expect(parseTyped("09/16/2026")).toBe("");
    // But a date that is valid in both orders has to take the local reading.
    expect(parseTyped("05/09/2026")).toBe("2026-09-05");
  });
});

describe("staying inside a field's allowed dates", () => {
  // "Add a day off": today onwards. "Date paid": today and before.
  const today = "2026-09-25";

  it("knows which months have a day that can be chosen", () => {
    expect(monthOpen(2026, 8, today)).toBe(true); // September: the 25th onwards
    expect(monthOpen(2026, 7, today)).toBe(false); // August: all past
    expect(monthOpen(2025, 11, today)).toBe(false); // December 2025, the reported case
    expect(monthOpen(2026, 9, undefined, today)).toBe(false); // October, for a past-only field
    expect(monthOpen(2026, 8, undefined, today)).toBe(true);
    expect(monthOpen(1990, 0)).toBe(true); // no bounds at all
  });

  it("keeps a date inside the bounds", () => {
    expect(clampISO("2026-09-01", today)).toBe(today);
    expect(clampISO("2026-10-01", undefined, today)).toBe(today);
    expect(clampISO("2026-09-30", today)).toBe("2026-09-30");
  });

  it("the Year list always holds the year on screen and the chosen one", () => {
    // Min in 2026: 2026 onwards … and 2025 if the calendar is showing it.
    expect(yearOptions(2026, today, undefined, [2025])[0]).toBe(2025);
    expect(yearOptions(2026, today, undefined, [2026])[0]).toBe(2026);
    // A date of birth older than a century back is still shown as itself.
    expect(yearOptions(2026, undefined, undefined, [1920])[0]).toBe(1920);
    expect(yearOptions(2026, undefined, today)).toContain(1926);
    expect(yearOptions(2026, undefined, today).at(-1)).toBe(2026);
    // No duplicates, in order.
    const ys = yearOptions(2026, "2026-01-01", "2027-12-31", [2026, 2027]);
    expect(ys).toEqual([2026, 2027]);
  });

  it("paging back from January lands in December of the year before", () => {
    const dec = addMonths(new Date(2026, 0, 1), -1);
    expect([dec.getFullYear(), dec.getMonth()]).toEqual([2025, 11]);
  });
});

import { describe, expect, it } from "vitest";
import { formatTime12, parseHHMM, parseTypedTime, toHHMM } from "@/components/ui/TimePicker";

describe("the time picker's words", () => {
  it("shows a 24-hour value with AM/PM", () => {
    expect(formatTime12("17:00")).toBe("5:00 PM");
    expect(formatTime12("09:05")).toBe("9:05 AM");
    expect(formatTime12("00:30")).toBe("12:30 AM");
    expect(formatTime12("12:00")).toBe("12:00 PM");
    expect(formatTime12("")).toBe("");
    expect(formatTime12("25:00")).toBe("");
  });

  it("reads what people type", () => {
    expect(parseTypedTime("17:00")).toBe("17:00");
    expect(parseTypedTime("5pm")).toBe("17:00");
    expect(parseTypedTime("5:30 pm")).toBe("17:30");
    expect(parseTypedTime("5.30 PM")).toBe("17:30");
    expect(parseTypedTime("1730")).toBe("17:30");
    expect(parseTypedTime("930")).toBe("09:30");
    expect(parseTypedTime("9")).toBe("09:00");
    expect(parseTypedTime("12 am")).toBe("00:00");
    expect(parseTypedTime("12:15 p.m.")).toBe("12:15");
  });

  it("refuses what is not a time, rather than guessing", () => {
    expect(parseTypedTime("24:00")).toBe("");
    expect(parseTypedTime("13 pm")).toBe("");
    expect(parseTypedTime("10:75")).toBe("");
    expect(parseTypedTime("noon")).toBe("");
    expect(parseTypedTime("")).toBe("");
  });

  it("keeps the stored value 24-hour", () => {
    expect(toHHMM(7, 5)).toBe("07:05");
    expect(parseHHMM("07:05")).toEqual({ h: 7, m: 5 });
    expect(parseHHMM("7:05")).toBeNull();
  });
});

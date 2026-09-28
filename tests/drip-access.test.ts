import { describe, expect, it } from "vitest";
import { patientMayBook } from "@/lib/clinical/drip-access";

const PUBLIC = { _id: "d1", isPublic: true };
const HIDDEN = { _id: "d2", isPublic: false };

describe("who may book a drip kept off the website", () => {
  it("anyone may book a drip on the website", () => {
    expect(patientMayBook(PUBLIC, [])).toBe(true);
  });

  it("a drip saved before the setting existed counts as on the website", () => {
    expect(patientMayBook({ _id: "d3" }, [])).toBe(true);
  });

  it("a hidden drip only on the physician's recommendation", () => {
    expect(patientMayBook(HIDDEN, [])).toBe(false);
    expect(patientMayBook(HIDDEN, ["d1"])).toBe(false);
    expect(patientMayBook(HIDDEN, ["d1", "d2"])).toBe(true);
  });

  it("compares ids as text, whatever type the database returns", () => {
    const objectIdLike = { toString: () => "d2" };
    expect(patientMayBook(HIDDEN, [objectIdLike])).toBe(true);
  });
});

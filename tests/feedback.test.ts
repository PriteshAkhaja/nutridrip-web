import { describe, expect, it } from "vitest";
import { isLow, readFeedback } from "@/lib/clinical/feedback";

describe("session feedback", () => {
  it("reads the two parts separately", () => {
    const v = readFeedback({ nurseRating: 5, nurseComment: " Very gentle ", sessionRating: 3, sessionComment: "", givenAt: "2026-09-24T08:00:00Z" });
    expect(v?.nurse).toEqual({ rating: 5, comment: "Very gentle" });
    expect(v?.session).toEqual({ rating: 3, comment: null });
    expect(v?.givenAt).toBe("2026-09-24T08:00:00.000Z");
  });

  it("reads an older single rating as both the nurse's and the session's", () => {
    const v = readFeedback({ rating: 4, comment: "Fine" });
    expect(v?.nurse).toEqual({ rating: 4, comment: "Fine" });
    expect(v?.session).toEqual({ rating: 4, comment: "Fine" });
  });

  it("is nothing when nothing was rated, or the numbers are not ratings", () => {
    expect(readFeedback(null)).toBeNull();
    expect(readFeedback({})).toBeNull();
    expect(readFeedback({ rating: 9 })).toBeNull();
  });

  it("flags a low rating on either part for the physician", () => {
    expect(isLow(readFeedback({ nurseRating: 2, sessionRating: 5 }))).toBe(true);
    expect(isLow(readFeedback({ nurseRating: 5, sessionRating: 1 }))).toBe(true);
    expect(isLow(readFeedback({ nurseRating: 3, sessionRating: 4 }))).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { approvalState, APPROVAL_VALID_DAYS, APPROVAL_WARN_DAYS } from "@/lib/clinical/validity";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

describe("physician approval window", () => {
  it("blocks a patient who has never taken the quiz", () => {
    const s = approvalState(null);
    expect(s.canBook).toBe(false);
    expect(s.status).toBe("none");
  });

  it("holds a pending submission short of booking", () => {
    const s = approvalState({ reviewStatus: "pending", completedAt: daysAgo(0) });
    expect(s.canBook).toBe(false);
    expect(s.status).toBe("pending");
  });

  it("lets a fresh approval book freely", () => {
    const s = approvalState({ reviewStatus: "approved", reviewedAt: daysAgo(1), completedAt: daysAgo(1) });
    expect(s.canBook).toBe(true);
    expect(s.status).toBe("valid");
    expect(s.daysLeft).toBeGreaterThan(APPROVAL_WARN_DAYS);
  });

  it("warns near the end of the window but still allows booking", () => {
    const s = approvalState({
      reviewStatus: "approved",
      reviewedAt: daysAgo(APPROVAL_VALID_DAYS - 3),
      completedAt: daysAgo(APPROVAL_VALID_DAYS - 3),
    });
    expect(s.canBook).toBe(true);
    expect(s.status).toBe("expiring");
  });

  it("stops booking once the approval has lapsed", () => {
    const s = approvalState({
      reviewStatus: "approved",
      reviewedAt: daysAgo(APPROVAL_VALID_DAYS + 1),
      completedAt: daysAgo(APPROVAL_VALID_DAYS + 1),
    });
    expect(s.canBook).toBe(false);
    expect(s.status).toBe("expired");
  });

  it("keeps a declined patient blocked regardless of age", () => {
    const s = approvalState({ reviewStatus: "rejected", reviewedAt: daysAgo(2), completedAt: daysAgo(3) });
    expect(s.canBook).toBe(false);
    expect(s.status).toBe("rejected");
  });

  it("dates the window from the review, not the submission", () => {
    // Answered long ago, reviewed yesterday: the clock runs from the review.
    const s = approvalState({ reviewStatus: "approved", reviewedAt: daysAgo(1), completedAt: daysAgo(200) });
    expect(s.canBook).toBe(true);
  });
});

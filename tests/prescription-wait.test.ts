import { describe, expect, it } from "vitest";
import { describeWait, waitedLongEnough, RX_OVERRIDE_WAIT_MIN } from "@/lib/clinical/prescription";

const NOW = new Date("2026-09-14T12:00:00Z").getTime();
const ago = (mins: number) => new Date(NOW - mins * 60_000);

describe("how long the nurse has been waiting", () => {
  it("says nothing when nothing was asked", () => {
    expect(describeWait(null, NOW)).toBeNull();
    expect(describeWait(undefined, NOW)).toBeNull();
  });

  it("reads the first minute as just now, not zero minutes", () => {
    expect(describeWait(ago(0), NOW)).toBe("just now");
    expect(describeWait(ago(0.5), NOW)).toBe("just now");
  });

  it("counts in minutes up to the hour", () => {
    expect(describeWait(ago(1), NOW)).toBe("waiting 1 min");
    expect(describeWait(ago(23), NOW)).toBe("waiting 23 min");
    expect(describeWait(ago(59), NOW)).toBe("waiting 59 min");
  });

  it("switches to hours, and drops a bare zero minutes", () => {
    expect(describeWait(ago(60), NOW)).toBe("waiting 1 h");
    expect(describeWait(ago(65), NOW)).toBe("waiting 1 h 5 min");
    expect(describeWait(ago(120), NOW)).toBe("waiting 2 h");
  });
});

describe("when proceeding alone becomes reasonable", () => {
  it("is not reasonable straight away", () => {
    expect(waitedLongEnough(ago(0), NOW)).toBe(false);
    expect(waitedLongEnough(ago(RX_OVERRIDE_WAIT_MIN - 1), NOW)).toBe(false);
  });

  it("is reasonable once the stated wait has passed", () => {
    expect(waitedLongEnough(ago(RX_OVERRIDE_WAIT_MIN), NOW)).toBe(true);
    expect(waitedLongEnough(ago(RX_OVERRIDE_WAIT_MIN + 30), NOW)).toBe(true);
  });

  it("is never true when nothing was asked", () => {
    expect(waitedLongEnough(null, NOW)).toBe(false);
  });
});

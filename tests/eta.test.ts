import { describe, expect, it } from "vitest";
import { distanceKm, etaBetween, etaLabel, etaMinutesFor } from "@/lib/clinical/nurse-options";

/** Two real Bengaluru points, about 4.4 km apart. */
const KORAMANGALA = { latitude: 12.9345, longitude: 77.627 };
const HSR = { latitude: 12.9121, longitude: 77.6446 };

describe("how long the nurse will be", () => {
  it("never promises sooner than five minutes", () => {
    // "Arriving in 1 minute" reads as a doorbell about to ring, and it is not.
    expect(etaMinutesFor(0)).toBe(5);
    expect(etaMinutesFor(0.1)).toBe(5);
  });

  it("grows with the distance", () => {
    expect(etaMinutesFor(5)).toBeGreaterThan(etaMinutesFor(1));
    expect(etaMinutesFor(20)).toBeGreaterThan(etaMinutesFor(5));
  });

  it("puts a city crossing in a believable range", () => {
    // 10 km across Bengaluru is not a ten-minute trip.
    const t = etaMinutesFor(10);
    expect(t).toBeGreaterThanOrEqual(25);
    expect(t).toBeLessThanOrEqual(35);
  });

  it("returns whole minutes, not a precision nobody has", () => {
    expect(Number.isInteger(etaMinutesFor(4.37))).toBe(true);
  });

  it("does not fall over on nonsense", () => {
    expect(etaMinutesFor(-1)).toBe(5);
    expect(etaMinutesFor(Number.NaN)).toBe(5);
    expect(etaMinutesFor(Number.POSITIVE_INFINITY)).toBe(5);
  });
});

describe("the ETA between two people", () => {
  it("works it out when both ends are known", () => {
    const km = distanceKm(
      KORAMANGALA.latitude,
      KORAMANGALA.longitude,
      HSR.latitude,
      HSR.longitude
    );
    expect(km).toBeGreaterThan(2);
    expect(km).toBeLessThan(6);
    expect(etaBetween(KORAMANGALA, HSR)).toBe(etaMinutesFor(km));
  });

  it("gives nothing rather than a guess when a position is missing", () => {
    // A nurse with no coordinates would otherwise appear to be at the door.
    expect(etaBetween(null, HSR)).toBeNull();
    expect(etaBetween(KORAMANGALA, null)).toBeNull();
    expect(etaBetween(undefined, undefined)).toBeNull();
    expect(etaBetween({ latitude: 12.9 }, HSR)).toBeNull();
    expect(etaBetween({ longitude: 77.6 }, HSR)).toBeNull();
  });

  it("treats a zero coordinate as a real one, not as missing", () => {
    // 0°N 0°E is in the Atlantic, but it is a position — dropping it because
    // it is falsy is the classic bug this guards.
    expect(etaBetween({ latitude: 0, longitude: 0 }, HSR)).not.toBeNull();
  });

  it("is the same in both directions", () => {
    expect(etaBetween(KORAMANGALA, HSR)).toBe(etaBetween(HSR, KORAMANGALA));
  });
});

describe("what the patient is told", () => {
  it("gives a figure when there is one", () => {
    expect(etaLabel(18)).toBe("about 18 min away");
  });

  it("says something useful when there is not", () => {
    expect(etaLabel(null)).toBe("on the way");
    expect(etaLabel(undefined)).toBe("on the way");
    expect(etaLabel(0)).toBe("on the way");
  });
});

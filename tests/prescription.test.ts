import { describe, expect, it } from "vitest";
import {
  canOpenPrescription,
  rxLockState,
  RX_OTP_MAX_ATTEMPTS,
  RX_OTP_TTL_MS,
  RX_OVERRIDE_MIN_REASON,
} from "@/lib/clinical/prescription";

describe("prescription lock", () => {
  it("is shut until the patient's code has been accepted", () => {
    expect(rxLockState({}).unlocked).toBe(false);
    expect(rxLockState(null).unlocked).toBe(false);
    expect(rxLockState(undefined).unlocked).toBe(false);
    expect(rxLockState({ rxUnlockedAt: null }).unlocked).toBe(false);
  });

  it("opens once, and reports when", () => {
    const at = new Date("2026-09-12T09:30:00.000Z");
    const state = rxLockState({ rxUnlockedAt: at });
    expect(state.unlocked).toBe(true);
    expect(state.unlockedAt).toBe(at.toISOString());
  });

  it("offers a code only where there is a prescription to open", () => {
    // Approved onwards: the physician has signed something.
    for (const status of ["approved", "nurse_assigned", "en_route", "in_progress", "completed"]) {
      expect(canOpenPrescription(status)).toBe(true);
    }
  });

  it("refuses on sessions that were never approved or were stood down", () => {
    // Nothing has been prescribed yet, or it was withdrawn — there is no
    // document to open, so asking the patient for a code would be theatre.
    for (const status of ["draft", "awaiting_review", "rejected", "cancelled"]) {
      expect(canOpenPrescription(status)).toBe(false);
    }
  });

  it("keeps the code short-lived and guessing expensive", () => {
    // Ten minutes is long enough to read six digits aloud and no longer.
    expect(RX_OTP_TTL_MS).toBe(10 * 60_000);
    // A six-digit code is one-in-a-million per guess; five tries keeps it there.
    expect(RX_OTP_MAX_ATTEMPTS).toBeLessThanOrEqual(5);
  });
});

describe("how a prescription was opened", () => {
  it("reports the patient's code as the ordinary route", () => {
    const s = rxLockState({ rxUnlockedAt: new Date(), rxUnlockMethod: "code" });
    expect(s.unlocked).toBe(true);
    expect(s.overridden).toBe(false);
  });

  it("marks a physician authorisation as an override", () => {
    const s = rxLockState({ rxUnlockedAt: new Date(), rxUnlockMethod: "physician" });
    expect(s.overridden).toBe(true);
    expect(s.method).toBe("physician");
  });

  it("marks a nurse proceeding alone as an override", () => {
    // This is the one that must never be mistaken for a normal unlock on the
    // screen or in the report.
    const s = rxLockState({ rxUnlockedAt: new Date(), rxUnlockMethod: "break_glass" });
    expect(s.overridden).toBe(true);
    expect(s.method).toBe("break_glass");
  });

  it("treats a session opened before methods were recorded as a code unlock", () => {
    const s = rxLockState({ rxUnlockedAt: new Date() });
    expect(s.method).toBe("code");
    expect(s.overridden).toBe(false);
  });

  it("is not an override while still locked", () => {
    expect(rxLockState({ rxUnlockMethod: null }).overridden).toBe(false);
  });

  it("demands a reason long enough to mean something", () => {
    // A one-word reason makes the audit row worthless, and the audit row is the
    // only thing separating a break-glass from a plain bypass.
    expect(RX_OVERRIDE_MIN_REASON).toBeGreaterThanOrEqual(10);
  });
});

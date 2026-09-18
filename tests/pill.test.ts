import { describe, expect, it } from "vitest";
import { isLiveStatus, STATUS_TONE } from "@/components/ui/Pill";

describe("which status pills pulse", () => {
  it("pulses a status that is still in motion", () => {
    for (const s of ["en_route", "in_progress", "nurse_assigned", "awaiting_review", "info_needed", "pending"]) {
      expect(isLiveStatus(s), s).toBe(true);
    }
  });

  it("accepts the readable labels that some screens pass instead of the raw value", () => {
    expect(isLiveStatus("Awaiting review")).toBe(true);
    expect(isLiveStatus("Needs more information")).toBe(true);
  });

  it("keeps every settled state still", () => {
    // A pulse says "happening now". On a finished or stopped record it would
    // say something untrue.
    for (const s of ["completed", "cancelled", "approved", "rejected", "modified", "DRAFT", "CONFIRMED", "DISPATCHED", "CANCELLED", "active", "inactive", "suspended", "quarantined", "out_of_stock", "adverse_event"]) {
      expect(isLiveStatus(s), s).toBe(false);
    }
  });

  it("does not pulse an unknown status", () => {
    expect(isLiveStatus("")).toBe(false);
    expect(isLiveStatus("something_new")).toBe(false);
  });

  it("only names statuses the pill vocabulary knows", () => {
    // A live status missing from STATUS_TONE would render neutral grey and
    // pulse anyway — or, misspelt, never pulse at all.
    for (const s of ["en_route", "in_progress", "nurse_assigned", "awaiting_review", "Awaiting review", "info_needed", "Needs more information", "pending"]) {
      expect(STATUS_TONE[s], s).toBeDefined();
    }
  });
});

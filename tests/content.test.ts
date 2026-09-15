import { describe, expect, it } from "vitest";
import { CONTENT_DEFAULTS, CONTENT_GROUPS } from "@/lib/content";

describe("editable site copy", () => {
  it("gives every key a non-empty default, so a fresh database still renders", () => {
    for (const [key, value] of Object.entries(CONTENT_DEFAULTS)) {
      expect(value.trim().length, key).toBeGreaterThan(0);
    }
  });

  it("holds only copy — nothing that has no sensible default", () => {
    // Billing registration details lived here briefly and had to be blank,
    // which broke the rule above. They are configuration, not copy, and now
    // live in BillingSettings. Keep it that way.
    for (const key of Object.keys(CONTENT_DEFAULTS)) {
      expect(key.startsWith("billing."), key).toBe(false);
    }
  });

  it("puts every key in exactly one editor group", () => {
    const grouped = Object.values(CONTENT_GROUPS).flat();
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(new Set(grouped)).toEqual(new Set(Object.keys(CONTENT_DEFAULTS)));
  });
});

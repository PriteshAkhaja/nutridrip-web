import { describe, expect, it } from "vitest";
import { CONTENT_DEFAULTS, CONTENT_GROUPS } from "@/lib/content";

describe("editable site copy", () => {
  it("gives every key a non-empty default, so a fresh database still renders", () => {
    for (const [key, value] of Object.entries(CONTENT_DEFAULTS)) {
      expect(value.trim().length, key).toBeGreaterThan(0);
    }
  });

  it("puts every key in exactly one editor group", () => {
    const grouped = Object.values(CONTENT_GROUPS).flat();
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(new Set(grouped)).toEqual(new Set(Object.keys(CONTENT_DEFAULTS)));
  });
});

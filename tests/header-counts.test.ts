import { describe, expect, it } from "vitest";
import { plural } from "@/components/layout/HeaderCounts";

describe("counts that read as English", () => {
  it("keeps one singular", () => {
    expect(plural(1, "infusion")).toBe("1 infusion");
    expect(plural(1, "prescription")).toBe("1 prescription");
  });

  it("pluralises everything else, zero included", () => {
    expect(plural(0, "infusion")).toBe("0 infusions");
    expect(plural(2, "reaction")).toBe("2 reactions");
    expect(plural(17, "session")).toBe("17 sessions");
  });

  it("takes an irregular plural when -s would be wrong", () => {
    expect(plural(1, "batch", "batches")).toBe("1 batch");
    expect(plural(3, "batch", "batches")).toBe("3 batches");
  });
});

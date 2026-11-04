import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/next-path";

describe("where sign-in goes next", () => {
  it("keeps a path on this site, with its query and section", () => {
    expect(safeNextPath("/quiz")).toBe("/quiz");
    expect(safeNextPath("/app/session/abc?tab=report#vitals")).toBe("/app/session/abc?tab=report#vitals");
  });

  it("refuses anything that would leave the site", () => {
    for (const next of [
      "https://look-alike.example",
      "//look-alike.example",
      "/\\look-alike.example",
      "/\t/look-alike.example",
      "/\n/look-alike.example",
      "javascript:alert(1)",
      "look-alike.example",
    ]) {
      expect(safeNextPath(next), JSON.stringify(next)).toBeNull();
    }
  });

  it("refuses what is not a single address", () => {
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath("")).toBeNull();
    expect(safeNextPath(["/quiz", "https://look-alike.example"])).toBeNull();
  });
});

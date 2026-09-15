import { describe, expect, it } from "vitest";
import { normalisePhone } from "@/lib/auth/phone";

describe("phone normalisation", () => {
  it("treats the same number written four ways as one account", () => {
    const forms = ["+919844471234", "9844471234", "09844471234", "+91 98444 71234"];
    const normalised = new Set(forms.map(normalisePhone));
    expect(normalised.size).toBe(1);
    expect([...normalised][0]).toBe("+919844471234");
  });

  it("keeps an already-international number intact", () => {
    expect(normalisePhone("+442071234567")).toBe("+442071234567");
  });

  it("rejects what cannot be a phone number", () => {
    expect(normalisePhone("12345")).toBeNull();
    expect(normalisePhone("")).toBeNull();
    expect(normalisePhone(null)).toBeNull();
    expect(normalisePhone("not a number")).toBeNull();
  });
});

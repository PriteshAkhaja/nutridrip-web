import { describe, expect, it } from "vitest";
import {
  ADDRESS_MAX_LINES,
  LETTERHEAD_LIMITS,
  LetterheadInput,
  hasLetterhead,
  letterheadChanges,
  letterheadView,
  normaliseLetterhead,
} from "@/lib/clinical/letterhead";

describe("LetterheadInput", () => {
  it("accepts a complete letterhead", () => {
    const r = LetterheadInput.safeParse({
      practiceName: "Menon Internal Medicine",
      qualifications: "MBBS, MD (Internal Medicine)",
      address: "12 Church Street\nBengaluru 560001",
      phone: "+91 80 4000 0000",
      email: "Dr.Menon@Example.com",
      footerNote: "Please bring this slip to every session.",
    });
    expect(r.success).toBe(true);
  });

  it("accepts an empty one — a physician may have none", () => {
    expect(LetterheadInput.safeParse({}).success).toBe(true);
    expect(LetterheadInput.safeParse({ practiceName: "", address: "", phone: "", email: "" }).success).toBe(true);
  });

  it("tidies whitespace, so a slip does not print a ragged header", () => {
    const r = LetterheadInput.parse({
      practiceName: "   Menon   Internal  Medicine  ",
      address: "  12 Church   Street \n\n   \n Bengaluru 560001  ",
    });
    expect(r.practiceName).toBe("Menon Internal Medicine");
    expect(r.address).toBe("12 Church Street\nBengaluru 560001");
  });

  it("lower-cases an email, because that is how it will be compared and read", () => {
    expect(LetterheadInput.parse({ email: "  Dr.Menon@Example.COM " }).email).toBe("dr.menon@example.com");
  });

  it("refuses a phone number that is not one", () => {
    expect(LetterheadInput.safeParse({ phone: "call me maybe" }).success).toBe(false);
    expect(LetterheadInput.safeParse({ phone: "12" }).success).toBe(false);
    expect(LetterheadInput.safeParse({ phone: "080-4000-0000" }).success).toBe(true);
    // An area code in brackets is how a landline is normally written here.
    expect(LetterheadInput.safeParse({ phone: "(080) 4000 0000" }).success).toBe(true);
    // But it still has to be a number and not just punctuation.
    expect(LetterheadInput.safeParse({ phone: "(---)" }).success).toBe(false);
    expect(LetterheadInput.safeParse({ phone: "+91 (80) 4000 0000" }).success).toBe(true);
  });

  it("drops anything that is not a letterhead field — credentials cannot ride in", () => {
    // The route validates with this schema and only ever stores what it returns,
    // so a body carrying a licence number or a council must lose them here.
    const r = LetterheadInput.parse({
      practiceName: "Menon Clinic",
      licenseNo: "FAKE/0000/1",
      registrationCouncil: "Fake Council",
      role: "superadmin",
    });
    expect(r).toEqual({ practiceName: "Menon Clinic" });
    expect(r).not.toHaveProperty("licenseNo");
    expect(r).not.toHaveProperty("role");
  });

  it("refuses an email that is not one, with a plain message", () => {
    const r = LetterheadInput.safeParse({ email: "not-an-email" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("That does not look like an email address");
  });

  it("caps every field, so nothing can run off the sheet", () => {
    for (const key of Object.keys(LETTERHEAD_LIMITS) as Array<keyof typeof LETTERHEAD_LIMITS>) {
      const tooLong = key === "phone" ? "1".repeat(LETTERHEAD_LIMITS[key] + 1) : "x".repeat(LETTERHEAD_LIMITS[key] + 1);
      expect(LetterheadInput.safeParse({ [key]: tooLong }).success, key).toBe(false);
    }
  });

  it("limits the address to a few lines", () => {
    const ok = Array.from({ length: ADDRESS_MAX_LINES }, (_, i) => `L${i}`).join("\n");
    const tooMany = Array.from({ length: ADDRESS_MAX_LINES + 1 }, (_, i) => `L${i}`).join("\n");
    expect(LetterheadInput.safeParse({ address: ok }).success).toBe(true);
    expect(LetterheadInput.safeParse({ address: tooMany }).success).toBe(false);
  });

  it("does not count blank lines against the address", () => {
    const padded = "a\n\n\nb\n\n\nc\n\n\nd";
    expect(LetterheadInput.safeParse({ address: padded }).success).toBe(true);
  });
});

describe("normaliseLetterhead", () => {
  it("keeps known string fields and drops the rest", () => {
    expect(
      normaliseLetterhead({
        practiceName: " Menon ",
        licenseNo: "KMC-1234",
        phone: 9876543210,
        address: "",
        email: "   ",
      })
    ).toEqual({ practiceName: "Menon" });
  });

  it("survives what a half-migrated row might hold", () => {
    expect(normaliseLetterhead(null)).toEqual({});
    expect(normaliseLetterhead(undefined)).toEqual({});
    expect(normaliseLetterhead("nonsense")).toEqual({});
    expect(normaliseLetterhead([])).toEqual({});
  });

  it("can never carry a credential", () => {
    // Registration lives on the verified record and is not part of a letterhead.
    const out = normaliseLetterhead({ licenseNo: "FAKE", registrationCouncil: "FAKE", practiceName: "x" });
    expect(out).not.toHaveProperty("licenseNo");
    expect(out).not.toHaveProperty("registrationCouncil");
  });
});

describe("hasLetterhead", () => {
  it("is false for nothing, and for a lone footer note", () => {
    expect(hasLetterhead(null)).toBe(false);
    expect(hasLetterhead({})).toBe(false);
    // A closing line with no header would print a footer over an unmarked slip.
    expect(hasLetterhead({ footerNote: "Thank you" })).toBe(false);
  });

  it("is true once anything identifies the practice", () => {
    expect(hasLetterhead({ practiceName: "Menon" })).toBe(true);
    expect(hasLetterhead({ phone: "080 4000 0000" })).toBe(true);
  });
});

describe("letterheadView", () => {
  it("is headed by the practice name when there is one", () => {
    expect(letterheadView({ practiceName: "Menon Clinic" }, "Dr. Sarah Menon").title).toBe("Menon Clinic");
  });

  it("falls back to the physician's own name, so the signer always heads the slip", () => {
    expect(letterheadView({ phone: "080 4000 0000" }, "Dr. Sarah Menon").title).toBe("Dr. Sarah Menon");
    expect(letterheadView(null, "Dr. Sarah Menon").title).toBe("Dr. Sarah Menon");
  });

  it("splits the address into lines and joins contact with a dot", () => {
    const v = letterheadView(
      { address: "12 Church Street\nBengaluru 560001", phone: "080 4000 0000", email: "dr@example.com" },
      "Dr. X"
    );
    expect(v.addressLines).toEqual(["12 Church Street", "Bengaluru 560001"]);
    expect(v.contact).toBe("080 4000 0000 · dr@example.com");
  });

  it("shows one contact detail without a stray separator", () => {
    expect(letterheadView({ phone: "080 4000 0000" }, "Dr. X").contact).toBe("080 4000 0000");
    expect(letterheadView({ email: "dr@example.com" }, "Dr. X").contact).toBe("dr@example.com");
  });

  it("returns nulls, not empty strings, for what is absent", () => {
    const v = letterheadView({}, "Dr. X");
    expect(v.qualifications).toBeNull();
    expect(v.contact).toBeNull();
    expect(v.footerNote).toBeNull();
    expect(v.addressLines).toEqual([]);
  });
});

describe("letterheadChanges", () => {
  it("records only what moved", () => {
    const c = letterheadChanges(
      { practiceName: "Old", phone: "111 222 3333", email: "a@b.co" },
      { practiceName: "New", phone: "111 222 3333", email: "a@b.co" }
    );
    expect(c.before).toEqual({ practiceName: "Old" });
    expect(c.after).toEqual({ practiceName: "New" });
  });

  it("records a field that was added, and one that was cleared", () => {
    const added = letterheadChanges({}, { phone: "080 4000 0000" });
    expect(added.before).toEqual({});
    expect(added.after).toEqual({ phone: "080 4000 0000" });

    const cleared = letterheadChanges({ phone: "080 4000 0000" }, {});
    expect(cleared.before).toEqual({ phone: "080 4000 0000" });
    expect(cleared.after).toEqual({});
  });

  it("records nothing when nothing changed", () => {
    const c = letterheadChanges({ practiceName: "Same" }, { practiceName: "Same" });
    expect(c.before).toEqual({});
    expect(c.after).toEqual({});
  });
});

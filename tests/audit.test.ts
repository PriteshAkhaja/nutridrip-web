import { describe, expect, it } from "vitest";
import {
  actionLabel,
  AUDIT_GROUPS,
  describeChange,
  auditRange,
  entityLabel,
  presetsFor,
  toDay,
  groupFilter,
  groupFor,
  isNotable,
  prefixesForGroup,
} from "@/lib/data/audit";

describe("grouping an action", () => {
  it("files each prefix under the group somebody would look in", () => {
    expect(groupFor("access.refused")).toBe("Access");
    expect(groupFor("consent.captured")).toBe("Clinical");
    expect(groupFor("prescription.override.break_glass")).toBe("Clinical");
    expect(groupFor("lot.receive")).toBe("Inventory");
    expect(groupFor("user.update")).toBe("Accounts");
    expect(groupFor("billing.update")).toBe("Admin");
  });

  it("files an unknown prefix somewhere rather than losing it", () => {
    expect(AUDIT_GROUPS).toContain(groupFor("something.entirely.new"));
  });

  it("matches a whole prefix, not one that merely starts the same", () => {
    // Without the escaped dot, "user" would also swallow "username.*".
    const accounts = groupFilter("Accounts");
    expect(accounts.test("user.update")).toBe(true);
    expect(accounts.test("userscript.ran")).toBe(false);
  });

  it("puts every prefix in exactly one group", () => {
    const all = AUDIT_GROUPS.flatMap((g) => prefixesForGroup(g));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("naming an action for a human", () => {
  it("turns dots and underscores into words", () => {
    expect(actionLabel("prescription.override.break_glass")).toBe(
      "Prescription override break glass"
    );
    expect(actionLabel("access.refused")).toBe("Access refused");
  });
});

describe("what deserves a second look", () => {
  it("flags a refusal and a break-glass, not an ordinary edit", () => {
    expect(isNotable("access.refused")).toBe(true);
    expect(isNotable("prescription.override.break_glass")).toBe(true);
    expect(isNotable("user.update")).toBe(false);
    expect(isNotable("content.update")).toBe(false);
  });
});

describe("describing what changed", () => {
  it("shows only the fields that actually moved", () => {
    const out = describeChange(
      { name: "HealthFirst", status: "active" },
      { name: "HealthFirst", status: "inactive" }
    );
    expect(out).toEqual([{ field: "status", from: "active", to: "inactive" }]);
  });

  it("shows every field when there was nothing before it", () => {
    const out = describeChange(null, { name: "Emma", role: "nurse" });
    expect(out.map((c) => c.field)).toEqual(["name", "role"]);
    expect(out[0]).toEqual({ field: "name", to: "Emma" });
  });

  it("says nothing when nothing moved", () => {
    expect(describeChange({ a: 1 }, { a: 1 })).toEqual([]);
  });

  it("never prints a secret, whatever a caller put in the row", () => {
    // The row is read by admins; a leaked hash would spread rather than record.
    for (const field of ["password", "passwordHash", "resetToken", "otpCode", "signatureDataUrl", "apiKey"]) {
      const out = describeChange(null, { [field]: "should-never-appear" });
      expect(out).toEqual([{ field, to: "hidden" }]);
      expect(JSON.stringify(out)).not.toContain("should-never-appear");
    }
  });

  it("summarises a value too big to read inline", () => {
    expect(describeChange(null, { items: [1, 2, 3] })[0].to).toBe("3 items");
    expect(describeChange(null, { nested: { a: 1, b: 2 } })[0].to).toBe("2 fields");
    expect(describeChange(null, { note: "x".repeat(200) })[0].to).toHaveLength(91);
  });

  it("writes an absent value as a dash, not as 'undefined'", () => {
    expect(describeChange({ nurseId: "abc" }, { nurseId: null })).toEqual([
      { field: "nurseId", from: "abc", to: "—" },
    ]);
  });

  it("copes with both sides missing", () => {
    expect(describeChange(null, null)).toEqual([]);
    expect(describeChange(undefined, undefined)).toEqual([]);
  });

  it("reads booleans as words rather than true/false", () => {
    expect(describeChange(null, { sessionsEnded: true })[0].to).toBe("yes");
  });
});

describe("the actions added for compliance", () => {
  it("files a sign-in under Access, beside the refusals", () => {
    // "Who was turned away" and "who got in" answer the same question.
    expect(groupFor("auth.signed_in")).toBe("Access");
    expect(groupFor("access.refused")).toBe("Access");
  });

  it("flags deleting a patient's medical document", () => {
    expect(isNotable("lab.delete")).toBe(true);
    // Uploading one is ordinary; removing one is not.
    expect(isNotable("lab.upload")).toBe(false);
  });

  it("reads a sign-in row without jargon", () => {
    expect(actionLabel("auth.signed_in")).toBe("Auth signed in");
  });
});

describe("entityLabel", () => {
  it("splits a model name into words a person would say", () => {
    expect(entityLabel("TreatmentPlan")).toBe("Treatment plan");
    expect(entityLabel("BatchLot")).toBe("Batch lot");
    expect(entityLabel("ProductMaster")).toBe("Product master");
    expect(entityLabel("HealthQuiz")).toBe("Health quiz");
  });

  it("leaves a single word alone", () => {
    expect(entityLabel("User")).toBe("User");
    expect(entityLabel("Booking")).toBe("Booking");
    expect(entityLabel("Route")).toBe("Route");
  });

  it("does not need a table of model names to stay in step", () => {
    // A model nobody has written yet must still read correctly.
    expect(entityLabel("SessionKit")).toBe("Session kit");
    expect(entityLabel("StockTxn")).toBe("Stock txn");
  });
});

describe("exporting the trail", () => {
  it("files an export beside the other reads, not under Admin", () => {
    expect(groupFor("audit.export")).toBe("Access");
    expect(groupFilter("Access").test("audit.export")).toBe(true);
    // And it must not drag in anything that merely starts the same way.
    expect(groupFilter("Access").test("auditorium.thing")).toBe(false);
  });

  it("reads as words in the filter and the file", () => {
    expect(actionLabel("audit.export")).toBe("Audit export");
  });
});

describe("AI Studio in the trail", () => {
  it("files every ai.* action under Admin, in the label AND in the filter", () => {
    // groupFor() defaults an unknown prefix to Admin, but the group FILTER is
    // built from the prefix map — an action missing from it would be labelled
    // Admin and then never turn up when somebody filters by Admin.
    for (const action of ["ai.create", "ai.update", "ai.activate", "ai.deactivate", "ai.delete"]) {
      expect(groupFor(action), action).toBe("Admin");
      expect(groupFilter("Admin").test(action), action).toBe(true);
    }
  });

  it("does not pull in a prefix that merely starts with the same letters", () => {
    expect(groupFilter("Admin").test("aim.something")).toBe(false);
    expect(groupFilter("Admin").test("airport.thing")).toBe(false);
  });

  it("reads as words", () => {
    expect(actionLabel("ai.activate")).toBe("AI activate");
  });
});

describe("labels and redaction after AI Studio", () => {
  it("writes AI as an acronym in an action", () => {
    expect(actionLabel("ai.delete")).toBe("AI delete");
    expect(actionLabel("ai.activate")).toBe("AI activate");
    // Only the whole word: "aim" and "airport" are not AI.
    expect(actionLabel("aim.thing")).toBe("Aim thing");
  });

  it("keeps an acronym intact in a record kind, and still splits ordinary names", () => {
    expect(entityLabel("AIModel")).toBe("AI model");
    expect(entityLabel("TreatmentPlan")).toBe("Treatment plan");
    expect(entityLabel("BatchLot")).toBe("Batch lot");
    expect(entityLabel("User")).toBe("User");
  });

  it("shows a model's length limit instead of hiding it as a token", () => {
    const c = describeChange({ maxTokens: 512 }, { maxTokens: 1024 });
    expect(c).toEqual([{ field: "maxTokens", from: "512", to: "1,024" }]);
  });

  it("still hides real secrets whose names contain the same word", () => {
    for (const field of ["resetToken", "accessToken", "apiKey", "passwordHash", "viaOtp"]) {
      const c = describeChange({}, { [field]: "s3cret" });
      expect(c, field).toEqual([{ field, to: "hidden" }]);
    }
  });
});

describe("the date window", () => {
  it("names the local day, not the UTC one", () => {
    // 2am on 12 March in a zone ahead of UTC is still 12 March. Via
    // toISOString() it would read as the 11th.
    expect(toDay(new Date(2026, 2, 12, 2, 0))).toBe("2026-03-12");
    expect(toDay(new Date(2026, 2, 12, 23, 30))).toBe("2026-03-12");
    expect(toDay(new Date(2026, 0, 1))).toBe("2026-01-01");
  });

  it("covers the whole of the day it names", () => {
    const r = auditRange("2026-03-12", "2026-03-12");
    expect(r?.$gte).toEqual(new Date(2026, 2, 12, 0, 0, 0, 0));
    expect(r?.$lte).toEqual(new Date(2026, 2, 12, 23, 59, 59, 999));

    // A row at 11:59pm on the day itself must be inside the window.
    const lateThatNight = new Date(2026, 2, 12, 23, 59, 30);
    expect(lateThatNight >= r!.$gte!).toBe(true);
    expect(lateThatNight <= r!.$lte!).toBe(true);
  });

  it("takes one end on its own", () => {
    expect(auditRange("2026-03-12", undefined)?.$lte).toBeUndefined();
    expect(auditRange(undefined, "2026-03-12")?.$gte).toBeUndefined();
  });

  it("shows everything rather than nothing when the dates are unusable", () => {
    expect(auditRange(undefined, undefined)).toBeNull();
    expect(auditRange("", "")).toBeNull();
    expect(auditRange("12-03-2026", "nonsense")).toBeNull();
    // A date that does not exist is rejected, not moved to 3 March.
    expect(auditRange("2026-02-31", undefined)).toBeNull();
  });

  it("reads a backwards range as the one that was meant", () => {
    const back = auditRange("2026-03-20", "2026-03-12");
    expect(back?.$gte).toEqual(new Date(2026, 2, 12, 0, 0, 0, 0));
    expect(back?.$lte).toEqual(new Date(2026, 2, 20, 23, 59, 59, 999));
  });

  it("builds the quick ranges around the day it is given", () => {
    const presets = presetsFor(new Date(2026, 2, 12, 15, 0));
    expect(presets.map((p) => p.label)).toEqual([
      "Today",
      "Last 7 days",
      "Last 30 days",
      "This month",
    ]);
    expect(presets[0]).toEqual({ label: "Today", from: "2026-03-12", to: "2026-03-12" });
    // Seven days inclusive of today, not eight.
    expect(presets[1].from).toBe("2026-03-06");
    expect(presets[3].from).toBe("2026-03-01");
  });

  it("crosses a month boundary backwards", () => {
    // 3 March back six days is 25 February — 2026 is not a leap year, so
    // February is 28 days, and 25 Feb to 3 Mar inclusive is seven days.
    const presets = presetsFor(new Date(2026, 2, 3, 9, 0));
    expect(presets[1].from).toBe("2026-02-25");
    expect(presets[3].from).toBe("2026-03-01");

    // And a leap year, where the same sum lands a day later.
    expect(presetsFor(new Date(2024, 2, 3, 9, 0))[1].from).toBe("2024-02-26");
  });
});

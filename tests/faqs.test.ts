import { describe, expect, it } from "vitest";
import { countFaqs, FAQ_CATEGORIES, FAQ_TOTAL, faqCategories, filterFaqs } from "@/lib/data/faqs";
import { APPROVAL_VALID_DAYS } from "@/lib/clinical/validity";
import { LATE_CANCEL_FEE_INR, LATE_CHANGE_HOURS } from "@/lib/clinical/slots";
import { ZONE_DEFAULTS as ZONES, type Zone } from "@/lib/zones";

const answerTo = (q: string) => {
  for (const c of FAQ_CATEGORIES) {
    const hit = c.items.find((i) => i.q === q);
    if (hit) return hit.a;
  }
  throw new Error(`No FAQ titled "${q}"`);
};

describe("the FAQ content", () => {
  it("has no empty category and no blank question or answer", () => {
    expect(FAQ_CATEGORIES.length).toBeGreaterThan(0);
    for (const c of FAQ_CATEGORIES) {
      expect(c.items.length).toBeGreaterThan(0);
      for (const i of c.items) {
        expect(i.q.trim().length).toBeGreaterThan(5);
        expect(i.a.trim().length).toBeGreaterThan(20);
      }
    }
  });

  it("never asks the same question twice", () => {
    const all = FAQ_CATEGORIES.flatMap((c) => c.items.map((i) => i.q));
    expect(new Set(all).size).toBe(all.length);
  });

  it("gives every category a distinct id, because the id selects it", () => {
    const ids = FAQ_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain("all");
  });

  it("counts every answer", () => {
    expect(FAQ_TOTAL).toBe(countFaqs(FAQ_CATEGORIES));
    expect(FAQ_TOTAL).toBeGreaterThan(10);
  });
});

describe("the FAQ numbers follow the rules that enforce them", () => {
  // The whole reason these are built from constants: an answer that quotes a
  // number typed by hand is wrong the day somebody changes the rule.
  it("quotes the real approval window", () => {
    expect(answerTo("How long does an approval last?")).toContain(`${APPROVAL_VALID_DAYS} days`);
  });

  it("quotes the real cancellation line and fee", () => {
    const a = answerTo("Can I cancel or reschedule?");
    expect(a).toContain(`${LATE_CHANGE_HOURS} hours`);
    expect(a).toContain(`₹${LATE_CANCEL_FEE_INR}`);
  });

  it("quotes the fees set on the Billing page when the page passes them", () => {
    const set = faqCategories({ windowHours: 24, rescheduleFee: 300, cancelFee: 800 });
    const a = set.flatMap((c) => c.items).find((i) => i.q === "Can I cancel or reschedule?")?.a ?? "";
    expect(a).toContain("24 hours");
    expect(a).toContain("a late fee applies (₹300 to move, ₹800 to cancel)");
    expect(a).not.toContain("{{");
  });

  it("quotes the real number of zones", () => {
    expect(answerTo("Do you serve my pincode?")).toContain(`${ZONES.length} zones`);
  });

  it("names the zones that run shorter hours, from the zone list itself", () => {
    const limited = ZONES.filter((z) => z.status === "limited").map((z) => z.name);
    const a = answerTo("Do you serve my pincode?");
    for (const name of limited) expect(a).toContain(name);
    // And none of the fully open ones are mislabelled as limited.
    expect(a).not.toContain("Koramangala");
  });

  it("follows the zones the super admin saves, and leaves paused ones out of the count", () => {
    const zones: Zone[] = [
      { ...ZONES[0], status: "open" },
      { ...ZONES[1], status: "paused" },
      { ...ZONES[2], name: "Hebbal", status: "limited" },
    ];
    const a = faqCategories(undefined, zones)
      .flatMap((c) => c.items)
      .find((i) => i.q === "Do you serve my pincode?")!.a;
    expect(a).toContain("We cover 2 zones");
    expect(a).toContain("Hebbal runs shorter service hours");
    expect(a).not.toContain("{{");
  });
});

describe("what the FAQ must not promise", () => {
  // There is no payment gateway and no data-export button. An FAQ that
  // promised either would be describing an app that does not exist.
  const everything = FAQ_CATEGORIES.flatMap((c) => c.items.map((i) => `${i.q} ${i.a}`)).join(" ").toLowerCase();

  it("does not promise refunds, card or UPI payment", () => {
    expect(everything).not.toMatch(/\brefund/);
    expect(everything).not.toMatch(/\bupi\b|credit card|debit card|net banking/);
  });

  it("does not promise an export or delete button", () => {
    expect(everything).not.toMatch(/export (or delete )?your record/);
    expect(everything).not.toMatch(/from your profile/);
  });

  it("does not claim a certification the establishment has not shown", () => {
    expect(everything).not.toMatch(/hipaa|iso 9001|gmp|cdsco/);
  });

  it("does not say nobody else can see a record", () => {
    // Admins can open lab reports and work the review queue, so an absolute
    // "nobody else" would be untrue.
    expect(everything).not.toMatch(/nobody else/);
  });
});

describe("filterFaqs", () => {
  it("returns everything with no filter", () => {
    expect(countFaqs(filterFaqs(FAQ_CATEGORIES))).toBe(FAQ_TOTAL);
    expect(countFaqs(filterFaqs(FAQ_CATEGORIES, { query: "", category: "all" }))).toBe(FAQ_TOTAL);
  });

  it("narrows to one category", () => {
    const only = filterFaqs(FAQ_CATEGORIES, { category: "booking" });
    expect(only).toHaveLength(1);
    expect(only[0].id).toBe("booking");
  });

  it("finds words in the question or the answer, ignoring case", () => {
    const hits = filterFaqs(FAQ_CATEGORIES, { query: "ANAPHYLAXIS" });
    expect(countFaqs(hits)).toBeGreaterThan(0);
    for (const c of hits) {
      for (const i of c.items) expect(`${i.q} ${i.a}`.toLowerCase()).toContain("anaphylaxis");
    }
  });

  it("requires every word, in any order and any distance apart", () => {
    // "cancel" and "fee" sit a sentence apart in the cancellation answer.
    const hits = filterFaqs(FAQ_CATEGORIES, { query: "fee cancel" });
    const questions = hits.flatMap((c) => c.items.map((i) => i.q));
    expect(questions).toContain("Can I cancel or reschedule?");
  });

  it("finds nothing for words that do not appear, rather than everything", () => {
    expect(filterFaqs(FAQ_CATEGORIES, { query: "cancel zzzzqqqq" })).toEqual([]);
  });

  it("drops a category left with nothing in it", () => {
    const hits = filterFaqs(FAQ_CATEGORIES, { query: "pincode" });
    for (const c of hits) expect(c.items.length).toBeGreaterThan(0);
  });

  it("combines a category with a search", () => {
    const hits = filterFaqs(FAQ_CATEGORIES, { category: "before", query: "pincode" });
    expect(hits.map((c) => c.id)).toEqual(["before"]);
    // A word from another category finds nothing within this one.
    expect(filterFaqs(FAQ_CATEGORIES, { category: "before", query: "cannula" })).toEqual([]);
  });

  it("treats a search of only spaces as no search", () => {
    expect(countFaqs(filterFaqs(FAQ_CATEGORIES, { query: "   " }))).toBe(FAQ_TOTAL);
  });

  it("does not mutate the source list", () => {
    const before = JSON.stringify(FAQ_CATEGORIES);
    filterFaqs(FAQ_CATEGORIES, { query: "cancel", category: "booking" });
    expect(JSON.stringify(FAQ_CATEGORIES)).toBe(before);
  });
});

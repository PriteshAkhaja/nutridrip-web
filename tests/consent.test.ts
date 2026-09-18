import { describe, expect, it } from "vitest";
import {
  componentsForConsent,
  consentDocument,
  consentFingerprint,
  CONSENT_DOCUMENTS,
  CURRENT_CONSENT_VERSION,
  currentConsentDocument,
} from "@/lib/clinical/consent";

/**
 * Fingerprints of every published version.
 *
 * If one of these fails you have edited wording somebody has already agreed
 * to. That is the one thing a version must never do — add a new version and
 * point CURRENT_CONSENT_VERSION at it instead. Only add a line here when you
 * publish a new version; never update an existing line to make a test pass.
 */
const PUBLISHED: Record<string, string> = {
  // Literal on purpose. Computing it from the document would compare the text
  // against itself and pass whatever you did to it.
  "v2.1": "b48374b9-497",
};

describe("the consent document", () => {
  it("never changes the wording of a version already published", () => {
    for (const [version, fingerprint] of Object.entries(PUBLISHED)) {
      const doc = CONSENT_DOCUMENTS[version];
      expect(doc, `version ${version} has been deleted — a patient agreed to it`).toBeDefined();
      expect(
        consentFingerprint(doc),
        `The wording of ${version} has changed. Somebody has already agreed to the old text. ` +
          `Add a new version and point CURRENT_CONSENT_VERSION at it rather than editing this one.`
      ).toBe(fingerprint);
    }
  });

  it("publishes the version it claims to be current", () => {
    expect(CONSENT_DOCUMENTS[CURRENT_CONSENT_VERSION]).toBeDefined();
    expect(currentConsentDocument().version).toBe(CURRENT_CONSENT_VERSION);
  });

  it("gives every version an affirmation and at least one risk", () => {
    for (const [version, doc] of Object.entries(CONSENT_DOCUMENTS)) {
      expect(doc.version, version).toBe(version);
      expect(doc.affirmation.trim().length, version).toBeGreaterThan(20);
      expect(doc.risks.length, version).toBeGreaterThan(0);
      for (const r of doc.risks) expect(r.trim().length, version).toBeGreaterThan(10);
    }
  });

  it("refuses a version it does not publish rather than inventing one", () => {
    // A request naming an unknown version must not silently get today's text.
    expect(consentDocument("v9.9")).toBeNull();
    expect(consentDocument("")).toBeNull();
    expect(consentDocument(undefined)).toBeNull();
    expect(consentDocument(null)).toBeNull();
  });

  it("finds a version it does publish", () => {
    expect(consentDocument("v2.1")?.version).toBe("v2.1");
  });
});

describe("the doses frozen onto a consent", () => {
  const recipe = [
    { name: "Ascorbic acid", dose: 7500, unit: "mg" },
    { name: "Magnesium sulphate", dose: 1000, unit: "mg" },
  ];

  it("copies name, dose and unit exactly", () => {
    expect(componentsForConsent(recipe)).toEqual([
      { name: "Ascorbic acid", dose: 7500, unit: "mg" },
      { name: "Magnesium sulphate", dose: 1000, unit: "mg" },
    ]);
  });

  it("does not hand back the same objects the recipe holds", () => {
    // A shared reference would let a later edit reach into the record.
    const out = componentsForConsent(recipe);
    expect(out[0]).not.toBe(recipe[0]);
  });

  it("survives a drip with no ingredients, and no drip at all", () => {
    expect(componentsForConsent([])).toEqual([]);
    expect(componentsForConsent(undefined)).toEqual([]);
  });

  it("names an unnamed ingredient rather than storing a blank", () => {
    expect(componentsForConsent([{ dose: 500, unit: "ml" }])).toEqual([
      { name: "Unnamed", dose: 500, unit: "ml" },
    ]);
  });
});

describe("the fingerprint itself", () => {
  it("changes when a single character of the wording changes", () => {
    const doc = CONSENT_DOCUMENTS["v2.1"];
    const tweaked = { ...doc, affirmation: doc.affirmation.replace("agree", "Agree") };
    expect(consentFingerprint(tweaked)).not.toBe(consentFingerprint(doc));
  });

  it("changes when a risk is added, removed or reordered", () => {
    const doc = CONSENT_DOCUMENTS["v2.1"];
    expect(consentFingerprint({ ...doc, risks: doc.risks.slice(1) })).not.toBe(
      consentFingerprint(doc)
    );
    expect(consentFingerprint({ ...doc, risks: [...doc.risks].reverse() })).not.toBe(
      consentFingerprint(doc)
    );
  });

  it("is stable for the same text", () => {
    const doc = CONSENT_DOCUMENTS["v2.1"];
    expect(consentFingerprint(doc)).toBe(consentFingerprint({ ...doc, risks: [...doc.risks] }));
  });
});

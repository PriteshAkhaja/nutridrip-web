import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DripInput } from "@/lib/inventory/drip-input";

/**
 * The drip PATCH route copies fields onto the document from a hand-written
 * list. Its own comment says a field left off that list "is accepted by the
 * API and silently discarded on save" — and then exactly that happened twice:
 * the HSN code and the GST rate were added to the schema and to the form, the
 * form said "Saved", and neither was ever written.
 *
 * A comment could not stop it. This can: add a field to DripInput and this
 * test fails until the route is taught to save it, or until it is named below
 * as deliberately handled some other way.
 */

/** Fields the route deals with itself, not through the copy loop. */
const HANDLED_ELSEWHERE = new Set([
  // Resolved against ProductMaster and validated before assignment.
  "ingredients",
  // Cleared deliberately means "use the default kit", so "" is meaningful.
  "kitId",
  // The public URL of a drip. Changing it silently breaks every link already
  // shared, so it is fixed once at creation.
  "slug",
  // Ingredient-row fields, nested inside `ingredients` above.
  "masterId",
  "dose",
  "unit",
  "role",
  "notes",
]);

const route = readFileSync(
  new URL("../src/app/api/drips/[id]/route.ts", import.meta.url),
  "utf8"
);

/** The quoted keys in the copy loop's fixed list. */
function copiedKeys(): Set<string> {
  const block = route.slice(route.indexOf("for (const key of ["), route.indexOf("] as const)"));
  return new Set([...block.matchAll(/"([a-zA-Z]+)"/g)].map((m) => m[1]));
}

describe("editing a drip", () => {
  it("saves every field the schema accepts, or says why not", () => {
    const copied = copiedKeys();
    const missing = Object.keys(DripInput.shape).filter(
      (k) => !copied.has(k) && !HANDLED_ELSEWHERE.has(k)
    );
    expect(
      missing,
      `These fields would be accepted by the API and silently discarded on save. ` +
        `Add them to the copy loop in src/app/api/drips/[id]/route.ts, or to ` +
        `HANDLED_ELSEWHERE here if the route deals with them another way.`
    ).toEqual([]);
  });

  it("copies nothing the schema does not accept", () => {
    // The mirror image: a key in the list that Zod would strip is dead code,
    // and reads as though the field is saved when nothing ever arrives.
    const schemaKeys = new Set(Object.keys(DripInput.shape));
    const stray = [...copiedKeys()].filter((k) => !schemaKeys.has(k));
    expect(stray).toEqual([]);
  });

  it("lets the tax fields be cleared, not only set", () => {
    // A clinic's drip can stop being taxable, and a classification can turn
    // out to be wrong. Null has to survive parsing for either to be sayable.
    const parsed = DripInput.partial().parse({ hsnCode: null, gstRate: null });
    expect(parsed.hsnCode).toBeNull();
    expect(parsed.gstRate).toBeNull();
  });

  it("still rejects a nonsense rate", () => {
    expect(() => DripInput.partial().parse({ gstRate: 45 })).toThrow();
    expect(() => DripInput.partial().parse({ gstRate: -1 })).toThrow();
  });
});

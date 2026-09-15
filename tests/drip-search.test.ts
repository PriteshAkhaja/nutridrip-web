import { describe, expect, it } from "vitest";
import { filterDrips, matchesDrip, type SearchableDrip } from "@/lib/data/drip-search";

const CATALOGUE: SearchableDrip[] = [
  { name: "Myers' Revive", category: "Energy", keywords: ["Ascorbic acid", "Magnesium sulphate", "B-complex"] },
  { name: "Glow Protocol", category: "Skin", keywords: ["Glutathione", "Ascorbic acid"] },
  { name: "Immune Shield", category: "Immunity", keywords: ["Ascorbic acid", "Zinc sulphate", "Sodium selenite"] },
  { name: "Iron Restore", category: "Energy", keywords: ["Iron sucrose"] },
  { name: "Hydrate Plus", category: "Hydration", keywords: ["Normal saline 0.9%", "Electrolyte concentrate"] },
];

const names = (list: SearchableDrip[]) => list.map((d) => d.name);

describe("drip search", () => {
  it("returns everything for an empty query", () => {
    expect(filterDrips(CATALOGUE, "")).toHaveLength(5);
    expect(filterDrips(CATALOGUE, "   ")).toHaveLength(5);
  });

  it("finds a drip by its name", () => {
    expect(names(filterDrips(CATALOGUE, "glow"))).toEqual(["Glow Protocol"]);
  });

  it("finds drips by an ingredient they contain", () => {
    // The thing people actually ask for: "the one with glutathione".
    expect(names(filterDrips(CATALOGUE, "glutathione"))).toEqual(["Glow Protocol"]);
    expect(names(filterDrips(CATALOGUE, "ascorbic"))).toEqual([
      "Myers' Revive",
      "Glow Protocol",
      "Immune Shield",
    ]);
  });

  it("finds drips by category", () => {
    expect(names(filterDrips(CATALOGUE, "energy"))).toEqual(["Myers' Revive", "Iron Restore"]);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(names(filterDrips(CATALOGUE, "  IRON  "))).toEqual(["Iron Restore"]);
  });

  it("matches every word, in any order", () => {
    // "zinc immunity" and "immunity zinc" are the same question.
    expect(names(filterDrips(CATALOGUE, "zinc immunity"))).toEqual(["Immune Shield"]);
    expect(names(filterDrips(CATALOGUE, "immunity zinc"))).toEqual(["Immune Shield"]);
  });

  it("narrows as the user keeps typing", () => {
    expect(filterDrips(CATALOGUE, "i").length).toBeGreaterThan(1);
    expect(names(filterDrips(CATALOGUE, "iron s"))).toEqual(["Iron Restore"]);
  });

  it("survives the apostrophe in Myers' Revive", () => {
    // Punctuation is stripped from both sides, so typing it or not both work.
    expect(names(filterDrips(CATALOGUE, "myers"))).toEqual(["Myers' Revive"]);
    expect(names(filterDrips(CATALOGUE, "myers'"))).toEqual(["Myers' Revive"]);
  });

  it("keeps digits and percent signs that appear in real drug names", () => {
    expect(names(filterDrips(CATALOGUE, "0.9%"))).toEqual(["Hydrate Plus"]);
    expect(names(filterDrips(CATALOGUE, "saline"))).toEqual(["Hydrate Plus"]);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterDrips(CATALOGUE, "penicillin")).toEqual([]);
  });

  it("copes with a drip that has no category or keywords", () => {
    const bare: SearchableDrip = { name: "Bare Drip" };
    expect(matchesDrip(bare, "bare")).toBe(true);
    expect(matchesDrip(bare, "energy")).toBe(false);
  });

  it("ignores undefined keywords rather than matching on them", () => {
    const gappy: SearchableDrip = { name: "Gappy", keywords: [undefined, "Zinc", undefined] };
    expect(matchesDrip(gappy, "zinc")).toBe(true);
    expect(matchesDrip(gappy, "undefined")).toBe(false);
  });
});

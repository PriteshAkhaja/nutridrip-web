import { describe, expect, it } from "vitest";
import {
  AI_DEFAULTS,
  AI_LIMITS,
  AiConfigCreate,
  AiConfigPatch,
  MODEL_SUGGESTIONS,
  aiChanges,
  escapeRegExp,
  inspectTemplate,
} from "@/lib/ai/config";

const valid = {
  name: "Treatment recommendations",
  description: "First draft of the recommendation prompt",
  model: "claude-sonnet-5",
  temperature: 0.2,
  maxTokens: 1024,
  systemPrompt: "You assist a physician. You never diagnose.",
  userPromptTemplate: "Patient aged {{age}} reporting {{symptoms}}.",
};

describe("AiConfigCreate", () => {
  it("accepts a complete configuration", () => {
    expect(AiConfigCreate.safeParse(valid).success).toBe(true);
  });

  it("needs only a name and a model, and fills the rest with sensible values", () => {
    const r = AiConfigCreate.parse({ name: "Draft", model: "claude-sonnet-5" });
    expect(r.temperature).toBe(AI_DEFAULTS.temperature);
    expect(r.maxTokens).toBe(AI_DEFAULTS.maxTokens);
    expect(r.description).toBe("");
    expect(r.systemPrompt).toBe("");
    expect(r.userPromptTemplate).toBe("");
  });

  it("trims the name and the model, and refuses a blank one", () => {
    const r = AiConfigCreate.parse({ ...valid, name: "  Draft  ", model: "  gpt-4 " });
    expect(r.name).toBe("Draft");
    expect(r.model).toBe("gpt-4");
    expect(AiConfigCreate.safeParse({ ...valid, name: "   " }).success).toBe(false);
    expect(AiConfigCreate.safeParse({ ...valid, model: "" }).success).toBe(false);
  });

  it("holds temperature to 0–1, boundaries included", () => {
    expect(AiConfigCreate.safeParse({ ...valid, temperature: 0 }).success).toBe(true);
    expect(AiConfigCreate.safeParse({ ...valid, temperature: 1 }).success).toBe(true);
    expect(AiConfigCreate.safeParse({ ...valid, temperature: 1.01 }).success).toBe(false);
    expect(AiConfigCreate.safeParse({ ...valid, temperature: -0.1 }).success).toBe(false);
  });

  it("refuses a temperature that is not a number, in words a person can act on", () => {
    const r = AiConfigCreate.safeParse({ ...valid, temperature: "warm" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Temperature is a number from 0 to 1");
  });

  it("holds the length limit to a whole number in range", () => {
    expect(AiConfigCreate.safeParse({ ...valid, maxTokens: 1 }).success).toBe(true);
    expect(AiConfigCreate.safeParse({ ...valid, maxTokens: AI_LIMITS.maxTokens }).success).toBe(true);
    expect(AiConfigCreate.safeParse({ ...valid, maxTokens: 0 }).success).toBe(false);
    expect(AiConfigCreate.safeParse({ ...valid, maxTokens: AI_LIMITS.maxTokens + 1 }).success).toBe(false);
    expect(AiConfigCreate.safeParse({ ...valid, maxTokens: 512.5 }).success).toBe(false);
  });

  it("caps the prompts, so one record cannot be made enormous", () => {
    expect(AiConfigCreate.safeParse({ ...valid, systemPrompt: "x".repeat(AI_LIMITS.systemPrompt) }).success).toBe(true);
    expect(AiConfigCreate.safeParse({ ...valid, systemPrompt: "x".repeat(AI_LIMITS.systemPrompt + 1) }).success).toBe(false);
    expect(AiConfigCreate.safeParse({ ...valid, userPromptTemplate: "x".repeat(AI_LIMITS.userPromptTemplate + 1) }).success).toBe(false);
  });

  it("stores line breaks the same way whatever the browser sent", () => {
    const r = AiConfigCreate.parse({ ...valid, systemPrompt: "line one\r\nline two" });
    expect(r.systemPrompt).toBe("line one\nline two");
  });

  it("has nowhere to put a credential", () => {
    // API keys belong in the server's environment; nothing here can carry one.
    const r = AiConfigCreate.parse({ ...valid, apiKey: "sk-secret-123", secret: "x" });
    expect(r).not.toHaveProperty("apiKey");
    expect(r).not.toHaveProperty("secret");
    expect(JSON.stringify(r)).not.toContain("sk-secret");
  });

  it("cannot be created already Active", () => {
    // A new configuration starts in Test; making it live is a separate, recorded act.
    const r = AiConfigCreate.parse({ ...valid, status: "active" });
    expect(r).not.toHaveProperty("status");
  });
});

describe("AiConfigPatch", () => {
  it("accepts a change to one field", () => {
    expect(AiConfigPatch.safeParse({ name: "Renamed" }).success).toBe(true);
    expect(AiConfigPatch.safeParse({ status: "active" }).success).toBe(true);
  });

  it("does not carry defaults for fields nobody sent", () => {
    // The bug this guards: .partial() keeps .default(), so renaming a model
    // would come back with a temperature and length limit that overwrite the
    // stored ones.
    const r = AiConfigPatch.parse({ name: "Renamed" });
    expect(r).toEqual({ name: "Renamed" });
    expect(r).not.toHaveProperty("temperature");
    expect(r).not.toHaveProperty("maxTokens");
    expect(r).not.toHaveProperty("systemPrompt");
  });

  it("refuses an empty change", () => {
    expect(AiConfigPatch.safeParse({}).success).toBe(false);
  });

  it("refuses a status that is not one of the two", () => {
    expect(AiConfigPatch.safeParse({ status: "retired" }).success).toBe(false);
    expect(AiConfigPatch.safeParse({ status: "test" }).success).toBe(true);
  });

  it("applies the same rules to the fields it does carry", () => {
    expect(AiConfigPatch.safeParse({ temperature: 5 }).success).toBe(false);
    expect(AiConfigPatch.safeParse({ name: "   " }).success).toBe(false);
    expect(AiConfigPatch.safeParse({ maxTokens: 10.5 }).success).toBe(false);
  });

  it("can clear a prompt by sending an empty one", () => {
    // Empty means "none" and is a real change, unlike a missing key.
    expect(AiConfigPatch.parse({ systemPrompt: "" })).toEqual({ systemPrompt: "" });
  });
});

describe("inspectTemplate", () => {
  it("lists each variable once, in the order it first appears", () => {
    expect(inspectTemplate("{{age}} then {{symptoms}} then {{age}} again").names).toEqual(["age", "symptoms"]);
  });

  it("allows spaces inside the braces and dots in a name", () => {
    expect(inspectTemplate("{{ age }} {{patient.weightKg}}").names).toEqual(["age", "patient.weightKg"]);
  });

  it("finds nothing in a plain template, without complaint", () => {
    expect(inspectTemplate("No variables here.")).toEqual({ names: [], problems: [] });
    expect(inspectTemplate("")).toEqual({ names: [], problems: [] });
    expect(inspectTemplate(null)).toEqual({ names: [], problems: [] });
  });

  it("flags a placeholder that was opened and never closed", () => {
    const r = inspectTemplate("Patient aged {{age and {{symptoms}}");
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toContain("{{name}}");
    // The well-formed one is still found.
    expect(r.names).toContain("symptoms");
  });

  it("flags a stray closing brace pair", () => {
    expect(inspectTemplate("aged age}}").problems).toHaveLength(1);
  });

  it("flags an empty or numeric placeholder, which is not a name", () => {
    expect(inspectTemplate("{{}}").problems).toHaveLength(1);
    expect(inspectTemplate("{{ 9lives }}").problems).toHaveLength(1);
  });

  it("does not mistake single braces for a placeholder", () => {
    // JSON in a prompt is full of single braces and is not a mistake.
    expect(inspectTemplate('Reply as {"risk": "low"}')).toEqual({ names: [], problems: [] });
  });
});

describe("aiChanges", () => {
  const before = { ...valid };

  it("records only what moved, with both sides", () => {
    const c = aiChanges(before, { ...before, temperature: 0.7, model: "gpt-4" });
    expect(c.before).toEqual({ temperature: 0.2, model: "claude-sonnet-5" });
    expect(c.after).toEqual({ temperature: 0.7, model: "gpt-4" });
  });

  it("keeps a changed prompt in full, not shortened", () => {
    const long = "x".repeat(2000);
    const c = aiChanges(before, { ...before, systemPrompt: long });
    expect(c.after.systemPrompt).toBe(long);
    expect(c.before.systemPrompt).toBe(before.systemPrompt);
  });

  it("ignores a field that was not part of the change", () => {
    const c = aiChanges(before, { name: "Renamed" });
    expect(Object.keys(c.after)).toEqual(["name"]);
  });

  it("records nothing when nothing changed", () => {
    expect(aiChanges(before, { ...before })).toEqual({ before: {}, after: {} });
  });
});

describe("the small helpers", () => {
  it("escapes a name for a case-insensitive lookup", () => {
    // A name like "Model (v2) + test?" must match literally, not as a pattern.
    const re = new RegExp(`^${escapeRegExp("Model (v2) + test?")}$`, "i");
    expect(re.test("model (V2) + TEST?")).toBe(true);
    expect(re.test("Model v2 test")).toBe(false);
  });

  it("offers models without limiting to them", () => {
    expect(MODEL_SUGGESTIONS.length).toBeGreaterThan(0);
    // Anything else is still accepted.
    expect(AiConfigCreate.safeParse({ ...valid, model: "some-future-model-9" }).success).toBe(true);
  });
});

import { z } from "zod";

/**
 * AI Studio: the settings a model would run with.
 *
 * What this is: a place to record, edit and switch between model configurations
 * — the model, its temperature and length limit, the system prompt and the
 * per-request template — with a trail of who changed what.
 *
 * What it is not, yet: connected to anything. Nothing in the app reads these
 * records. Treatment recommendations are produced by the health quiz's scoring
 * rules and reviewed by a physician; no model is called anywhere. The screen
 * says so on its face, because a toggle marked Active that changes nothing would
 * otherwise be read as a control over patient-facing behaviour.
 *
 * API keys are never stored here. They belong in the server's environment, and
 * a database of prompts that also held credentials would be a much worse thing
 * to leak.
 *
 * Pure: no model, no request, so the rules can be tested without either.
 */

export const AI_STATUS = ["test", "active"] as const;
export type AiStatus = (typeof AI_STATUS)[number];

export const AI_LIMITS = {
  name: 80,
  description: 300,
  model: 80,
  systemPrompt: 8000,
  userPromptTemplate: 4000,
  maxTokens: 32000,
} as const;

/**
 * Offered, never enforced: a model id is free text, because the list of models
 * changes faster than this file does and a fixed dropdown would refuse the very
 * one somebody needs. The two OpenAI names are the ones the PRD lists.
 */
export const MODEL_SUGGESTIONS = [
  "claude-opus-5",
  "claude-sonnet-5",
  "claude-haiku-4-5-20251001",
  "claude-fable-5-1",
  "gpt-4",
  "gpt-3.5",
] as const;

export const AI_DEFAULTS = {
  temperature: 0.2,
  maxTokens: 1024,
} as const;

const LF = (s: string) => s.replace(/\r\n/g, "\n");

/**
 * Built without `.default()` on purpose. `.partial()` keeps a default, so a
 * patch that named only `name` would come back carrying a temperature and a
 * token limit nobody sent, and quietly overwrite the stored ones.
 */
const shape = {
  name: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "Give it a name").max(AI_LIMITS.name, `Keep the name under ${AI_LIMITS.name} characters`)),
  description: z
    .string()
    .max(AI_LIMITS.description, `Keep the description under ${AI_LIMITS.description} characters`)
    .transform((s) => s.trim()),
  model: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "Choose a model, or type its id").max(AI_LIMITS.model, `Keep the model id under ${AI_LIMITS.model} characters`)),
  temperature: z
    .number({ error: "Temperature is a number from 0 to 1" })
    .min(0, "Temperature is between 0 and 1")
    .max(1, "Temperature is between 0 and 1"),
  maxTokens: z
    .number({ error: "Maximum length is a whole number" })
    .int("Maximum length is a whole number")
    .min(1, "Maximum length must be at least 1")
    .max(AI_LIMITS.maxTokens, `Maximum length cannot be more than ${AI_LIMITS.maxTokens.toLocaleString("en-IN")}`),
  systemPrompt: z
    .string()
    .max(AI_LIMITS.systemPrompt, `Keep the system prompt under ${AI_LIMITS.systemPrompt.toLocaleString("en-IN")} characters`)
    .transform(LF),
  userPromptTemplate: z
    .string()
    .max(
      AI_LIMITS.userPromptTemplate,
      `Keep the template under ${AI_LIMITS.userPromptTemplate.toLocaleString("en-IN")} characters`
    )
    .transform(LF),
};

/** A new configuration. Everything is required; it always starts in Test. */
export const AiConfigCreate = z.object({
  ...shape,
  // These three may be left empty, and mean "none".
  description: shape.description.optional().transform((s) => s ?? ""),
  systemPrompt: shape.systemPrompt.optional().transform((s) => s ?? ""),
  userPromptTemplate: shape.userPromptTemplate.optional().transform((s) => s ?? ""),
  temperature: shape.temperature.optional().transform((n) => n ?? AI_DEFAULTS.temperature),
  maxTokens: shape.maxTokens.optional().transform((n) => n ?? AI_DEFAULTS.maxTokens),
});

/** A change: any of the fields, and/or the status. At least one. */
export const AiConfigPatch = z
  .object({ ...shape, status: z.enum(AI_STATUS) })
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: "Nothing to change" });

export const AI_FIELDS = [
  "name",
  "description",
  "model",
  "temperature",
  "maxTokens",
  "systemPrompt",
  "userPromptTemplate",
] as const;
export type AiField = (typeof AI_FIELDS)[number];

export type AiConfig = {
  name: string;
  description: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  userPromptTemplate: string;
};

/* ------------------------------------------------------- placeholders */

const PLACEHOLDER = /\{\{\s*([A-Za-z_][A-Za-z0-9_.]*)\s*\}\}/g;

/**
 * The `{{variables}}` a template asks for, in the order they first appear, each
 * once — and anything that looks like an attempt at one but is not, because
 * that is what silently sends the literal text "{{age" to a model.
 */
export function inspectTemplate(template: string | null | undefined): { names: string[]; problems: string[] } {
  const text = template ?? "";
  const names: string[] = [];
  for (const m of text.matchAll(PLACEHOLDER)) if (!names.includes(m[1])) names.push(m[1]);

  const problems: string[] = [];
  // Whatever is left once every well-formed placeholder is taken out.
  const rest = text.replace(PLACEHOLDER, "");
  if (rest.includes("{{") || rest.includes("}}")) {
    problems.push("A placeholder is not written as {{name}} — check each one opens with {{ and closes with }}.");
  }
  return { names, problems };
}

/* ------------------------------------------------------------ changes */

/**
 * The fields that differ, with both sides, for the audit trail.
 *
 * Full text is kept for the prompts — a prompt edit is exactly the change
 * somebody will later need to see — even though the audit screen shortens long
 * values for reading.
 */
export function aiChanges(
  before: Partial<AiConfig> | null | undefined,
  after: Partial<AiConfig> | null | undefined
): { before: Partial<AiConfig>; after: Partial<AiConfig> } {
  const outB: Record<string, unknown> = {};
  const outA: Record<string, unknown> = {};
  for (const key of AI_FIELDS) {
    const b = before?.[key];
    const a = after?.[key];
    if (a === undefined) continue; // not part of this change
    if (b !== a) {
      outB[key] = b;
      outA[key] = a;
    }
  }
  return { before: outB as Partial<AiConfig>, after: outA as Partial<AiConfig> };
}

/** Escape a string for use inside a RegExp — for the case-insensitive name check. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

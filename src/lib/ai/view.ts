import type { AiStatus } from "./config";

export type AiModelView = {
  id: string;
  name: string;
  description: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  userPromptTemplate: string;
  status: AiStatus;
  /** ISO string — a Date does not cross from a server component to a client one. */
  updatedAt: string | null;
};

/**
 * A stored row as the screen and the API see it.
 *
 * Every read tolerates a missing field, and the id and date become plain
 * strings: this is handed to a client component, which cannot be given an
 * ObjectId, and one row missing a field must not take the whole list down.
 */
export function aiView(row: Record<string, unknown>): AiModelView {
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
  const updated = row.updatedAt instanceof Date ? row.updatedAt : row.updatedAt ? new Date(String(row.updatedAt)) : null;

  return {
    id: String(row._id ?? ""),
    name: str(row.name) || "Untitled",
    description: str(row.description),
    model: str(row.model),
    temperature: num(row.temperature, 0),
    maxTokens: num(row.maxTokens, 0),
    systemPrompt: str(row.systemPrompt),
    userPromptTemplate: str(row.userPromptTemplate),
    status: row.status === "active" ? "active" : "test",
    updatedAt: updated && !Number.isNaN(updated.getTime()) ? updated.toISOString() : null,
  };
}

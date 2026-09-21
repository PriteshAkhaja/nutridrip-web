"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Field";
import { AI_DEFAULTS, AI_LIMITS, MODEL_SUGGESTIONS, inspectTemplate } from "@/lib/ai/config";
import type { AiModelView } from "@/lib/ai/view";

type Form = {
  name: string;
  description: string;
  model: string;
  temperature: string;
  maxTokens: string;
  systemPrompt: string;
  userPromptTemplate: string;
};
type Field = keyof Form;

const blank: Form = {
  name: "",
  description: "",
  model: "",
  temperature: String(AI_DEFAULTS.temperature),
  maxTokens: String(AI_DEFAULTS.maxTokens),
  systemPrompt: "",
  userPromptTemplate: "",
};

const fromModel = (m: AiModelView): Form => ({
  name: m.name,
  description: m.description,
  model: m.model,
  temperature: String(m.temperature),
  maxTokens: String(m.maxTokens),
  systemPrompt: m.systemPrompt,
  userPromptTemplate: m.userPromptTemplate,
});

/**
 * Add a model configuration, or edit one.
 *
 * The numbers are held as text while somebody types — "0." is not yet a number
 * and would be snapped to "0" under their cursor — and turned into numbers only
 * on save. A value that is not a number is sent as the text it is, so the server
 * refuses it in the same words it uses everywhere.
 */
export function StudioForm({ editing }: { editing: AiModelView | null }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(editing ? fromModel(editing) : blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});

  const set = (k: Field) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setFieldErrors((fe) => ({ ...fe, [k]: undefined }));
  };

  const template = inspectTemplate(form.userPromptTemplate);
  const live = editing?.status === "active";

  const save = async () => {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const num = (s: string) => (s.trim() === "" ? undefined : Number.isNaN(Number(s)) ? s : Number(s));
      const res = await fetch(editing ? `/api/admin/ai/${editing.id}` : "/api/admin/ai", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          model: form.model,
          temperature: num(form.temperature),
          maxTokens: num(form.maxTokens),
          systemPrompt: form.systemPrompt,
          userPromptTemplate: form.userPromptTemplate,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        const issues: Array<{ path: string; message: string }> = json.issues ?? [];
        if (issues.length) {
          const next: Partial<Record<Field, string>> = {};
          for (const i of issues) if (i.path in blank) next[i.path as Field] = i.message;
          setFieldErrors(next);
          setError("Some of these need another look.");
        } else setError(json.error ?? "Could not save that");
        return;
      }
      router.replace("/admin/studio");
      router.refresh();
    } catch {
      setError("Could not reach the server. Nothing was saved — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="p-6">
      <h2 className="t-h3 mb-1">{editing ? `Edit “${editing.name}”` : "Add a model"}</h2>
      <p className="t-small text-[var(--color-ink-3)] mb-5">
        {editing
          ? "Changes are recorded in the audit trail, with the old and new values."
          : "A new model starts in Test. Making it the active one is a separate step."}
      </p>

      {live ? (
        <div className="mb-5">
          <Card tone="caution" padding="p-4">
            <span className="t-small text-[var(--color-ink-2)]">
              This is the active model — changes take effect as soon as you save.
            </span>
          </Card>
        </div>
      ) : null}

      {/* noValidate: the browser's own range check on the number inputs blocked
          the submit and said nothing in this page's words — in a headless test it
          said nothing at all. The server's messages are the one source, and they
          appear against the field that needs fixing. */}
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            label="Name"
            required
            value={form.name}
            onChange={set("name")}
            maxLength={AI_LIMITS.name}
            placeholder="Treatment recommendations"
            error={fieldErrors.name}
          />
          <div className="flex flex-col gap-[7px]">
            <Input
              label="Model"
              required
              mono
              list="ai-model-suggestions"
              value={form.model}
              onChange={set("model")}
              maxLength={AI_LIMITS.model}
              placeholder="claude-sonnet-5"
              error={fieldErrors.model}
            />
            <datalist id="ai-model-suggestions">
              {MODEL_SUGGESTIONS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
        </div>

        <Input
          label="Description"
          hint="optional"
          value={form.description}
          onChange={set("description")}
          maxLength={AI_LIMITS.description}
          placeholder="What this configuration is for"
          error={fieldErrors.description}
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 items-start">
          <div className="flex flex-col gap-[7px]">
            <Input
              label="Temperature"
              type="number"
              mono
              min={0}
              max={1}
              step={0.05}
              value={form.temperature}
              onChange={set("temperature")}
              error={fieldErrors.temperature}
            />
            <span className="t-small text-[var(--color-ink-3)]">0 is the steadiest, 1 the most varied.</span>
          </div>
          <div className="flex flex-col gap-[7px]">
            <Input
              label="Maximum length (tokens)"
              type="number"
              mono
              min={1}
              max={AI_LIMITS.maxTokens}
              step={1}
              value={form.maxTokens}
              onChange={set("maxTokens")}
              error={fieldErrors.maxTokens}
            />
            <span className="t-small text-[var(--color-ink-3)]">
              Up to {AI_LIMITS.maxTokens.toLocaleString("en-IN")}.
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-[7px]">
          <Textarea
            label="System prompt"
            hint="required to make it active"
            value={form.systemPrompt}
            onChange={set("systemPrompt")}
            rows={8}
            maxLength={AI_LIMITS.systemPrompt}
            placeholder="The standing instructions the model is given before every request."
            error={fieldErrors.systemPrompt}
          />
          <span className="t-small text-[var(--color-ink-3)] t-data">
            {form.systemPrompt.length.toLocaleString("en-IN")} / {AI_LIMITS.systemPrompt.toLocaleString("en-IN")}
          </span>
        </div>

        <div className="flex flex-col gap-[7px]">
          <Textarea
            label="Request template"
            hint="optional"
            value={form.userPromptTemplate}
            onChange={set("userPromptTemplate")}
            rows={5}
            maxLength={AI_LIMITS.userPromptTemplate}
            placeholder={"Patient aged {{age}} reports {{symptoms}}."}
            error={fieldErrors.userPromptTemplate}
          />
          {template.problems.length > 0 ? (
            <span className="t-small text-[var(--color-critical-text)]" role="alert">
              {template.problems[0]}
            </span>
          ) : template.names.length > 0 ? (
            <span className="t-small text-[var(--color-ink-2)]">
              Fills in: <span className="t-data">{template.names.join(", ")}</span>
            </span>
          ) : (
            <span className="t-small text-[var(--color-ink-3)]">
              Write <span className="t-data">{"{{name}}"}</span> wherever a value should be filled in.
            </span>
          )}
        </div>

        {error ? (
          <span className="t-small text-[var(--color-critical-text)]" role="alert">
            {error}
          </span>
        ) : null}

        <div className="flex gap-3 flex-wrap items-center">
          <Button type="submit" loading={busy} disabled={!form.name.trim() || !form.model.trim()}>
            {editing ? "Save changes" : "Add model"}
          </Button>
          <Link href="/admin/studio" className="t-body font-semibold inline-flex items-center min-h-[44px] px-2">
            Cancel
          </Link>
        </div>
      </form>
    </Card>
  );
}

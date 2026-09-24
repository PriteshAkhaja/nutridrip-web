"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Field";
import {
  CONSULT_TOPICS,
  CONTACT_WINDOWS,
  composeConsultMessage,
  consultReady,
  pincodeHint,
} from "@/lib/data/consult";
import type { Zone } from "@/lib/zones";

const HINT_COLOUR = {
  safe: "var(--color-safe-text)",
  caution: "var(--color-caution-text)",
  critical: "var(--color-critical-text)",
} as const;

/**
 * Ask a clinician a question.
 *
 * It is a request and says so, everywhere it can. The old build's version
 * ended in a "Consultation booked!" panel over a form that had booked nothing,
 * which is a promise the software could not keep. Here the confirmation
 * repeats what actually happened — a note was left for our team — and the
 * wording of what happens next is editable site copy, so the business, not the
 * developer, decides what it commits to.
 */
export function ConsultForm({ response, zones }: { response: string; zones: Zone[] }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    pincode: "",
    window: "Any time",
    question: "",
  });
  const [topics, setTopics] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const toggle = (t: string) =>
    setTopics((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const hint = pincodeHint(form.pincode, zones);
  const pin = form.pincode.replace(/\D/g, "");

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "consult",
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          pincode: pin.length === 6 ? pin : undefined,
          message: composeConsultMessage({ topics, window: form.window, question: form.question }) || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not send that");
      else setSent(true);
    } catch {
      setError("Could not reach the server. Nothing was sent — please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <Card tone="safe" padding="p-6">
        <h2 className="t-h3 mb-2">We have your request</h2>
        <p className="t-body text-[var(--color-ink-2)]">{response}</p>
      </Card>
    );
  }

  return (
    <Card padding="p-6">
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Input label="Your name" required value={form.name} onChange={set("name")} autoComplete="name" />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Phone"
            type="tel"
            mono
            value={form.phone}
            onChange={set("phone")}
            autoComplete="tel"
            placeholder="+91 98•• ••••"
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={set("email")}
            autoComplete="email"
            placeholder="you@example.com"
          />
        </div>
        <p className="t-small text-[var(--color-ink-3)] -mt-3">Either one is enough — however you would like us to reply.</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 items-start">
          <div className="flex flex-col gap-[7px]">
            <Input
              label="Pincode (optional)"
              mono
              inputMode="numeric"
              maxLength={7}
              value={form.pincode}
              onChange={set("pincode")}
              autoComplete="postal-code"
              placeholder="560095"
            />
            {hint ? (
              <span className="t-small" style={{ color: HINT_COLOUR[hint.tone] }} aria-live="polite">
                {hint.text}
              </span>
            ) : null}
          </div>
          <Select label="Best time to reach you" value={form.window} onChange={set("window")}>
            {CONTACT_WINDOWS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </Select>
        </div>

        <fieldset className="border-0 p-0 m-0 min-w-0">
          <legend className="t-body font-medium mb-2 p-0">What is it about?</legend>
          <div className="flex flex-wrap gap-2">
            {CONSULT_TOPICS.map((t) => {
              const on = topics.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(t)}
                  className={`t-small rounded-full px-[14px] py-[8px] border min-h-[44px] sm:min-h-[36px] cursor-pointer transition-colors ${
                    on
                      ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-white"
                      : "border-[var(--color-line-2)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-[var(--color-ink-3)]"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </fieldset>

        <Textarea
          label="What would you like to ask?"
          value={form.question}
          onChange={set("question")}
          rows={4}
          placeholder="For example: I take thyroid tablets — is that a reason not to?"
        />

        {error ? (
          <span className="t-small text-[var(--color-critical-text)]" role="alert">
            {error}
          </span>
        ) : null}

        <Button type="submit" size="lg" block loading={busy} disabled={!consultReady(form)}>
          Send my request
        </Button>

        <p className="t-small text-[var(--color-ink-3)]">
          We use this only to reply to you. It is not added to any mailing list.
        </p>
      </form>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { CONSULT_TOPICS, CONTACT_WINDOWS, composeConsultMessage, consultReady, pincodeHint } from "@/lib/data/consult";
import type { Zone } from "@/lib/zones";

/**
 * Ask a clinician a question, in the client's form style (`.nd-form`).
 *
 * It is a request and says so, everywhere it can: the confirmation repeats
 * what actually happened (a note was left for our team), and the wording of
 * what happens next is editable site copy (consult.response). The same
 * fields, rules and POST to /api/leads (kind "consult") as the form it
 * replaces.
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
  const toggle = (t: string) => setTopics((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const hint = pincodeHint(form.pincode, zones);
  const pin = form.pincode.replace(/\D/g, "");
  const ready = consultReady(form);

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
      if (!json?.success) setError(json?.error ?? "Could not send that");
      else setSent(true);
    } catch {
      setError("Could not reach the server. Nothing was sent: please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="nd-callout cs-form" role="status">
        <p className="cs-form__h">We have your request.</p>
        <p className="nd-body">{response}</p>
      </div>
    );
  }

  return (
    <div className="nd-callout cs-form">
      <form
        className="nd-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !busy) submit();
        }}
      >
        <div className="nd-field">
          <label htmlFor="cs-name">Your name</label>
          <input
            id="cs-name"
            required
            autoComplete="name"
            placeholder="Priya Sharma"
            value={form.name}
            onChange={set("name")}
          />
        </div>
        <div className="cs-form__row">
          <div className="nd-field">
            <label htmlFor="cs-phone">Phone</label>
            <input
              id="cs-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="10-digit mobile"
              value={form.phone}
              onChange={set("phone")}
            />
          </div>
          <div className="nd-field">
            <label htmlFor="cs-email">Email</label>
            <input
              id="cs-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={set("email")}
            />
          </div>
        </div>
        <p className="nd-small cs-form__either">Either one is enough: however you would like us to reply.</p>
        <div className="cs-form__row">
          <div className="nd-field">
            <label htmlFor="cs-pin">Pincode (optional)</label>
            <input
              id="cs-pin"
              inputMode="numeric"
              maxLength={7}
              autoComplete="postal-code"
              placeholder="560095"
              value={form.pincode}
              onChange={set("pincode")}
              aria-describedby={hint ? "cs-pin-hint" : undefined}
            />
            {hint ? (
              <p id="cs-pin-hint" className={`cs-hint cs-hint--${hint.tone}`} aria-live="polite">
                {hint.text}
              </p>
            ) : null}
          </div>
          <div className="nd-field">
            <label htmlFor="cs-window">Best time to reach you</label>
            <select id="cs-window" value={form.window} onChange={set("window")}>
              {CONTACT_WINDOWS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
        </div>
        <fieldset className="nd-field">
          <legend>What is it about?</legend>
          <div className="cs-topics">
            {CONSULT_TOPICS.map((t) => (
              <button
                key={t}
                type="button"
                className="cs-topic"
                aria-pressed={topics.includes(t)}
                onClick={() => toggle(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="nd-field">
          <label htmlFor="cs-q">What would you like to ask?</label>
          <textarea
            id="cs-q"
            rows={4}
            placeholder="For example: I take thyroid tablets. Is that a reason not to?"
            value={form.question}
            onChange={set("question")}
          />
        </div>
        {error ? (
          <p className="nd-err" role="alert">
            {error}
          </p>
        ) : null}
        <button className="nd-btn" type="submit" disabled={!ready || busy} aria-busy={busy || undefined}>
          {busy ? "Sending…" : "Send my request"}
        </button>
        <p className="nd-small">We use this only to reply to you. It is not added to any mailing list.</p>
      </form>
    </div>
  );
}

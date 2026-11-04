"use client";

import { useState } from "react";

/**
 * The clinic enquiry, in the client's form style (`.nd-form`): the same
 * fields and the same POST to /api/leads (kind "clinic") as before.
 */
export function ClinicEnquiryForm() {
  const [form, setForm] = useState({
    name: "",
    organisation: "",
    email: "",
    phone: "",
    city: "Bengaluru",
    rooms: "",
    monthlyVolume: "",
    message: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const digits = (k: "rooms" | "monthlyVolume") => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value.replace(/\D/g, "") }));
  const ready = !!form.name.trim() && (!!form.email.trim() || !!form.phone.trim());

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "clinic",
          name: form.name,
          organisation: form.organisation || undefined,
          email: form.email,
          phone: form.phone,
          city: form.city || undefined,
          rooms: form.rooms ? Number(form.rooms) : undefined,
          monthlyVolume: form.monthlyVolume ? Number(form.monthlyVolume) : undefined,
          message: form.message || undefined,
        }),
      });
      const json = await res.json();
      if (!json?.success) setError(json?.error ?? "Could not send that");
      else setSent(true);
    } catch {
      setError("Could not reach the server. Nothing was sent: try again, or email us directly.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="nd-callout cl-form__sent" role="status">
        <p className="cl-form__h">We have it.</p>
        <p className="nd-body">
          An operations lead will call to arrange the site visit. If it is urgent, write to{" "}
          <a className="nd-link" href="mailto:partners@nutridrip.com">
            partners@nutridrip.com
          </a>{" "}
          and say so.
        </p>
      </div>
    );
  }

  return (
    <div className="nd-callout">
      <form
        className="nd-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !busy) submit();
        }}
      >
        <div className="nd-field">
          <label htmlFor="cl-name">Your name</label>
          <input
            id="cl-name"
            autoComplete="name"
            required
            placeholder="Dr. Priya Sharma"
            value={form.name}
            onChange={set("name")}
          />
        </div>
        <div className="nd-field">
          <label htmlFor="cl-org">Clinic or hospital</label>
          <input
            id="cl-org"
            autoComplete="organization"
            placeholder="HealthFirst, Indiranagar"
            value={form.organisation}
            onChange={set("organisation")}
          />
        </div>
        <div className="cl-form__row">
          <div className="nd-field">
            <label htmlFor="cl-email">Email</label>
            <input
              id="cl-email"
              type="email"
              autoComplete="email"
              placeholder="you@clinic.com"
              value={form.email}
              onChange={set("email")}
            />
          </div>
          <div className="nd-field">
            <label htmlFor="cl-phone">Phone</label>
            <input
              id="cl-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="10-digit mobile"
              value={form.phone}
              onChange={set("phone")}
            />
          </div>
        </div>
        <div className="cl-form__row cl-form__row--3">
          <div className="nd-field">
            <label htmlFor="cl-city">City</label>
            <input id="cl-city" autoComplete="address-level2" value={form.city} onChange={set("city")} />
          </div>
          {/* Whole numbers: a text field that keeps digits only, so no spinner
              arrows crowd a narrow box and the API always gets a number. */}
          <div className="nd-field">
            <label htmlFor="cl-rooms">Rooms</label>
            <input
              id="cl-rooms"
              inputMode="numeric"
              placeholder="2"
              maxLength={3}
              value={form.rooms}
              onChange={digits("rooms")}
            />
          </div>
          <div className="nd-field">
            <label htmlFor="cl-volume">Sessions a month</label>
            <input
              id="cl-volume"
              inputMode="numeric"
              placeholder="About 60"
              maxLength={5}
              value={form.monthlyVolume}
              onChange={digits("monthlyVolume")}
            />
          </div>
        </div>
        <div className="nd-field">
          <label htmlFor="cl-msg">Anything else</label>
          <textarea
            id="cl-msg"
            rows={3}
            placeholder="An existing IV service, where stock would be kept, whether you have nurses already."
            value={form.message}
            onChange={set("message")}
          />
        </div>
        {error ? (
          <p className="nd-err" role="alert">
            {error}
          </p>
        ) : null}
        <button className="nd-btn" type="submit" disabled={!ready || busy} aria-busy={busy || undefined}>
          {busy ? "Sending…" : "Request a site visit"}
        </button>
        <p className="nd-small">
          Your name and an email or phone number are enough. We use this only to contact you about a partnership; it is
          not added to any mailing list.
        </p>
      </form>
    </div>
  );
}

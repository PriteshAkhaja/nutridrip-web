"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";

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
      if (!json.success) setError(json.error ?? "Could not send that");
      else setSent(true);
    } catch {
      setError("Could not reach the server. Nothing was sent — try again, or email us directly.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <Card tone="safe" padding="p-6">
        <h3 className="t-h3 mb-2">We have it</h3>
        <p className="t-body text-[var(--color-ink-2)]">
          An operations lead will call within two working days to arrange the site visit. If it is urgent, write to{" "}
          <a href="mailto:partners@nutridrip.com">partners@nutridrip.com</a> and say so.
        </p>
      </Card>
    );
  }

  return (
    <Card padding="p-6">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Input label="Your name" required value={form.name} onChange={set("name")} placeholder="Dr. Raj Verma" />
        <Input
          label="Clinic"
          value={form.organisation}
          onChange={set("organisation")}
          placeholder="HealthFirst, Indiranagar"
        />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Email" type="email" value={form.email} onChange={set("email")} placeholder="you@clinic.com" />
          <Input label="Phone" type="tel" mono value={form.phone} onChange={set("phone")} placeholder="+91 98•• ••••" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input label="City" value={form.city} onChange={set("city")} />
          <Input label="Rooms" type="number" min={0} mono value={form.rooms} onChange={set("rooms")} placeholder="2" />
          <Input
            label="Sessions/mo"
            hint="est."
            type="number"
            min={0}
            mono
            value={form.monthlyVolume}
            onChange={set("monthlyVolume")}
            placeholder="60"
          />
        </div>

        <Textarea
          label="Anything else"
          value={form.message}
          onChange={set("message")}
          rows={3}
          placeholder="Existing IV service, cold chain, whether you have nurses already."
        />

        {error && <span className="t-small text-[var(--color-critical-text)]">{error}</span>}

        <Button type="submit" size="lg" block loading={busy} disabled={!form.name || (!form.email && !form.phone)}>
          Request a site visit
        </Button>

        <p className="t-small text-[var(--color-ink-3)]">
          We use this only to contact you about a partnership. It is not added to any mailing list.
        </p>
      </form>
    </Card>
  );
}

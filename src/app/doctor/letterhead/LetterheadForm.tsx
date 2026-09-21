"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Field";
import { LetterheadBlock } from "@/components/clinical/LetterheadBlock";
import { LETTERHEAD_LIMITS, hasLetterhead, letterheadView, type Letterhead } from "@/lib/clinical/letterhead";

type Credentials = {
  name: string;
  specialization: string | null;
  licenseNo: string | null;
  registrationCouncil: string | null;
};

const FIELDS = ["practiceName", "qualifications", "address", "phone", "email", "footerNote"] as const;
type Form = Record<(typeof FIELDS)[number], string>;

const toForm = (l: Letterhead): Form => ({
  practiceName: l.practiceName ?? "",
  qualifications: l.qualifications ?? "",
  address: l.address ?? "",
  phone: l.phone ?? "",
  email: l.email ?? "",
  footerNote: l.footerNote ?? "",
});

/**
 * Edit the letterhead that prints above your prescriptions.
 *
 * The preview is the same component the printed slip uses, fed the same
 * function, so what is on the right is what comes out of the printer — and the
 * credentials strip under it is drawn from the verified record, to show which
 * part of the slip this form cannot change.
 */
export function LetterheadForm({
  initial,
  credentials,
  latestPlanId,
}: {
  initial: Letterhead;
  credentials: Credentials;
  latestPlanId: string | null;
}) {
  const [form, setForm] = useState<Form>(toForm(initial));
  const [saved, setSaved] = useState<Form>(toForm(initial));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof Form, string>>>({});

  const set = (k: keyof Form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setNote(null);
    setFieldErrors((fe) => ({ ...fe, [k]: undefined }));
  };

  const dirty = FIELDS.some((k) => form[k].trim() !== saved[k].trim());
  const view = letterheadView(form, credentials.name);
  const hasAny = hasLetterhead(form);

  const save = async () => {
    setBusy(true);
    setError(null);
    setNote(null);
    setFieldErrors({});
    try {
      const res = await fetch("/api/me/letterhead", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) {
        // Each message is shown against its own field, in the words the server
        // chose for a person, not as "phone: ..." in one line at the bottom.
        const issues: Array<{ path: string; message: string }> = json.issues ?? [];
        if (issues.length) {
          const next: Partial<Record<keyof Form, string>> = {};
          for (const i of issues) if ((FIELDS as readonly string[]).includes(i.path)) next[i.path as keyof Form] = i.message;
          setFieldErrors(next);
          setError("Some of these need another look.");
        } else setError(json.error ?? "Could not save that");
        return;
      }
      const stored = toForm(json.data?.letterhead ?? {});
      setForm(stored);
      setSaved(stored);
      setNote(
        json.data?.changed === false
          ? "Nothing had changed."
          : "Saved. Your next prescription will use this letterhead."
      );
    } catch {
      setError("Could not reach the server. Nothing was saved — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,480px)] items-start">
      <Card padding="p-6">
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Input
            label="Practice or clinic name"
            hint="optional"
            value={form.practiceName}
            onChange={set("practiceName")}
            maxLength={LETTERHEAD_LIMITS.practiceName}
            placeholder={credentials.name}
            error={fieldErrors.practiceName}
          />
          <p className="t-small text-[var(--color-ink-3)] -mt-3">
            Left blank, the slip is headed by your own name.
          </p>

          <Input
            label="Qualifications"
            hint="optional"
            value={form.qualifications}
            onChange={set("qualifications")}
            maxLength={LETTERHEAD_LIMITS.qualifications}
            placeholder="MBBS, MD (Internal Medicine)"
            error={fieldErrors.qualifications}
          />

          <Textarea
            label="Address"
            hint="optional · up to 4 lines"
            value={form.address}
            onChange={set("address")}
            rows={4}
            maxLength={LETTERHEAD_LIMITS.address}
            placeholder={"12 Church Street\nBengaluru 560001"}
            error={fieldErrors.address}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Phone"
              type="tel"
              mono
              value={form.phone}
              onChange={set("phone")}
              maxLength={LETTERHEAD_LIMITS.phone}
              placeholder="080 4000 0000"
              error={fieldErrors.phone}
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={set("email")}
              maxLength={LETTERHEAD_LIMITS.email}
              placeholder="you@practice.com"
              error={fieldErrors.email}
            />
          </div>

          <Textarea
            label="Closing note"
            hint="optional · printed at the foot"
            value={form.footerNote}
            onChange={set("footerNote")}
            rows={2}
            maxLength={LETTERHEAD_LIMITS.footerNote}
            placeholder="Please bring this slip to every session."
            error={fieldErrors.footerNote}
          />

          {error ? (
            <span className="t-small text-[var(--color-critical-text)]" role="alert">
              {error}
            </span>
          ) : null}
          {note ? (
            <span className="t-small text-[var(--color-safe-text)]" role="status">
              {note}
            </span>
          ) : null}

          <div className="flex gap-3 flex-wrap items-center">
            <Button type="submit" loading={busy} disabled={!dirty}>
              Save letterhead
            </Button>
            {dirty ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setForm(saved);
                  setFieldErrors({});
                  setError(null);
                }}
              >
                Discard changes
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      <div className="flex flex-col gap-4">
        <Card padding="p-6">
          <span className="t-micro">How the top of your prescription reads</span>
          <div className="mt-4 pb-4 border-b-2 border-[var(--color-ink)]">
            <LetterheadBlock view={view} />
          </div>
          <div className="pt-3">
            <span className="t-micro">Prescribing physician</span>
            <div className="t-body font-medium mt-1">{credentials.name}</div>
            {credentials.specialization ? (
              <div className="t-small text-[var(--color-ink-2)]">{credentials.specialization}</div>
            ) : null}
            <div className="t-data text-[13px] mt-1">
              {credentials.registrationCouncil ?? "—"} · {credentials.licenseNo ?? "—"}
            </div>
          </div>
          {view.footerNote ? (
            <p className="t-small text-[var(--color-ink-3)] mt-4 pt-3 border-t border-[var(--color-line)]">
              {view.footerNote}
            </p>
          ) : null}
          {!hasAny ? (
            <p className="t-small text-[var(--color-ink-3)] mt-4">
              No letterhead yet — prescriptions keep the NutriDrip header.
            </p>
          ) : null}
        </Card>

        <Card tone="muted" padding="p-5">
          <p className="t-small text-[var(--color-ink-2)]" style={{ textWrap: "pretty" }}>
            Your registration number and council are printed from your verified record on every prescription. They are
            set by an administrator, so they are not here to edit — and they appear whether or not you have a
            letterhead.
          </p>
          {latestPlanId ? (
            <a
              href={`/doctor/plans/${latestPlanId}/print`}
              className="t-body font-semibold inline-flex items-center min-h-[44px] mt-2"
            >
              See it on your latest prescription
            </a>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

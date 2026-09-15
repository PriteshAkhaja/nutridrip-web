"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { checkGstin, stateCodeFromGstin, stateName } from "@/lib/billing/gst";
import type { BillingConfig } from "@/lib/billing/settings";

/**
 * The GST switch, and the registration behind it.
 *
 * One toggle rather than "clear this text field to turn tax off", which is how
 * it worked when these lived among the site copy — an obscure way to change
 * whether a business charges tax.
 *
 * The switch alone is not enough and the form says so: a supplier with no
 * registration number may not charge GST however it is set, so turning it on
 * without a GSTIN is refused here and again at the API.
 */
export function BillingForm({ config }: { config: BillingConfig }) {
  const router = useRouter();
  const [gstEnabled, setGstEnabled] = useState(config.gstEnabled);
  const [gstin, setGstin] = useState(config.gstin);
  const [address, setAddress] = useState(config.address);
  const [terms, setTerms] = useState(config.terms);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const code = stateCodeFromGstin(gstin);
  const home = stateName(code);
  const verdict = checkGstin(gstin);
  const noNumber = gstEnabled && !gstin.trim();
  // A warning does not block: see checkGstin. Only a hard error does.
  const blocked = noNumber || Boolean(verdict.error);

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/billing", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gstEnabled, gstin, address, terms }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not save that");
      else {
        setGstin(json.data.config.gstin);
        setSaved(true);
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h2 className="t-h3">GST</h2>
          <p className="t-body text-[var(--color-ink-2)] mt-1 max-w-[62ch]">
            With this off, every clinic downloads a <strong>bill of supply</strong> and nothing is
            taxed — whatever rate a drip carries. With it on, they get a <strong>tax invoice</strong>
            , and the first two digits of the GSTIN below decide whether a supply is CGST + SGST or
            IGST.
          </p>
        </div>
        <Pill tone={gstEnabled ? "safe" : "neutral"} dot>
          {gstEnabled ? "Charging GST" : "Not charging GST"}
        </Pill>
      </div>

      <div className="py-4 border-y border-[var(--color-line)]">
        <Switch
          label="Charge GST on invoices"
          hint={
            gstEnabled
              ? "Clinics receive a tax invoice, at each drip's own rate."
              : "Clinics receive a bill of supply. Nothing is taxed."
          }
          checked={gstEnabled}
          onChange={setGstEnabled}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mt-5">
        <Input
          label="Your GSTIN"
          hint={home ? `${home} · ${code}` : "15 characters"}
          mono
          value={gstin}
          error={
            noNumber
              ? "Required. Without it no GSTIN can be printed, and every invoice would go out as a bill of supply."
              : verdict.error
          }
          onChange={(e) => setGstin(e.target.value.toUpperCase())}
          placeholder="e.g. 29AAACN0000X1ZQ"
        />
        <Input
          label="Registered address"
          hint="printed on every invoice"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="e.g. 8th Block Koramangala, Bengaluru 560095"
        />
        {verdict.warning ? (
          <p className="t-small text-[var(--color-caution-text)] lg:col-span-2">
            {verdict.warning}
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        <Textarea
          label="Payment terms"
          rows={2}
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          placeholder="Payable within 30 days of the invoice date."
        />
      </div>

      {/* An invoice already downloaded is never rewritten, so a change here
          only reaches bills raised afterwards. Saying so beats somebody
          changing the GSTIN and concluding it did not work. */}
      <p className="t-small text-[var(--color-ink-3)] mt-4" style={{ textWrap: "pretty" }}>
        Invoices already raised keep the details they were issued with. A bill is a document of
        record, not a view of today&rsquo;s settings.
      </p>

      {error ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3 mt-5">
          <span className="t-body text-[var(--color-ink-2)]">{error}</span>
        </div>
      ) : null}

      <div className="flex items-center gap-4 mt-6">
        <Button size="md" loading={busy} disabled={blocked} onClick={save}>
          Save
        </Button>
        {saved ? <span className="t-small text-[var(--color-safe-text)]">Saved</span> : null}
      </div>
    </Card>
  );
}

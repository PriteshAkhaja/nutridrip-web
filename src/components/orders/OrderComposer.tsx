"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select, Checkbox, Textarea } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import { DripPicker } from "@/components/ui/DripPicker";
import { Pill } from "@/components/ui/Pill";
import { formatInr } from "@/lib/inventory/units";

type DripOption = {
  id: string;
  name: string;
  priceInr: number;
  available: number;
  category?: string;
  /** Ingredient names, so a drip can be found by what is in it. */
  keywords?: Array<string | undefined>;
};
type ClinicOption = { id: string; name: string; city: string };
type Line = { dripId: string; quantity: number };

/**
 * Raising a preparation order. A clinic orders for its own rooms; the
 * pharmacy raises one on a clinic's or a walk-in's behalf. Either way it is a
 * DRAFT that holds nothing until somebody confirms it.
 */
export function OrderComposer({
  drips,
  clinics = [],
  mode = "clinic",
}: {
  drips: DripOption[];
  /** Only the pharmacy sees this: a clinic's order is always its own. */
  clinics?: ClinicOption[];
  mode?: "clinic" | "admin";
}) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([{ dripId: drips[0]?.id ?? "", quantity: mode === "clinic" ? 5 : 1 }]);
  const [patientRef, setPatientRef] = useState("");
  const [patientName, setPatientName] = useState("");
  const [clinicId, setClinicId] = useState("");
  const [notes, setNotes] = useState("");
  const [delivery, setDelivery] = useState("");
  const [includeKits, setIncludeKits] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = new Map(drips.map((d) => [d.id, d]));
  const total = lines.reduce((s, l) => s + (byId.get(l.dripId)?.priceInr ?? 0) * l.quantity, 0);

  const update = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, n) => (n === i ? { ...l, ...patch } : l)));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          patientRef: patientRef || undefined,
          patientName: mode === "admin" && patientName ? patientName : undefined,
          clinicId: mode === "admin" && clinicId ? clinicId : undefined,
          notes: mode === "admin" && notes ? notes : undefined,
          scheduledDelivery: delivery ? new Date(`${delivery}T09:00:00`).toISOString() : undefined,
          includeKits,
          lines: lines.filter((l) => l.dripId).map((l) => ({ ...l, withKit: includeKits })),
        }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not raise the order");
      else if (mode === "admin") {
        router.push(`/admin/inventory/orders/${json.data.order._id}`);
      } else {
        setLines([{ dripId: drips[0]?.id ?? "", quantity: 5 }]);
        setPatientRef("");
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. Nothing was ordered.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="p-5" className="xl:sticky xl:top-6">
      <span className="t-micro">New order</span>
      <h2 className="t-h3 mt-2 mb-4">{mode === "admin" ? "Raise a preparation order" : "What do you need"}</h2>

      <div className="flex flex-col gap-4">
        {lines.map((line, i) => {
          const drip = byId.get(line.dripId);
          const short = drip ? line.quantity > drip.available : false;
          return (
            <div key={i} className="flex flex-col gap-2 pb-4 border-b border-[var(--color-line)] last:border-b-0">
              <DripPicker
                label="Drip"
                value={line.dripId}
                onChange={(id) => update(i, { dripId: id })}
                options={drips.map((d) => ({
                  id: d.id,
                  name: d.name,
                  category: d.category,
                  keywords: d.keywords,
                  detail: `${d.available} available`,
                }))}
              />

              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Input
                    label="Quantity"
                    type="number"
                    min={1}
                    mono
                    value={line.quantity}
                    onChange={(e) => update(i, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </div>
                {lines.length > 1 && (
                  <Button
                    variant="ghost"
                    onClick={() => setLines((ls) => ls.filter((_, n) => n !== i))}
                    aria-label="Remove line"
                  >
                    Remove
                  </Button>
                )}
              </div>

              {short && (
                <Pill tone="caution" dot>
                  Only {drip!.available} can be prepared today
                </Pill>
              )}
            </div>
          );
        })}

        <Button
          variant="secondary"
          block
          onClick={() => setLines((ls) => [...ls, { dripId: drips[0]?.id ?? "", quantity: 1 }])}
        >
          Add another drip
        </Button>

        <Input
          label="Patient reference"
          hint="optional"
          placeholder="HF-CL-0042"
          mono
          value={patientRef}
          onChange={(e) => setPatientRef(e.target.value)}
        />
        <span className="t-small text-[var(--color-ink-3)] -mt-2">
          A clinic code is preferred over a name — the pharmacy does not need to know who the patient is.
        </span>

        {mode === "admin" && (
          <>
            {clinics.length > 0 && (
              <>
                <Select label="For which clinic" value={clinicId} onChange={(e) => setClinicId(e.target.value)}>
                  <option value="">Nobody — a walk-in the pharmacy is preparing</option>
                  {clinics.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.city ? ` — ${c.city}` : ""}
                    </option>
                  ))}
                </Select>
                <span className="t-small text-[var(--color-ink-3)] -mt-2">
                  Attributing it to a clinic is what puts the order on their screen and sends them the
                  confirmation. Leave it unset and the order stays the pharmacy&apos;s own.
                </span>
              </>
            )}
            <Input
              label="Patient name"
              hint="only if there is no reference"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
            />
            <Input
              label="Needed by"
              hint="optional"
              type="date"
              mono
              value={delivery}
              onChange={(e) => setDelivery(e.target.value)}
            />
            <Textarea
              label="Notes for dispatch"
              hint="optional"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </>
        )}

        <Checkbox label="Include session kits" checked={includeKits} onChange={setIncludeKits} />

        <div className="flex justify-between gap-4 items-baseline pt-4 border-t border-[var(--color-line)]">
          <span className="t-body text-[var(--color-ink-2)]">Order total</span>
          <span className="t-data text-[18px]">{formatInr(total)}</span>
        </div>

        {error && <span className="t-small text-[var(--color-critical-text)]">{error}</span>}

        <Button size="lg" block loading={busy} disabled={lines.every((l) => !l.dripId)} onClick={submit}>
          Save as draft
        </Button>
      </div>
    </Card>
  );
}

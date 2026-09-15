"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, Checkbox } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { DRIP_CATEGORIES, INGREDIENT_ROLES, UNITS } from "@/lib/models/types";

type Master = { id: string; name: string; canonicalUnit: string; category: string };
type Kit = { id: string; name: string; isDefault: boolean; itemCount: number };

type Line = { masterId: string; dose: string; unit: string; role: string; notes: string };

export type DripDraft = {
  id?: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  infusionNotes: string;
  durationMin: string;
  priceInr: string;
  /** Tax classification, printed on the invoice a clinic downloads. */
  hsnCode: string;
  gstRate: string;
  /** Which group it shows under on the public catalogue. "" means none. */
  category: string;
  /** Upper end of the session range. "" means a single figure. */
  durationToMin: string;
  volumeMl: string;
  /** Comma-free: held as a list, edited as chips. */
  tags: string[];
  /** One emoji, the drip's own mark. Never a colour — see the model. */
  icon: string;
  isPopular: boolean;
  benefits: Array<{ title: string; description: string }>;
  withKit: boolean;
  /** Which session kit. "" means the default one. */
  kitId: string;
  isPublic: boolean;
  requiresApproval: boolean;
  isActive: boolean;
  ingredients: Line[];
};

const ROLE_HELP: Record<string, string> = {
  ACTIVE: "The reason the drip exists",
  FLUID: "The carrier it runs in",
  PREMED: "Given before, to cover a reaction",
  ADDITIVE: "Supporting, added to the bag",
};

const blankLine = (m?: Master): Line => ({
  masterId: m?.id ?? "",
  dose: "",
  unit: m?.canonicalUnit ?? "mg",
  role: "ACTIVE",
  notes: "",
});

export const emptyDrip = (): DripDraft => ({
  name: "",
  slug: "",
  tagline: "",
  description: "",
  infusionNotes: "",
  durationMin: "45",
  durationToMin: "",
  volumeMl: "500",
  priceInr: "8000",
  hsnCode: "30049099",
  gstRate: "12",
  category: "",
  tags: [],
  icon: "",
  isPopular: false,
  benefits: [],
  withKit: true,
  kitId: "",
  isPublic: true,
  requiresApproval: true,
  isActive: true,
  ingredients: [],
});

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export function DripEditor({
  masters,
  kits = [],
  initial,
  onClose,
}: {
  masters: Master[];
  /** Every session kit, so a recipe can name one instead of taking the default. */
  kits?: Kit[];
  initial: DripDraft;
  onClose: () => void;
}) {
  const router = useRouter();
  const [d, setD] = useState<DripDraft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const masterById = new Map(masters.map((m) => [m.id, m]));
  const editing = Boolean(d.id);

  const setLine = (i: number, patch: Partial<Line>) =>
    setD({ ...d, ingredients: d.ingredients.map((l, n) => (n === i ? { ...l, ...patch } : l)) });

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        name: d.name,
        slug: d.slug || slugify(d.name),
        tagline: d.tagline || undefined,
        description: d.description || undefined,
        infusionNotes: d.infusionNotes || undefined,
        durationMin: Number(d.durationMin) || 45,
        priceInr: Number(d.priceInr) || 0,
        // null, not undefined: JSON.stringify drops an undefined value, so the
        // key never reaches the server and "cleared" is indistinguishable from
        // "not sent". Null says it out loud.
        hsnCode: d.hsnCode || null,
        // null clears it: that drip is exempt, or we are not charging GST.
        gstRate: d.gstRate === "" ? null : Number(d.gstRate),
        category: d.category || null,
        durationToMin: d.durationToMin ? Number(d.durationToMin) : null,
        volumeMl: d.volumeMl ? Number(d.volumeMl) : null,
        tags: d.tags,
        icon: d.icon || null,
        isPopular: d.isPopular,
        benefits: d.benefits.filter((b) => b.title.trim()).map((b) => ({
          title: b.title.trim(),
          description: b.description.trim() || undefined,
        })),
        withKit: d.withKit,
        // null is meaningful: it clears a chosen kit back to the default.
        kitId: d.withKit ? d.kitId || null : null,
        isPublic: d.isPublic,
        requiresApproval: d.requiresApproval,
        isActive: d.isActive,
        ingredients: d.ingredients
          .filter((l) => l.masterId && l.dose)
          .map((l) => ({
            masterId: l.masterId,
            dose: Number(l.dose),
            unit: l.unit,
            role: l.role,
            notes: l.notes || undefined,
          })),
      };

      const res = await fetch(editing ? `/api/drips/${d.id}` : "/api/drips", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not save that recipe");
      else {
        onClose();
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. Nothing was saved.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!d.id) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/drips/${d.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not remove that recipe");
      else {
        if (json.data.retired) setNote(json.data.message);
        onClose();
        router.refresh();
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="p-6">
      <div className="flex items-baseline justify-between gap-4 mb-5 flex-wrap">
        <h2 className="t-h3">{editing ? `Editing ${initial.name}` : "New drip"}</h2>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>

      {note && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-info)] bg-[var(--color-info-soft)] px-4 py-3 mb-5">
          <span className="t-body text-[var(--color-ink-2)]">{note}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Input
          label="Name"
          value={d.name}
          onChange={(e) =>
            setD({ ...d, name: e.target.value, slug: editing ? d.slug : slugify(e.target.value) })
          }
          placeholder="Myers' Revive"
        />
        <Input
          label="Web address"
          hint="lowercase, hyphens"
          mono
          value={d.slug}
          onChange={(e) => setD({ ...d, slug: slugify(e.target.value) })}
          placeholder="myers-revive"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        {/* Without this a new drip has no category and lands as "Wellness",
            invisible to every filter chip on the public catalogue. */}
        <Select
          label="Category"
          hint="where it appears on the site"
          value={d.category}
          onChange={(e) => setD({ ...d, category: e.target.value })}
        >
          <option value="">No category — hidden from the goal filters</option>
          {DRIP_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Input
          label="Tagline"
          value={d.tagline}
          onChange={(e) => setD({ ...d, tagline: e.target.value })}
          placeholder="The default first drip"
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Minutes"
            hint="the short end"
            type="number"
            mono
            value={d.durationMin}
            onChange={(e) => setD({ ...d, durationMin: e.target.value })}
          />
          {/* A range is more honest than one number: a session that runs 60 to
              90 minutes told as "60 min" reads as a promise it cannot keep. */}
          <Input
            label="up to"
            hint="optional"
            type="number"
            mono
            value={d.durationToMin}
            onChange={(e) => setD({ ...d, durationToMin: e.target.value })}
            placeholder="90"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4 mt-4">
        {/* The price is read as tax-inclusive when a clinic is invoiced — the
            taxable value is worked back out of it, so the bill and the order
            come to the same figure. */}
        <Input
          label="Price ₹"
          hint="includes GST"
          type="number"
          mono
          value={d.priceInr}
          onChange={(e) => setD({ ...d, priceInr: e.target.value })}
        />
        {/* How much fluid goes up — a patient reads this and knows roughly how
            long they are sitting there. The dose list alone does not say it. */}
        <Input
          label="Volume"
          hint="ml"
          type="number"
          mono
          value={d.volumeMl}
          onChange={(e) => setD({ ...d, volumeMl: e.target.value })}
          placeholder="500"
        />
        <Input
          label="Icon"
          hint="one emoji"
          value={d.icon}
          onChange={(e) => setD({ ...d, icon: e.target.value })}
          placeholder="⚡"
        />
        <div className="flex items-end pb-[10px]">
          <Checkbox
            label="Most popular"
            checked={d.isPopular}
            onChange={(v) => setD({ ...d, isPopular: v })}
          />
        </div>
      </div>

      {/* An order is priced per drip, not per vial, so the line on a clinic's
          tax invoice is the drip — and the drip is what has to carry the
          classification. The drug behind it has its own HSN on the product
          master; that one describes the vial, not what was sold.

          Both are optional. Leave the rate blank and this drip is billed with
          no GST on it; leave NutriDrip's own GSTIN unset at /admin/content and
          nothing is taxed at all. */}
      <div className="grid gap-4 lg:grid-cols-4 mt-4">
        <Input
          label="HSN code"
          hint="on the invoice"
          mono
          value={d.hsnCode}
          onChange={(e) => setD({ ...d, hsnCode: e.target.value })}
          placeholder="30049099"
        />
        <Input
          label="GST rate"
          hint="% · blank = none"
          type="number"
          min={0}
          max={28}
          step="any"
          mono
          value={d.gstRate}
          onChange={(e) => setD({ ...d, gstRate: e.target.value })}
          placeholder="none"
        />
      </div>

      {/* Tags feed the search as well as the card, so "NAD+" finds a drip whose
          name never says it. */}
      <div className="mt-4">
        <span className="t-micro block mb-2">Tags{d.tags.length ? ` · ${d.tags.length} of 8` : ""}</span>
        <div className="flex flex-wrap gap-2 items-center">
          {d.tags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setD({ ...d, tags: d.tags.filter((x) => x !== t) })}
              aria-label={`Remove ${t}`}
              className="rounded-full px-[12px] py-[6px] border border-[var(--color-primary)] bg-[var(--color-primary)] text-white cursor-pointer"
              style={{ font: "500 12.5px/1.4 var(--font-sans)" }}
            >
              {t} ×
            </button>
          ))}
          {d.tags.length < 8 && (
            <input
              type="text"
              placeholder="Type a tag, press Enter"
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const v = e.currentTarget.value.trim();
                if (!v || d.tags.includes(v)) return;
                setD({ ...d, tags: [...d.tags, v] });
                e.currentTarget.value = "";
              }}
              className="min-h-[36px] px-[12px] rounded-[var(--radius-sm)] border border-[var(--color-line-2)] bg-[var(--color-surface)] text-[13px] placeholder:text-[var(--color-ink-3)]"
            />
          )}
        </div>
      </div>

      {/* What it does for somebody, explained. `bestFor` stays for the one-line
          claims; this is the version with a reason under each. */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <span className="t-micro">What it helps with</span>
          <span className="t-small text-[var(--color-ink-3)]">{d.benefits.length} of 6</span>
        </div>
        {/* items-end, matching the ingredient rows above. Only the first row
            carries labels, so it is taller — aligning to the START put its
            Remove link up beside the labels instead of beside the box it
            removes. */}
        <div className="flex flex-col gap-3">
          {d.benefits.map((b, i) => (
            <div key={i} className="grid gap-2 lg:grid-cols-[1fr_2fr_auto] items-end">
              <Input
                label={i === 0 ? "Heading" : undefined}
                value={b.title}
                onChange={(e) => {
                  const next = [...d.benefits];
                  next[i] = { ...next[i], title: e.target.value };
                  setD({ ...d, benefits: next });
                }}
                placeholder="Sharp focus"
              />
              <Input
                label={i === 0 ? "What it means" : undefined}
                value={b.description}
                onChange={(e) => {
                  const next = [...d.benefits];
                  next[i] = { ...next[i], description: e.target.value };
                  setD({ ...d, benefits: next });
                }}
                placeholder="NAD+ restores mitochondrial energy in neurons."
              />
              <Button
                variant="ghost"
                onClick={() => setD({ ...d, benefits: d.benefits.filter((_, n) => n !== i) })}
              >
                Remove
              </Button>
            </div>
          ))}
          {d.benefits.length < 6 && (
            <Button
              variant="secondary"
              onClick={() => setD({ ...d, benefits: [...d.benefits, { title: "", description: "" }] })}
            >
              Add something it helps with
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <Textarea
          label="Description"
          rows={2}
          value={d.description}
          onChange={(e) => setD({ ...d, description: e.target.value })}
        />
        <Textarea
          label="Infusion notes"
          hint="the nurse reads this before starting"
          rows={2}
          value={d.infusionNotes}
          onChange={(e) => setD({ ...d, infusionNotes: e.target.value })}
          placeholder="Run the carrier clear before the ascorbic acid is introduced."
        />
      </div>

      {/* ---------------- Ingredients ---------------- */}
      <div className="mt-6">
        <span className="t-micro block mb-1">Ingredients</span>
        <p className="t-small text-[var(--color-ink-2)] mb-3 max-w-[64ch]">
          Dose each one in a unit from the same family as the product is held in — the engine converts mg to mcg, but
          never mg to ml, and a mismatch is refused rather than guessed at.
        </p>

        <div className="flex flex-col gap-3">
          {d.ingredients.map((l, i) => {
            const master = masterById.get(l.masterId);
            const slip = master ? !unitsCompatible(l.unit, master.canonicalUnit) : false;
            return (
              <div key={i} className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
                <div className="grid gap-3 lg:grid-cols-[2fr_100px_90px_1fr_auto] items-end">
                  <Select
                    label={i === 0 ? "Product" : undefined}
                    value={l.masterId}
                    onChange={(e) => {
                      const m = masterById.get(e.target.value);
                      setLine(i, { masterId: e.target.value, unit: m?.canonicalUnit ?? l.unit });
                    }}
                  >
                    <option value="">Choose…</option>
                    {masters.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.canonicalUnit})
                      </option>
                    ))}
                  </Select>

                  <Input
                    label={i === 0 ? "Dose" : undefined}
                    type="number"
                    mono
                    value={l.dose}
                    onChange={(e) => setLine(i, { dose: e.target.value })}
                  />

                  <Select
                    label={i === 0 ? "Unit" : undefined}
                    value={l.unit}
                    onChange={(e) => setLine(i, { unit: e.target.value })}
                  >
                    {UNITS.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </Select>

                  <Select
                    label={i === 0 ? "Role" : undefined}
                    value={l.role}
                    onChange={(e) => setLine(i, { role: e.target.value })}
                  >
                    {INGREDIENT_ROLES.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </Select>

                  <Button
                    variant="ghost"
                    onClick={() => setD({ ...d, ingredients: d.ingredients.filter((_, n) => n !== i) })}
                  >
                    Remove
                  </Button>
                </div>

                {/* The note the nurse reads at the chair — "add this one
                    slowly, at the end". The field was on the record and in the
                    payload; there was simply nowhere to type it. */}
                <Input
                  label={i === 0 ? "Note for the nurse" : undefined}
                  hint={i === 0 ? "optional" : undefined}
                  value={l.notes}
                  onChange={(e) => setLine(i, { notes: e.target.value })}
                  placeholder="Add slowly, at the end"
                  className="mt-2"
                />

                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className="t-small text-[var(--color-ink-3)]">{ROLE_HELP[l.role]}</span>
                  {slip && (
                    <Pill tone="critical" dot>
                      Unit slip — {master?.name} is held in {master?.canonicalUnit}
                    </Pill>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3">
          <Button
            variant="secondary"
            onClick={() => setD({ ...d, ingredients: [...d.ingredients, blankLine()] })}
          >
            Add an ingredient
          </Button>
        </div>
      </div>

      {/* Which kit, not just whether. Some recipes need a different one, and
          the recipe could only ever say yes or no — so every drip silently took
          the default. */}
      {d.withKit && kits.length > 0 && (
        <div className="mt-6">
          <Select
            label="Which session kit"
            hint="the consumables the nurse brings"
            value={d.kitId}
            onChange={(e) => setD({ ...d, kitId: e.target.value })}
          >
            <option value="">
              The default kit{kits.find((k) => k.isDefault) ? ` — ${kits.find((k) => k.isDefault)!.name}` : ""}
            </option>
            {kits.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name} · {k.itemCount} item{k.itemCount === 1 ? "" : "s"}
                {k.isDefault ? " (default)" : ""}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 mt-6">
        <Checkbox
          label="Include the session kit"
          checked={d.withKit}
          onChange={(v) => setD({ ...d, withKit: v })}
        />
        <Checkbox
          label="Show on the public catalogue"
          checked={d.isPublic}
          onChange={(v) => setD({ ...d, isPublic: v })}
        />
        <Checkbox
          label="Needs physician approval"
          checked={d.requiresApproval}
          onChange={(v) => setD({ ...d, requiresApproval: v })}
        />
        <Checkbox label="Live" checked={d.isActive} onChange={(v) => setD({ ...d, isActive: v })} />
      </div>

      {error && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3 mt-5">
          <span className="t-body text-[var(--color-ink-2)]">{error}</span>
        </div>
      )}

      <div className="flex gap-2 mt-6 flex-wrap">
        <Button
          size="md"
          loading={busy}
          disabled={!d.name || d.ingredients.filter((l) => l.masterId && l.dose).length === 0}
          onClick={save}
        >
          {editing ? "Save the recipe" : "Create the drip"}
        </Button>
        {editing && (
          <Button variant="danger" loading={busy} onClick={remove}>
            Remove
          </Button>
        )}
      </div>
    </Card>
  );
}

/** Mirrors the server's unit-family rule so the slip is shown before saving. */
function unitsCompatible(a: string, b: string): boolean {
  const family = (u: string) =>
    ["mcg", "mg", "g"].includes(u) ? "mass" : u === "ml" ? "volume" : u === "IU" ? "activity" : "count";
  return family(a) === family(b);
}

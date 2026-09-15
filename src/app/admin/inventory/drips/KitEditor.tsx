"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";

type Master = { id: string; name: string; category: string };
type Item = { masterId: string; qty: string };

/**
 * The session kit is deducted per drip prepared, so its contents are part of
 * every availability figure. Consumables are offered first; anything else is
 * still allowed, because a kit can legitimately carry a pre-med.
 */
export function KitEditor({
  kit,
  masters,
}: {
  kit: { id: string; name: string; description?: string; items: Array<{ masterId: string; qty: number }> };
  masters: Master[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(kit.name);
  const [items, setItems] = useState<Item[]>(kit.items.map((i) => ({ masterId: i.masterId, qty: String(i.qty) })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consumables = masters.filter((m) => m.category === "CONSUMABLE");
  const others = masters.filter((m) => m.category !== "CONSUMABLE");
  const nameOf = (id: string) => masters.find((m) => m.id === id)?.name ?? "Unknown item";

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/kits/${kit.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          items: items
            .filter((i) => i.masterId)
            .map((i) => ({ masterId: i.masterId, qty: Math.max(1, Number(i.qty) || 1) })),
        }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not save the kit");
      else {
        setOpen(false);
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. Nothing was saved.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Card padding="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-3 flex-1 min-w-[240px]">
            {kit.items.map((item, i) => (
              <div key={i} className="flex justify-between gap-4 items-baseline">
                <span className="t-body text-[var(--color-ink-2)]">{nameOf(item.masterId)}</span>
                <span className="t-data text-[14.5px]">{item.qty} per drip</span>
              </div>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            Edit the kit
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="p-6">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <h3 className="t-h3">Edit {kit.name}</h3>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>

      <Input label="Kit name" value={name} onChange={(e) => setName(e.target.value)} />

      <div className="flex flex-col gap-3 mt-4">
        {items.map((item, i) => (
          <div key={i} className="grid gap-3 sm:grid-cols-[1fr_120px_auto] items-end">
            <Select
              label={i === 0 ? "Item" : undefined}
              value={item.masterId}
              onChange={(e) => setItems(items.map((x, n) => (n === i ? { ...x, masterId: e.target.value } : x)))}
            >
              <option value="">Choose…</option>
              <optgroup label="Consumables">
                {consumables.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
              {others.length > 0 && (
                <optgroup label="Everything else">
                  {others.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>
            <Input
              label={i === 0 ? "Per drip" : undefined}
              type="number"
              min={1}
              mono
              value={item.qty}
              onChange={(e) => setItems(items.map((x, n) => (n === i ? { ...x, qty: e.target.value } : x)))}
            />
            <Button variant="ghost" onClick={() => setItems(items.filter((_, n) => n !== i))}>
              Remove
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <Button variant="secondary" onClick={() => setItems([...items, { masterId: "", qty: "1" }])}>
          Add an item
        </Button>
      </div>

      {error && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3 mt-4">
          <span className="t-body text-[var(--color-ink-2)]">{error}</span>
        </div>
      )}

      <div className="mt-5">
        <Button loading={busy} disabled={!name || items.filter((i) => i.masterId).length === 0} onClick={save}>
          Save the kit
        </Button>
      </div>
    </Card>
  );
}

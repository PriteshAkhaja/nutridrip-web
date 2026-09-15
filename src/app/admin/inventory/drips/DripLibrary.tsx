"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DripPicker } from "@/components/ui/DripPicker";
import { DripEditor, emptyDrip, type DripDraft } from "./DripEditor";

type Master = { id: string; name: string; canonicalUnit: string; category: string };

/** Holds the editor open over the library, so the list stays as the backdrop. */
export function DripLibrary({
  masters,
  kits = [],
  drips,
}: {
  masters: Master[];
  kits?: Array<{ id: string; name: string; isDefault: boolean; itemCount: number }>;
  drips: DripDraft[];
}) {
  const [editing, setEditing] = useState<DripDraft | null>(null);

  if (editing) {
    return <DripEditor masters={masters} kits={kits} initial={editing} onClose={() => setEditing(null)} />;
  }

  return (
    <div className="flex gap-2 flex-wrap items-center">
      <Button onClick={() => setEditing(emptyDrip())} disabled={masters.length === 0}>
        Create a drip
      </Button>
      {drips.length > 0 && (
        <div className="min-w-[280px]">
          <DripPicker
            label=""
            value=""
            emptyLabel="Edit an existing drip…"
            onChange={(id) => {
              const d = drips.find((x) => x.id === id);
              if (d) setEditing(d);
            }}
            options={drips.map((d) => ({
              id: d.id ?? "",
              name: d.name,
              // A recipe is most often looked up by what is in it.
              keywords: d.ingredients.map((i) => masters.find((m) => m.id === i.masterId)?.name),
              detail: d.isActive ? undefined : "retired",
            }))}
          />
        </div>
      )}
    </div>
  );
}

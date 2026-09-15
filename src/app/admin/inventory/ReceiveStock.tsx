"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select, Checkbox, Textarea } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import { CATEGORIES, UNITS, UNIT_FORMS } from "@/lib/models/types";

const CATEGORY_LABEL: Record<string, string> = {
  DRUG: "Drug",
  FLUID: "Fluid",
  CONSUMABLE: "Consumable",
  PREMED: "Pre-med",
};

/**
 * Two jobs that people confuse: defining a drug, and receiving a physical
 * batch of it. The tabs keep them apart, because a master is created once and
 * batches arrive against it forever after.
 */
export function ReceiveStock({
  masters,
}: {
  masters: Array<{ id: string; name: string; canonicalUnit: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<"none" | "master" | "lot">("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [master, setMaster] = useState({
    name: "",
    molecule: "",
    hsnCode: "",
    gstRate: "12",
    category: "DRUG",
    canonicalUnit: "mg",
    reorderLevel: "20",
    isMultidose: false,
    storageCondition: "",
    notes: "",
  });

  const [lot, setLot] = useState({
    masterId: masters[0]?.id ?? "",
    brandName: "",
    manufacturer: "",
    batchNo: "",
    expiry: "",
    contentValue: "",
    contentUnit: "mg",
    unitForm: "Vial",
    qtyReceived: "",
    packVolumeMl: "",
    costPerUnit: "",
    mrp: "",
  });

  const selectedMaster = masters.find((m) => m.id === lot.masterId);

  const post = async (url: string, body: unknown, ok: (d: Record<string, unknown>) => string) => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "That did not save");
      else {
        setDone(ok(json.data));
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. Nothing was saved.");
    } finally {
      setBusy(false);
    }
  };

  if (open === "none") {
    return (
      <div className="flex gap-2 flex-wrap">
        <Button onClick={() => setOpen("lot")} disabled={masters.length === 0}>
          Receive a batch
        </Button>
        <Button variant="secondary" onClick={() => setOpen("master")}>
          Define a new product
        </Button>
      </div>
    );
  }

  return (
    <Card padding="p-6" className="w-full">
      <div className="flex items-baseline justify-between gap-4 mb-2 flex-wrap">
        <h2 className="t-h3">{open === "lot" ? "Receive a batch" : "Define a product"}</h2>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setOpen(open === "lot" ? "master" : "lot")}>
            {open === "lot" ? "Define a product instead" : "Receive a batch instead"}
          </Button>
          <Button variant="ghost" onClick={() => setOpen("none")}>
            Close
          </Button>
        </div>
      </div>

      <p className="t-body text-[var(--color-ink-2)] mb-5 max-w-[70ch]">
        {open === "lot"
          ? "A batch is physical stock arriving against a product that already exists. Its expiry and strength are its own — two batches of the same drug can differ in both."
          : "A product is the drug's identity: what it is called, its HSN code, and the unit it is dosed in. It holds no stock itself; batches do that."}
      </p>

      {done && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-safe)] bg-[var(--color-safe-soft)] px-4 py-3 mb-5">
          <span className="t-body text-[var(--color-ink-2)]">{done}</span>
        </div>
      )}

      {open === "master" ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Input
              label="Drug name"
              value={master.name}
              onChange={(e) => setMaster({ ...master, name: e.target.value })}
              placeholder="Ascorbic acid"
            />
            <Input
              label="Molecule"
              hint="optional, for grouping"
              value={master.molecule}
              onChange={(e) => setMaster({ ...master, molecule: e.target.value })}
              placeholder="Vitamin C"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-4 mt-4">
            <Input
              label="HSN code"
              mono
              value={master.hsnCode}
              onChange={(e) => setMaster({ ...master, hsnCode: e.target.value })}
              placeholder="30045020"
            />
            <Input
              label="GST %"
              type="number"
              mono
              value={master.gstRate}
              onChange={(e) => setMaster({ ...master, gstRate: e.target.value })}
            />
            <Select
              label="Category"
              value={master.category}
              onChange={(e) => setMaster({ ...master, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
            <Select
              label="Dosed in"
              value={master.canonicalUnit}
              onChange={(e) => setMaster({ ...master, canonicalUnit: e.target.value })}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 mt-4">
            <Input
              label="Reorder level"
              hint="alert below this many units"
              type="number"
              mono
              value={master.reorderLevel}
              onChange={(e) => setMaster({ ...master, reorderLevel: e.target.value })}
            />
            <Input
              label="Storage"
              value={master.storageCondition}
              onChange={(e) => setMaster({ ...master, storageCondition: e.target.value })}
              placeholder="2–8 °C, protect from light"
            />
          </div>

          <div className="mt-4">
            <Checkbox
              label="Multidose — a part-used unit can serve the next patient"
              checked={master.isMultidose}
              onChange={(v) => setMaster({ ...master, isMultidose: v })}
            />
            <p className="t-small text-[var(--color-ink-3)] mt-1 max-w-[62ch]">
              This is the single most consequential field here. A single-use vial wastes whatever is left after one
              dose, and that waste is what makes the realistic count lower than the arithmetic.
            </p>
          </div>

          {/* Anything about this drug that is not a number — a handling rule,
              a supplier quirk. The field was on the record with no box for it. */}
          <div className="mt-4">
            <Textarea
              label="Notes"
              hint="optional"
              rows={2}
              value={master.notes}
              onChange={(e) => setMaster({ ...master, notes: e.target.value })}
              placeholder="Anything a pharmacist should know before ordering or handling this."
            />
          </div>

          {error && (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3 mt-5">
              <span className="t-body text-[var(--color-ink-2)]">{error}</span>
            </div>
          )}

          <div className="mt-6">
            <Button
              size="md"
              loading={busy}
              disabled={!master.name || !master.hsnCode}
              onClick={() =>
                post(
                  "/api/inventory/masters",
                  {
                    ...master,
                    gstRate: Number(master.gstRate),
                    reorderLevel: Number(master.reorderLevel),
                    molecule: master.molecule || undefined,
                    storageCondition: master.storageCondition || undefined,
                    notes: master.notes || undefined,
                  },
                  (d) => `${(d.master as { name: string }).name} is defined. Now receive a batch against it.`
                )
              }
            >
              Define the product
            </Button>
          </div>
        </>
      ) : (
        <>
          <Select
            label="Product"
            value={lot.masterId}
            onChange={(e) => setLot({ ...lot, masterId: e.target.value })}
          >
            {masters.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — dosed in {m.canonicalUnit}
              </option>
            ))}
          </Select>

          <div className="grid gap-4 lg:grid-cols-2 mt-4">
            <Input
              label="Brand"
              value={lot.brandName}
              onChange={(e) => setLot({ ...lot, brandName: e.target.value })}
              placeholder="Ascorvit 7.5"
            />
            <Input
              label="Manufacturer"
              value={lot.manufacturer}
              onChange={(e) => setLot({ ...lot, manufacturer: e.target.value })}
              placeholder="Neon Labs"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2 mt-4">
            <Input
              label="Batch number"
              mono
              value={lot.batchNo}
              onChange={(e) => setLot({ ...lot, batchNo: e.target.value })}
              placeholder="VC-B9"
            />
            <Input
              label="Expiry"
              type="date"
              mono
              value={lot.expiry}
              onChange={(e) => setLot({ ...lot, expiry: e.target.value })}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-4 mt-4">
            <Input
              label="Content per unit"
              hint={selectedMaster ? `in ${selectedMaster.canonicalUnit}` : undefined}
              type="number"
              mono
              value={lot.contentValue}
              onChange={(e) => setLot({ ...lot, contentValue: e.target.value })}
              placeholder="7500"
            />
            {/* How much liquid is physically in the vial, which is not the same
                as how much drug is in it — 7,500 mg can sit in 5 ml. */}
            <Input
              label="Pack volume"
              hint="ml, optional"
              type="number"
              mono
              value={lot.packVolumeMl}
              onChange={(e) => setLot({ ...lot, packVolumeMl: e.target.value })}
              placeholder="5"
            />
            <Select
              label="Unit"
              value={lot.contentUnit}
              onChange={(e) => setLot({ ...lot, contentUnit: e.target.value })}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
            <Select
              label="Form"
              value={lot.unitForm}
              onChange={(e) => setLot({ ...lot, unitForm: e.target.value })}
            >
              {UNIT_FORMS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
            <Input
              label="Quantity"
              type="number"
              mono
              value={lot.qtyReceived}
              onChange={(e) => setLot({ ...lot, qtyReceived: e.target.value })}
              placeholder="240"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2 mt-4">
            <Input
              label="Cost per unit"
              hint="optional"
              type="number"
              mono
              value={lot.costPerUnit}
              onChange={(e) => setLot({ ...lot, costPerUnit: e.target.value })}
            />
            <Input
              label="MRP"
              hint="optional"
              type="number"
              mono
              value={lot.mrp}
              onChange={(e) => setLot({ ...lot, mrp: e.target.value })}
            />
          </div>

          {error && (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3 mt-5">
              <span className="t-body text-[var(--color-ink-2)]">{error}</span>
            </div>
          )}

          <div className="mt-6">
            <Button
              size="md"
              loading={busy}
              disabled={!lot.masterId || !lot.batchNo || !lot.expiry || !lot.contentValue || !lot.qtyReceived}
              onClick={() =>
                post(
                  `/api/inventory/masters/${lot.masterId}/lots`,
                  {
                    brandName: lot.brandName,
                    manufacturer: lot.manufacturer || undefined,
                    batchNo: lot.batchNo,
                    expiry: lot.expiry,
                    contentValue: Number(lot.contentValue),
                    contentUnit: lot.contentUnit,
                    unitForm: lot.unitForm,
                    qtyReceived: Number(lot.qtyReceived),
                    packVolumeMl: lot.packVolumeMl ? Number(lot.packVolumeMl) : undefined,
                    costPerUnit: lot.costPerUnit ? Number(lot.costPerUnit) : undefined,
                    mrp: lot.mrp ? Number(lot.mrp) : undefined,
                  },
                  (d) => {
                    const l = d.lot as { batchNo: string; qtyOnHand: number; daysToExpiry: number };
                    return `${l.batchNo} received — ${l.qtyOnHand} units, ${l.daysToExpiry} days to expiry. It is now available to the engine.`;
                  }
                )
              }
            >
              Receive the batch
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

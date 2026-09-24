"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { DataTable, THead, TR, TH, TD } from "@/components/ui/Table";
import {
  ZONE_STATUS_LABEL,
  cleanPincode,
  parsePincodes,
  zoneProblems,
  type Zone,
  type ZoneInput,
  type ZoneStatus,
} from "@/lib/zones";
import { SLOT_STEPS, slotTimes, stepLabel } from "@/lib/clinical/slots";

export type ZoneRow = Zone & { id: string; nurses: number };

type Form = ZoneInput & { pincodes: string };

const EMPTY: Form = {
  name: "",
  pincodes: "",
  opensAt: "08:00",
  closesAt: "19:00",
  slotMinutes: 60,
  status: "open",
};

const TONE: Record<ZoneStatus, PillTone> = {
  open: "safe",
  limited: "caution",
  paused: "neutral",
};

function StatusPill({ status }: { status: ZoneStatus }) {
  return (
    <Pill tone={TONE[status]} dot={status !== "paused"}>
      {ZONE_STATUS_LABEL[status]}
    </Pill>
  );
}

/**
 * The super admin's list of service zones: what each covers, and the form to
 * add or change one. The same rules the server applies (lib/zones) run here as
 * you type, so a pincode already in another zone is caught before Save.
 */
export function ZoneEditor({ zones }: { zones: ZoneRow[] }) {
  const router = useRouter();
  /** The zone being edited, "new" for the add form, or nothing open. */
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [lookup, setLookup] = useState("");
  const formRef = useRef<HTMLDivElement>(null);

  const current = zones.find((z) => z.id === editing) ?? null;
  const others = zones.filter((z) => z.id !== editing);
  const problems = zoneProblems(form, others);
  const valid = Object.keys(problems).length === 0;
  const pinCount = parsePincodes(form.pincodes).length;
  // What a patient will be offered with these hours, shown as it is typed.
  const times = problems.opensAt || problems.closesAt || problems.slotMinutes ? [] : slotTimes(form);

  const open = (zone: ZoneRow | null) => {
    setEditing(zone ? zone.id : "new");
    setForm(
      zone
        ? {
            name: zone.name,
            pincodes: zone.pincodes.join(", "),
            opensAt: zone.opensAt,
            closesAt: zone.closesAt,
            slotMinutes: zone.slotMinutes,
            status: zone.status,
          }
        : EMPTY,
    );
    setTouched(false);
    setConfirmDelete(false);
    setError(null);
    setDone(null);
    // The form opens above the table; editing a zone far down the list would
    // otherwise open it out of sight.
    requestAnimationFrame(() =>
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };
  const close = () => {
    setEditing(null);
    setError(null);
    setConfirmDelete(false);
  };

  const set = (k: keyof Form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const send = async (method: "POST" | "PATCH" | "DELETE") => {
    const url =
      method === "POST" ? "/api/admin/zones" : `/api/admin/zones/${editing}`;
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: method === "DELETE" ? undefined : JSON.stringify(form),
    });
    return res.json();
  };

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    setBusy("save");
    setError(null);
    try {
      const json = await send(editing === "new" ? "POST" : "PATCH");
      if (!json.success) setError(json.error ?? "Could not save that");
      else {
        const renamed = json.data?.nursesRenamed ?? 0;
        setDone(
          `${form.name.trim()} saved.${renamed ? ` ${renamed} ${renamed === 1 ? "nurse" : "nurses"} moved to the new name.` : ""}`,
        );
        setEditing(null);
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. Nothing was changed.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy("delete");
    setError(null);
    try {
      const json = await send("DELETE");
      if (!json.success) setError(json.error ?? "Could not delete that");
      else {
        setDone(`${current?.name ?? "The zone"} deleted.`);
        setEditing(null);
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. Nothing was changed.");
    } finally {
      setBusy(null);
      setConfirmDelete(false);
    }
  };

  // "Do we come to 560064?" — the question this page most often answers.
  const pin = cleanPincode(lookup);
  const found =
    pin.length === 6 ? zones.find((z) => z.pincodes.includes(pin)) : null;

  const show = (k: keyof Form) => (touched ? problems[k] : undefined);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-2 w-full max-w-[340px]">
          <Input
            label="Check a pincode"
            mono
            inputMode="numeric"
            maxLength={7}
            placeholder="560034"
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
          />
          {pin.length === 6 && (
            <span
              className="t-small"
              style={{
                color: !found
                  ? "var(--color-critical-text)"
                  : found.status === "paused"
                    ? "var(--color-ink-2)"
                    : "var(--color-safe-text)",
              }}
            >
              {!found
                ? `${pin} is not in any zone — a patient there is told we do not serve it.`
                : found.status === "paused"
                  ? `${pin} is in ${found.name}, which is paused — not offered to patients.`
                  : `${pin} is in ${found.name} · ${found.window}`}
            </span>
          )}
        </div>
        {editing === null && (
          <Button onClick={() => open(null)}>Add a zone</Button>
        )}
      </div>

      {done && editing === null && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-safe)] bg-[var(--color-safe-soft)] px-4 py-3">
          <span className="t-body text-[var(--color-ink-2)]">{done}</span>
        </div>
      )}

      {editing !== null && (
        <div ref={formRef} className="scroll-mt-20">
          <Card padding="p-6">
            <h2 className="t-h3">
              {current ? `Edit ${current.name}` : "Add a zone"}
            </h2>
            <p className="t-body text-[var(--color-ink-2)] mt-1 max-w-[64ch]">
              {current
                ? current.nurses > 0
                  ? `${current.nurses} ${current.nurses === 1 ? "nurse covers" : "nurses cover"} this zone. A new name is carried over to them.`
                  : "No nurse covers this zone yet. Tick it for a nurse in People."
                : "Patients in these pincodes can book as soon as it is saved. Then tick the zone for the nurses who cover it, in People."}
            </p>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 mt-5">
              <Input
                label="Name"
                placeholder="e.g. Yelahanka"
                value={form.name}
                error={show("name")}
                onChange={set("name")}
              />
              <Select
                label="Status"
                value={form.status}
                onChange={set("status")}
              >
                <option value="open">Full cover</option>
                <option value="limited">
                  Limited — we serve it, with shorter hours
                </option>
                <option value="paused">
                  Paused — kept, but not offered to patients
                </option>
              </Select>
              <div className="lg:col-span-2">
                <Textarea
                  label={`Pincodes${pinCount ? ` · ${pinCount}` : ""}`}
                  hint="six digits each, separated by commas or new lines"
                  rows={3}
                  className="font-[var(--font-mono)] font-medium tabular-nums"
                  placeholder="560064, 560063"
                  value={form.pincodes}
                  error={show("pincodes")}
                  onChange={set("pincodes")}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Opens"
                  type="time"
                  value={form.opensAt}
                  error={show("opensAt")}
                  onChange={set("opensAt")}
                />
                <Input
                  label="Closes"
                  type="time"
                  value={form.closesAt}
                  error={show("closesAt")}
                  onChange={set("closesAt")}
                />
              </div>
              <div className="flex flex-col gap-[7px]">
                <Select
                  label="Times offered"
                  value={String(form.slotMinutes)}
                  error={show("slotMinutes")}
                  onChange={(e) => setForm((f) => ({ ...f, slotMinutes: Number(e.target.value) }))}
                >
                  {SLOT_STEPS.map((m) => (
                    <option key={m} value={m}>
                      {stepLabel(m).replace(/^every/, "Every")}
                    </option>
                  ))}
                </Select>
                {/* What a patient will see, so the step is judged by its result. */}
                {times.length > 0 && (
                  <span className="t-small text-[var(--color-ink-3)]">
                    Patients see {times.length === 1 ? times[0] : `${times[0]}, ${times[1]}${times.length > 2 ? ` … ${times[times.length - 1]}` : ""}`} ·{" "}
                    {times.length} a day
                  </span>
                )}
              </div>
            </div>

            {error && (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3 mt-5">
                <span className="t-body text-[var(--color-ink-2)]">
                  {error}
                </span>
              </div>
            )}

            <div className="flex items-center gap-3 mt-6 flex-wrap">
              <Button loading={busy === "save"} onClick={save}>
                {current ? "Save changes" : "Add zone"}
              </Button>
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
              {touched && !valid && (
                <span className="t-small text-[var(--color-critical-text)]">
                  Fix the fields marked above.
                </span>
              )}
              {current && (
                <span className="ml-auto flex items-center gap-3 flex-wrap">
                  {current.nurses > 0 ? (
                    <span className="t-small text-[var(--color-ink-3)] max-w-[36ch] text-right">
                      Cannot be deleted while a nurse covers it — pause it
                      instead.
                    </span>
                  ) : confirmDelete ? (
                    <>
                      <span className="t-small text-[var(--color-ink-2)]">
                        Delete {current.name} for good?
                      </span>
                      <Button
                        variant="ghost"
                        onClick={() => setConfirmDelete(false)}
                      >
                        Keep it
                      </Button>
                      <Button
                        variant="danger"
                        loading={busy === "delete"}
                        onClick={remove}
                      >
                        Delete
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="destructive"
                      onClick={() => setConfirmDelete(true)}
                    >
                      Delete zone
                    </Button>
                  )}
                </span>
              )}
            </div>
          </Card>
        </div>
      )}

      <DataTable>
        <THead>
          <TR>
            <TH>Zone</TH>
            <TH>Pincodes</TH>
            <TH>Hours</TH>
            <TH>Status</TH>
            <TH numeric>Nurses</TH>
            <TH>
              <span className="sr-only">Edit</span>
            </TH>
          </TR>
        </THead>
        <tbody>
          {zones.map((z) => (
            <TR key={z.id}>
              <TD>
                <span className="font-medium">{z.name}</span>
              </TD>
              <TD>
                <span className="t-data text-[13px]">
                  {z.pincodes.join(", ")}
                </span>
              </TD>
              <TD>
                <span className="t-data text-[13px] block">{z.window}</span>
                <span className="t-small text-[var(--color-ink-3)]">{stepLabel(z.slotMinutes)}</span>
              </TD>
              <TD>
                <StatusPill status={z.status} />
              </TD>
              <TD numeric>
                <span className="t-data text-[13px]">
                  {z.nurses > 0 ? z.nurses : "None"}
                </span>
              </TD>
              <TD>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => open(z)}
                  disabled={editing === z.id}
                >
                  Edit
                </Button>
              </TD>
            </TR>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}

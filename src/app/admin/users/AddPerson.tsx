"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { PersonFields, EMPTY_PERSON, type PersonForm } from "./PersonFields";
import { Card } from "@/components/ui/Card";
import { ROLES, type Role } from "@/lib/models/types";

const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Super admin",
  admin: "Admin",
  doctor: "Doctor",
  nurse: "Nurse",
  clinic: "Partner clinic",
  patient: "Patient",
};

/** What each role is for, said plainly — this form is where people learn it. */
const ROLE_BLURB: Record<Role, string> = {
  superadmin: "Full control, including creating accounts and receiving stock.",
  admin: "Runs operations — orders, dispatch, alerts and enquiries. Cannot create accounts.",
  doctor: "Reviews assessments and approves protocols. Their registration number goes on every report they sign.",
  nurse: "Attends sessions and works the 29-step checklist. Give them a home base so dispatch can rank them by distance.",
  clinic: "A partner running sessions from their own rooms. They order stock and see only their own bookings.",
  patient: "An ordinary patient account. Patients normally create their own by signing in with a phone number.",
};


export function AddPerson({ doctors = [] }: { doctors?: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>("nurse");
  const [form, setForm] = useState<PersonForm>(EMPTY_PERSON);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  /**
   * Ticked from the real zone list, not typed. Dispatch matches these against
   * zone names EXACTLY, so "HSR layout" silently covered nowhere at all.
   */
  const [areas, setAreas] = useState<string[]>([]);
  const toggleArea = (zone: string) =>
    setAreas((a) => (a.includes(zone) ? a.filter((z) => z !== zone) : [...a, zone]));

  const set = (k: keyof PersonForm) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role,
          name: form.name,
          email: form.email || undefined,
          phone: form.phone || undefined,
          password: form.password || undefined,
          specialization: form.specialization || undefined,
          licenseNo: form.licenseNo || undefined,
          registrationCouncil: form.registrationCouncil || undefined,
          serviceAreas: areas.length ? areas : undefined,
          doctorId: form.doctorId || undefined,
          latitude: form.latitude ? Number(form.latitude) : undefined,
          longitude: form.longitude ? Number(form.longitude) : undefined,
          address: form.address || undefined,
          city: form.city || undefined,
          pincode: form.pincode || undefined,
          gstin: form.gstin || undefined,
          monthlyVolumeTarget: form.monthlyVolumeTarget ? Number(form.monthlyVolumeTarget) : undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not create that account");
      else {
        setDone(`${json.data.user.name} can now sign in as a ${ROLE_LABEL[role].toLowerCase()}.`);
        setForm({ ...form, name: "", email: "", phone: "", password: "", licenseNo: "" });
        setAreas([]);
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. No account was created.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return <Button onClick={() => setOpen(true)}>Add a person</Button>;
  }

  return (
    <Card padding="p-6" className="w-full">
      <div className="flex items-baseline justify-between gap-4 mb-5">
        <h2 className="t-h3">Add a person</h2>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>

      {done && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-safe)] bg-[var(--color-safe-soft)] px-4 py-3 mb-5">
          <span className="t-body text-[var(--color-ink-2)]">{done}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </Select>
        <Input label="Full name" value={form.name} onChange={set("name")} placeholder="Dr. Sarah Menon" />
      </div>

      <p className="t-small text-[var(--color-ink-2)] mt-2 mb-5 max-w-[62ch]">{ROLE_BLURB[role]}</p>

      <PersonFields
        role={role}
        form={form}
        set={set}
        areas={areas}
        toggleArea={toggleArea}
        doctors={doctors}
        mode="create"
      />

      {error && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3 mt-5">
          <span className="t-body text-[var(--color-ink-2)]">{error}</span>
        </div>
      )}

      <div className="mt-6">
        <Button size="md" loading={busy} disabled={!form.name} onClick={submit}>
          Create the account
        </Button>
      </div>
    </Card>
  );
}

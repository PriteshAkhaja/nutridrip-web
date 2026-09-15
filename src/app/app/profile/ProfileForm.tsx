"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { AddressPicker, type PickedAddress } from "@/components/ui/AddressPicker";

export type ProfileInitial = {
  name: string;
  email: string;
  phone: string;
  dob: string;
  gender: string;
  bloodGroup: string;
  heightCm: string;
  weightKg: string;
  address: string;
  city: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  emergencyContactName: string;
  emergencyContactPhone: string;
  allergies: string;
  chronicConditions: string;
  currentMedications: string;
  surgeries: string;
  familyHistory: string;
};

const BLOOD_GROUPS = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

/**
 * The patient's own record, edited by the patient. Allergies, conditions and
 * medication are the lines a nurse reads aloud, so they are given the most
 * room and the plainest labels.
 */
export function ProfileForm({
  initial,
  mapsKey,
  searchEnabled,
}: {
  initial: ProfileInitial;
  mapsKey: string | null;
  searchEnabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (k: keyof ProfileInitial) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  /** The four the onboarding gate insists on. Emptying any of them here would
   *  save, then bounce the patient to /welcome on the next page load — so the
   *  button is held shut and the server refuses it too. */
  const missing = [
    form.name.trim() ? null : "your name",
    form.address.trim() ? null : "your address",
    form.city.trim() ? null : "your city",
    /^\d{6}$/.test(form.pincode) ? null : "a six-digit pincode",
  ].filter(Boolean) as string[];

  const place: PickedAddress = {
    address: form.address,
    city: form.city,
    pincode: form.pincode,
    latitude: form.latitude,
    longitude: form.longitude,
  };
  const setPlace = (next: PickedAddress) => setForm((f) => ({ ...f, ...next }));

  const save = async () => {
    // Belt and braces: the server refuses this too, but there is no reason to
    // let the request leave at all.
    if (missing.length > 0) {
      setError(`We still need ${missing.join(", ")} — a nurse has to have somewhere to come.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          dob: form.dob,
          gender: form.gender || undefined,
          bloodGroup: form.bloodGroup,
          heightCm: form.heightCm ? Number(form.heightCm) : null,
          weightKg: form.weightKg ? Number(form.weightKg) : null,
          address: form.address,
          city: form.city,
          pincode: form.pincode,
          latitude: form.latitude,
          longitude: form.longitude,
          emergencyContactName: form.emergencyContactName,
          emergencyContactPhone: form.emergencyContactPhone,
          allergies: form.allergies,
          chronicConditions: form.chronicConditions,
          currentMedications: form.currentMedications,
          surgeries: form.surgeries,
          familyHistory: form.familyHistory,
        }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not save your details");
      else {
        setSaved(true);
        setOpen(false);
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="flex flex-col gap-3">
        {saved && (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-safe)] bg-[var(--color-safe-soft)] px-4 py-3">
            <span className="t-body text-[var(--color-ink-2)]">Saved. Your nurse and physician see the new details.</span>
          </div>
        )}
        <Button variant="secondary" block onClick={() => setOpen(true)}>
          Edit my details
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="t-h3">Your details</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="t-small text-[var(--color-ink-2)] bg-transparent border-0 p-0 cursor-pointer underline"
        >
          Cancel
        </button>
      </div>

      <section className="flex flex-col gap-3">
        <span className="t-micro">You</span>
        <Input label="Name" value={form.name} onChange={set("name")} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Phone" mono type="tel" value={form.phone} onChange={set("phone")} />
          <Input label="Email" type="email" value={form.email} onChange={set("email")} placeholder="optional" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Date of birth" type="date" mono value={form.dob} onChange={set("dob")} />
          <Select label="Sex" value={form.gender} onChange={set("gender")}>
            <option value="">—</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
            <option value="undisclosed">Prefer not to say</option>
          </Select>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Select label="Blood group" value={form.bloodGroup} onChange={set("bloodGroup")}>
            {BLOOD_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g || "—"}
              </option>
            ))}
          </Select>
          <Input label="Height" hint="cm" type="number" mono value={form.heightCm} onChange={set("heightCm")} />
          <Input label="Weight" hint="kg" type="number" mono value={form.weightKg} onChange={set("weightKg")} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <span className="t-micro">Where a nurse comes</span>
        <AddressPicker value={place} onChange={setPlace} mapsKey={mapsKey} searchEnabled={searchEnabled} />
      </section>

      <section className="flex flex-col gap-3">
        <span className="t-micro">In an emergency</span>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Contact" value={form.emergencyContactName} onChange={set("emergencyContactName")} />
          <Input label="Their number" mono type="tel" value={form.emergencyContactPhone} onChange={set("emergencyContactPhone")} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <span className="t-micro">What a nurse reads aloud</span>
        <Textarea label="Allergies" rows={2} value={form.allergies} onChange={set("allergies")} placeholder="Write them exactly as you were told, or None" />
        <Textarea label="Ongoing conditions" rows={2} value={form.chronicConditions} onChange={set("chronicConditions")} />
        <Textarea label="Current medication" hint="including over the counter" rows={2} value={form.currentMedications} onChange={set("currentMedications")} />
        <Textarea label="Past surgeries" rows={2} value={form.surgeries} onChange={set("surgeries")} />
        <Textarea label="Family history" hint="optional" rows={2} value={form.familyHistory} onChange={set("familyHistory")} />
      </section>

      {error && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3">
          <span className="t-body text-[var(--color-ink-2)]">{error}</span>
        </div>
      )}

      {missing.length > 0 && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-caution)] bg-[var(--color-caution-soft)] px-4 py-3">
          <span className="t-body text-[var(--color-ink-2)]">
            We still need {missing.join(", ")} before this can be saved — a nurse has to have somewhere to come.
          </span>
        </div>
      )}

      <Button size="lg" block loading={busy} disabled={missing.length > 0} onClick={save}>
        Save my details
      </Button>
    </div>
  );
}

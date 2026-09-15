"use client";

import { Input, Select } from "@/components/ui/Field";
import { ZONE_NAMES } from "@/lib/zones";
import type { Role } from "@/lib/models/types";
import { checkGstin, stateCodeFromGstin, stateName } from "@/lib/billing/gst";

/**
 * Every field an account can carry, in one place.
 *
 * Creating and editing a person show the SAME fields, because the alternative
 * is what this replaced: a create form with fifteen fields and an edit panel
 * with five, so a nurse's phone number or home base could be set once and never
 * corrected. Two forms over one record is how they drift.
 */

export type PersonForm = {
  name: string;
  email: string;
  phone: string;
  password: string;
  specialization: string;
  licenseNo: string;
  registrationCouncil: string;
  doctorId: string;
  latitude: string;
  longitude: string;
  address: string;
  city: string;
  pincode: string;
  gstin: string;
  monthlyVolumeTarget: string;
};

export const EMPTY_PERSON: PersonForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  specialization: "",
  licenseNo: "",
  registrationCouncil: "Karnataka Medical Council",
  doctorId: "",
  latitude: "",
  longitude: "",
  address: "",
  city: "Bengaluru",
  pincode: "",
  gstin: "",
  monthlyVolumeTarget: "",
};

export const NEEDS_PASSWORD: Role[] = ["superadmin", "admin", "doctor", "nurse", "clinic"];

export function PersonFields({
  role,
  form,
  set,
  areas,
  toggleArea,
  doctors,
  mode,
}: {
  role: Role;
  form: PersonForm;
  set: (k: keyof PersonForm) => (e: { target: { value: string } }) => void;
  areas: string[];
  toggleArea: (zone: string) => void;
  doctors: Array<{ id: string; name: string }>;
  mode: "create" | "edit";
}) {
  // Only a clinic carries one, but computing it unconditionally keeps the
  // hooks-free path simple — checkGstin("") is not an error.
  const gstinCheck = checkGstin(form.gstin);
  const gstinHome = stateName(stateCodeFromGstin(form.gstin));

  const editing = mode === "edit";

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Input
          label="Email"
          /* Changing a sign-in address is an account takeover in one field, so
             it is deliberately not editable here. */
          hint={editing ? "not changeable" : NEEDS_PASSWORD.includes(role) ? "how they sign in" : "optional"}
          type="email"
          value={form.email}
          onChange={set("email")}
          disabled={editing}
        />
        <Input
          label="Phone"
          hint={role === "patient" ? "how they sign in" : "optional"}
          mono
          type="tel"
          value={form.phone}
          onChange={set("phone")}
        />
      </div>

      {NEEDS_PASSWORD.includes(role) && (
        <div className="mt-4">
          <Input
            label={editing ? "New password" : "Temporary password"}
            hint={editing ? "leave blank to keep" : "at least 8 characters"}
            type="text"
            mono
            value={form.password}
            onChange={set("password")}
            placeholder={editing ? "" : "Give it to them directly, not by email"}
          />
        </div>
      )}

      {role === "doctor" && (
        <div className="grid gap-4 lg:grid-cols-3 mt-4">
          <Input label="Specialisation" value={form.specialization} onChange={set("specialization")} />
          <Input
            label="Council number"
            mono
            value={form.licenseNo}
            onChange={set("licenseNo")}
            placeholder="KMC/2016/44219"
          />
          <Input label="Council" value={form.registrationCouncil} onChange={set("registrationCouncil")} />
        </div>
      )}

      {role === "nurse" && (
        <>
          <div className="grid gap-4 lg:grid-cols-2 mt-4">
            <Input
              label="Council number"
              mono
              value={form.licenseNo}
              onChange={set("licenseNo")}
              placeholder="KNC/2019/8842"
            />
            <Select
              label="Works under"
              hint="the physician who dispatches them"
              value={form.doctorId}
              onChange={set("doctorId")}
            >
              <option value="">No physician yet</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Ticked, never typed: dispatch compares these to zone names exactly,
              so "HSR layout" silently covered nowhere at all. */}
          <div className="mt-4">
            <span className="t-micro block mb-2">
              Zones covered{areas.length > 0 ? ` · ${areas.length} of ${ZONE_NAMES.length}` : ""}
            </span>
            <div className="flex flex-wrap gap-2">
              {ZONE_NAMES.map((z) => {
                const on = areas.includes(z);
                return (
                  <button
                    key={z}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleArea(z)}
                    className="rounded-full px-[14px] py-[7px] border cursor-pointer"
                    style={{
                      font: "500 13px/1.4 var(--font-sans)",
                      borderColor: on ? "var(--color-primary)" : "var(--color-line-2)",
                      background: on ? "var(--color-primary)" : "var(--color-surface)",
                      color: on ? "#fff" : "var(--color-ink)",
                    }}
                  >
                    {z}
                  </button>
                );
              })}
            </div>
            <p className="t-small text-[var(--color-ink-3)] mt-2">
              Tick none and this nurse is offered for every zone.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 mt-4">
            <Input label="Home latitude" mono value={form.latitude} onChange={set("latitude")} placeholder="12.9352" />
            <Input
              label="Home longitude"
              mono
              value={form.longitude}
              onChange={set("longitude")}
              placeholder="77.6245"
            />
          </div>
          <p className="t-small text-[var(--color-ink-3)] mt-2">
            Without coordinates this nurse can still be assigned, but only after every nurse whose distance is known.
          </p>
        </>
      )}

      {(role === "clinic" || role === "patient") && (
        <div className="grid gap-4 lg:grid-cols-3 mt-4">
          <Input label="Address" value={form.address} onChange={set("address")} />
          <Input label="City" value={form.city} onChange={set("city")} />
          <Input label="Pincode" mono value={form.pincode} onChange={set("pincode")} />
        </div>
      )}

      {role === "clinic" && (
        <div className="grid gap-4 lg:grid-cols-2 mt-4">
          {/* A clinic's GSTIN decides whether their invoice is CGST+SGST or
              IGST, so a typo here is a wrongly taxed bill — checked the same
              way our own is. */}
          <Input
            label="GSTIN"
            hint={gstinHome ? `${gstinHome}` : "15 characters"}
            mono
            value={form.gstin}
            error={gstinCheck.error}
            onChange={(e) => set("gstin")({ target: { value: e.target.value.toUpperCase() } })}
            placeholder="e.g. 29AABCH1234K1ZN"
          />
          {gstinCheck.warning ? (
            <p className="t-small text-[var(--color-caution-text)]">{gstinCheck.warning}</p>
          ) : null}
          <Input
            label="Monthly session target"
            type="number"
            mono
            value={form.monthlyVolumeTarget}
            onChange={set("monthlyVolumeTarget")}
          />
        </div>
      )}
    </>
  );
}

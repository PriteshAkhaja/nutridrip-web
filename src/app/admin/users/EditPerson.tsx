"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import { USER_STATUS, type Role } from "@/lib/models/types";
import { PersonFields, type PersonForm } from "./PersonFields";
import type { Zone } from "@/lib/zones";

const STATUS_BLURB: Record<string, string> = {
  active: "Can sign in and work normally.",
  inactive: "Cannot sign in. Their history stays intact.",
  pending: "Created but not yet verified.",
  suspended: "Locked out. Use this when access must stop immediately.",
};

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Super admin",
  admin: "Admin",
  doctor: "Doctor",
  nurse: "Nurse",
  clinic: "Partner clinic",
  patient: "Patient",
};

/**
 * Editing an account in full, on the same form that created it.
 *
 * It lives above the table rather than inside a cell: a form of this size in a
 * table cell made the row taller than the screen and pushed every other person
 * out of view.
 *
 * Two things stay fixed. Role is not editable — a patient turned into an admin
 * inherits every booking and quiz they ever filed. Nor is email, which is the
 * sign-in address and would be an account takeover in one field. Both are shown
 * so it is clear they were considered rather than forgotten.
 */
export function EditPerson({
  user,
  doctors,
  closeHref,
  zones,
}: {
  user: {
    id: string;
    role: Role;
    status: string;
    form: PersonForm;
    serviceAreas: string[];
  };
  doctors: Array<{ id: string; name: string }>;
  zones: Array<Pick<Zone, "name" | "status">>;
  /** Back to the list, keeping whatever filter was on. */
  closeHref: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<PersonForm>(user.form);
  const [status, setStatus] = useState(user.status);
  const [areas, setAreas] = useState<string[]>(user.serviceAreas);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  /**
   * Bring the form to the reader, not the reader to the form.
   *
   * Edit is pressed from a row that can be most of a page down, and the form
   * opens at the top — so without this, pressing Edit looks like nothing
   * happened. Focus moves too, not just the scroll position: somebody on a
   * keyboard or a screen reader would otherwise still be standing on the row
   * they came from, with no idea a form had opened above them.
   */
  const cardRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    // preventScroll, because focus() jumps abruptly and scrollIntoView below
    // does the same job in a way somebody can follow.
    headingRef.current?.focus({ preventScroll: true });
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    cardRef.current?.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
  }, [user.id]);

  const set = (k: keyof PersonForm) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleArea = (zone: string) =>
    setAreas((a) => (a.includes(zone) ? a.filter((z) => z !== zone) : [...a, zone]));

  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

  const save = async () => {
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name || undefined,
          phone: form.phone || undefined,
          status: status !== user.status ? status : undefined,
          password: form.password || undefined,
          specialization: form.specialization || undefined,
          licenseNo: form.licenseNo || undefined,
          registrationCouncil: form.registrationCouncil || undefined,
          // null clears the link; undefined would leave it alone, which is not
          // the same thing when somebody has just emptied the dropdown.
          ...(user.role === "nurse" && { doctorId: form.doctorId || null }),
          ...(user.role === "nurse" && { serviceAreas: areas }),
          latitude: num(form.latitude),
          longitude: num(form.longitude),
          address: form.address || undefined,
          city: form.city || undefined,
          pincode: form.pincode || undefined,
          monthlyVolumeTarget: num(form.monthlyVolumeTarget),
          // Empty string rather than undefined, so clearing a GSTIN is a real
          // change: a clinic that deregisters has to be able to say so, and an
          // absent key would leave the old number on their next invoice.
          ...(user.role === "clinic" && { gstin: form.gstin }),
          ...(user.role === "clinic" && { onCredit: form.onCredit === "yes" }),
        }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not save that");
      else {
        setDone(true);
        setForm((f) => ({ ...f, password: "" }));
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={cardRef} className="scroll-mt-6">
    <Card padding="p-6" className="w-full">
      <div className="flex items-baseline justify-between gap-4 mb-5 flex-wrap">
        <div className="flex items-baseline gap-3 flex-wrap">
          {/* tabIndex -1 makes it focusable without putting it in tab order. */}
          <h2 ref={headingRef} tabIndex={-1} className="t-h3">
            {user.form.name}
          </h2>
          <span className="t-small text-[var(--color-ink-3)]">
            {ROLE_LABEL[user.role] ?? user.role} · role cannot be changed
          </span>
        </div>
        <Link href={closeHref} className="no-underline hover:no-underline">
          <Button variant="ghost">Close</Button>
        </Link>
      </div>

      {done && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-safe)] bg-[var(--color-safe-soft)] px-4 py-3 mb-5">
          <span className="t-body text-[var(--color-ink-2)]">Saved.</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Input label="Full name" value={form.name} onChange={set("name")} />
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          {USER_STATUS.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </Select>
      </div>
      <p className="t-small text-[var(--color-ink-2)] mt-2">{STATUS_BLURB[status]}</p>

      {["doctor", "nurse"].includes(user.role) && status !== "active" && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-caution)] bg-[var(--color-caution-soft)] px-4 py-3 mt-4">
          <span className="t-body text-[var(--color-ink-2)]">
            If they still hold live sessions this will be refused — reassign those first, so no patient is left with a
            nurse who can no longer open the checklist.
          </span>
        </div>
      )}

      <div className="mt-4">
        <PersonFields
          role={user.role}
          form={form}
          set={set}
          areas={areas}
          toggleArea={toggleArea}
          doctors={doctors}
          mode="edit"
          zones={zones}
        />
      </div>

      {error && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3 mt-5">
          <span className="t-body text-[var(--color-ink-2)]">{error}</span>
        </div>
      )}

      <div className="mt-6 flex gap-3 flex-wrap">
        <Button size="md" loading={busy} disabled={!form.name} onClick={save}>
          Save changes
        </Button>
        <Link href={closeHref} className="no-underline hover:no-underline">
          <Button variant="secondary" size="md">
            Done
          </Button>
        </Link>
      </div>
    </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { formatInr } from "@/lib/inventory/units";
import { zoneForPincode } from "@/lib/zones";
import { SLOTS, slotDate, LATE_CHANGE_HOURS, LATE_CANCEL_FEE_INR } from "@/lib/clinical/slots";
import { filterDrips, noMatchMessage } from "@/lib/data/drip-search";

type DripOption = {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceInr: number;
  durationMin: number;
  available: number;
  category?: string;
  /** Ingredient names, so "the one with glutathione" finds it. */
  keywords?: Array<string | undefined>;
};

type ClinicOption = { id: string; name: string; city: string };

const LOCATIONS = [
  { value: "home", label: "My home" },
  { value: "office", label: "My office" },
  { value: "clinic", label: "A partner clinic" },
  { value: "hotel", label: "A hotel" },
] as const;

/** Where a pincode stands: served, served with limited cover, or not yet. */
export function CoverageNote({ pincode }: { pincode: string }) {
  if (pincode.length !== 6) return null;
  const zone = zoneForPincode(pincode);
  if (!zone) {
    return (
      <span className="t-small text-[var(--color-critical-text)]">
        We do not serve {pincode} yet — a straight no rather than a waitlist. The zones we cover are on the Zones
        page.
      </span>
    );
  }
  return (
    <span className="t-small" style={{ color: zone.status === "open" ? "var(--color-safe)" : "var(--color-caution)" }}>
      {zone.name} · slots {zone.window}
      {zone.status === "limited" ? " · limited cover, expect a narrower choice of times" : ""}
    </span>
  );
}

export function BookingFlow({
  drips,
  clinics,
  releasedDays,
  recommendedIds = [],
  preferredSlug,
  defaultAddress,
  defaultPincode,
  pendingReview,
}: {
  drips: DripOption[];
  clinics: ClinicOption[];
  /** What the physician recommended, or the quiz suggested. Leads the list. */
  recommendedIds?: string[];
  /** Decided on the server, so the list cannot differ after hydration. */
  releasedDays: string[];
  preferredSlug: string | null;
  defaultAddress: string;
  defaultPincode: string;
  pendingReview: boolean;
}) {
  const router = useRouter();
  const days = releasedDays.map((iso) => new Date(iso));

  /**
   * Ordered so what was recommended comes first, and in stock before out.
   * Catalogue order is a price list; it is not an answer to "what should I
   * book", which is the only question being asked on this screen.
   */
  const recommended = new Set(recommendedIds);
  const ordered = [...drips].sort((a, b) => {
    const ra = recommended.has(a.id);
    const rb = recommended.has(b.id);
    if (ra !== rb) return ra ? -1 : 1;
    const oa = a.available === 0;
    const ob = b.available === 0;
    if (oa !== ob) return oa ? 1 : -1;
    return 0;
  });

  // A link with ?drip= wins, then the first recommended drip actually in
  // stock, and only then whatever is available — which was the whole rule
  // before, and is why an unrecommended drip arrived pre-ticked.
  const [dripId, setDripId] = useState(
    drips.find((d) => d.slug === preferredSlug)?.id ??
      ordered.find((d) => recommended.has(d.id) && d.available > 0)?.id ??
      ordered.find((d) => d.available > 0)?.id ??
      ""
  );
  const [day, setDay] = useState(days[0]);
  const [slot, setSlot] = useState(SLOTS[1]);
  const [location, setLocation] = useState<(typeof LOCATIONS)[number]["value"]>("home");
  const [clinicId, setClinicId] = useState(clinics[0]?.id ?? "");
  const [address, setAddress] = useState(defaultAddress);
  const [pincode, setPincode] = useState(defaultPincode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const drip = drips.find((d) => d.id === dripId);
  const atClinic = location === "clinic";
  const served = Boolean(zoneForPincode(pincode));

  // The chosen drip stays on screen even when it falls outside the search, so a
  // half-typed word never silently hides what the patient already selected.
  const shown = filterDrips(ordered, query);
  const visible = drip && !shown.some((d) => d.id === drip.id) ? [drip, ...shown] : shown;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dripId,
          scheduledAt: slotDate(day, slot).toISOString(),
          location,
          address: atClinic ? undefined : address,
          pincode: atClinic ? undefined : pincode,
          clinicId: atClinic ? clinicId : undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not book that slot");
      else {
        router.push("/app");
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. Nothing was booked and nothing was charged.");
    } finally {
      setBusy(false);
    }
  };

  const canSubmit =
    Boolean(dripId) &&
    (atClinic ? Boolean(clinicId) : Boolean(address) && pincode.length === 6 && served);

  return (
    <div className="flex flex-col gap-6">
      {pendingReview && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-info)] bg-[var(--color-info-soft)] px-4 py-3">
          <span className="t-body text-[var(--color-ink-2)]">
            You can hold a slot now. It is confirmed only once a physician approves your quiz, and nothing is charged
            before then.
          </span>
        </div>
      )}

      {/* ---------------- Drip ---------------- */}
      <div>
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <span className="t-micro">
            Which drip{recommendedIds.length > 1 ? " · one per session" : ""}
          </span>
          <span className="t-small text-[var(--color-ink-3)]">
            {visible.length} of {drips.length}
          </span>
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or what is in it"
          aria-label="Search drips"
          className="min-h-[44px] w-full px-[14px] mb-3 rounded-[var(--radius-sm)] border border-[var(--color-line-2)] bg-[var(--color-surface)] text-[14.5px] placeholder:text-[var(--color-ink-3)] focus:border-[var(--color-primary)]"
        />

        <div className="flex flex-col gap-2">
          {visible.length === 0 && (
            <p className="t-small text-[var(--color-ink-3)] py-3">{noMatchMessage(query)}</p>
          )}
          {visible.map((d) => {
            const selected = d.id === dripId;
            const out = d.available === 0;
            return (
              <button
                key={d.id}
                type="button"
                disabled={out}
                aria-pressed={selected}
                onClick={() => setDripId(d.id)}
                className="text-left p-4 rounded-[var(--radius-md)] border flex flex-col gap-2 disabled:cursor-not-allowed"
                style={{
                  borderColor: selected ? "var(--color-primary)" : "var(--color-line)",
                  background: selected
                    ? "var(--color-primary-soft)"
                    : out
                      ? "var(--color-surface-2)"
                      : "var(--color-surface)",
                  opacity: out ? 0.6 : 1,
                  cursor: out ? "not-allowed" : "pointer",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex flex-col gap-[3px]">
                    <span style={{ font: `${selected ? 600 : 500} 16px/1.4 var(--font-sans)` }}>{d.name}</span>
                    {recommended.has(d.id) && (
                      <span className="t-small text-[var(--color-primary-text)]">
                        Recommended for you
                      </span>
                    )}
                  </span>
                  {out ? (
                    <Pill tone="critical">Out of stock</Pill>
                  ) : d.available <= 3 ? (
                    <Pill tone="caution">{d.available} left</Pill>
                  ) : null}
                </div>
                <div className="flex gap-4">
                  <span className="t-data text-[13px]">{formatInr(d.priceInr)}</span>
                  <span className="t-data text-[13px] text-[var(--color-ink-3)]">{d.durationMin} min</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------------- Day ---------------- */}
      <div>
        <span className="t-micro block mb-3">Which day</span>
        <div className="grid grid-cols-5 gap-2">
          {days.map((d) => {
            const selected = d.getTime() === day.getTime();
            return (
              <button
                key={d.toISOString()}
                type="button"
                aria-pressed={selected}
                onClick={() => setDay(d)}
                className="py-3 rounded-[var(--radius-md)] border flex flex-col items-center gap-1 cursor-pointer min-h-[68px]"
                style={{
                  borderColor: selected ? "var(--color-primary)" : "var(--color-line)",
                  background: selected ? "var(--color-primary-soft)" : "var(--color-surface)",
                }}
              >
                <span
                  className="t-micro"
                  style={{ color: selected ? "var(--color-primary-dark)" : "var(--color-ink-3)" }}
                >
                  {d.toLocaleDateString("en-IN", { weekday: "short" })}
                </span>
                <span
                  className="t-data text-[18px]"
                  style={{ color: selected ? "var(--color-primary-dark)" : "var(--color-ink)" }}
                >
                  {d.getDate()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------------- Slot ---------------- */}
      <div>
        <span className="t-micro block mb-3">What time</span>
        <div className="grid grid-cols-3 gap-2">
          {SLOTS.map((s) => {
            const selected = s === slot;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={selected}
                onClick={() => setSlot(s)}
                className="min-h-[48px] rounded-[var(--radius-md)] border cursor-pointer t-data text-[14.5px]"
                style={{
                  borderColor: selected ? "var(--color-primary)" : "var(--color-line)",
                  background: selected ? "var(--color-primary-soft)" : "var(--color-surface)",
                  color: selected ? "var(--color-primary-dark)" : "var(--color-ink)",
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------------- Where ---------------- */}
      <div className="flex flex-col gap-4">
        <Select
          label="Where"
          value={location}
          onChange={(e) => setLocation(e.target.value as typeof location)}
        >
          {LOCATIONS.map((l) => (
            <option key={l.value} value={l.value} disabled={l.value === "clinic" && clinics.length === 0}>
              {l.label}
              {l.value === "clinic" && clinics.length === 0 ? " — none taking bookings" : ""}
            </option>
          ))}
        </Select>

        {atClinic ? (
          <Select label="Which clinic" value={clinicId} onChange={(e) => setClinicId(e.target.value)}>
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.city ? ` — ${c.city}` : ""}
              </option>
            ))}
          </Select>
        ) : (
          <>
            <Input
              label="Address"
              placeholder="Flat, building, street"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <div className="flex flex-col gap-[7px]">
              <Input
                label="Pincode"
                hint="14 zones served"
                mono
                inputMode="numeric"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
              />
              <CoverageNote pincode={pincode} />
            </div>
          </>
        )}
      </div>

      {/* ---------------- Summary ---------------- */}
      {drip && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-5">
          <span className="t-micro">Summary</span>
          <div className="flex flex-col gap-2 mt-3">
            {[
              ["Drip", drip.name],
              [
                "When",
                `${day.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} · ${slot}`,
              ],
              ["Where", atClinic ? (clinics.find((c) => c.id === clinicId)?.name ?? "Clinic") : LOCATIONS.find((l) => l.value === location)?.label ?? ""],
              ["Duration", `${drip.durationMin} min`],
              ["Session total", formatInr(drip.priceInr)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 items-baseline">
                <span className="t-body text-[var(--color-ink-2)]">{k}</span>
                <span className="t-data text-[14.5px]">{v}</span>
              </div>
            ))}
          </div>
          <p className="t-small text-[var(--color-ink-3)] mt-4">
            Move or cancel freely up to {LATE_CHANGE_HOURS} hours before. Inside that window a{" "}
            <span className="t-data text-[13px]">₹{LATE_CANCEL_FEE_INR}</span> cancellation fee applies, because the
            nurse is already dispatched with your batch drawn.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3">
          <span className="t-body text-[var(--color-ink-2)]">{error}</span>
        </div>
      )}

      <Button size="lg" block loading={busy} disabled={!canSubmit} onClick={submit}>
        {pendingReview ? "Hold this slot" : "Confirm booking"}
      </Button>
    </div>
  );
}

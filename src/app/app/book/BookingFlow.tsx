"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { formatInr } from "@/lib/inventory/units";
import { zoneForPincode, type Zone } from "@/lib/zones";
import { SlotPicker, slotLabel } from "@/components/ui/SlotPicker";
import { latePolicySentence, type LatePolicy } from "@/lib/billing/late-policy";
import { filterDrips, noMatchMessage } from "@/lib/data/drip-search";
import { useClockFormat } from "@/components/ClockProvider";
import { clockText } from "@/lib/time";
import { PayButton, PaymentTrust } from "@/components/payments/PayButton";

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

// Where the nurse comes to. Partner clinics are the business's own customers and
// are not offered to patients.
const LOCATIONS = [
  { value: "home", label: "My home" },
  { value: "office", label: "My office" },
  { value: "hotel", label: "A hotel" },
] as const;

/** Where a pincode stands: served, served with limited cover, or not yet. */
export function CoverageNote({ pincode, zones }: { pincode: string; zones: Zone[] }) {
  const clockFmt = useClockFormat();
  if (pincode.length !== 6) return null;
  const zone = zoneForPincode(pincode, zones);
  if (!zone) {
    return (
      <span className="t-small text-[var(--color-critical-text)]">
        We do not serve {pincode} yet — a straight no rather than a waitlist. The zones we cover are on the Zones page.
      </span>
    );
  }
  return (
    <span className="t-small" style={{ color: zone.status === "open" ? "var(--color-safe)" : "var(--color-caution)" }}>
      {zone.name} · open {clockText(zone.window, clockFmt)}
      {zone.status === "limited" ? " · limited cover, expect a narrower choice of times" : ""}
    </span>
  );
}

export function BookingFlow({
  drips,
  recommendedIds = [],
  preferredSlug,
  defaultAddress,
  defaultPincode,
  pendingReview,
  zones,
  latePolicy,
  payOnline = false,
}: {
  drips: DripOption[];
  /** What the physician recommended, or the quiz suggested. Leads the list. */
  recommendedIds?: string[];
  preferredSlug: string | null;
  defaultAddress: string;
  defaultPincode: string;
  pendingReview: boolean;
  /** The zones a patient can book in, from the Service zones page. */
  zones: Zone[];
  /** The late-change rule and fees, from the Billing page. */
  latePolicy: LatePolicy;
  /** Online payment is on: the session is paid for to book it. */
  payOnline?: boolean;
}) {
  const clockFmt = useClockFormat();
  const router = useRouter();

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
  /** The chosen time, as an ISO moment, from the slot picker. None until the patient picks one. */
  const [slotAt, setSlotAt] = useState<string | null>(null);
  const [slotReload, setSlotReload] = useState(0);
  const [location, setLocation] = useState<(typeof LOCATIONS)[number]["value"]>("home");
  const [address, setAddress] = useState(defaultAddress);
  const [pincode, setPincode] = useState(defaultPincode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const drip = drips.find((d) => d.id === dripId);
  const served = Boolean(zoneForPincode(pincode, zones));

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
          scheduledAt: slotAt,
          location,
          address,
          pincode,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Could not book that slot");
        // Taken since the grid loaded: show the times as they are now.
        if (res.status === 409 || res.status === 422) setSlotReload((n) => n + 1);
      } else {
        router.push("/app");
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. Nothing was booked and nothing was charged.");
    } finally {
      setBusy(false);
    }
  };

  // What the slot picker asks about: this drip's length, at this address.
  const slotQuery =
    !dripId || pincode.length !== 6 || !served ? null : new URLSearchParams({ dripId, location, pincode }).toString();

  const canSubmit = Boolean(dripId) && Boolean(slotAt) && Boolean(address) && pincode.length === 6 && served;

  return (
    // On a desktop, two panes: what and where on the left; when, the summary
    // and the button on the right. A phone or a tablet keeps one column.
    <div className="flex flex-col gap-6 @4xl:grid @4xl:grid-cols-2 @4xl:gap-8 @4xl:items-start">
      <div className="flex flex-col gap-6 min-w-0">
        {pendingReview && (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-info)] bg-[var(--color-info-soft)] px-4 py-3">
            <span className="t-body text-[var(--color-ink-2)]">
              {payOnline
                ? "You can hold a slot now. You pay to hold it, and it is confirmed once a physician approves your quiz — if they do not, everything you paid is refunded in full, automatically."
                : "You can hold a slot now. It is confirmed only once a physician approves your quiz, and nothing is charged before then."}
            </span>
          </div>
        )}

        {/* ---------------- Drip ---------------- */}
        <div>
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <span className="t-micro">Which drip{recommendedIds.length > 1 ? " · one per session" : ""}</span>
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

          <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
            {visible.length === 0 && (
              <p className="t-small text-[var(--color-ink-3)] py-3 col-span-full">{noMatchMessage(query)}</p>
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
                        <span className="t-small text-[var(--color-primary-text)]">Recommended for you</span>
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

        {/* ---------------- Where ---------------- */}
        <div className="flex flex-col gap-4">
          <Select label="Where" value={location} onChange={(e) => setLocation(e.target.value as typeof location)}>
            {LOCATIONS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </Select>

          <Input
            label="Address"
            placeholder="Flat, building, street"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <div className="flex flex-col gap-[7px]">
            <Input
              label="Pincode"
              hint={`${zones.length} ${zones.length === 1 ? "zone" : "zones"} served`}
              mono
              inputMode="numeric"
              maxLength={6}
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
            />
            <CoverageNote pincode={pincode} zones={zones} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 min-w-0">
        {/* ---------------- When ---------------- */}
        <SlotPicker
          query={slotQuery}
          value={slotAt}
          onChange={setSlotAt}
          reloadKey={slotReload}
          idleMessage="Enter your pincode to see the times a nurse can come."
        />

        {/* ---------------- Summary ----------------
            A checkout card: what is being booked, then the total set apart in
            large figures, then what happens to the money if it does not go ahead. */}
        {drip && (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] overflow-hidden">
            <div className="p-5">
              <span className="t-micro">Summary</span>
              <div className="flex flex-col gap-2 mt-3">
                {[
                  ["Drip", drip.name],
                  ["When", slotAt ? slotLabel(slotAt, clockFmt) : "Pick a time"],
                  ["Where", LOCATIONS.find((l) => l.value === location)?.label ?? ""],
                  ["Duration", `${drip.durationMin} min`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 items-baseline">
                    <span className="t-body text-[var(--color-ink-2)]">{k}</span>
                    <span className="t-data text-[14.5px] text-right">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-[var(--color-line)] bg-[var(--color-surface-2)] flex flex-col gap-3">
              <div className="flex justify-between gap-4 items-baseline">
                <span className="t-body font-semibold">{payOnline ? "Total to pay now" : "Session total"}</span>
                <span className="t-data text-[22px] leading-[1.2]">{formatInr(drip.priceInr)}</span>
              </div>
              <p className="t-small text-[var(--color-ink-3)]">{latePolicySentence(latePolicy)}</p>
              {payOnline && (
                <p className="t-small text-[var(--color-ink-3)]">
                  If the session does not go ahead — the physician does not approve, we cancel, or your vitals stop it —
                  everything you paid is refunded to the account you paid from, automatically.
                </p>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="pay-swap rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3">
            <span className="t-body text-[var(--color-ink-2)]">{error}</span>
          </div>
        )}

        {payOnline ? (
          <div className="flex flex-col gap-3">
            <PayButton
              size="lg"
              block
              navigate
              disabled={!canSubmit}
              successTitle={pendingReview ? "Paid — your slot is held" : "Paid — you are booked"}
              finishing={pendingReview ? "Holding your slot" : "Booking your session"}
              request={{
                purpose: "booking",
                booking: {
                  dripId,
                  scheduledAt: slotAt,
                  location,
                  address,
                  pincode,
                },
              }}
              onRefused={(r) => {
                setError(r.message);
                // Taken since the grid loaded: show the times as they are now.
                if (r.status === 409 || r.status === 422) setSlotReload((n) => n + 1);
              }}
              onSettled={(st) => {
                // Paid for a time that went while paying, and refunded: that time is
                // gone, so clear it and show the times as they are now.
                if (st.phase === "refunded") {
                  setSlotAt(null);
                  setSlotReload((n) => n + 1);
                }
              }}
              noticeAlign="center"
            >
              {drip
                ? `Pay ${formatInr(drip.priceInr)} and ${pendingReview ? "hold this slot" : "book"}`
                : "Pay and book"}
            </PayButton>
            <PaymentTrust align="center" />
          </div>
        ) : (
          <Button size="lg" block loading={busy} disabled={!canSubmit} onClick={submit}>
            {pendingReview ? "Hold this slot" : "Confirm booking"}
          </Button>
        )}
      </div>
    </div>
  );
}

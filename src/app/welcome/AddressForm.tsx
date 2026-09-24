"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { AddressPicker, type PickedAddress } from "@/components/ui/AddressPicker";
import { zoneForPincode, type Zone } from "@/lib/zones";

export type AddressInitial = PickedAddress & { name: string };

/**
 * The one screen a new patient cannot skip. It asks for the least we need to
 * send a nurse to a real door — a name to verify at the bedside, an address to
 * drive to, and ideally a pin so the nearest nurse is actually the nearest.
 */
export function AddressForm({
  initial,
  mapsKey,
  searchEnabled,
  zones,
}: {
  initial: AddressInitial;
  mapsKey: string | null;
  searchEnabled: boolean;
  zones: Zone[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [place, setPlace] = useState<PickedAddress>({
    address: initial.address,
    city: initial.city,
    pincode: initial.pincode,
    latitude: initial.latitude,
    longitude: initial.longitude,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete =
    name.trim().length > 1 &&
    place.address.trim().length > 4 &&
    place.city.trim().length > 1 &&
    /^\d{6}$/.test(place.pincode);

  // An address outside the served zones is saved anyway: the patient can still
  // read the catalogue and take the quiz, and the booking screen gives them a
  // straight answer rather than us refusing to create an account at all.
  const served = Boolean(zoneForPincode(place.pincode, zones));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          address: place.address.trim(),
          city: place.city.trim(),
          pincode: place.pincode,
          // Sent in the same request as the address they belong to; the route
          // applies them after its moved-house reset so they survive.
          latitude: place.latitude,
          longitude: place.longitude,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Could not save your address");
        return;
      }
      router.push("/app");
      router.refresh();
    } catch {
      setError("Could not reach the server. Nothing was saved — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (complete) save();
      }}
    >
      <Input
        label="Your full name"
        hint="as on your ID"
        autoComplete="name"
        placeholder="Riya Mehta"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <AddressPicker value={place} onChange={setPlace} mapsKey={mapsKey} searchEnabled={searchEnabled} zones={zones} />

      {place.pincode.length === 6 && !served && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-caution)] bg-[var(--color-caution-soft)] px-4 py-3">
          <span className="t-body text-[var(--color-ink-2)]">
            We will still save this so you can browse and take the health quiz — but a nurse cannot be sent to this
            pincode yet, so booking will be unavailable until we cover it.
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3">
          <span className="t-body text-[var(--color-ink-2)]">{error}</span>
        </div>
      )}

      <Button type="submit" size="lg" block loading={busy} disabled={!complete}>
        Save and continue
      </Button>

      <p className="t-small text-[var(--color-ink-3)] text-center">
        You can change any of this later from your profile.
      </p>
    </form>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { CoverageNote } from "@/app/app/book/BookingFlow";
import type { Zone } from "@/lib/zones";

export type PickedAddress = {
  address: string;
  city: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
};

type Suggestion = { id: string; label: string; detail: string };

/* ------------------------------------------------------------------
   Minimal Google Maps typings — only the surface this file touches,
   which is cheaper than a dependency for three classes.
   ------------------------------------------------------------------ */
type LatLngLiteral = { lat: number; lng: number };
type GLatLng = { lat(): number; lng(): number };
type GMap = { setCenter(p: LatLngLiteral): void; setZoom(z: number): void };
type GMarker = {
  setPosition(p: LatLngLiteral): void;
  addListener(event: string, cb: () => void): void;
  getPosition(): GLatLng | undefined;
};
type GMapsApi = {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => GMap;
  Marker: new (opts: Record<string, unknown>) => GMarker;
};

declare global {
  interface Window {
    google?: { maps?: GMapsApi };
    __ndMapsPromise?: Promise<GMapsApi | null>;
  }
}

/** Load the Maps script once per page, however many pickers mount. */
function loadMaps(key: string): Promise<GMapsApi | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (window.__ndMapsPromise) return window.__ndMapsPromise;

  window.__ndMapsPromise = new Promise<GMapsApi | null>((resolve) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&region=IN`;
    script.async = true;
    script.onload = () => resolve(window.google?.maps ?? null);
    // A blocked or misconfigured key must not take the whole form down with it.
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return window.__ndMapsPromise;
}

/** Bengaluru, so an empty map opens somewhere useful rather than mid-ocean. */
const DEFAULT_CENTRE: LatLngLiteral = { lat: 12.9716, lng: 77.5946 };

async function geocode(body: Record<string, unknown>) {
  const res = await fetch("/api/geocode", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{
    success: boolean;
    data?: {
      suggestions?: Suggestion[];
      unavailable?: boolean;
      address?: { latitude: number; longitude: number; line1: string; city: string; pincode: string };
    };
    error?: string;
  }>;
}

/**
 * Search an address, or drop a pin on it.
 *
 * Coordinates are the whole point: `pickNurse()` ranks nurses by distance from
 * the patient, so without a latitude every nurse scores the same and the
 * nearest-nurse dispatch quietly stops working. Typing an address never
 * produced one.
 *
 * Everything degrades. No browser key means no map; no server key means no
 * search; with neither, the patient types the address by hand and can still
 * contribute a real location from their device.
 */
export function AddressPicker({
  value,
  onChange,
  mapsKey,
  searchEnabled,
  zones,
}: {
  value: PickedAddress;
  onChange: (next: PickedAddress) => void;
  /** Browser-restricted Maps key. Null hides the map and keeps the rest. */
  mapsKey: string | null;
  /** Whether the server holds a geocoding key — decides if search is offered. */
  searchEnabled: boolean;
  /** The zones a patient can book in, for the "do we come here" line under the pincode. */
  zones: Zone[];
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  // Told apart from an empty result on purpose: "we cannot look addresses up
  // right now" and "that address does not exist" need different answers from
  // the person filling the form in.
  const [lookupDown, setLookupDown] = useState(false);
  const [noMatch, setNoMatch] = useState(false);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GMap | null>(null);
  const markerRef = useRef<GMarker | null>(null);

  // The parent hands us a new onChange every render; the marker listener is
  // bound once, so it reads the live one through a ref rather than closing
  // over a stale copy. The assignment happens in an effect because writing a
  // ref during render is what tears under concurrent rendering.
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  useEffect(() => {
    onChangeRef.current = onChange;
    valueRef.current = value;
  });

  const hasPin = value.latitude !== null && value.longitude !== null;

  /** A point was chosen: keep it, and refresh the address sitting under it. */
  const applyPoint = useCallback(
    async (lat: number, lng: number) => {
      onChangeRef.current({ ...valueRef.current, latitude: lat, longitude: lng });
      if (!searchEnabled) return;
      const json = await geocode({ mode: "reverse", lat, lng });
      const a = json.data?.address;
      if (!a) return;
      onChangeRef.current({
        address: a.line1 || valueRef.current.address,
        city: a.city || valueRef.current.city,
        pincode: a.pincode || valueRef.current.pincode,
        latitude: lat,
        longitude: lng,
      });
    },
    [searchEnabled]
  );

  /* ---------------- the map itself ---------------- */
  useEffect(() => {
    if (!mapsKey || !mapEl.current) return;
    let cancelled = false;

    loadMaps(mapsKey).then((maps) => {
      if (cancelled) return;
      if (!maps || !mapEl.current) {
        setNote("The map could not load, but you can still search or type your address.");
        return;
      }

      const start = valueRef.current;
      const centre =
        start.latitude !== null && start.longitude !== null
          ? { lat: start.latitude, lng: start.longitude }
          : DEFAULT_CENTRE;

      const map = new maps.Map(mapEl.current, {
        center: centre,
        zoom: start.latitude !== null ? 17 : 12,
        disableDefaultUI: true,
        zoomControl: true,
      });
      const marker = new maps.Marker({ map, position: centre, draggable: true });
      marker.addListener("dragend", () => {
        const p = marker.getPosition();
        if (p) applyPoint(p.lat(), p.lng());
      });

      mapRef.current = map;
      markerRef.current = marker;
    });

    return () => {
      cancelled = true;
    };
    // Built once for a given key. Position changes are pushed by the effect below.
  }, [mapsKey, applyPoint]);

  /* Keep the pin in step when search or geolocation moves the value. */
  useEffect(() => {
    if (value.latitude === null || value.longitude === null) return;
    const p = { lat: value.latitude, lng: value.longitude };
    markerRef.current?.setPosition(p);
    mapRef.current?.setCenter(p);
    mapRef.current?.setZoom(17);
  }, [value.latitude, value.longitude]);

  /* ---------------- search ---------------- */
  useEffect(() => {
    // Clearing is done by the input's own handler, not here: a setState in an
    // effect body cascades an extra render pass on every keystroke.
    if (!searchEnabled || query.trim().length < 3) return;
    // Debounced, because every keystroke would otherwise be a billed lookup.
    const timer = setTimeout(async () => {
      setSearching(true);
      const json = await geocode({ mode: "suggest", query });
      const found = json.data?.suggestions ?? [];
      const down = Boolean(json.data?.unavailable) || json.success === false;
      setSuggestions(found);
      setLookupDown(down);
      setNoMatch(!down && found.length === 0);
      setSearching(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [query, searchEnabled]);

  const choose = async (s: Suggestion) => {
    setSuggestions([]);
    setNoMatch(false);
    setQuery("");
    setSearching(true);
    const json = await geocode({ mode: "place", placeId: s.id });
    setSearching(false);

    const a = json.data?.address;
    if (!a) {
      setNote("We could not pin that address. Drag the pin, or type it in below.");
      return;
    }
    setNote(null);
    onChange({
      address: a.line1 || s.label,
      city: a.city,
      pincode: a.pincode,
      latitude: a.latitude,
      longitude: a.longitude,
    });
  };

  /* ---------------- the device's own location ---------------- */
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setNote("This browser cannot share a location.");
      return;
    }
    setLocating(true);
    setNote(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await applyPoint(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setNote("Location permission was declined. Search for the address or drag the pin instead.");
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {searchEnabled && (
        <div className="relative">
          <Input
            label="Search your address"
            hint="pick the closest match"
            placeholder="Building, street or landmark"
            value={query}
            autoComplete="off"
            onChange={(e) => {
              const next = e.target.value;
              setQuery(next);
              // Too short to search: drop any stale list here, in the handler.
              if (next.trim().length < 3) {
                setSuggestions([]);
                setLookupDown(false);
                setNoMatch(false);
              }
            }}
          />
          {(suggestions.length > 0 || searching || lookupDown || noMatch) && (
            <div className="absolute z-20 left-0 right-0 mt-1 rounded-[var(--radius-md)] border border-[var(--color-line-2)] bg-[var(--color-surface)] overflow-hidden shadow-[var(--shadow-pop)]">
              {searching && suggestions.length === 0 ? (
                <div className="px-4 py-3 t-small text-[var(--color-ink-3)]">Searching…</div>
              ) : lookupDown ? (
                /* The form still works without this: the address fields below
                   are typed by hand and the pin can be dragged. Saying so is
                   the difference between a broken page and a slower one. */
                <div className="px-4 py-3">
                  <span className="t-small text-[var(--color-caution-text)] block">
                    Address search is not available right now.
                  </span>
                  <span className="t-small text-[var(--color-ink-3)]">
                    Type your address in the fields below and drag the pin to your door — that is what the nurse is
                    sent to.
                  </span>
                </div>
              ) : noMatch ? (
                <div className="px-4 py-3">
                  <span className="t-small text-[var(--color-ink-2)] block">No address matched that.</span>
                  <span className="t-small text-[var(--color-ink-3)]">
                    Try a landmark or the road name, or type it in below and drop the pin yourself.
                  </span>
                </div>
              ) : (
                suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => choose(s)}
                    className="w-full text-left px-4 py-3 border-b border-[var(--color-line)] last:border-b-0 hover:bg-[var(--color-primary-soft)] cursor-pointer"
                  >
                    <span className="t-body block">{s.label}</span>
                    {s.detail && <span className="t-small text-[var(--color-ink-3)]">{s.detail}</span>}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Button type="button" variant="secondary" size="sm" loading={locating} onClick={useMyLocation}>
          Use my current location
        </Button>
        {hasPin ? (
          <span className="t-small text-[var(--color-safe-text)]">
            Pin set ·{" "}
            <span className="t-data text-[13px]">
              {value.latitude?.toFixed(5)}, {value.longitude?.toFixed(5)}
            </span>
          </span>
        ) : (
          <span className="t-small text-[var(--color-ink-3)]">
            No pin yet — the nurse would get your address only.
          </span>
        )}
      </div>

      {mapsKey && (
        <div>
          <div
            ref={mapEl}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-line-2)] overflow-hidden"
            style={{ height: 220, background: "var(--color-surface-2)" }}
          />
          <span className="t-small text-[var(--color-ink-3)] block mt-2">
            Drag the pin to your exact door — it decides which nurse is sent.
          </span>
        </div>
      )}

      {note && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-caution)] bg-[var(--color-caution-soft)] px-4 py-3">
          <span className="t-body text-[var(--color-ink-2)]">{note}</span>
        </div>
      )}

      <Input
        label="Address"
        hint="where the nurse comes"
        autoComplete="street-address"
        placeholder="Flat, building, street"
        value={value.address}
        onChange={(e) => onChange({ ...value, address: e.target.value })}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="City"
          autoComplete="address-level2"
          placeholder="Bengaluru"
          value={value.city}
          onChange={(e) => onChange({ ...value, city: e.target.value })}
        />
        <Input
          label="Pincode"
          mono
          inputMode="numeric"
          maxLength={6}
          autoComplete="postal-code"
          placeholder="560034"
          value={value.pincode}
          onChange={(e) => onChange({ ...value, pincode: e.target.value.replace(/\D/g, "") })}
        />
      </div>

      <CoverageNote pincode={value.pincode} zones={zones} />
    </div>
  );
}

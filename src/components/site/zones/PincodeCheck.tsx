"use client";

import { useState } from "react";
import { cleanPincode, zoneForPincode, ZONE_STATUS_LABEL, type Zone } from "@/lib/zones";
import { zoneAnchor } from "./anchor";

/** A zone as the page shows it: its hours already written in the platform's clock. */
export type ShownZone = Zone & { hours: string; step: string };

/**
 * "Do you come to my pincode?" answered on the page, with the rule the
 * booking guard applies (zoneForPincode, lib/zones.ts): six digits, a served
 * zone's list, a paused zone counts as no. The answer names the zone and
 * points at its card below.
 */
export function PincodeCheck({ zones }: { zones: ShownZone[] }) {
  const [value, setValue] = useState("");
  const pin = cleanPincode(value);
  const zone = pin.length === 6 ? (zoneForPincode(pin, zones) as ShownZone | null) : null;

  return (
    <div className="zn-check">
      <label className="zn-check__label" htmlFor="zn-pin">
        Check your pincode
      </label>
      <div className="zn-check__row">
        <input
          id="zn-pin"
          className="zn-check__input"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={7}
          placeholder="560034"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-describedby="zn-pin-out"
        />
      </div>
      <p
        id="zn-pin-out"
        className="zn-check__out"
        role="status"
        data-state={pin.length < 6 ? "idle" : zone ? zone.status : "no"}
      >
        {pin.length < 6 ? (
          "Six digits, and you get a straight yes or no."
        ) : zone ? (
          <>
            <b>Yes, {zone.name}.</b> {ZONE_STATUS_LABEL[zone.status]}: {zone.hours}, a slot {zone.step}.{" "}
            <a className="nd-link" href={`#${zoneAnchor(zone)}`}>
              See the zone
            </a>
          </>
        ) : (
          <>
            <b>Not yet.</b> We do not reach {pin} at the moment. Ask a clinician about your area below.
          </>
        )}
      </p>
    </div>
  );
}

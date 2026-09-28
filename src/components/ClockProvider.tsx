"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_CLOCK, type ClockFormat } from "@/lib/time";

/**
 * The 12- or 24-hour choice, handed to every client component from the root
 * layout, which reads it from the super admin's setting on each request.
 */
const ClockContext = createContext<ClockFormat>(DEFAULT_CLOCK);

export function ClockProvider({ format, children }: { format: ClockFormat; children: ReactNode }) {
  return <ClockContext.Provider value={format}>{children}</ClockContext.Provider>;
}

/** The clock format for this screen. Pass it to the formatters in lib/time. */
export function useClockFormat(): ClockFormat {
  return useContext(ClockContext);
}

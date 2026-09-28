import { cache } from "react";
import { connectDB } from "@/lib/db/mongoose";
import { PlatformSettings } from "@/lib/models";
import { DEFAULT_CLOCK, type ClockFormat } from "@/lib/time";

/**
 * The 12- or 24-hour choice for this request. Read once per render (cached),
 * and 12-hour whenever the setting is missing or the database cannot be
 * reached — a time shown in the default format beats a page that fails.
 */
export const getClockFormat = cache(async (): Promise<ClockFormat> => {
  try {
    await connectDB();
    const row = await PlatformSettings.findOne({ singleton: "platform" })
      .select("clockFormat")
      .lean<{ clockFormat?: string } | null>();
    return row?.clockFormat === "24h" ? "24h" : DEFAULT_CLOCK;
  } catch {
    return DEFAULT_CLOCK;
  }
});

import { cache } from "react";
import { connectDB } from "@/lib/db/mongoose";
import { PlatformSettings } from "@/lib/models";
import { DEFAULT_NURSE_DAY_LIMIT, nurseDayLimitOf } from "@/lib/clinical/nurse-options";

/**
 * The most sessions one nurse takes on one day, as the super admin set it.
 * Read once per render (cached), and the default whenever the setting is
 * missing or the database cannot be reached -- the limit the product starts
 * with beats a booking screen that fails.
 */
export const getNurseDayLimit = cache(async (): Promise<number> => {
  try {
    await connectDB();
    const row = await PlatformSettings.findOne({ singleton: "platform" })
      .select("nurseDayLimit")
      .lean<{ nurseDayLimit?: number } | null>();
    return nurseDayLimitOf(row?.nurseDayLimit ?? DEFAULT_NURSE_DAY_LIMIT);
  } catch {
    return DEFAULT_NURSE_DAY_LIMIT;
  }
});

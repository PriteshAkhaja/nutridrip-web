import { cache } from "react";
import { connectDB } from "@/lib/db/mongoose";
import { PlatformSettings } from "@/lib/models";
import { brandProblem, contrastProblem, deepProblem, normalizeHex } from "@/lib/theme";

/**
 * The brand colour the super admin set (Admin → Settings), or null for the
 * shipped teal. Read once per render (cached). Null whenever the setting is
 * missing, unusable, or the database cannot be reached: the default colours
 * beat a page that fails.
 */
export const getBrandColor = cache(async (): Promise<string | null> => {
  try {
    await connectDB();
    const row = await PlatformSettings.findOne({ singleton: "platform" })
      .select("brandColor")
      .lean<{ brandColor?: string | null } | null>();
    const c = normalizeHex(row?.brandColor);
    return c && !brandProblem(c) ? c : null;
  } catch {
    return null;
  }
});

/** The dark sections' colour the super admin set, or null: derived from the brand colour. */
export const getDeepColor = cache(async (): Promise<string | null> => {
  try {
    await connectDB();
    const row = await PlatformSettings.findOne({ singleton: "platform" })
      .select("deepColor")
      .lean<{ deepColor?: string | null } | null>();
    const c = normalizeHex(row?.deepColor);
    return c && !deepProblem(c) ? c : null;
  } catch {
    return null;
  }
});

/** The contrast colour the super admin set, or null: the text ink (black). */
export const getContrastColor = cache(async (): Promise<string | null> => {
  try {
    await connectDB();
    const row = await PlatformSettings.findOne({ singleton: "platform" })
      .select("contrastColor")
      .lean<{ contrastColor?: string | null } | null>();
    const c = normalizeHex(row?.contrastColor);
    return c && !contrastProblem(c) ? c : null;
  } catch {
    return null;
  }
});

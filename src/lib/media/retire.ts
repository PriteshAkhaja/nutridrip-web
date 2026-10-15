import { MediaRetired } from "@/lib/models";

/**
 * Records that an uploaded photograph is no longer used, starting its grace
 * period (lib/media/cleanup). Best effort: a failure here must never fail the
 * replace or restore the admin just did. The file is only left unmarked, and
 * `npm run clean-media` marks it the next time it runs.
 */
export async function retireFile(
  file: string | null | undefined,
  slot: string,
  reason: "replaced" | "restored" | "drip-deleted"
): Promise<void> {
  if (!file) return;
  try {
    await MediaRetired.updateOne(
      { file },
      { $setOnInsert: { file, slot, reason, retiredAt: new Date() } },
      { upsert: true }
    );
  } catch (err) {
    console.error("retireFile() failed:", err);
  }
}

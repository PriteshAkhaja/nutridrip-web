import { cache } from "react";
import { connectDB } from "@/lib/db/mongoose";
import { SiteMedia } from "@/lib/models";
import { SITE_IMAGES, dripImage, type SiteImage, type SiteImageKey } from "@/lib/site-images";
import { SLOTS, dripSlot, type SlotKey } from "@/lib/media/slots";
import { applyMedia, type MediaRecord } from "@/lib/media/rules";

/**
 * Every replaced photograph, read once per render. Empty when the database
 * cannot be reached: the shipped photos beat a page that fails.
 */
export const getSiteMedia = cache(async (): Promise<Map<string, MediaRecord>> => {
  try {
    await connectDB();
    const rows = await SiteMedia.find().select("slot file width height blur alt position").lean<MediaRecord[]>();
    return new Map(rows.map((r) => [r.slot, r]));
  } catch {
    return new Map();
  }
});

/** The photo a slot shows: the upload if there is one, else the shipped one. */
export async function siteImages(): Promise<(slot: SlotKey) => SiteImage> {
  const media = await getSiteMedia();
  return (slot) => applyMedia(SITE_IMAGES[SLOTS[slot].fallback], media.get(slot));
}

/** A shipped photograph that is not replaceable from the admin (see slots.ts): shown as it is. */
export const fixedImage = (key: SiteImageKey): SiteImage => SITE_IMAGES[key];

/** A drip's photo: its own upload, else the shipped picture for it (its slug's, then its goal's). */
export async function dripPhotos(): Promise<(d: { id: string; slug: string; category: string }) => SiteImage> {
  const media = await getSiteMedia();
  return (d) => applyMedia(dripImage(d.slug, d.category), media.get(dripSlot(d.slug)));
}

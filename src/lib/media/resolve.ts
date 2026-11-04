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

/**
 * A drip's photo only when the admin has uploaded one (Admin → Site images),
 * else null. The redesigned site shows the drip's own bag in its colour, and
 * an upload in the bag's place: on its card, and in its page's first screen
 * (the user's rule, 2026-11-03). The shipped stand-ins are never shown there.
 */
/**
 * A place's photo only when the admin has uploaded one, else null: for places
 * that must never show a stand-in (the About page's team, 2026-11-03: only real
 * photographs of the people, as the client's page promises).
 */
export async function uploadedSiteImages(): Promise<(slot: SlotKey) => SiteImage | null> {
  const media = await getSiteMedia();
  return (slot) => {
    const row = media.get(slot);
    return row?.file && row.width && row.height ? applyMedia(SITE_IMAGES[SLOTS[slot].fallback], row) : null;
  };
}

export async function uploadedDripPhotos(): Promise<(slug: string) => SiteImage | null> {
  const media = await getSiteMedia();
  return (slug) => {
    const row = media.get(dripSlot(slug));
    return row?.file && row.width && row.height ? applyMedia(dripImage(slug, ""), row) : null;
  };
}

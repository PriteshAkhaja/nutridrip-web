import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guard";
import { adminNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { connectDB } from "@/lib/db/mongoose";
import { Drip, SiteMedia } from "@/lib/models";
import { SITE_IMAGES, dripImage } from "@/lib/site-images";
import { DRIP_FRAME, DRIP_PHONE, PAGES, SLOTS, dripSlot, type SlotKey } from "@/lib/media/slots";
import { applyMedia, needFor, startPosition, type MediaRecord } from "@/lib/media/rules";
import { getClockFormat } from "@/lib/settings/clock";
import { shortDateClock } from "@/lib/time";
import { ImageManager, type ImageGroup, type ImageItem } from "./ImageManager";

export const metadata: Metadata = { title: "Site images" };
export const dynamic = "force-dynamic";

type Row = MediaRecord & { updatedAt?: Date };

/**
 * Every photograph on the website, by page, then every drip's own photograph,
 * each replaceable (lib/media). Super admin only, like the colours. This page
 * only gathers them; ImageManager lays them out and ImageEditor changes one.
 */
export default async function SiteImagesPage() {
  const session = await requirePermission("settings.manage");
  await connectDB();
  const [nav, clockFormat, rows, drips] = await Promise.all([
    adminNav(),
    getClockFormat(),
    SiteMedia.find().lean<Row[]>(),
    Drip.find({ isActive: true })
      .select("slug name category isPublic")
      .sort({ name: 1 })
      .lean<Array<{ _id: unknown; slug: string; name: string; category?: string | null; isPublic?: boolean }>>(),
  ]);
  const media = new Map(rows.map((r) => [r.slot, r]));

  const item = (
    slot: string,
    title: string,
    shipped: {
      src: string;
      alt: string;
      position: string;
      width: number;
      height: number;
      blur: string;
      credit: string;
    },
    frame: { w: number; h: number },
    phone: { w: number; h: number },
    extra?: Partial<ImageItem>
  ): ImageItem => {
    const r = media.get(slot);
    const img = applyMedia(shipped, r);
    return {
      slot,
      title,
      image: { src: img.src, alt: img.alt, position: img.position, width: img.width, height: img.height },
      status: !r ? "original" : r.file ? "replaced" : "edited",
      updated: r?.updatedAt ? shortDateClock(r.updatedAt, clockFormat) : null,
      need: needFor(frame),
      frame,
      phone,
      startPosition: startPosition(shipped.position, !!r?.file),
      ...extra,
    };
  };

  const groups: ImageGroup[] = [
    ...PAGES.map((p) => ({
      key: p.key,
      name: p.name,
      path: p.path,
      items: (Object.keys(SLOTS) as SlotKey[])
        .filter((k) => SLOTS[k].page === p.key)
        .map((k) => item(k, SLOTS[k].label, SITE_IMAGES[SLOTS[k].fallback], SLOTS[k].frame, SLOTS[k].phone)),
    })),
    {
      key: "drips-own",
      name: "Each drip",
      path: "/drips",
      note: "Shown on the drip's card, its page and the Drips menu. Until one is uploaded, a drip shows the photo for its goal.",
      items: drips.map((d) => {
        const category = d.category || "Wellness";
        return item(dripSlot(d.slug), d.name, dripImage(d.slug, category), DRIP_FRAME, DRIP_PHONE, {
          where: d.isPublic === false ? `${category} · not on the website` : category,
          viewPath: `/drips/${d.slug}`,
        });
      }),
    },
  ];

  const latest = rows.reduce<Date | null>((a, r) => (r.updatedAt && (!a || r.updatedAt > a) ? r.updatedAt : a), null);

  return (
    <ConsoleShell
      session={session}
      roleLabel="Super admin"
      nav={nav}
      activeHref="/admin/images"
      breadcrumb={["Platform", "Site images"]}
      title="Site images"
    >
      <ImageManager groups={groups} lastChange={latest ? shortDateClock(latest, clockFormat) : null} />
    </ConsoleShell>
  );
}

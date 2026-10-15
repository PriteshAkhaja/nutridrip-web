import type { SiteImage } from "@/lib/site-images";

/**
 * The rules for a replaced photograph, pure so they are tested
 * (tests/media.test.ts) and shared by the upload route and the admin screen.
 */

/** What a browser can send and the resizer can read. HEIC is left out: browsers cannot show it to preview. */
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const ACCEPT_ATTR = ACCEPTED_TYPES.join(",");
/** Formats as the resizer names them. */
const ACCEPTED_FORMATS = ["jpeg", "png", "webp", "avif", "heif"];

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
/** Big enough to stay sharp at the widest any layout shows a photo (about 640 CSS px, at 2x). */
export const MIN_LONG_EDGE = 1200;
export const MIN_SHORT_EDGE = 600;

/** What is stored: the longest any layout needs, landscape and portrait. */
export const MAX_LANDSCAPE_WIDTH = 1600;
export const MAX_PORTRAIT_WIDTH = 1400;

export type Frame = { w: number; h: number };

/**
 * What a place on the site needs, from the size it is drawn at there. `min` is
 * that size: a smaller photo would be stretched and look blurry on any screen,
 * so it is refused. `ideal` is twice it, for high-resolution screens (phones,
 * laptops): a photo between the two is allowed, with a note. Rounded up to 10.
 */
export type Need = { min: Frame; ideal: Frame };
export function needFor(frame: Frame): Need {
  const up = (n: number) => Math.ceil(n / 10) * 10;
  return { min: { w: up(frame.w), h: up(frame.h) }, ideal: { w: up(frame.w * 2), h: up(frame.h * 2) } };
}

/** Too small for its place: both sides must reach the place's size. */
export function sizeProblem(width: number, height: number, need: Need): string | null {
  if (width >= need.min.w && height >= need.min.h) return null;
  return `The photo is ${width} × ${height} px. This place needs at least ${need.min.w} × ${need.min.h} px to look sharp (${need.ideal.w} × ${need.ideal.h} px or more is ideal).`;
}

/** Big enough, but short of ideal: said, not refused. */
export function sizeNote(width: number, height: number, need: Need): string | null {
  if (sizeProblem(width, height, need) || (width >= need.ideal.w && height >= need.ideal.h)) return null;
  return `The photo is ${width} × ${height} px. It will look a little soft on high-resolution screens, such as a phone or a MacBook; ${need.ideal.w} × ${need.ideal.h} px or more is ideal.`;
}

/**
 * Why an upload cannot be used, in words for the admin, or null. With the
 * place's `need` the size is judged against it; without, against the general
 * floor.
 */
export function uploadProblem(
  f: { bytes: number; format?: string | null; width?: number | null; height?: number | null },
  need?: Need
): string | null {
  if (!f.bytes) return "The file is empty.";
  if (f.bytes > MAX_UPLOAD_BYTES)
    return `The file is ${(f.bytes / 1024 / 1024).toFixed(1)} MB; the limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`;
  if (!f.format || !ACCEPTED_FORMATS.includes(f.format)) return "Upload a JPEG, PNG, WebP or AVIF photograph.";
  const w = f.width ?? 0,
    h = f.height ?? 0;
  if (need) return sizeProblem(w, h, need);
  if (Math.max(w, h) < MIN_LONG_EDGE || Math.min(w, h) < MIN_SHORT_EDGE)
    return `The photo is ${w} × ${h} px. It needs at least ${MIN_LONG_EDGE} px on the long side and ${MIN_SHORT_EDGE} px on the short side to stay sharp.`;
  return null;
}

/** The size it is stored at: never enlarged. */
export function storedSize(width: number, height: number): { width: number; height: number } {
  const max = width >= height ? MAX_LANDSCAPE_WIDTH : MAX_PORTRAIT_WIDTH;
  if (width <= max) return { width, height };
  return { width: max, height: Math.round((height * max) / width) };
}

/** "x% y%": where the subject sits, so any crop keeps it. Anything else is refused. */
export function focalPoint(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const m = /^\s*(\d{1,3}(?:\.\d+)?)%\s+(\d{1,3}(?:\.\d+)?)%\s*$/.exec(input);
  if (!m) return null;
  const x = Number(m[1]),
    y = Number(m[2]);
  if (x > 100 || y > 100) return null;
  return `${Math.round(x)}% ${Math.round(y)}%`;
}

/**
 * Where a slot's files are kept, so the folder says what is in it:
 *   images/site/<page>/<place>/   for "home.goal-energy" → images/site/home/goal-energy/
 *   images/drips/<slug>/          for a drip
 */
export function slotFolder(slot: string, dripSlug?: string | null): string {
  if (slot.startsWith("drip.")) return `images/drips/${safeSegment(dripSlug || slot.slice(5))}`;
  const [page, place] = slot.split(".");
  return `images/site/${safeSegment(page)}/${safeSegment(place ?? "photo")}`;
}

function safeSegment(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "x"
  );
}

/** A new name per upload ("20261014-153012-a1b2c3.jpg"): browsers can cache each one forever. */
export function fileName(now: Date, random: string): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}-${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}`;
  return `${stamp}-${
    random
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 8) || "0"
  }.jpg`;
}

/**
 * A key the storage will read or write: relative, lower-case, no "..", no
 * leading slash, ending in a file name. Anything else (a path from a URL
 * included) is refused, so a request can never reach outside the folder.
 */
export function isSafeKey(key: string): boolean {
  return /^images\/[a-z0-9-]+(\/[a-z0-9-]+)*\/[a-z0-9-]+\.(jpg|jpeg|png|webp|avif)$/.test(key) && !key.includes("..");
}

export function contentTypeOf(key: string): string {
  const ext = key.slice(key.lastIndexOf(".") + 1);
  return ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "avif" ? "image/avif" : "image/jpeg";
}

/** The address a stored file is served at (app/media/[...path]). */
export function mediaUrl(key: string): string {
  return `/media/${key}`;
}

/** What is saved for a slot. */
export type MediaRecord = {
  slot: string;
  /** Storage key of the uploaded photograph; null when only the details were changed. */
  file?: string | null;
  width?: number | null;
  height?: number | null;
  blur?: string | null;
  alt?: string | null;
  position?: string | null;
};

/**
 * The photograph a slot shows: the upload over the shipped one. A new photo
 * brings its own description and a centred subject unless told otherwise; with
 * no upload, edited details apply to the shipped photo.
 */
export function applyMedia(shipped: SiteImage, row?: MediaRecord | null): SiteImage {
  if (!row) return shipped;
  if (row.file && row.width && row.height) {
    return {
      src: mediaUrl(row.file),
      alt: row.alt?.trim() || "",
      width: row.width,
      height: row.height,
      position: row.position || "50% 50%",
      credit: "",
      // Never the shipped photo's preview: it would flash the old picture first.
      blur: row.blur || "",
    };
  }
  return {
    ...shipped,
    alt: row.alt?.trim() || shipped.alt,
    position: row.position || shipped.position,
  };
}

/**
 * Dragging a photo inside its frame (Admin → Site images). The frame shows the
 * photo covering it, so only one direction has spare picture to slide over:
 * dragging the picture right shows more of its left, which lowers the x
 * position. Returns the new "x% y%" as numbers, held inside 0–100; a direction
 * with no spare picture stays where it is.
 */
export function dragPosition(
  start: { x: number; y: number },
  drag: { dx: number; dy: number },
  frame: { w: number; h: number },
  image: { w: number; h: number }
): { x: number; y: number } {
  const scale = Math.max(frame.w / image.w, frame.h / image.h);
  const spareX = image.w * scale - frame.w;
  const spareY = image.h * scale - frame.h;
  const move = (p: number, d: number, spare: number) =>
    spare < 1 ? p : Math.round(Math.min(100, Math.max(0, p - (d / spare) * 100)) * 10) / 10;
  return { x: move(start.x, drag.dx, spareX), y: move(start.y, drag.dy, spareY) };
}

/** "x% y%" as numbers, centred if it is not a position. */
export function parsePosition(position: string): { x: number; y: number } {
  const m = /^\s*(\d{1,3}(?:\.\d+)?)%\s+(\d{1,3}(?:\.\d+)?)%\s*$/.exec(position);
  return m ? { x: Math.min(100, Number(m[1])), y: Math.min(100, Number(m[2])) } : { x: 50, y: 50 };
}

/**
 * Where a photo starts, for "Reset position": an uploaded photo starts
 * centred (that is where a new upload is put), the shipped one where it was
 * placed when it was chosen.
 */
export function startPosition(shipped: string, hasUpload: boolean): string {
  return hasUpload ? "50% 50%" : shipped;
}

/** Whether two positions are the same place, ignoring how they are written. */
export function samePosition(a: string, b: string): boolean {
  const x = parsePosition(a),
    y = parsePosition(b);
  return Math.abs(x.x - y.x) < 0.5 && Math.abs(x.y - y.y) < 0.5;
}

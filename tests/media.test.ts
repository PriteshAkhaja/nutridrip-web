import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SITE_IMAGES, goalImage } from "@/lib/site-images";
import { CATEGORIES } from "@/lib/data/marketing";
import {
  frameOf,
  DRIP_FRAME,
  PAGES,
  SLOTS,
  dripSlugOf,
  dripSlot,
  goalTileSlot,
  isSlotKey,
  type SlotKey,
} from "@/lib/media/slots";
import {
  MIN_LONG_EDGE,
  applyMedia,
  dragPosition,
  needFor,
  sizeNote,
  sizeProblem,
  samePosition,
  startPosition,
  parsePosition,
  fileName,
  focalPoint,
  isSafeKey,
  mediaUrl,
  slotFolder,
  storedSize,
  uploadProblem,
} from "@/lib/media/rules";

const keys = Object.keys(SLOTS) as SlotKey[];

describe("the slots", () => {
  it("each shows a shipped photo until replaced, on a page that exists", () => {
    const pages = new Set<string>(PAGES.map((p) => p.key));
    for (const k of keys) {
      expect(SITE_IMAGES[SLOTS[k].fallback], k).toBeTruthy();
      expect(pages.has(SLOTS[k].page), k).toBe(true);
    }
    for (const p of PAGES)
      expect(
        keys.some((k) => SLOTS[k].page === p.key),
        p.key
      ).toBe(true);
  });

  it("are each used by a public page, and no page shows a shipped photo directly", () => {
    const dir = path.join(process.cwd(), "src/app/(site)");
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (p.endsWith(".tsx")) files.push(p);
      }
    };
    walk(dir);
    const source = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");
    // The goal tiles are reached through goalTileSlot(category), not by name.
    for (const k of keys.filter((k) => !k.startsWith("home.goal-"))) expect(source, k).toContain(`"${k}"`);
    expect(source).not.toMatch(/SITE_IMAGES\./);
  });

  it("give every home goal tile a slot that starts as today's tile", () => {
    for (const c of CATEGORIES) {
      const slot = goalTileSlot(c.slug);
      expect(slot, c.slug).not.toBeNull();
      expect(SITE_IMAGES[SLOTS[slot!].fallback]).toBe(goalImage(c.slug));
    }
    expect(goalTileSlot("Not a goal")).toBeNull();
  });

  it("key a drip by its slug, which a reseed keeps (its id it does not)", () => {
    expect(dripSlot("hydrate-plus")).toBe("drip.hydrate-plus");
    expect(dripSlugOf(dripSlot("hydrate-plus"))).toBe("hydrate-plus");
    for (const bad of ["drip.", "drip.Hydrate-Plus", "drip.../etc", "drip.a/b", "hydrate-plus"])
      expect(dripSlugOf(bad), bad).toBeNull();
    expect(isSlotKey(dripSlot("hydrate-plus"))).toBe(false);
    expect(isSlotKey("home.closing")).toBe(true);
    expect(isSlotKey("home.hero")).toBe(false);
  });
});

describe("an upload", () => {
  const good = { bytes: 2_000_000, format: "jpeg", width: 3000, height: 2000 };
  it("is accepted as a large enough JPEG, PNG, WebP or AVIF", () => {
    for (const format of ["jpeg", "png", "webp", "avif"]) expect(uploadProblem({ ...good, format })).toBeNull();
    expect(uploadProblem({ ...good, width: MIN_LONG_EDGE, height: 800 })).toBeNull();
  });
  it("is refused when empty, too heavy, the wrong kind, or too small, saying why", () => {
    expect(uploadProblem({ ...good, bytes: 0 })).toMatch(/empty/);
    expect(uploadProblem({ ...good, bytes: 16 * 1024 * 1024 })).toMatch(/limit is 15 MB/);
    expect(uploadProblem({ ...good, format: "gif" })).toMatch(/JPEG, PNG, WebP or AVIF/);
    expect(uploadProblem({ ...good, format: "svg" })).toMatch(/JPEG/);
    expect(uploadProblem({ ...good, width: 1000, height: 700 })).toMatch(/1000 × 700 px/);
    expect(uploadProblem({ ...good, width: 2000, height: 400 })).toMatch(/short side/);
  });
  it("is stored no larger than any layout needs, and never enlarged", () => {
    expect(storedSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(storedSize(3000, 4000)).toEqual({ width: 1400, height: 1867 });
    expect(storedSize(1300, 900)).toEqual({ width: 1300, height: 900 });
  });
});

describe("the focus point", () => {
  it("is two percentages, rounded", () => {
    expect(focalPoint("40% 60%")).toBe("40% 60%");
    expect(focalPoint(" 33.4%  66.6% ")).toBe("33% 67%");
    expect(focalPoint("0% 100%")).toBe("0% 100%");
  });
  it("refuses anything else, so nothing but a position reaches the page's style", () => {
    for (const v of ["120% 5%", "50%", "left top", "50% 50%; background:red", "", null, 42])
      expect(focalPoint(v)).toBeNull();
  });
});

describe("where files are kept", () => {
  it("is a folder per page and place, and per drip by its name", () => {
    expect(slotFolder("home.goal-energy")).toBe("images/site/home/goal-energy");
    expect(slotFolder("how-it-works.step-slot")).toBe("images/site/how-it-works/step-slot");
    expect(slotFolder("drip.hydrate-plus", "hydrate-plus")).toBe("images/drips/hydrate-plus");
    expect(slotFolder("drip.hydrate-plus", "../../etc")).toBe("images/drips/etc");
  });
  it("names each upload anew, so a file never changes once served", () => {
    expect(fileName(new Date(Date.UTC(2026, 9, 14, 15, 30, 12)), "A1B2c3d4")).toBe("20261014-153012-a1b2c3d4.jpg");
  });
  it("only ever reads or writes keys inside the images folder", () => {
    expect(isSafeKey("images/site/home/hero/20261014-153012-a1b2c3.jpg")).toBe(true);
    expect(isSafeKey("images/drips/hydrate-plus/20261014-153012-a1b2c3.jpg")).toBe(true);
    for (const bad of [
      "../secret.jpg",
      "/images/site/a.jpg",
      "images/../../.env.jpg",
      "images/site/home/Hero.jpg",
      "images/site/home/hero.exe",
      "storage/images/a.jpg",
      "images/site\\home\\a.jpg",
      "images/a.jpg",
    ])
      expect(isSafeKey(bad), bad).toBe(false);
  });
});

describe("what a slot shows", () => {
  const shipped = SITE_IMAGES.homeHero;
  it("is the shipped photo with nothing saved", () => {
    expect(applyMedia(shipped, null)).toBe(shipped);
  });
  it("is the upload, with its own description and never the old preview", () => {
    const shown = applyMedia(shipped, {
      slot: "home.closing",
      file: "images/site/home/hero/20261014-153012-a1b2c3.jpg",
      width: 1600,
      height: 1067,
      blur: "data:image/jpeg;base64,xyz",
      alt: "A nurse at a patient's home",
      position: null,
    });
    expect(shown.src).toBe(mediaUrl("images/site/home/hero/20261014-153012-a1b2c3.jpg"));
    expect(shown.alt).toBe("A nurse at a patient's home");
    expect(shown.position).toBe("50% 50%");
    expect(shown.blur).toBe("data:image/jpeg;base64,xyz");
    expect(
      applyMedia(shipped, { slot: "home.closing", file: "images/site/home/hero/x.jpg", width: 10, height: 10 }).blur
    ).toBe("");
  });
  it("is the shipped photo with new details when only those were changed", () => {
    const shown = applyMedia(shipped, { slot: "home.closing", file: null, alt: "New words", position: "20% 30%" });
    expect(shown.src).toBe(shipped.src);
    expect(shown.alt).toBe("New words");
    expect(shown.position).toBe("20% 30%");
  });
});

describe("dragging a photo in its frame", () => {
  // A 3:2 photo in a 4:3 frame has spare picture sideways only.
  const frame = { w: 400, h: 300 };
  const photo = { w: 1600, h: 1067 };
  it("slides the picture with the pointer: right shows more of the left", () => {
    // Covering the frame the photo is 450 px wide, so 50 px of spare to share.
    expect(dragPosition({ x: 50, y: 50 }, { dx: 25, dy: 0 }, frame, photo)).toEqual({ x: 0, y: 50 });
    expect(dragPosition({ x: 50, y: 50 }, { dx: -25, dy: 0 }, frame, photo)).toEqual({ x: 100, y: 50 });
    expect(dragPosition({ x: 50, y: 50 }, { dx: 5, dy: 0 }, frame, photo).x).toBe(40);
  });
  it("leaves a direction with no spare picture where it is", () => {
    expect(dragPosition({ x: 50, y: 30 }, { dx: 0, dy: 80 }, frame, photo)).toEqual({ x: 50, y: 30 });
  });
  it("slides a tall photo up and down, and never leaves 0–100", () => {
    const tall = { w: 1000, h: 1500 };
    const up = dragPosition({ x: 50, y: 50 }, { dx: 0, dy: -40 }, frame, tall);
    expect(up.y).toBeGreaterThan(50);
    expect(dragPosition({ x: 50, y: 98 }, { dx: 0, dy: -9999 }, frame, tall).y).toBe(100);
    expect(dragPosition({ x: 2, y: 50 }, { dx: 9999, dy: 0 }, frame, photo).x).toBe(0);
  });
  it("reads a saved position back, centred when it is not one", () => {
    expect(parsePosition("40% 60%")).toEqual({ x: 40, y: 60 });
    expect(parsePosition("12.5% 80%")).toEqual({ x: 12.5, y: 80 });
    for (const v of ["", "left top", "50%", "150% 20%"])
      expect(parsePosition(v), v).toEqual(v === "150% 20%" ? { x: 100, y: 20 } : { x: 50, y: 50 });
  });
  it("is saved the way the server accepts it", () => {
    const p = dragPosition({ x: 50, y: 50 }, { dx: 7, dy: 0 }, frame, photo);
    expect(focalPoint(`${p.x}% ${p.y}%`)).not.toBeNull();
  });
});

describe("resetting a position", () => {
  it("goes back to the centre for an uploaded photo, and to the original placing for a shipped one", () => {
    expect(startPosition("40% 40%", true)).toBe("50% 50%");
    expect(startPosition("40% 40%", false)).toBe("40% 40%");
  });
  it("knows when a photo is already there", () => {
    expect(samePosition("50% 24%", "50% 24%")).toBe(true);
    expect(samePosition("50% 24.2%", "50% 24%")).toBe(true);
    expect(samePosition("50% 24%", "50% 40%")).toBe(false);
    expect(samePosition("not a position", "50% 50%")).toBe(true);
  });
});

describe("what each place needs", () => {
  it("is the size it is drawn at, and twice that for sharp high-resolution screens", () => {
    expect(needFor({ w: 384, h: 346 })).toEqual({ min: { w: 390, h: 350 }, ideal: { w: 770, h: 700 } });
    expect(needFor({ w: 588, h: 676 })).toEqual({ min: { w: 590, h: 680 }, ideal: { w: 1180, h: 1360 } });
  });
  it("is different for each place, so one photo can suit one and not another", () => {
    const small = needFor(SLOTS["about.physicians"].frame);
    const tall = needFor(SLOTS["how-it-works.step-slot"].frame);
    expect(small.min.h).toBeLessThan(tall.min.h);
    expect(sizeProblem(900, 500, small)).toBeNull();
    expect(sizeProblem(900, 500, tall)).toMatch(/needs at least 590 × 680 px/);
    expect(sizeProblem(250, 170, small)).toMatch(/250 × 170 px/);
  });
  it("refuses a photo below the place's size, notes one below twice it, and says nothing to a large one", () => {
    const need = needFor({ w: 500, h: 400 });
    expect(sizeProblem(400, 300, need)).not.toBeNull();
    expect(sizeProblem(600, 450, need)).toBeNull();
    expect(sizeNote(600, 450, need)).toMatch(/a little soft on high-resolution screens/);
    expect(sizeNote(400, 300, need)).toBeNull(); // refused, not merely noted
    expect(sizeNote(1000, 800, need)).toBeNull();
    expect(sizeNote(2000, 790, need)).not.toBeNull(); // wide enough, not tall enough for ideal
  });
  it("is judged by the place on the server, and by the general floor where there is none", () => {
    const good = { bytes: 1_000_000, format: "jpeg", width: 700, height: 500 };
    expect(uploadProblem(good, needFor({ w: 500, h: 400 }))).toBeNull();
    expect(uploadProblem(good)).toMatch(/1200 px on the long side/);
  });
  it("is known for every place and every drip, and no other", () => {
    for (const k of keys) expect(frameOf(k), k).toEqual(SLOTS[k].frame);
    expect(frameOf(dripSlot("hydrate-plus"))).toEqual(DRIP_FRAME);
    expect(frameOf("nowhere.at-all")).toBeNull();
  });
  it("is met by the photo each place ships with, so the shipped site would pass its own rule", () => {
    for (const k of keys) {
      const shipped = SITE_IMAGES[SLOTS[k].fallback];
      const need = needFor(SLOTS[k].frame);
      expect(
        sizeProblem(shipped.width, shipped.height, need),
        `${k}: ${shipped.src} is ${shipped.width} × ${shipped.height}`
      ).toBeNull();
    }
    for (const key of Object.keys(SITE_IMAGES) as Array<keyof typeof SITE_IMAGES>) {
      if (!key.startsWith("goal") && !["dripBag", "dripChamber", "dripStand"].includes(key)) continue;
      const shipped = SITE_IMAGES[key];
      expect(sizeProblem(shipped.width, shipped.height, needFor(DRIP_FRAME)), key).toBeNull();
    }
  });
});

describe("npm run seed", () => {
  const seed = fs.readFileSync(path.join(process.cwd(), "scripts/seed.ts"), "utf8");
  const wipe = seed.slice(seed.indexOf("async function wipe()"), seed.indexOf("async function seedUsers"));
  it("leaves the replaced photos and the brand colours alone", () => {
    expect(wipe).toMatch(/deleteMany/);
    expect(wipe).not.toMatch(/\bSiteMedia\b/);
    expect(wipe).not.toMatch(/\bPlatformSettings\b/);
    // Nor the uploaded files ("storageCondition", how a drug is kept, is not them).
    expect(seed).not.toMatch(
      /SiteMedia\.(deleteMany|deleteOne|drop|collection)|dropDatabase|STORAGE_DIR|["'`]storage[/"'`]|\b(rmSync|unlink|unlinkSync|rmdir)\(/
    );
  });
  it("recreates the drips with the same slugs, so their photos find them again", () => {
    for (const slug of ["hydrate-plus", "myers-revive", "immune-shield"]) expect(seed, slug).toContain(`"${slug}"`);
  });
});

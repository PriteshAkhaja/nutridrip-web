import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_GRACE_DAYS, formatBytes, planCleanup } from "@/lib/media/cleanup";
import { deleteFile, listFiles, putFile } from "@/lib/storage";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-15T10:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * DAY);
const f = (key: string, bytes = 1000) => ({ key, bytes });
const k = (n: string) => `images/site/home/closing/20261001-000000-${n}.jpg`;

describe("which stored photographs may be deleted", () => {
  const base = { now, graceDays: 30 };

  it("never touches a file a photo record points to, however old or retired", () => {
    const plan = planCleanup({
      ...base,
      files: [f(k("used"))],
      used: new Set([k("used")]),
      retired: new Map([[k("used"), ago(400)]]),
    });
    expect(plan.inUse.map((x) => x.key)).toEqual([k("used")]);
    expect(plan.remove).toEqual([]);
    expect(plan.waiting).toEqual([]);
    // A retirement record for a file now in use is stale, and is cleared.
    expect(plan.staleRecords).toEqual([k("used")]);
  });

  it("deletes a file only after a full grace period out of use", () => {
    const retired = new Map([
      [k("old"), ago(31)],
      [k("exact"), ago(30)],
      [k("recent"), ago(5)],
    ]);
    const plan = planCleanup({
      ...base,
      files: [f(k("old")), f(k("exact")), f(k("recent"))],
      used: new Set(),
      retired,
    });
    expect(plan.remove.map((x) => x.key)).toEqual([k("exact"), k("old")]);
    expect(plan.waiting.map((x) => [x.key, x.daysLeft])).toEqual([[k("recent"), 25]]);
  });

  it("counts the grace period from when it stopped being used, not from its upload", () => {
    // A photo that served the site for a year was replaced yesterday: its file is a year old, its grace has barely begun.
    const plan = planCleanup({
      ...base,
      files: [f(k("year"))],
      used: new Set(),
      retired: new Map([[k("year"), ago(1)]]),
    });
    expect(plan.remove).toEqual([]);
    expect(plan.waiting[0].daysLeft).toBe(29);
  });

  it("starts the clock on a file nobody has noticed, and never deletes it on a first sighting", () => {
    const plan = planCleanup({ ...base, files: [f(k("stray"))], used: new Set(), retired: new Map() });
    expect(plan.remove).toEqual([]);
    expect(plan.mark.map((x) => x.key)).toEqual([k("stray")]);
    expect(plan.waiting[0].daysLeft).toBe(30);
  });

  it("with no grace at all, deletes everything unused at once, and still never a file in use", () => {
    const plan = planCleanup({
      now,
      graceDays: 0,
      files: [f(k("a")), f(k("b")), f(k("used"))],
      used: new Set([k("used")]),
      retired: new Map([[k("a"), ago(0)]]),
    });
    expect(plan.remove.map((x) => x.key)).toEqual([k("a"), k("b")]);
    expect(plan.inUse.map((x) => x.key)).toEqual([k("used")]);
    expect(plan.mark).toEqual([]);
  });

  it("clears the records of files already gone, and adds up the sizes", () => {
    const plan = planCleanup({
      ...base,
      files: [f(k("old"), 2000), f(k("wait"), 500), f(k("used"), 700)],
      used: new Set([k("used")]),
      retired: new Map([
        [k("old"), ago(40)],
        [k("wait"), ago(2)],
        [k("gone"), ago(90)],
      ]),
    });
    expect(plan.staleRecords).toEqual([k("gone")]);
    expect(plan.bytes).toEqual({ remove: 2000, waiting: 500, inUse: 700 });
  });

  it("defaults to 30 days, and says sizes the way people read them", () => {
    expect(DEFAULT_GRACE_DAYS).toBe(30);
    expect(formatBytes(900)).toBe("900 B");
    expect(formatBytes(204_800)).toBe("200 KB");
    expect(formatBytes(3_145_728)).toBe("3.0 MB");
  });
});

describe("listing what is stored", () => {
  let dir: string;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "nd-list-"));
    process.env.STORAGE_DIR = dir;
  });
  afterAll(() => {
    delete process.env.STORAGE_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("is empty for an empty or missing folder", async () => {
    expect(await listFiles()).toEqual([]);
  });
  it("lists every photograph with its size, by key, and skips what is not one", async () => {
    await putFile(k("a"), Buffer.alloc(1234));
    await putFile("images/drips/hydrate-plus/20261001-000000-b.jpg", Buffer.alloc(99));
    // A temporary file left by a crash, and a file that is not a photograph key.
    fs.writeFileSync(path.join(dir, "images", "site", "home", "closing", "crash.tmp"), "x");
    fs.writeFileSync(path.join(dir, "images", "notes.txt"), "x");
    const listed = (await listFiles()).sort((x, y) => x.key.localeCompare(y.key));
    expect(listed).toEqual([
      { key: "images/drips/hydrate-plus/20261001-000000-b.jpg", bytes: 99 },
      { key: k("a"), bytes: 1234 },
    ]);
  });
  it("sees a file go when it is deleted", async () => {
    await deleteFile(k("a"));
    expect((await listFiles()).map((x) => x.key)).toEqual(["images/drips/hydrate-plus/20261001-000000-b.jpg"]);
  });
});

describe("recording that a file is out of use", () => {
  const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
  it("happens when a photo is replaced, restored, or its drip deleted", () => {
    const media = read("src/app/api/admin/media/route.ts");
    expect(media).toMatch(/retireFile\(before\.file, slot, "replaced"\)/);
    expect(media).toMatch(/retireFile\(row\?\.file, slot, "restored"\)/);
    const drips = read("src/app/api/drips/[id]/route.ts");
    expect(drips).toMatch(/retireFile\(photo\?\.file, dripSlot\(drip\.slug\), "drip-deleted"\)/);
  });
  it("never deletes a file itself: only the cleanup command does", () => {
    for (const p of [
      "src/app/api/admin/media/route.ts",
      "src/app/api/drips/[id]/route.ts",
      "src/lib/media/retire.ts",
    ]) {
      expect(read(p), p).not.toMatch(/deleteFile\(|unlink|rmSync/);
    }
  });
  it("is left alone by npm run seed, like the photo records", () => {
    const seed = read("scripts/seed.ts");
    const wipe = seed.slice(seed.indexOf("async function wipe()"), seed.indexOf("async function seedUsers"));
    expect(wipe).not.toMatch(/\bMediaRetired\b/);
  });
});

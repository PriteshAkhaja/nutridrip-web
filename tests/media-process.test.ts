import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp, { type SharpOptions } from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UploadError, processUpload } from "@/lib/media/process";
import { deleteFile, getFile, putFile } from "@/lib/storage";

// Everything is written to a throwaway folder, never the real storage/.
let dir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "nd-storage-"));
  process.env.STORAGE_DIR = dir;
});
afterAll(() => {
  delete process.env.STORAGE_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

const photo = (w: number, h: number, extra: Partial<SharpOptions["create"]> = {}) =>
  sharp({ create: { width: w, height: h, channels: 3, background: "#4488cc", ...extra } });

describe("storage", () => {
  const key = "images/site/home/hero/20261014-153012-a1b2c3d4.jpg";
  it("keeps a file under its key and gives it back byte for byte", async () => {
    await putFile(key, Buffer.from("hello"));
    expect(fs.existsSync(path.join(dir, ...key.split("/")))).toBe(true);
    expect((await getFile(key))?.toString()).toBe("hello");
  });
  it("leaves no half-written or temporary file behind", async () => {
    const folder = path.join(dir, "images", "site", "home", "hero");
    expect(fs.readdirSync(folder).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });
  it("answers null for a file that is not there, and deletes quietly twice", async () => {
    await deleteFile(key);
    expect(await getFile(key)).toBeNull();
    await expect(deleteFile(key)).resolves.toBeUndefined();
  });
  it("refuses any key that could reach outside the images folder", async () => {
    for (const bad of ["../x.jpg", "images/../../x.jpg", "/etc/passwd.jpg", "images/a.jpg", "images\\a\\b.jpg"]) {
      await expect(putFile(bad, Buffer.from("x")), bad).rejects.toThrow(/Refused storage key/);
      expect(await getFile(bad), bad).toBeNull();
    }
    expect(fs.existsSync(path.join(dir, "..", "x.jpg"))).toBe(false);
  });
});

describe("processUpload", () => {
  it("stores a large landscape photo at 1600 px, as a JPEG, in the slot's folder", async () => {
    const out = await processUpload(await photo(3200, 2000).png().toBuffer(), "home.step-physician");
    expect(out.file).toMatch(/^images\/site\/home\/step-physician\/\d{8}-\d{6}-[a-z0-9]+\.jpg$/);
    expect(out.width).toBe(1600);
    expect(out.height).toBe(1000);
    const stored = await getFile(out.file);
    const meta = await sharp(stored!).metadata();
    expect(meta.format).toBe("jpeg");
    expect([meta.width, meta.height]).toEqual([1600, 1000]);
    expect(out.bytes).toBe(stored!.length);
  });

  it("stores a portrait photo at 1400 px wide, and never enlarges a smaller one", async () => {
    const tall = await processUpload(await photo(2100, 3000).jpeg().toBuffer(), "home.step-physician");
    expect([tall.width, tall.height]).toEqual([1400, 2000]);
    const modest = await processUpload(await photo(1300, 900).jpeg().toBuffer(), "home.step-physician");
    expect([modest.width, modest.height]).toEqual([1300, 900]);
  });

  it("makes a 20 px preview a browser can show while the photo loads", async () => {
    const out = await processUpload(await photo(2000, 1000).jpeg().toBuffer(), "pricing.hero");
    expect(out.blur.startsWith("data:image/jpeg;base64,")).toBe(true);
    const preview = await sharp(Buffer.from(out.blur.split(",")[1], "base64")).metadata();
    expect(preview.width).toBe(20);
    expect(out.blur.length).toBeLessThan(2500);
  });

  it("turns a phone photo upright and strips the camera's data, location included", async () => {
    // A 2400×1600 sensor image tagged "rotate 90°": upright it is 1600×2400.
    const tagged = await photo(2400, 1600)
      .withMetadata({ orientation: 6, exif: { IFD0: { Copyright: "someone" } } })
      .jpeg()
      .toBuffer();
    expect((await sharp(tagged).metadata()).exif).toBeDefined();
    const out = await processUpload(tagged, "home.step-physician");
    expect([out.width, out.height]).toEqual([1400, 2100]);
    expect(out.height).toBeGreaterThan(out.width);
    const meta = await sharp((await getFile(out.file))!).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation ?? 1).toBe(1);
  });

  it("turns the picture itself upright, not only its size", async () => {
    // Sensor image: left half red, right half blue, tagged "rotate 90° clockwise".
    // Upright, the sensor's left edge is the top: red above, blue below.
    const left = await photo(1200, 1600, { background: "#ff0000" }).png().toBuffer();
    const sensor = await photo(2400, 1600, { background: "#0000ff" })
      .composite([{ input: left, left: 0, top: 0 }])
      .withMetadata({ orientation: 6 })
      .jpeg({ quality: 95 })
      .toBuffer();
    const out = await processUpload(sensor, "home.step-physician");
    const stored = (await getFile(out.file))!;
    const at = async (x: number, y: number) =>
      (await sharp(stored).extract({ left: x, top: y, width: 8, height: 8 }).resize(1, 1).raw().toBuffer()).subarray(
        0,
        3
      );
    const top = await at(300, 100);
    const bottom = await at(300, out.height - 120);
    expect(top[0]).toBeGreaterThan(200); // red
    expect(top[2]).toBeLessThan(80);
    expect(bottom[2]).toBeGreaterThan(200); // blue
    expect(bottom[0]).toBeLessThan(80);
  });

  it("puts a transparent PNG on white rather than black", async () => {
    const clear = await sharp({
      create: { width: 1400, height: 900, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
    const out = await processUpload(clear, "home.step-physician");
    const px = await sharp((await getFile(out.file))!)
      .resize(1, 1)
      .raw()
      .toBuffer();
    expect(px[0]).toBeGreaterThan(240);
    expect(px[1]).toBeGreaterThan(240);
    expect(px[2]).toBeGreaterThan(240);
  });

  it("files a drip's photo under the drip's name", async () => {
    const out = await processUpload(await photo(1600, 1100).jpeg().toBuffer(), "drip.hydrate-plus", "hydrate-plus");
    expect(out.file).toMatch(/^images\/drips\/hydrate-plus\//);
  });

  it("gives every upload a name of its own, so nothing is overwritten", async () => {
    const data = await photo(1600, 1000).jpeg().toBuffer();
    const a = await processUpload(data, "zones.hero");
    const b = await processUpload(data, "zones.hero");
    expect(a.file).not.toBe(b.file);
    expect(await getFile(a.file)).not.toBeNull();
    expect(await getFile(b.file)).not.toBeNull();
  });

  it("refuses what is not a photo, a small photo, or a format the site cannot show, with a reason", async () => {
    await expect(processUpload(Buffer.from("just text, named .jpg"), "home.step-physician")).rejects.toThrow(
      /not a photograph/
    );
    await expect(processUpload(Buffer.alloc(0), "home.step-physician")).rejects.toBeInstanceOf(UploadError);
    await expect(processUpload(await photo(640, 480).jpeg().toBuffer(), "home.step-physician")).rejects.toThrow(
      /640 × 480 px/
    );
    await expect(processUpload(await photo(2000, 400).jpeg().toBuffer(), "home.step-physician")).rejects.toThrow(
      /needs at least 580 × 670 px/
    );
    await expect(processUpload(await photo(1600, 1000).gif().toBuffer(), "home.step-physician")).rejects.toThrow(
      /JPEG, PNG, WebP or AVIF/
    );
  });

  it("writes nothing when it refuses", async () => {
    const before = fs.readdirSync(path.join(dir, "images", "site"), { recursive: true }).length;
    await processUpload(await photo(300, 300).jpeg().toBuffer(), "about.closing").catch(() => {});
    expect(fs.readdirSync(path.join(dir, "images", "site"), { recursive: true }).length).toBe(before);
  });
});

describe("image quality settings", () => {
  it("lets Next serve the admin previews at 90 as well as the site's 75", async () => {
    const config = fs.readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8");
    expect(config).toMatch(/qualities:\s*\[75,\s*90\]/);
    const slot = fs.readFileSync(path.join(process.cwd(), "src/app/admin/images/ImageEditor.tsx"), "utf8");
    expect(slot).toMatch(/quality=\{90\}/);
  });
});

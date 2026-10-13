// Share of strongly teal/cyan pixels (hue 170–215, saturation > 0.35) in each image.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
for (const dir of process.argv.slice(2))
  for (const f of fs.readdirSync(dir)) {
    if (!/\.(png|jpe?g|webp|avif)$/i.test(f)) continue;
    const { data, info } = await sharp(path.join(dir, f))
      .resize(200, 200, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let teal = 0,
      all = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      all++;
      const r = data[i] / 255,
        g = data[i + 1] / 255,
        b = data[i + 2] / 255,
        mx = Math.max(r, g, b),
        mn = Math.min(r, g, b),
        l = (mx + mn) / 2,
        d = mx - mn;
      if (d < 0.05) continue;
      const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      const h = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
      if (s > 0.35 && h >= 170 && h <= 215 && l > 0.15 && l < 0.85) teal++;
    }
    const pct = (100 * teal) / Math.max(all, 1);
    if (pct > 2) console.log(`${pct.toFixed(1).padStart(5)}%  ${dir}/${f}`);
  }

// Quick raster check of each cutout on the light stage ground and on ink,
// before anything is built in HTML. Writes lab/cutout/preview-*.png.
import fs from "node:fs";
import sharp from "sharp";

const meta = JSON.parse(fs.readFileSync("data/assets.json", "utf8"));
const GROUNDS = {
  light: { top: [255, 255, 255], bottom: [236, 240, 244] },
  dark: { top: [10, 14, 18], bottom: [4, 6, 8] },
};

async function ground(w, h, g) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgb(${g.top})"/><stop offset="1" stop-color="rgb(${g.bottom})"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

for (const [gname, g] of Object.entries(GROUNDS)) {
  const items = ["vial", "ampoule", "bag"];
  const W = 2200,
    H = 1700;
  const layers = [];
  let x = 80;
  for (const name of items) {
    const m = meta[name];
    const scale = name === "bag" ? 1.05 : 1.5;
    const ow = Math.round(m.size.w * scale),
      oh = Math.round(m.size.h * scale);
    const top = H - 140 - Math.round(m.object.y1 * scale);
    if (m.shadow && gname === "light") {
      const sw = Math.round(m.shadow.w * scale),
        sh = Math.round(m.shadow.h * scale);
      const left = x + Math.round(m.shadow.x * scale),
        stop = top + Math.round(m.shadow.y * scale);
      const buf = await sharp(`assets/${name}-shadow.webp`).resize(sw, sh).png().toBuffer();
      const cl = Math.max(0, -left),
        ct = Math.max(0, -stop);
      const ex = await sharp(buf)
        .extract({
          left: cl,
          top: ct,
          width: Math.min(sw - cl, W - Math.max(left, 0)),
          height: Math.min(sh - ct, H - Math.max(stop, 0)),
        })
        .png()
        .toBuffer();
      layers.push({ input: ex, left: Math.max(left, 0), top: Math.max(stop, 0) });
    }
    const file = gname === "dark" ? `assets/${name}-dark.webp` : `assets/${name}.webp`;
    layers.push({ input: await sharp(file).resize(ow, oh).png().toBuffer(), left: x, top });
    x += ow + 140;
  }
  await sharp(await ground(W, H, g))
    .composite(layers)
    .png()
    .toFile(`lab/cutout/preview-${gname}.png`);
  console.log(`lab/cutout/preview-${gname}.png`);
}

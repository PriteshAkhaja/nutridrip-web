// Turns the generated stills into the compositing layers the assembly needs.
//
//   node tools/prepare.mjs            (run from scrollcraft/builds/home-v2)
//
// Per object, in assets/:
//   <name>.webp         white-ground cutout, true alpha. Clear material keeps
//                       its refraction as alpha (darkness), opaque parts (caps,
//                       labels, crimp) keep alpha 1 so they never turn into
//                       holes on a tinted ground.
//   <name>-dark.webp    the same object for a deep ink ground. Bright-field
//                       glass is drawn by dark refraction lines; on ink the
//                       same lines are drawn light, which is what rim light does.
//   <name>-sheen.webp   the object's own highlights, for the layer ABOVE a
//                       printed label: the gloss crossing the print is what
//                       makes a label read as printed under the plastic.
//   <name>-shadow.webp  the shadow on the floor, its own layer, so it can stay
//                       on the floor (or fade) while the object moves.
// and data/assets.json with each layer's size and the anchors the page needs
// (label area, meniscus, hanging hole, base line).
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { analyse } from "./analyse.mjs";
import { blur, saveRGBA, clamp, bbox } from "./img.mjs";

fs.mkdirSync("assets", { recursive: true });
fs.mkdirSync("data", { recursive: true });

const INK = [10 / 255, 12 / 255, 14 / 255];
const RIM = [0.94, 0.96, 0.98];

const SETS = {
  "kie-bag-1": {
    file: "out/kie-bag-1.png",
    seeds: [[864, 1200]],
    // The ground between the two ports is enclosed by the seam above it.
    // Below the welded seam only the two ports are bag; the ground beside and
    // between them is cleared (the closed outline can wrap small pockets of it).
    carve: [
      { x0: 600, y0: 1732, x1: 757, y1: 1915 },
      { x0: 858, y0: 1732, x1: 905, y1: 1915 },
      { x0: 981, y0: 1732, x1: 1150, y1: 1915 },
    ],
    objects: {
      bag: {
        // Port caps are solid white plastic; the port tubes are frosted.
        opaque: [
          { x0: 758, y0: 1793, x1: 857, y1: 1892 },
          { x0: 906, y0: 1818, x1: 980, y1: 1888 },
        ],
        // The two ports, traced as cylinders (row by row between their
        // outermost edges). On ink they show the photograph's own shading of
        // frosted plastic: a lit object, not a flat fill or a broken outline.
        ports: [
          { x0: 750, y0: 1738, x1: 868, y1: 1898, frost: 0.92 },
          { x0: 896, y0: 1738, x1: 988, y1: 1894, frost: 0.55, capY: 1814 },
        ],
        shadow: "photo",
        hole: { x: 870, y: 590 },
      },
    },
  },
  "kie-containers-1": {
    file: "out/kie-containers-1.png",
    spans: [
      { name: "vial", x0: 958, y0: 498, x1: 1324, y1: 1279 },
      { name: "ampoule", x0: 1533, y0: 360, x1: 1754, y1: 1279 },
    ],
    objects: {
      vial: {
        box: { x0: 958, y0: 498, x1: 1324, y1: 1279 },
        // Cap and crimp; the stopper seen through the neck; the wrap label.
        opaque: [
          { x0: 958, y0: 498, x1: 1324, y1: 646 },
          { x0: 1030, y0: 646, x1: 1252, y1: 742 },
          { x0: 958, y0: 895, x1: 1324, y1: 1156 },
        ],
        label: { y0: 895, y1: 1156 },
        shadow: "cast",
      },
      ampoule: {
        box: { x0: 1533, y0: 360, x1: 1754, y1: 1279 },
        opaque: [{ x0: 1533, y0: 900, x1: 1754, y1: 1098 }],
        label: { y0: 900, y1: 1098 },
        shadow: "cast",
      },
    },
  },
};

const meta = {};

for (const [setName, set] of Object.entries(SETS)) {
  const a = await analyse(set.file, set.seeds ?? [], { spans: set.spans ?? [], carve: set.carve ?? [] });
  const { w, h } = a;
  const n = w * h;

  // Highlights and fine structure, shared by the sheen layers.
  const soft = blur(a.fL, w, h, 10);

  for (const [name, o] of Object.entries(set.objects)) {
    // This object's own silhouette: the set's silhouette inside its box.
    const ob = o.box ?? a.box;
    const sil = new Uint8Array(n);
    for (let y = ob.y0; y <= ob.y1; y++) for (let x = ob.x0; x <= ob.x1; x++) sil[y * w + x] = a.sil[y * w + x];
    const sb = bbox(sil, w, h);
    const inRects = (rects, x, y) => (rects ?? []).some((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);

    // Soft-edged silhouette so the outline is antialiased.
    const silSoft = blur(Float32Array.from(sil), w, h, 1.2);
    const opq = new Float32Array(n);
    for (let y = sb.y0; y <= sb.y1; y++)
      for (let x = sb.x0; x <= sb.x1; x++) if (sil[y * w + x] && inRects(o.opaque, x, y)) opq[y * w + x] = 1;
    const opqSoft = blur(opq, w, h, 1.2);

    const L = { r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n), a: new Float32Array(n) };
    const D = { r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n), a: new Float32Array(n) };
    const S = { r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n), a: new Float32Array(n) };
    // The sheen only exists to cross printed labels, so it lives where a
    // label can be: the bag's body inside the welded seam, a container's label
    // band. Kept off the outline, where it would only add noise.
    const zone = new Float32Array(n);
    {
      const H = sb.y1 - sb.y0,
        W = sb.x1 - sb.x0,
        seam = Math.round(W * 0.07);
      const z = o.label
        ? { x0: sb.x0 + 6, x1: sb.x1 - 6, y0: o.label.y0 - 40, y1: o.label.y1 + 40 }
        : { x0: sb.x0 + seam, x1: sb.x1 - seam, y0: sb.y0 + Math.round(H * 0.13), y1: sb.y0 + Math.round(H * 0.84) };
      for (let y = z.y0; y <= z.y1; y++) for (let x = z.x0; x <= z.x1; x++) zone[y * w + x] = 1;
    }
    const zoneSoft = blur(zone, w, h, 10);

    for (let y = sb.y0 - 4; y <= sb.y1 + 4; y++) {
      for (let x = sb.x0 - 4; x <= sb.x1 + 4; x++) {
        const i = y * w + x;
        const m = silSoft[i];
        if (m <= 0.001) continue;
        const f = [a.fr[i], a.fg[i], a.fb[i]];
        const fmin = Math.min(f[0], f[1], f[2]);
        const op = opqSoft[i];

        // White ground: alpha is the darkness, colour solved so the result over
        // white is the flat-fielded photograph exactly.
        // A small knee: the last few percent of darkness is ground the fit
        // missed, not glass, and would print as a faint card edge.
        let aw = clamp((1 - fmin - 0.012) * 1.1, 0, 1);
        let cw = f.map((v) => (aw > 0.004 ? clamp((v - (1 - aw)) / aw, 0, 1) : 0));
        // Opaque parts: their own colour at full alpha.
        aw = aw * (1 - op) + op;
        cw = cw.map((v, k) => v * (1 - op) + clamp(f[k], 0, 1) * op);
        L.r[i] = cw[0];
        L.g[i] = cw[1];
        L.b[i] = cw[2];
        L.a[i] = aw * m;

        // Ink ground: dark refraction lines become light rim lines; highlights
        // stay highlights; opaque and frosted parts keep their colour, a touch
        // lower, as they would under the same light in a dark room.
        const d = clamp(1 - a.fL[i], 0, 1);
        const hi = clamp((a.fL[i] - 1.02) * 3.2, 0, 1);
        const rim = clamp((d - 0.035) * 1.6, 0, 1);
        let ad = rim + hi * (1 - rim);
        let cd = RIM.map((v) => v);
        ad = ad * (1 - op) + op;
        cd = cd.map((v, k) => v * (1 - op) + clamp(f[k], 0, 1) * 0.86 * op);
        D.r[i] = cd[0];
        D.g[i] = cd[1];
        D.b[i] = cd[2];
        D.a[i] = ad * m;

        // Sheen: highlights above the ground, plus the fine light structure of
        // the film (crinkles, seams), white; a little of its fine dark
        // structure, ink. Never the broad refraction bands, which belong to
        // the liquid behind the print.
        const hp = a.fL[i] - soft[i];
        const sw = clamp((a.fL[i] - 1.0) * 2.6, 0, 1) + clamp(hp * 5, 0, 1);
        const sd = clamp(-hp * 2.2, 0, 0.35);
        const zm = zoneSoft[i] * m;
        if (sw >= sd) {
          S.r[i] = 1;
          S.g[i] = 1;
          S.b[i] = 1;
          S.a[i] = clamp(sw, 0, 0.9) * zm;
        } else {
          S.r[i] = INK[0];
          S.g[i] = INK[1];
          S.b[i] = INK[2];
          S.a[i] = sd * zm;
        }
      }
    }

    // Ports on ink: inside each traced port, the photograph's own colour (its
    // frosted-plastic shading), nearly opaque; the septum and cap rows solid.
    const portMask = new Float32Array(n),
      portA = new Float32Array(n);
    for (const pr of o.ports ?? []) {
      const rows = [];
      for (let y = pr.y0; y <= pr.y1; y++) {
        let l = -1,
          r = -1;
        for (let x = pr.x0; x <= pr.x1; x++)
          if (a.grad[y * w + x] > 0.018) {
            if (l < 0) l = x;
            r = x;
          }
        rows.push(l < 0 ? null : [l, r]);
      }
      const med = (arr) => {
        const v = arr.filter((q) => q != null).sort((p, q) => p - q);
        return v.length ? v[v.length >> 1] : null;
      };
      for (let k = 0; k < rows.length; k++) {
        const win = rows.slice(Math.max(0, k - 3), k + 4);
        const l = med(win.map((q) => q?.[0])),
          r = med(win.map((q) => q?.[1]));
        if (l == null) continue;
        const y = pr.y0 + k;
        // The tube grows out of the weld: no hard top edge.
        const grow = clamp((y - pr.y0) / 22, 0, 1);
        for (let x = l; x <= r; x++) {
          portMask[y * w + x] = grow;
          portA[y * w + x] = pr.capY && y >= pr.capY ? 1 : pr.frost;
        }
      }
    }
    const portSoft = blur(portMask, w, h, 1.0);
    for (let i = 0; i < n; i++) {
      const pm = portSoft[i];
      if (pm <= 0.002) continue;
      const pa = (portA[i] || 0.85) * pm;
      const cp = [a.fr[i], a.fg[i], a.fb[i]].map((v) => clamp(v, 0, 1) * 0.9);
      const a0 = D.a[i],
        aOut = pa + a0 * (1 - pa);
      D.r[i] = (cp[0] * pa + D.r[i] * a0 * (1 - pa)) / Math.max(aOut, 1e-4);
      D.g[i] = (cp[1] * pa + D.g[i] * a0 * (1 - pa)) / Math.max(aOut, 1e-4);
      D.b[i] = (cp[2] * pa + D.b[i] * a0 * (1 - pa)) / Math.max(aOut, 1e-4);
      D.a[i] = aOut;
    }

    // Shadows.
    const Sh = { a: new Float32Array(n) };
    let shadowBox = null;
    if (o.shadow === "photo") {
      // The floor under the object, flattened against its own fitted ground,
      // keeping only what is darker than it.
      const y0 = sb.y1 + 10,
        y1 = h - 1,
        x0 = Math.max(0, sb.x0 - 60),
        x1 = Math.min(w - 1, sb.x1 + 380);
      const floor = fitFloor(a, x0, y0, x1, y1);
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const i = y * w + x;
          const s = clamp((1 - a.L[i] / floor[i]) * 1.1, 0, 1);
          // Fade at the region's edges so nothing ends on a line.
          const fe = Math.min(1, (x - x0) / 220, (x1 - x) / 220, (y1 - y) / 120, (y - y0) / 30);
          Sh.a[i] = s < 0.04 ? 0 : s * 0.8 * clamp(fe, 0, 1) ** 1.5;
        }
      shadowBox = { x0, y0, x1, y1 };
    } else if (o.shadow === "cast") {
      // Built from the silhouette: the light comes from the upper left, so the
      // shadow runs right along the floor, sharp at the base and softer with
      // distance, the way the photographed ones do.
      const base = sb.y1,
        H = sb.y1 - sb.y0;
      const reach = Math.round(H * 0.85);
      const x0 = sb.x0 - 40,
        x1 = sb.x1 + reach,
        y0 = base - 40,
        y1 = base + 70;
      const hard = new Float32Array(n);
      for (let y = sb.y0; y <= sb.y1; y++)
        for (let x = sb.x0; x <= sb.x1; x++) {
          if (!sil[y * w + x]) continue;
          const up = (base - y) / H; // 0 at the base, 1 at the top
          const sx = Math.round(x + up * reach),
            sy = Math.round(base - 4 + up * 26);
          if (sx < w && sy < h) hard[sy * w + sx] = Math.max(hard[sy * w + sx], 1);
        }
      const near = blur(hard, w, h, 4),
        far = blur(hard, w, h, 16);
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const i = y * w + x;
          const t = clamp((x - sb.x1) / reach, 0, 1);
          const cast = (near[i] * (1 - t) + far[i] * t) * 0.34 * (1 - 0.65 * t);
          // Contact: a tight dark line where the glass meets the floor.
          const cx = (sb.x0 + sb.x1) / 2,
            rx = (sb.x1 - sb.x0) / 2 + 6;
          const dx = (x - cx) / rx,
            dy = (y - base) / 9;
          const contact = Math.max(0, 1 - dx * dx - dy * dy) ** 1.5 * 0.45;
          Sh.a[i] = clamp(Math.max(cast, contact), 0, 0.6);
        }
      shadowBox = { x0, y0, x1, y1 };
    }

    // Crop: the object with a margin; the shadow in its own crop.
    const pad = 24;
    const crop = { x: Math.max(0, sb.x0 - pad), y: Math.max(0, sb.y0 - pad) };
    crop.w = Math.min(w, sb.x1 + pad + 1) - crop.x;
    crop.h = Math.min(h, sb.y1 + pad + 1) - crop.y;
    await saveRGBA(`assets/${name}.webp`, w, h, L.r, L.g, L.b, L.a, { crop, webp: true });
    await saveRGBA(`assets/${name}-dark.webp`, w, h, D.r, D.g, D.b, D.a, { crop, webp: true });
    if (name === "bag") {
      // For the lamp-lit room: the same rim-lit bag, its light warmed to the lamp.
      const WARM = [1.0, 0.86, 0.7];
      await saveRGBA(
        `assets/${name}-room.webp`,
        w,
        h,
        D.r.map((v) => v * WARM[0] * 0.95),
        D.g.map((v) => v * WARM[1] * 0.95),
        D.b.map((v) => v * WARM[2] * 0.95),
        D.a,
        { crop, webp: true }
      );
    }
    await saveRGBA(`assets/${name}-sheen.webp`, w, h, S.r, S.g, S.b, S.a, { crop, webp: true });
    await saveRGBA(`assets/${name}.png`, w, h, L.r, L.g, L.b, L.a, { crop });
    const one = new Float32Array(n);
    const ink = [new Float32Array(n).fill(INK[0]), new Float32Array(n).fill(INK[1]), new Float32Array(n).fill(INK[2])];
    let shadowCrop = null;
    if (shadowBox) {
      shadowCrop = { x: Math.max(0, shadowBox.x0), y: Math.max(0, shadowBox.y0) };
      shadowCrop.w = Math.min(w - 1, shadowBox.x1) - shadowCrop.x + 1;
      shadowCrop.h = Math.min(h - 1, shadowBox.y1) - shadowCrop.y + 1;
      await saveRGBA(`assets/${name}-shadow.webp`, w, h, ink[0], ink[1], ink[2], Sh.a, {
        crop: shadowCrop,
        webp: true,
      });
    }
    void one;

    // The bag's fill. The photograph is full, so the empty state is made from
    // it: below the meniscus the liquid's refraction bands are lifted toward
    // clear film, while the air pocket above, the seams and the outline stay
    // exactly as shot. The page reveals the full plate over the empty one from
    // the bottom up, so the last frame of the fill IS the photograph.
    let fill = null;
    if (name === "bag") {
      const anchors = bagAnchors(a, sb, { x: 0, y: 0 });
      const mY = anchors.meniscus;
      const inner = blur(Float32Array.from(sil), w, h, 40);
      const E = { r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n), a: new Float32Array(n) };
      const ED = { r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n), a: new Float32Array(n) };
      for (let y = sb.y0 - 4; y <= sb.y1 + 4; y++)
        for (let x = sb.x0 - 4; x <= sb.x1 + 4; x++) {
          const i = y * w + x;
          const m = silSoft[i];
          if (m <= 0.001) continue;
          // 0 in the air pocket, 1 from just above the meniscus down, so the
          // empty plate carries no liquid line at all.
          const below = clamp((y - mY + 22) / 14, 0, 1) * (y < sb.y1 - 230 ? 1 : clamp((sb.y1 - 120 - y) / 110, 0, 1));
          const wInt = clamp((inner[i] - 0.62) / 0.3, 0, 1) * below;
          const k = 1 - 0.92 * wInt;
          const f = [a.fr[i], a.fg[i], a.fb[i]].map((v) => 1 - (1 - v) * k);
          const fmin = Math.min(f[0], f[1], f[2]);
          let aw = clamp((1 - fmin - 0.012) * 1.1, 0, 1);
          const op = opqSoft[i];
          let cw = f.map((v) => (aw > 0.004 ? clamp((v - (1 - aw)) / aw, 0, 1) : 0));
          aw = aw * (1 - op) + op;
          cw = cw.map((v, kk) => v * (1 - op) + clamp(a[["fr", "fg", "fb"][kk]][i], 0, 1) * op);
          E.r[i] = cw[0];
          E.g[i] = cw[1];
          E.b[i] = cw[2];
          E.a[i] = aw * m;
          // Ink ground, from the same lifted darkness.
          const fL = 1 - (1 - a.fL[i]) * k;
          const d = clamp(1 - fL, 0, 1);
          const hi = clamp((fL - 1.02) * 3.2, 0, 1);
          const rim = clamp((d - 0.035) * 1.6, 0, 1);
          let ad = rim + hi * (1 - rim);
          ad = ad * (1 - op) + op;
          ED.r[i] = D.r[i];
          ED.g[i] = D.g[i];
          ED.b[i] = D.b[i];
          if (!op) {
            ED.r[i] = RIM[0];
            ED.g[i] = RIM[1];
            ED.b[i] = RIM[2];
          }
          ED.a[i] = ad * m;
          if (portSoft[i] > 0.002) {
            ED.r[i] = D.r[i];
            ED.g[i] = D.g[i];
            ED.b[i] = D.b[i];
            ED.a[i] = D.a[i];
          }
        }
      await saveRGBA(`assets/${name}-empty.webp`, w, h, E.r, E.g, E.b, E.a, { crop, webp: true });
      await saveRGBA(`assets/${name}-dark-empty.webp`, w, h, ED.r, ED.g, ED.b, ED.a, { crop, webp: true });
      // The photograph's own meniscus, as a strip that rides the rising level:
      // only the film between the seams, its ends feathered into it.
      const seamIn = anchors.seam + 8;
      let r0 = -1,
        r1 = -1;
      for (let x = sb.x0; x <= sb.x1; x++)
        if (sil[mY * w + x]) {
          if (r0 < 0) r0 = x;
          r1 = x;
        }
      const strip = { x: r0 + seamIn, y: mY - 16, w: r1 - r0 - 2 * seamIn + 1, h: 44 };
      const feather = (A) => {
        const out = Float32Array.from(A);
        for (let y = strip.y; y < strip.y + strip.h; y++)
          for (let x = strip.x; x < strip.x + strip.w; x++) {
            const e = Math.min(
              1,
              (x - strip.x) / 40,
              (strip.x + strip.w - 1 - x) / 40,
              (y - strip.y) / 6,
              (strip.y + strip.h - 1 - y) / 6
            );
            out[y * w + x] *= clamp(e, 0, 1);
          }
        return out;
      };
      await saveRGBA(`assets/${name}-meniscus.webp`, w, h, L.r, L.g, L.b, feather(L.a), { crop: strip, webp: true });
      await saveRGBA(`assets/${name}-dark-meniscus.webp`, w, h, D.r, D.g, D.b, feather(D.a), {
        crop: strip,
        webp: true,
      });
      // The film's inner span on each row below the meniscus, so the strip can
      // be fitted to the bag's width at any level (the sides are not straight).
      const rows = [];
      for (let y = mY; y <= sb.y1 - 150; y += 6) {
        let x0 = -1,
          x1 = -1;
        for (let x = sb.x0; x <= sb.x1; x++)
          if (sil[y * w + x]) {
            if (x0 < 0) x0 = x;
            x1 = x;
          }
        rows.push([y - crop.y, x0 + seamIn - crop.x, x1 - seamIn - crop.x]);
      }
      fill = {
        meniscus: mY - crop.y,
        strip: { x: strip.x - crop.x, y: strip.y - crop.y, w: strip.w, h: strip.h },
        rows,
      };
    }

    meta[name] = {
      source: set.file,
      size: { w: crop.w, h: crop.h },
      // Everything below is in the cutout's own pixels.
      object: { x0: sb.x0 - crop.x, y0: sb.y0 - crop.y, x1: sb.x1 - crop.x, y1: sb.y1 - crop.y },
      shadow: shadowCrop
        ? { x: shadowCrop.x - crop.x, y: shadowCrop.y - crop.y, w: shadowCrop.w, h: shadowCrop.h }
        : null,
      label: o.label ? { y0: o.label.y0 - crop.y, y1: o.label.y1 - crop.y } : null,
      hole: o.hole ? { x: o.hole.x - crop.x, y: o.hole.y - crop.y } : null,
      ...(name === "bag" ? bagAnchors(a, sb, crop) : {}),
      ...(fill ? { fill } : {}),
    };
    console.log(name, JSON.stringify(meta[name]));
  }
}
fs.writeFileSync("data/assets.json", JSON.stringify(meta, null, 2));

// The floor's own brightness, fitted per row with the shadow excluded: two
// passes, dropping what is clearly darker than the first fit.
function fitFloor(a, x0, y0, x1, y1) {
  const { w, L } = a;
  const out = new Float32Array(L.length).fill(1);
  for (let y = y0; y <= y1; y++) {
    let keep = [];
    for (let x = x0; x <= x1; x++) keep.push([x, L[y * w + x]]);
    for (let pass = 0; pass < 3; pass++) {
      const c = quad(keep);
      keep = keep.filter(([x, v]) => v > c(x) * 0.97);
    }
    const c = quad(keep);
    for (let x = x0; x <= x1; x++) out[y * w + x] = Math.max(c(x), 0.05);
  }
  // Smooth down the rows: the floor is a smooth surface.
  return blur(out, w, a.h, 6);
}
function quad(pts) {
  // Least squares v = p + q x + r x^2, x normalised.
  if (pts.length < 3) return () => 1;
  const xs = pts.map((p) => p[0]),
    m = xs.reduce((s, v) => s + v, 0) / xs.length,
    sc = Math.max(...xs) - Math.min(...xs) || 1;
  let S = [0, 0, 0, 0, 0],
    T = [0, 0, 0];
  for (const [x0, v] of pts) {
    const x = (x0 - m) / sc;
    S[0] += 1;
    S[1] += x;
    S[2] += x * x;
    S[3] += x * x * x;
    S[4] += x * x * x * x;
    T[0] += v;
    T[1] += v * x;
    T[2] += v * x * x;
  }
  const A = [
    [S[0], S[1], S[2]],
    [S[1], S[2], S[3]],
    [S[2], S[3], S[4]],
  ];
  const det = (M) =>
    M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
    M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
    M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  const D = det(A) || 1e-9;
  const col = (k) => A.map((row, i) => row.map((v, j) => (j === k ? T[i] : v)));
  const p = det(col(0)) / D,
    q = det(col(1)) / D,
    r = det(col(2)) / D;
  return (x0) => {
    const x = (x0 - m) / sc;
    return p + q * x + r * x * x;
  };
}

// The bag's anchors: the meniscus (the strongest horizontal edge across the
// middle of the bag), and the clear body inside the welded seam, which bounds
// where a label may sit and where the turn's light sweep may run.
function bagAnchors(a, sb, crop) {
  const { w, fL } = a;
  const cx0 = Math.round(sb.x0 + (sb.x1 - sb.x0) * 0.3),
    cx1 = Math.round(sb.x0 + (sb.x1 - sb.x0) * 0.7);
  let best = { y: 0, e: 0 };
  for (let y = sb.y0 + 120; y < sb.y0 + (sb.y1 - sb.y0) * 0.55; y++) {
    let e = 0;
    for (let x = cx0; x <= cx1; x++) e += Math.abs(fL[(y + 2) * w + x] - fL[(y - 2) * w + x]);
    if (e > best.e) best = { y, e };
  }
  // Inner body: per row, the silhouette span shrunk by the seam width.
  const seam = Math.round((sb.x1 - sb.x0) * 0.055);
  return {
    meniscus: best.y - crop.y,
    seam,
    body: {
      x0: sb.x0 + seam - crop.x,
      x1: sb.x1 - seam - crop.x,
      y0: sb.y0 + Math.round((sb.y1 - sb.y0) * 0.12) - crop.y,
      y1: sb.y0 + Math.round((sb.y1 - sb.y0) * 0.82) - crop.y,
    },
  };
}

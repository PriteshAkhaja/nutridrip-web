// Silhouette, ground estimate and flat-field for one generated still.
// Used by prepare.mjs, and on its own with --debug to check each stage by eye.
//
//   node tools/analyse.mjs out/kie-bag-1.png 864,1037
//
// The generated sets are lit like a real studio: a light beam crosses the
// sweep and black flags stand in frame, so the ground is far from flat. A
// blurred global estimate of it fails. Instead:
//   1. the outline comes from crisp local edges (the ground's gradients are soft),
//   2. the ground behind the object is a smooth surface fitted to a ring of clean
//      ground just outside that outline.
import path from "node:path";
import { load, blur, dilate, floodFromBorder, component, bbox, saveGray } from "./img.mjs";

export async function analyse(file, seeds, opts = {}) {
  const {
    edge = 0.045,
    close = 6,
    ringIn = 24,
    ringOut = 150,
    floorCut = 30,
    debug = false,
    dbgDir = "lab/cutout",
  } = opts;
  const im = await load(file);
  const { w, h, L } = im;
  const n = w * h;

  // 1. Edges: gradient magnitude of a lightly smoothed luminance.
  const s = blur(L, w, h, 1);
  const grad = new Float32Array(n);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = s[i - w + 1] + 2 * s[i + 1] + s[i + w + 1] - s[i - w - 1] - 2 * s[i - 1] - s[i + w - 1];
      const gy = s[i + w - 1] + 2 * s[i + w] + s[i + w + 1] - s[i - w - 1] - 2 * s[i - w] - s[i - w + 1];
      grad[i] = Math.hypot(gx, gy) / 4;
    }
  const e = Float32Array.from(grad, (v) => (v > edge ? 1 : 0));
  const closed = dilate(e, w, h, close);

  // 2. Silhouette: what the ground cannot reach from the frame edge without
  //    crossing an edge, kept only where it holds a seed. Then shrink back by
  //    the closing radius so the outline sits on the object, not outside it.
  const reach = floodFromBorder(
    Uint8Array.from(closed, (v) => (v ? 0 : 1)),
    w,
    h
  );
  const inside = Uint8Array.from(reach, (v) => (v ? 0 : 1));
  if (debug) {
    const base = path.join(dbgDir, path.basename(file, ".png"));
    await saveGray(
      `${base}-edges.png`,
      w,
      h,
      Float32Array.from(closed, (v, i) => (v ? 0 : inside[i] ? 0.6 : 1)),
      { resize: { width: 720 } }
    );
  }
  let sil = new Uint8Array(n);
  for (const [sx, sy] of seeds) {
    const c = component(inside, w, h, sx, sy);
    for (let i = 0; i < n; i++) if (c[i]) sil[i] = 1;
  }
  // Lathe-turned glass (vials, ampoules) has stretches as bright as the ground,
  // so its outline never closes. Inside a measured box, each row is filled
  // between its outermost edges instead; then the two sides are median-smoothed
  // down the rows so one noisy row cannot notch the outline.
  // The objects are upright and front-on, so they share one vertical axis: the
  // half-width of each row is read from whichever side shows an edge (a white
  // cap or label on a light ground often shows only one), rows that disagree
  // with their neighbours are dropped, and the gaps are interpolated.
  const median = (arr) => {
    const v = arr.filter((x) => x != null).sort((p, q) => p - q);
    return v.length ? v[Math.floor(v.length / 2)] : null;
  };
  for (const s of opts.spans ?? []) {
    const thr = s.edge ?? edge * 0.5;
    const H = s.y1 - s.y0 + 1;
    const L0 = new Array(H).fill(null),
      R0 = new Array(H).fill(null);
    for (let k = 0; k < H; k++) {
      const y = s.y0 + k;
      for (let x = s.x0; x <= s.x1; x++)
        if (grad[y * w + x] > thr) {
          if (L0[k] == null) L0[k] = x;
          R0[k] = x;
        }
    }
    const both = L0.map((l, k) => (l != null && R0[k] - l > 20 ? (l + R0[k]) / 2 : null));
    const c = median(both);
    const half = L0.map((l, k) => (l == null ? null : Math.max(R0[k] - c, c - l)));
    // Reject rows far from their neighbourhood's half-width.
    const clean = half.map((v, k) => {
      if (v == null) return null;
      const m = median(half.slice(Math.max(0, k - 12), k + 13));
      return Math.abs(v - m) > Math.max(5, m * 0.05) ? null : v;
    });
    // Interpolate the gaps, hold the ends.
    const idx = clean.map((v, k) => (v == null ? -1 : k)).filter((k) => k >= 0);
    const filled = clean.map((v, k) => {
      if (v != null) return v;
      const a = [...idx].reverse().find((j) => j < k),
        b = idx.find((j) => j > k);
      if (a == null) return clean[b];
      if (b == null) return clean[a];
      return clean[a] + ((clean[b] - clean[a]) * (k - a)) / (b - a);
    });
    for (let k = 0; k < H; k++) {
      const hw = median(filled.slice(Math.max(0, k - 2), k + 3));
      if (hw == null) continue;
      for (let x = Math.round(c - hw); x <= Math.round(c + hw); x++) sil[(s.y0 + k) * w + x] = 1;
    }
  }
  // Fill holes (a clear port whose inside the ground could not reach is still
  // part of the object), then smooth the outline. It stays a few pixels
  // generous on purpose: outside the object the flat ground is 1, so a generous
  // silhouette adds no alpha there, while a tight one would shave glass edges.
  const outside = floodFromBorder(
    Uint8Array.from(sil, (v) => (v ? 0 : 1)),
    w,
    h
  );
  for (let i = 0; i < n; i++) sil[i] = outside[i] ? 0 : 1;
  const shrunk = blur(Float32Array.from(sil), w, h, 2);
  sil = Uint8Array.from(shrunk, (v) => (v > 0.5 ? 1 : 0));
  // Explicit holes: background enclosed by the object's parts (between ports).
  for (const r of opts.carve ?? [])
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) sil[y * w + x] = 0;
  const box = bbox(sil, w, h);

  // 3. Ground: a smooth surface fitted to a ring of clean ground around the
  //    object. Dark pixels (flags) and the floor below the object (its own
  //    shadow) are left out of the fit.
  const outer = dilate(Float32Array.from(sil), w, h, ringOut);
  const inner = dilate(Float32Array.from(sil), w, h, ringIn);
  const ring = new Uint8Array(n);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      ring[i] = outer[i] && !inner[i] && L[i] > 0.4 && grad[i] < edge * 0.5 && y < box.y1 + floorCut ? 1 : 0;
    }
  const fit = (plane) => polyFit(plane, ring, w, h, box);
  const bgR = fit(im.r),
    bgG = fit(im.g),
    bgB = fit(im.b);
  const bgL = new Float32Array(n);
  for (let i = 0; i < n; i++) bgL[i] = 0.2126 * bgR[i] + 0.7152 * bgG[i] + 0.0722 * bgB[i];

  // 4. Flat-field: the ground becomes exactly 1.
  const fr = new Float32Array(n),
    fg = new Float32Array(n),
    fb = new Float32Array(n),
    fL = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    fr[i] = im.r[i] / Math.max(bgR[i], 0.05);
    fg[i] = im.g[i] / Math.max(bgG[i], 0.05);
    fb[i] = im.b[i] / Math.max(bgB[i], 0.05);
    fL[i] = L[i] / Math.max(bgL[i], 0.05);
  }

  if (debug) {
    const base = path.join(dbgDir, path.basename(file, ".png"));
    const small = { width: 720 };
    await saveGray(
      `${base}-edges.png`,
      w,
      h,
      Float32Array.from(closed, (v) => 1 - v),
      { resize: small }
    );
    await saveGray(
      `${base}-ring.png`,
      w,
      h,
      Float32Array.from(L, (v, i) => (ring[i] ? 1 : v * 0.35)),
      { resize: small }
    );
    await saveGray(
      `${base}-flat.png`,
      w,
      h,
      Float32Array.from(fL, (v, i) => Math.min(1, v * 0.94) * (sil[i] ? 1 : 0.6)),
      { resize: small }
    );
    console.log(
      `${base}: silhouette`,
      box,
      "ring px",
      ring.reduce((a, b) => a + b, 0)
    );
  }
  return { ...im, bgL, fr, fg, fb, fL, sil, box, grad };
}

// Least-squares fit of a bivariate cubic to `plane` over the `use` pixels,
// evaluated everywhere. Coordinates are normalised to the object's box so the
// fit is well conditioned. Subsampled: the ground is smooth.
function polyFit(plane, use, w, h, box) {
  const cx = (box.x0 + box.x1) / 2,
    cy = (box.y0 + box.y1) / 2;
  const sx = Math.max(box.w, 1) * 0.75,
    sy = Math.max(box.h, 1) * 0.75;
  const terms = (u, v) => [1, u, v, u * u, u * v, v * v, u * u * u, u * u * v, u * v * v, v * v * v];
  const K = 10;
  const A = Array.from({ length: K }, () => new Float64Array(K));
  const B = new Float64Array(K);
  for (let y = 0; y < h; y += 3)
    for (let x = 0; x < w; x += 3) {
      const i = y * w + x;
      if (!use[i]) continue;
      const t = terms((x - cx) / sx, (y - cy) / sy);
      for (let a = 0; a < K; a++) {
        B[a] += t[a] * plane[i];
        for (let b = 0; b < K; b++) A[a][b] += t[a] * t[b];
      }
    }
  for (let a = 0; a < K; a++) A[a][a] += 1e-6;
  const c = solve(A, B);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = terms((x - cx) / sx, (y - cy) / sy);
      let v = 0;
      for (let k = 0; k < K; k++) v += c[k] * t[k];
      out[y * w + x] = v;
    }
  return out;
}

function solve(A, B) {
  const n = B.length;
  const M = A.map((row, i) => [...row, B[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

const self = path.resolve(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1"));
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const [file, ...rest] = process.argv.slice(2);
  const seeds = rest.filter((a) => /^\d+,\d+$/.test(a)).map((a) => a.split(",").map(Number));
  const fs = await import("node:fs");
  fs.mkdirSync("lab/cutout", { recursive: true });
  await analyse(file, seeds, { debug: true });
}

// A drip added after the fact: does it appear on Site images by itself, take a photo, and show on the site?
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { request } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:3001";
const SLUG = "zz-test-drip";
const APP = path.resolve("../../..");
const require = createRequire(path.join(APP, "package.json"));
const mongoose = require("mongoose");

const results = [];
const check = (n, p, d = "") => {
  results.push(p);
  console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};

// The settings file, read the plain way: lines of NAME=value.
const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const env = {};
for (const raw of fs.readFileSync(path.join(APP, ".env"), "utf8").split(NL)) {
  const line = raw.split(CR).join("");
  const eq = line.indexOf("=");
  if (eq > 0 && /^[A-Z_]+$/.test(line.slice(0, eq)))
    env[line.slice(0, eq)] = line.slice(eq + 1).replace(/^["']|["']$/g, "");
}

// Copy Hydrate Plus's recipe for the ingredients (read only).
await mongoose.connect(env.MONGODB_URI);
const src = await mongoose.connection.db.collection("drips").findOne({ slug: "hydrate-plus" });
await mongoose.disconnect();
const ing = src.ingredients.map((i) => ({ masterId: String(i.masterId), dose: i.dose, unit: i.unit, role: i.role }));

const a = await request.newContext({ baseURL: BASE });
await a.post("/api/auth/login", { data: { email: "admin@nutridrip.com", password: "admin123" } });
const cardIn = (html) => html.includes(`id="drip.${SLUG}"`);

check("before: no card for the new drip", !cardIn(await (await a.get("/admin/images")).text()));
let r = await a.post("/api/drips", {
  data: {
    name: "Zz Test Drip",
    slug: SLUG,
    category: "Energy",
    priceInr: 4999,
    durationMin: 40,
    ingredients: ing,
    isPublic: true,
    tags: [],
  },
});
const made = await r.json();
check("a new drip is created", r.status() === 201, made.error ?? made.data?.slug);
const id = made.data?.id;

let html = await (await a.get("/admin/images")).text();
check("it appears under Each drip with no other change", cardIn(html));
const at = html.indexOf(`id="drip.${SLUG}"`);
check(
  "showing its goal's photo until it has one (no Replaced or Edited badge)",
  at > 0 && !/Replaced|Edited/.test(html.slice(at, at + 2500))
);

const jpg = fs.readFileSync(path.resolve("../../../public/images/site/goal-skin.jpg"));
r = await a.post("/api/admin/media", {
  multipart: {
    slot: `drip.${SLUG}`,
    alt: "Photo for the test drip",
    file: { name: "t.jpg", mimeType: "image/jpeg", buffer: jpg },
  },
});
const up = await r.json();
check("a photo can be uploaded for it straight away", r.status() === 200, up.data?.file ?? up.error);
for (const [u, what] of [
  ["/drips", "catalogue"],
  [`/drips/${SLUG}`, "its own page"],
]) {
  const h = await (await a.get(u)).text();
  check(`it shows on the ${what}`, h.includes(encodeURIComponent("/media/" + up.data?.file)));
}

// Clean up: the photo first, then the drip.
r = await a.delete(`/api/admin/media?slot=drip.${SLUG}`);
check("photo restored", r.status() === 200);
r = await a.delete(`/api/drips/${id}`);
const del = await r.json();
check(
  "test drip removed",
  r.status() === 200 && !del.data?.retired,
  JSON.stringify(del.data ?? del.error).slice(0, 100)
);
html = await (await a.get("/admin/images")).text();
check("and its card is gone", !cardIn(html));
await a.dispose();
console.log(`${NL}${results.filter(Boolean).length}/${results.length} passed`);

// Deleting a drip takes its replaced photo with it, so a later drip under the same address starts clean.
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
const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const env = {};
for (const raw of fs.readFileSync(path.join(APP, ".env"), "utf8").split(NL)) {
  const line = raw.split(CR).join("");
  const eq = line.indexOf("=");
  if (eq > 0 && /^[A-Z_]+$/.test(line.slice(0, eq)))
    env[line.slice(0, eq)] = line.slice(eq + 1).replace(/^["']|["']$/g, "");
}
await mongoose.connect(env.MONGODB_URI);
const db = mongoose.connection.db;
const src = await db.collection("drips").findOne({ slug: "hydrate-plus" });
const ing = src.ingredients.map((i) => ({ masterId: String(i.masterId), dose: i.dose, unit: i.unit, role: i.role }));
const rowCount = () => db.collection("sitemedias").countDocuments({ slot: `drip.${SLUG}` });

const a = await request.newContext({ baseURL: BASE });
await a.post("/api/auth/login", { data: { email: "admin@nutridrip.com", password: "admin123" } });
const make = async () =>
  (
    await a.post("/api/drips", {
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
    })
  ).json();
const jpg = fs.readFileSync(path.resolve("../../../public/images/site/goal-skin.jpg"));

let made = await make();
check("a test drip is created", !!made.data?.id, made.error);
let r = await a.post("/api/admin/media", {
  multipart: {
    slot: `drip.${SLUG}`,
    alt: "Photo for the test drip",
    file: { name: "t.jpg", mimeType: "image/jpeg", buffer: jpg },
  },
});
check("it is given a photo", r.status() === 200 && (await rowCount()) === 1);
r = await a.delete(`/api/drips/${made.data.id}`);
check(
  "the drip is deleted without restoring the photo first",
  r.status() === 200 && (await r.json()).data?.deleted === true
);
check("its photo record went with it", (await rowCount()) === 0);

made = await make();
check("a new drip under the same address is created", !!made.data?.id, made.error);
const html = await (await a.get("/admin/images")).text();
const at = html.indexOf(`id="drip.${SLUG}"`);
check(
  "it starts clean: no inherited photo (no Replaced or Edited badge)",
  at > 0 && !/Replaced|Edited/.test(html.slice(at, at + 2500))
);
r = await a.delete(`/api/drips/${made.data.id}`);
check("cleaned up", r.status() === 200 && (await rowCount()) === 0);

await a.dispose();
await mongoose.disconnect();
console.log(`${NL}${results.filter(Boolean).length}/${results.length} passed`);

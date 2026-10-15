// On the running dev site: replacing, restoring and deleting a drip each record the moment a file stops
// being used (the start of its grace period), and none of them deletes a file.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { request } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:3001";
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
const retired = (file) => db.collection("mediaretireds").findOne({ file });
const onDisk = (key) => fs.existsSync(path.join(APP, "storage", ...key.split("/")));

const a = await request.newContext({ baseURL: BASE });
await a.post("/api/auth/login", { data: { email: "admin@nutridrip.com", password: "admin123" } });
const jpg = fs.readFileSync(path.resolve("../../../public/images/site/goal-skin.jpg"));
const up = async (slot, alt) =>
  (
    await a.post("/api/admin/media", {
      multipart: { slot, alt, file: { name: "t.jpg", mimeType: "image/jpeg", buffer: jpg } },
    })
  ).json();

// Replace twice: the first file is retired by the second.
const first = await up("zones.hero", "First test photo");
check("a first photo is uploaded", !!first.data?.file);
check("nothing is retired by a first upload", !(await retired(first.data.file)));
const second = await up("zones.hero", "Second test photo");
const rec = await retired(first.data.file);
check(
  "replacing records the old file as retired, just now",
  rec?.reason === "replaced" && Date.now() - new Date(rec.retiredAt).getTime() < 60000,
  rec?.reason
);
check("and the old file is still on disk", onDisk(first.data.file));
check("the new file is not retired", !(await retired(second.data.file)));

// Restore: the current file is retired.
let r = await a.delete("/api/admin/media?slot=zones.hero");
const rest = await retired(second.data.file);
check("restoring records the file as retired", r.status() === 200 && rest?.reason === "restored", rest?.reason);
check("and it is still on disk", onDisk(second.data.file));

// Details only (no file): nothing to retire.
const retiredBefore = await db.collection("mediaretireds").countDocuments();
await a.patch("/api/admin/media", { data: { slot: "zones.hero", alt: "Details only", position: "10% 10%" } });
r = await a.delete("/api/admin/media?slot=zones.hero");
check(
  "restoring a details-only change retires nothing",
  r.status() === 200 && (await db.collection("mediaretireds").countDocuments()) === retiredBefore
);

// A drip deleted with its photo.
const src = await db.collection("drips").findOne({ slug: "hydrate-plus" });
const ing = src.ingredients.map((i) => ({ masterId: String(i.masterId), dose: i.dose, unit: i.unit, role: i.role }));
const made = await (
  await a.post("/api/drips", {
    data: {
      name: "Zz Retire Drip",
      slug: "zz-retire-drip",
      category: "Energy",
      priceInr: 4999,
      durationMin: 40,
      ingredients: ing,
      isPublic: true,
      tags: [],
    },
  })
).json();
const dripPhoto = await up("drip.zz-retire-drip", "Photo for the retire drip");
await a.delete(`/api/drips/${made.data.id}`);
const dr = await retired(dripPhoto.data.file);
check("deleting a drip records its photo as retired", dr?.reason === "drip-deleted", dr?.reason);
check("and the file is still on disk", onDisk(dripPhoto.data.file));

await a.dispose();
await mongoose.disconnect();
console.log(`${NL}${results.filter(Boolean).length}/${results.length} passed`);

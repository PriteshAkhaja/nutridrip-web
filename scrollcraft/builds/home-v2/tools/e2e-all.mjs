// Every end-to-end check of Site images, one after another, against a running dev server.
// The photo records (SiteMedia and MediaRetired) are saved before the run and put back exactly
// afterwards, so a photo someone uploaded by hand is never lost to the tests that replace and
// restore the same places. Files are only ever added to storage by the tests, never deleted.
//   BASE=http://localhost:3001 node tools/e2e-all.mjs
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const BASE = process.env.BASE ?? "http://localhost:3001";
const APP = path.resolve("../../..");
const require = createRequire(path.join(APP, "package.json"));
const mongoose = require("mongoose");
const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const env = {};
for (const raw of fs.readFileSync(path.join(APP, ".env"), "utf8").split(NL)) {
  const line = raw.split(CR).join("");
  const eq = line.indexOf("=");
  if (eq > 0 && /^[A-Z_]+$/.test(line.slice(0, eq)))
    env[line.slice(0, eq)] = line.slice(eq + 1).replace(/^["']|["']$/g, "");
}

const SUITES = [
  ["Site images screen (library + editor)", "library-e2e.mjs"],
  ["Upload, serve, refuse, access, paths (API)", "media-e2e.mjs"],
  ["A new drip gets its own photo", "new-drip-e2e.mjs"],
  ["Deleting a drip with a photo", "drip-delete-photo-e2e.mjs"],
  ["Old files: retirement is recorded", "retire-api-e2e.mjs"],
  ["npm run clean-media (throwaway database)", "clean-media-e2e.mjs"],
  ["npm run seed keeps photos and colours (throwaway database)", "seed-keeps-photos.mjs"],
  ["The public site: every page, desktop and phone", "site-pages-e2e.mjs"],
];

await mongoose.connect(env.MONGODB_URI);
const db = mongoose.connection.db;
const snap = {
  sitemedias: await db.collection("sitemedias").find().toArray(),
  mediaretireds: await db.collection("mediaretireds").find().toArray(),
};
console.log(
  `Saved ${snap.sitemedias.length} photo record(s) and ${snap.mediaretireds.length} retirement record(s) before the run.`
);
// Set aside for the run, so every test starts from the shipped photos whatever has been uploaded by hand;
// put back at the end. (Until then the site shows the shipped photos. The uploaded files stay in storage.)
await db.collection("sitemedias").deleteMany({});
await db.collection("mediaretireds").deleteMany({});
console.log(`Set them aside for the run; they are put back at the end.${NL}`);
await mongoose.disconnect();

const summary = [];
try {
  for (const [name, file] of SUITES) {
    const t0 = Date.now();
    // Each suite is run from the build folder, as it expects (paths in them are relative to it).
    const home = path.resolve(import.meta.dirname, "..");
    const r = spawnSync(process.execPath, [path.join(import.meta.dirname, file)], {
      cwd: home,
      env: { ...process.env, BASE },
      encoding: "utf8",
      timeout: 900000,
    });
    const out = (r.stdout ?? "") + (r.stderr ?? "");
    const m = /(\d+)\/(\d+) passed/.exec(out);
    const fails = out.split(NL).filter((l) => l.startsWith("FAIL"));
    summary.push({
      name,
      file,
      pass: m ? Number(m[1]) : 0,
      total: m ? Number(m[2]) : 0,
      ok: !!m && m[1] === m[2] && r.status === 0,
      fails,
      secs: Math.round((Date.now() - t0) / 1000),
      tail: m ? "" : out.slice(-400),
    });
    const s = summary.at(-1);
    console.log(`${s.ok ? "PASS" : "FAIL"}  ${name}  ${s.pass}/${s.total}  (${s.secs}s)`);
    for (const l of fails) console.log("      " + l.slice(0, 200));
    if (!m) console.log("      did not finish: " + s.tail.replace(/\s+/g, " ").slice(0, 300));
  }
} finally {
  // Put the photo records back exactly as they were.
  await mongoose.connect(env.MONGODB_URI);
  const d = mongoose.connection.db;
  for (const [coll, rows] of Object.entries(snap)) {
    await d.collection(coll).deleteMany({});
    if (rows.length) await d.collection(coll).insertMany(rows);
  }
  const back = {
    photos: await d.collection("sitemedias").countDocuments(),
    retired: await d.collection("mediaretireds").countDocuments(),
  };
  await d.collection("drips").deleteMany({ slug: { $in: ["zz-test-drip", "zz-retire-drip"] } });
  console.log(`${NL}Put back ${back.photos} photo record(s) and ${back.retired} retirement record(s), as they were.`);
  await mongoose.disconnect();
}

const total = summary.reduce((n, s) => n + s.total, 0);
const pass = summary.reduce((n, s) => n + s.pass, 0);
const bad = summary.filter((s) => !s.ok);
console.log(
  `${NL}${pass}/${total} checks passed across ${summary.length} suites${bad.length ? `; ${bad.length} suite(s) need attention` : ""}.`
);
process.exit(bad.length ? 1 : 0);

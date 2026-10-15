// Proves `npm run seed` keeps replaced photos and brand colours, against a
// throwaway database (never the dev one): seed, save photos and a colour, seed
// again, check, then drop the throwaway database.
//   node tools/seed-keeps-photos.mjs   (from this build folder)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const APP = path.resolve("../../..");
const require = createRequire(path.join(APP, "package.json"));
const mongoose = require("mongoose");
const SCRATCH = "nutridrip_seedcheck";

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(APP, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
    })
);
// Same server, another database name. Never printed: it may hold a password.
const u = new URL(env.MONGODB_URI);
if (u.pathname.replace("/", "") === SCRATCH) throw new Error("refusing: the dev database already has the scratch name");
u.pathname = "/" + SCRATCH;
const uri = u.toString();

const results = [];
const check = (n, p, d = "") => {
  results.push(p);
  console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};
const seed = () =>
  execFileSync(process.execPath, [path.join(APP, "node_modules/tsx/dist/cli.mjs"), "scripts/seed.ts"], {
    cwd: APP,
    env: { ...process.env, MONGODB_URI: uri },
    stdio: "pipe",
    timeout: 300000,
  });

try {
  seed();
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  check("the check runs on the throwaway database", db.databaseName === SCRATCH, db.databaseName);
  const drip1 = await db.collection("drips").findOne({ slug: "hydrate-plus" }, { projection: { _id: 1 } });
  await db.collection("sitemedias").insertMany([
    {
      slot: "pricing.hero",
      file: "images/site/pricing/hero/20261014-000000-test.jpg",
      width: 1600,
      height: 1067,
      alt: "Kept across a reseed",
      position: "40% 60%",
    },
    {
      slot: "drip.hydrate-plus",
      file: "images/drips/hydrate-plus/20261014-000000-test.jpg",
      width: 1600,
      height: 1067,
      alt: "Hydrate Plus photo",
      position: "50% 50%",
    },
  ]);
  await db
    .collection("platformsettings")
    .updateOne(
      { singleton: "platform" },
      { $set: { brandColor: "#6d28d9", contrastColor: "#002e5c" } },
      { upsert: true }
    );
  await mongoose.disconnect();

  seed(); // what a client running `npm run seed` would do

  await mongoose.connect(uri);
  const db2 = mongoose.connection.db;
  const rows = await db2.collection("sitemedias").find().toArray();
  check(
    "website photo kept, with its description and position",
    rows.some((r) => r.slot === "pricing.hero" && r.alt === "Kept across a reseed" && r.position === "40% 60%")
  );
  check(
    "drip photo kept",
    rows.some((r) => r.slot === "drip.hydrate-plus")
  );
  const drip2 = await db2.collection("drips").findOne({ slug: "hydrate-plus" }, { projection: { _id: 1 } });
  check(
    "the seed did make Hydrate Plus anew (a new id)",
    !!drip1 && !!drip2 && String(drip1._id) !== String(drip2._id),
    `${drip1?._id} → ${drip2?._id}`
  );
  check(
    "so the photo, keyed by slug, still finds its drip",
    !!drip2 && rows.some((r) => r.slot === `drip.${"hydrate-plus"}`)
  );
  const s = await db2.collection("platformsettings").findOne({ singleton: "platform" });
  check(
    "brand colours kept",
    s?.brandColor === "#6d28d9" && s?.contrastColor === "#002e5c",
    `${s?.brandColor} ${s?.contrastColor}`
  );
} finally {
  if (mongoose.connection.readyState === 1 && mongoose.connection.db.databaseName === SCRATCH) {
    await mongoose.connection.db.dropDatabase();
    console.log("throwaway database dropped");
  }
  await mongoose.disconnect().catch(() => {});
}
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);

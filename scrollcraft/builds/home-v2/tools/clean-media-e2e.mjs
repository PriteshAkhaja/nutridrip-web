// `npm run clean-media` end to end, on a throwaway database and a temporary folder (never the dev ones).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const APP = path.resolve("../../..");
const require = createRequire(path.join(APP, "package.json"));
const mongoose = require("mongoose");
const SCRATCH = "nutridrip_cleancheck";
const DAY = 24 * 60 * 60 * 1000;
const results = [];
const check = (n, p, d = "") => {
  results.push(p);
  console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};

// The settings file, read the plain way. The address is never printed.
const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const env = {};
for (const raw of fs.readFileSync(path.join(APP, ".env"), "utf8").split(NL)) {
  const line = raw.split(CR).join("");
  const eq = line.indexOf("=");
  if (eq > 0 && /^[A-Z_]+$/.test(line.slice(0, eq)))
    env[line.slice(0, eq)] = line.slice(eq + 1).replace(/^["']|["']$/g, "");
}
const u = new URL(env.MONGODB_URI);
if (u.pathname.replace("/", "") === SCRATCH) throw new Error("refusing: the dev database has the scratch name");
u.pathname = "/" + SCRATCH;
const uri = u.toString();

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nd-clean-"));
const K = (n) => `images/site/home/closing/20261001-000000-${n}.jpg`;
const USED = K("used"),
  OLD = K("old"),
  RECENT = K("recent"),
  STRAY = K("stray"),
  GONE = K("gone");
const put = (key, size = 500) => {
  const full = path.join(dir, ...key.split("/"));
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, Buffer.alloc(size));
};
const has = (key) => fs.existsSync(path.join(dir, ...key.split("/")));
const run = (...args) =>
  spawnSync(process.execPath, [path.join(APP, "node_modules/tsx/dist/cli.mjs"), "scripts/clean-media.ts", ...args], {
    cwd: APP,
    env: { ...process.env, MONGODB_URI: uri, STORAGE_DIR: dir },
    encoding: "utf8",
    timeout: 120000,
  });

try {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  check("runs on the throwaway database", db.databaseName === SCRATCH, db.databaseName);
  for (const k of [USED, OLD, RECENT, STRAY]) put(k);
  fs.writeFileSync(path.join(dir, "images", "site", "home", "closing", "crash.tmp"), "x");
  await db
    .collection("sitemedias")
    .insertOne({ slot: "home.closing", file: USED, alt: "In use", width: 1600, height: 1067 });
  await db.collection("mediaretireds").insertMany([
    { file: OLD, slot: "home.closing", reason: "replaced", retiredAt: new Date(Date.now() - 40 * DAY) },
    { file: RECENT, slot: "home.closing", reason: "restored", retiredAt: new Date(Date.now() - 3 * DAY) },
    { file: GONE, slot: "home.closing", reason: "replaced", retiredAt: new Date(Date.now() - 90 * DAY) },
  ]);
  await mongoose.disconnect();

  // 1. The default is a dry run.
  let r = run();
  check(
    "a dry run deletes nothing",
    r.status === 0 && [USED, OLD, RECENT, STRAY].every(has),
    (r.stdout.match(/Nothing was deleted[^\n]*/) ?? [r.stderr])[0]
  );
  check(
    "and lists the file past its grace period",
    r.stdout.includes("delete  " + OLD) &&
      !r.stdout.includes("delete  " + USED) &&
      !r.stdout.includes("delete  " + RECENT),
    ""
  );
  await mongoose.connect(uri);
  const afterDry = await mongoose.connection.db.collection("mediaretireds").countDocuments();
  check("and a dry run changes no record either (still the 3 it started with)", afterDry === 3, String(afterDry));
  await mongoose.disconnect();

  // 2. --delete: only the old, retired, unused file goes.
  r = run("--delete");
  check("--delete removes the file out of use for over 30 days", r.status === 0 && !has(OLD), r.stderr.slice(0, 200));
  check("keeps the one in use, the recent one, and the one nobody had noticed", has(USED) && has(RECENT) && has(STRAY));
  await mongoose.connect(uri);
  let rows = await mongoose.connection.db.collection("mediaretireds").find().toArray();
  const stray = rows.find((x) => x.file === STRAY);
  check("starts the clock on the unnoticed file", stray?.reason === "noticed");
  check(
    "clears the record of a file that was already gone, and of the one it deleted",
    !rows.some((x) => x.file === GONE || x.file === OLD)
  );
  check(
    "leaves a crash's temporary file alone",
    fs.existsSync(path.join(dir, "images", "site", "home", "closing", "crash.tmp"))
  );
  await mongoose.disconnect();

  // 3. Again: nothing more is due.
  r = run("--delete");
  check(
    "running it again deletes nothing more",
    r.status === 0 && has(RECENT) && has(STRAY) && /Deleted 0 files/.test(r.stdout),
    (r.stdout.match(/Deleted[^\n]*/) ?? [""])[0]
  );

  // 4. A shorter grace period.
  r = run("--days", "1", "--delete");
  check("--days 1 deletes the 3-day-old one, not the one just noticed", !has(RECENT) && has(STRAY) && has(USED));

  // 5. No grace: everything unused, never what is in use.
  r = run("--days", "0", "--delete");
  check(
    "--days 0 deletes everything unused, and still never a file in use",
    !has(STRAY) && has(USED),
    (r.stdout.match(/Deleted[^\n]*/) ?? [""])[0]
  );

  // 6. A photo that starts using a file after planning is not lost: covered by the re-check; here, bad options.
  r = run("--days", "-1");
  check("a bad --days is refused", r.status === 1 && /whole number/.test(r.stderr), r.stderr.trim());
  r = run("--wipe");
  check("an unknown option is refused", r.status === 1 && /Unknown option/.test(r.stderr), r.stderr.trim());
  check("the file in use is still there at the end", has(USED));
} finally {
  if (mongoose.connection.readyState === 0) await mongoose.connect(uri).catch(() => {});
  if (mongoose.connection.readyState === 1 && mongoose.connection.db.databaseName === SCRATCH) {
    await mongoose.connection.db.dropDatabase();
    console.log("throwaway database dropped");
  }
  await mongoose.disconnect().catch(() => {});
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(`${NL}${results.filter(Boolean).length}/${results.length} passed`);

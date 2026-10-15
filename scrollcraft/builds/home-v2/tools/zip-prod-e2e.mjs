// The unzipped, built copy of the package running in PRODUCTION mode (next start), against a throwaway
// database and a temporary photo folder: the client's first run. Never touches the dev database.
//   FRESH=<unzipped copy, already built> node tools/zip-prod-e2e.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { request } from "playwright-core";

const FRESH = process.env.FRESH;
if (!FRESH || !fs.existsSync(path.join(FRESH, ".next"))) throw new Error("FRESH must be an unzipped, built copy");
const APP = path.resolve("../../..");
const require = createRequire(path.join(APP, "package.json"));
const mongoose = require("mongoose");
const SCRATCH = "nutridrip_zipcheck";
const PORT = 3100;
const BASE = `http://localhost:${PORT}`;
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
const u = new URL(env.MONGODB_URI);
if (u.pathname.replace("/", "") === SCRATCH) throw new Error("refusing: the dev database has the scratch name");
u.pathname = "/" + SCRATCH;
const uri = u.toString();

const PLACEHOLDER = /^JWT_SECRET="([^"]+)"/m.exec(fs.readFileSync(path.join(FRESH, ".env.example"), "utf8"))[1];
const REAL = "b7e41c9a05d83f62a1c7e9b40d5f8a3261c0e7b94a5d2f813c6e0a9b7d4f1258";
const photoDir = fs.mkdtempSync(path.join(os.tmpdir(), "nd-zipcheck-"));
const base = { ...process.env, MONGODB_URI: uri, STORAGE_DIR: photoDir, NODE_ENV: "production", PORT: String(PORT) };
delete base.NEXT_RUNTIME;

let server = null;
const start = async (secret) => {
  server = spawn(process.execPath, [path.join(FRESH, "node_modules/next/dist/bin/next"), "start", "-p", String(PORT)], {
    cwd: FRESH,
    env: { ...base, JWT_SECRET: secret },
    stdio: "pipe",
  });
  let log = "";
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    try {
      if ((await fetch(BASE + "/zones")).status === 200) return log;
    } catch {}
    await new Promise((r) => setTimeout(r, 700));
  }
  throw new Error("server did not start: " + log.slice(-300));
};
const stop = async () => {
  if (!server) return;
  const done = new Promise((r) => server.once("exit", r));
  server.kill();
  await Promise.race([done, new Promise((r) => setTimeout(r, 5000))]);
  server = null;
};

try {
  // The throwaway database, seeded the way the client would.
  execFileSync(process.execPath, [path.join(FRESH, "node_modules/tsx/dist/cli.mjs"), "scripts/seed.ts"], {
    cwd: FRESH,
    env: { ...process.env, MONGODB_URI: uri },
    stdio: "pipe",
    timeout: 300000,
  });
  check("seeded a throwaway database from the unzipped copy", true, SCRATCH);

  // 1. Production with the example's secret.
  await start(PLACEHOLDER);
  let a = await request.newContext({ baseURL: BASE });
  let r = await a.post("/api/auth/login", { data: { email: "admin@nutridrip.com", password: "admin123" } });
  const body = await r.text();
  let said = "";
  try {
    said = JSON.parse(body).error ?? "";
  } catch {}
  check(
    "production refuses to sign anyone in with the example secret",
    r.status() >= 400 && !/"success":true/.test(body),
    `HTTP ${r.status()}`
  );
  check(
    "and says why, and how to make a good one",
    /example value/.test(said) && /randomBytes/.test(said),
    said.slice(0, 90)
  );
  const page = await a.get("/");
  check("the public site still opens (the secret is only needed to sign in)", page.status() === 200);
  await a.dispose();
  await stop();

  // 2. Production with a private secret.
  await start(REAL);
  a = await request.newContext({ baseURL: BASE });
  for (const p of ["/", "/drips", "/pricing", "/about", "/login"]) check(`GET ${p}`, (await a.get(p)).status() === 200);
  r = await a.post("/api/auth/login", { data: { email: "admin@nutridrip.com", password: "admin123" } });
  check("the super admin signs in", r.status() === 200 && (await r.json()).success === true);
  const screen = await (await a.get("/admin/images")).text();
  check(
    "Admin → Site images opens, with its photos",
    screen.includes("Site images") && screen.includes("pricing.hero")
  );
  const jpg = fs.readFileSync(path.join(FRESH, "public/images/site/goal-skin.jpg"));
  r = await a.post("/api/admin/media", {
    multipart: {
      slot: "pricing.hero",
      alt: "Production upload check",
      file: { name: "t.jpg", mimeType: "image/jpeg", buffer: jpg },
    },
  });
  const up = await r.json();
  check("a photo uploads in production", r.status() === 200 && !!up.data?.file, up.data?.file ?? up.error);
  check(
    "and is saved in the folder chosen by STORAGE_DIR",
    !!up.data?.file && fs.existsSync(path.join(photoDir, ...up.data.file.split("/")))
  );
  r = await a.get("/media/" + up.data.file);
  check("it is served at /media", r.status() === 200 && r.headers()["content-type"] === "image/jpeg");
  const pricing = await (await a.get("/pricing")).text();
  check("the Pricing page shows it", pricing.includes(encodeURIComponent("/media/" + up.data.file)));
  r = await a.get(`/_next/image?url=${encodeURIComponent("/media/" + up.data.file)}&w=640&q=75`);
  check(
    "and the image optimiser can resize it",
    r.status() === 200 && /^image\//.test(r.headers()["content-type"] ?? "")
  );
  r = await a.get("/media/../.env");
  check("a path outside the photo folder is refused", r.status() === 404);
  r = await a.delete("/api/admin/media?slot=pricing.hero");
  check("restoring the original works", r.status() === 200);
  const anon = await request.newContext({ baseURL: BASE });
  r = await anon.post("/api/admin/media", {
    multipart: {
      slot: "pricing.hero",
      alt: "No sign-in",
      file: { name: "t.jpg", mimeType: "image/jpeg", buffer: jpg },
    },
  });
  check("a visitor who is not signed in cannot upload", r.status() === 403);
  await anon.dispose();
  await a.dispose();
} finally {
  await stop().catch(() => {});
  await mongoose.connect(uri).catch(() => {});
  if (mongoose.connection.readyState === 1 && mongoose.connection.db.databaseName === SCRATCH) {
    await mongoose.connection.db.dropDatabase();
    console.log("throwaway database dropped");
  }
  await mongoose.disconnect().catch(() => {});
  fs.rmSync(photoDir, { recursive: true, force: true });
}
console.log(`${NL}${results.filter(Boolean).length}/${results.length} passed`);

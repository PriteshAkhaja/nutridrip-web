// End-to-end check of Admin → Site images against a running dev server:
// upload, serve, show on the page, details, refusals, access, path safety,
// a drip's own photo, the admin screen at two widths, then restore everything.
// Leaves the database as it found it (audit rows aside); the caller removes
// the test files from storage.
//   BASE=http://localhost:3000 node tools/media-e2e.mjs
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { request } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:3000";
const ROOT = path.resolve("../../..");
const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const big = fs.readFileSync(path.join(ROOT, "public/images/site/goal-labs.jpg"));
const big2 = fs.readFileSync(path.join(ROOT, "public/images/site/goal-energy.jpg"));
const small = await sharp({ create: { width: 640, height: 480, channels: 3, background: "#88aacc" } })
  .jpeg()
  .toBuffer();
const fake = Buffer.from("not really a photo");

const admin = await request.newContext({ baseURL: BASE });
await admin.post("/api/auth/login", { data: { email: "admin@nutridrip.com", password: "admin123" } });
const upload = (ctx, slot, buf, name, alt = "Test photo of laboratory tubes", type = "image/jpeg") =>
  ctx.post("/api/admin/media", {
    multipart: { slot, alt, position: "50% 40%", file: { name, mimeType: type, buffer: buf } },
  });

// The drip to test with.
const dripsHtml = await (await admin.get("/admin/images")).text();
const dripSlotMatch = /id="(drip\.[a-z0-9-]+)"/.exec(dripsHtml);
// The first drip listed is alphabetical; find Hydrate Plus's slot by its card title instead.
const hp = /id="(drip\.hydrate-plus)"/.exec(dripsHtml);
const DRIP = hp?.[1] ?? dripSlotMatch?.[1];
check(
  "admin screen lists every page's photos and each drip",
  /Site images/.test(dripsHtml) && /pricing\.hero/.test(dripsHtml) && !!DRIP,
  DRIP
);

// 1. Replace the Pricing first screen.
let r = await upload(admin, "pricing.hero", big, "lab.jpg");
let j = await r.json();
check("upload accepted", r.status() === 200 && j.success, `${r.status()} ${j.error ?? ""}`);
const key = j.data?.file;
check(
  "stored in an organised folder",
  /^images\/site\/pricing\/hero\/\d{8}-\d{6}-[a-z0-9]+\.jpg$/.test(key ?? ""),
  key
);
check("file is on disk", !!key && fs.existsSync(path.join(ROOT, "storage", ...key.split("/"))));
check(
  "resized and previewed",
  j.data?.width <= 1600 && j.data?.blur?.startsWith("data:image/jpeg;base64,"),
  `${j.data?.width}×${j.data?.height}`
);
r = await admin.get("/media/" + key);
check(
  "served at /media with a long cache",
  r.status() === 200 &&
    r.headers()["content-type"] === "image/jpeg" &&
    /immutable/.test(r.headers()["cache-control"] ?? "")
);
let html = await (await admin.get("/pricing")).text();
check(
  "Pricing page shows the new photo",
  html.includes(encodeURIComponent("/media/" + key)) && html.includes("Test photo of laboratory tubes")
);
const opt = `/_next/image?url=${encodeURIComponent("/media/" + key)}&w=640&q=75`;
r = await admin.get(opt);
check(
  "image optimiser serves it",
  r.status() === 200 && /^image\//.test(r.headers()["content-type"] ?? ""),
  `${r.status()} ${r.headers()["content-type"]}`
);
html = await (await admin.get("/about")).text();
check("other pages unchanged (About still shipped)", !html.includes("/media/images/site/pricing"));

// 2. Details only.
r = await admin.patch("/api/admin/media", {
  data: { slot: "pricing.hero", alt: "Edited description", position: "20% 30%" },
});
html = await (await admin.get("/pricing")).text();
check("details saved and shown", r.status() === 200 && html.includes("Edited description") && html.includes("20% 30%"));

// 3. Refusals, each with a reason.
r = await upload(admin, "pricing.hero", small, "small.jpg");
j = await r.json();
check("too small refused with the reason", r.status() === 422 && /640 × 480 px/.test(j.error ?? ""), j.error);
r = await upload(admin, "pricing.hero", fake, "fake.jpg");
j = await r.json();
check("not a photo refused", r.status() === 422 && /not a photograph/.test(j.error ?? ""), j.error);
r = await upload(admin, "nowhere.at-all", big, "lab.jpg");
j = await r.json();
check("unknown slot refused", r.status() === 422, j.error);
r = await upload(admin, "pricing.hero", big, "lab.jpg", "x");
check("missing description refused", r.status() === 422);
r = await admin.patch("/api/admin/media", { data: { slot: "pricing.hero", position: "50% 50%; background:red" } });
check("unsafe focus point refused", r.status() === 422);

// 4. Who may.
const anon = await request.newContext({ baseURL: BASE });
r = await upload(anon, "pricing.hero", big, "lab.jpg");
check("signed out: refused", r.status() === 403);
const clinic = await request.newContext({ baseURL: BASE });
await clinic.post("/api/auth/login", { data: { email: "clinic@healthfirst.com", password: "clinic123" } });
r = await upload(clinic, "pricing.hero", big, "lab.jpg");
check("clinic: refused", r.status() === 403);
r = await clinic.get("/admin/images", { maxRedirects: 0 });
check("clinic cannot open the screen", r.status() >= 300 && r.status() < 400, String(r.status()));

// 5. Paths outside the folder.
for (const bad of [
  "/media/../.env",
  "/media/%2e%2e/%2e%2e/.env",
  "/media/images/site/x.jpg",
  "/media/storage/images/a.jpg",
]) {
  r = await anon.get(bad);
  check(`no file outside the images folder: ${bad}`, r.status() === 404, String(r.status()));
}

// 6. A drip's own photo.
r = await upload(admin, DRIP, big2, "energy.jpg", "Test photo for Hydrate Plus");
j = await r.json();
check(
  "drip photo accepted, in the drip's folder",
  r.status() === 200 && /^images\/drips\/hydrate-plus\//.test(j.data?.file ?? ""),
  j.data?.file ?? j.error
);
const dkey = j.data?.file;
for (const [u, what] of [
  ["/drips", "catalogue card"],
  ["/drips/hydrate-plus", "drip page"],
  ["/", "header menu / home"],
]) {
  html = await (await admin.get(u)).text();
  check(`drip photo on the ${what}`, html.includes(encodeURIComponent("/media/" + dkey)));
}

// (The admin screen itself is covered by library-e2e.mjs.)

// 8. Restore everything.
for (const s of ["pricing.hero", DRIP]) {
  r = await admin.delete("/api/admin/media?slot=" + encodeURIComponent(s));
  check(`restore ${s}`, r.status() === 200);
}
html = await (await admin.get("/pricing")).text();
check(
  "Pricing back to the shipped photo",
  !html.includes("/media/images") && html.includes(encodeURIComponent("/images/site/drip-bag.jpg"))
);
fs.writeFileSync("lab/media/keys.json", JSON.stringify([key, dkey]));
const failed = results.filter((x) => !x.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);

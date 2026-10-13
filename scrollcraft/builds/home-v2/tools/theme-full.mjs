// The whole product in a custom theme (violet brand, derived dark sections,
// navy contrast), applied in the browser exactly as the server would inject it,
// so nothing is saved. Every page each role can reach from its navigation is
// opened; every element is scanned for a colour still on the shipped teal
// family (a hard-coded value the theme cannot reach); a screenshot per page.
import fs from "node:fs";
import sharp from "sharp";
import { chromium } from "playwright-core";
const BASE = process.env.BASE ?? "http://localhost:3001";
const CSS = fs.readFileSync("lab/theme-full.css", "utf8");
// The shipped teal family: under the custom theme none of these should remain.
const OLD = [
  "#0a7fa1",
  "#086780",
  "#e4f6fc",
  "#b3e6f3",
  "#7ee3f8",
  "#06596f",
  "#062530",
  "#0b3340",
  "#1d4653",
  "#f0f7f9",
  "#04181f",
  "#061218",
];
const toRgb = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const OLD_RGB = OLD.map(toRgb);
const ROLES = [
  {
    role: "public",
    home: "/",
    extra: [
      "/drips",
      "/drips/glow-protocol",
      "/how-it-works",
      "/safety",
      "/pricing",
      "/zones",
      "/consult",
      "/faqs",
      "/for-clinics",
      "/about",
      "/login",
    ],
  },
  { role: "patient", home: "/app", phone: "+919844471234" },
  { role: "nurse", home: "/nurse", email: "nurse.emma@nutridrip.com", pw: "nurse123" },
  { role: "doctor", home: "/doctor", email: "dr.sarah@nutridrip.com", pw: "doctor123" },
  { role: "clinic", home: "/clinic", email: "clinic@healthfirst.com", pw: "clinic123" },
  { role: "superadmin", home: "/admin", email: "admin@nutridrip.com", pw: "admin123" },
];
fs.mkdirSync("lab/full", { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const report = [];
try {
  for (const R of ROLES) {
    const mobile = R.role === "patient" || R.role === "nurse";
    const c = await b.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
    await c.addInitScript((css) => {
      try {
        localStorage.setItem("nd_intro_at", String(Date.now()));
      } catch {}
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.id = "theme-test";
        s.textContent = css;
        document.head.appendChild(s);
      });
    }, CSS);
    const p = await c.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));
    if (R.email) {
      const r = await p.request.post(BASE + "/api/auth/login", { data: { email: R.email, password: R.pw } });
      if (!(await r.json()).success) {
        console.log(R.role, "LOGIN FAILED");
        continue;
      }
    } else if (R.phone) {
      const q = await (await p.request.post(BASE + "/api/auth/otp/request", { data: { phone: R.phone } })).json();
      const v = await (
        await p.request.post(BASE + "/api/auth/otp/verify", { data: { phone: R.phone, code: q.data?.devCode } })
      ).json();
      if (!v.success) {
        console.log(R.role, "OTP FAILED", JSON.stringify(v).slice(0, 160));
        continue;
      }
    }
    await p.goto(BASE + R.home, { waitUntil: "networkidle", timeout: 180000 });
    let paths = [R.home, ...(R.extra ?? [])];
    if (R.role !== "public") {
      const nav = await p.evaluate(
        (home) => [
          ...new Set(
            [...document.querySelectorAll("a[href]")]
              .map((a) => a.getAttribute("href"))
              .filter((h) => h && h.startsWith(home) && !h.includes("?") && !h.includes("#"))
          ),
        ],
        R.home
      );
      paths = [...new Set([R.home, ...nav])].slice(0, 22);
    }
    const shots = [];
    for (const path of paths) {
      try {
        await p.goto(BASE + path, { waitUntil: "networkidle", timeout: 180000 });
        await p.waitForTimeout(600);
        const found = await p.evaluate((OLD_RGB) => {
          const near = (s) => {
            const m = [...s.matchAll(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/g)];
            return m.some(
              (x) =>
                (x[4] === undefined || +x[4] > 0.05) &&
                OLD_RGB.some(
                  (o) => Math.abs(o[0] - x[1]) <= 2 && Math.abs(o[1] - x[2]) <= 2 && Math.abs(o[2] - x[3]) <= 2
                )
            );
          };
          const hits = [];
          for (const el of document.querySelectorAll("body *")) {
            const cs = getComputedStyle(el);
            if (cs.display === "none" || cs.visibility === "hidden") continue;
            const props = [
              "color",
              "backgroundColor",
              "borderTopColor",
              "borderBottomColor",
              "borderLeftColor",
              "borderRightColor",
              "outlineColor",
              "fill",
              "stroke",
              "boxShadow",
              "backgroundImage",
            ];
            for (const k of props) {
              if (k.startsWith("border") && parseFloat(cs[k.replace("Color", "Width")]) === 0) continue;
              if (k === "outlineColor" && cs.outlineStyle === "none") continue;
              if (near(cs[k] ?? "")) {
                const cls = (el.getAttribute("class") || "").slice(0, 70);
                hits.push(`${el.tagName.toLowerCase()}.${cls} [${k}]`);
                break;
              }
            }
            if (hits.length > 6) break;
          }
          // Images (svg <img>, backgrounds) are not scanned: the favicon and photos are out of scope.
          return hits;
        }, OLD_RGB);
        report.push({ role: R.role, path, hits: found });
        shots.push(
          await sharp(await p.screenshot())
            .resize(mobile ? 195 : 360, mobile ? 422 : 225)
            .png()
            .toBuffer()
        );
        console.log(
          `${R.role.padEnd(10)} ${path.padEnd(38)} ${found.length ? "LEFTOVER: " + found.slice(0, 3).join(" | ") : "ok"}`
        );
      } catch (e) {
        console.log(`${R.role.padEnd(10)} ${path.padEnd(38)} ERROR ${String(e).slice(0, 80)}`);
      }
    }
    const tw = mobile ? 195 : 360,
      th = mobile ? 422 : 225,
      cols = mobile ? 8 : 5;
    await sharp({
      create: {
        width: cols * (tw + 6),
        height: Math.ceil(shots.length / cols) * (th + 6),
        channels: 3,
        background: "#ccc",
      },
    })
      .composite(shots.map((s, i) => ({ input: s, left: (i % cols) * (tw + 6), top: Math.floor(i / cols) * (th + 6) })))
      .png()
      .toFile(`lab/full/${R.role}.png`);
    if (errors.length) console.log(R.role, "page errors:", errors.slice(0, 3));
    await c.close();
  }
} finally {
  await b.close();
}
fs.writeFileSync("lab/full/report.json", JSON.stringify(report, null, 1));
console.log("pages:", report.length, "with leftovers:", report.filter((r) => r.hits.length).length);

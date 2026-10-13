// Every page every role can reach, in the theme saved on the running server.
// Follows links from each role's home (ids collapsed to one pattern, two of
// each), and on each page scans every element's computed colours for:
//   shipped — a value from the shipped palette (teal family, greys, info) that
//             the saved theme should have replaced;
//   teal    — any vivid teal/cyan/blue the theme does not own;
//   ink-fill — a shape filled with the text ink (filled UI uses the contrast colour).
// Read-only: GETs pages, never follows logout or API links.
//   BASE=http://localhost:3000 node tools/theme-every.mjs
import fs from "node:fs";
import sharp from "sharp";
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:3000";
const SHIPPED = [
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
  "#f5f7f9",
  "#e3e7eb",
  "#ccd3da",
  "#0a0c0e",
  "#434a50",
  "#6b7178",
  "#949a9f",
  "#45699b",
  "#ebf0f7",
  "#2f4a70",
];
const ROLES = [
  {
    role: "public",
    home: "/",
    allow: (h) => !/^\/(app|nurse|doctor|clinic|admin|invoice)(\/|$)/.test(h),
    seed: [
      "/drips",
      "/how-it-works",
      "/safety",
      "/pricing",
      "/zones",
      "/consult",
      "/faqs",
      "/for-clinics",
      "/about",
      "/legal/terms",
      "/legal/privacy",
      "/legal/grievance",
      "/login",
      "/quiz",
      "/welcome",
    ],
  },
  {
    role: "patient",
    home: "/app",
    phone: "+919844471234",
    mobile: true,
    allow: (h) => /^\/(app|quiz|invoice|welcome)(\/|$)/.test(h),
  },
  {
    role: "nurse",
    home: "/nurse",
    email: "nurse.emma@nutridrip.com",
    pw: "nurse123",
    mobile: true,
    allow: (h) => /^\/nurse(\/|$)/.test(h),
  },
  {
    role: "doctor",
    home: "/doctor",
    email: "dr.sarah@nutridrip.com",
    pw: "doctor123",
    allow: (h) => /^\/doctor(\/|$)/.test(h),
  },
  {
    role: "clinic",
    home: "/clinic",
    email: "clinic@healthfirst.com",
    pw: "clinic123",
    allow: (h) => /^\/(clinic|invoice)(\/|$)/.test(h),
  },
  {
    role: "superadmin",
    home: "/admin",
    email: "admin@nutridrip.com",
    pw: "admin123",
    allow: (h) => /^\/(admin|invoice)(\/|$)/.test(h),
  },
];
// EXTRA=1: the pages only reachable from data, opened directly (no link following).
const S = "6ac3545effa20d363b3e7005",
  A = "6ac3545effa20d363b3e7008",
  D = "6ac3545effa20d363b3e7006";
if (process.env.EXTRA) {
  const steps = ["", "/adverse", "/consent", "/kit", "/monitor", "/report", "/rx", "/vitals"];
  const at = (r) => ROLES.find((x) => x.role === r);
  ROLES.splice(
    0,
    ROLES.length,
    { ...at("public"), paths: ["/quiz", "/welcome"] },
    { ...at("patient"), paths: ["/quiz", "/welcome", "/app/book"] },
    { ...at("patient"), role: "patient-2", phone: "+919845550002", paths: ["/app/report/" + D, "/app/sessions"] },
    {
      ...at("nurse"),
      paths: [
        ...steps.map((s) => "/nurse/session/" + S + s),
        "/nurse/session/" + A,
        "/nurse/session/" + D,
        "/nurse/session/" + D + "/report",
      ],
    },
    { ...at("clinic"), paths: ["/clinic/billing/statement?month=2026-10", "/clinic/billing/statement"] },
    { ...at("superadmin"), paths: ["/admin/studio", "/admin/studio?new=1"] }
  );
}
// INVOICE=<order id>: the invoice, as the clinic and the super admin see it (PRINT=1: as printed).
if (process.env.INVOICE) {
  const at = (r) => ROLES.find((x) => x.role === r);
  const path = "/invoice/" + process.env.INVOICE;
  ROLES.splice(0, ROLES.length, { ...at("clinic"), paths: [path] }, { ...at("superadmin"), paths: [path] });
}
const pattern = (h) => h.replace(/\/[0-9a-f]{24}(?=\/|$)/g, "/[id]");
const skip = (h) => /logout|signout|\/api\/|\.pdf$|^mailto:|^tel:/.test(h);

fs.mkdirSync("lab/every", { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const summary = [];
try {
  for (const R of ROLES) {
    const c = await b.newContext({ viewport: R.mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
    await c.addInitScript(() => {
      try {
        localStorage.setItem("nd_intro_at", String(Date.now()));
      } catch {}
    });
    const p = await c.newPage();
    p.on("dialog", (d) => d.dismiss().catch(() => {}));
    if (process.env.PRINT) await p.emulateMedia({ media: "print" });
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
        console.log(R.role, "OTP FAILED");
        continue;
      }
    }
    const queue = R.paths ? [...R.paths] : [R.home, ...(R.seed ?? [])];
    const seen = new Set(),
      perPattern = {};
    const shots = [];
    let n = 0;
    while (queue.length && n < 90) {
      const path = queue.shift();
      if (seen.has(path)) continue;
      seen.add(path);
      const pat = pattern(path);
      if ((perPattern[pat] = (perPattern[pat] ?? 0) + 1) > 2) continue;
      let res;
      try {
        res = await p.goto(BASE + path, { waitUntil: "networkidle", timeout: 180000 });
      } catch (e) {
        console.log(`${R.role.padEnd(10)} ${path.padEnd(52)} LOAD FAILED ${String(e).slice(0, 60)}`);
        continue;
      }
      if (new URL(p.url()).pathname !== path.split("?")[0]) {
        if (R.paths) console.log(`${R.role.padEnd(10)} ${path.padEnd(52)} redirected to ${new URL(p.url()).pathname}`);
        continue;
      } // redirected (no access, or elsewhere): not this role's page
      await p.waitForTimeout(500);
      n++;
      const out = await p.evaluate((SHIPPED) => {
        const root = getComputedStyle(document.documentElement);
        const toRgb = (h) => {
          const x = parseInt(h.slice(1), 16);
          return [(x >> 16) & 255, (x >> 8) & 255, x & 255];
        };
        const tok = (name) => {
          const v = root.getPropertyValue(name).trim();
          return /^#[0-9a-f]{6}$/i.test(v) ? toRgb(v.toLowerCase()) : null;
        };
        const ink = tok("--color-ink"),
          contrastTok = tok("--color-contrast");
        // Shipped values the live theme still uses on purpose (a token equal to its shipped value) are not leftovers.
        const live = new Set([...document.styleSheets].length ? [] : []);
        const tokens = [
          "--color-primary",
          "--color-primary-dark",
          "--color-primary-soft",
          "--color-primary-line",
          "--color-primary-text",
          "--color-primary-on-dark",
          "--color-deep",
          "--color-deep-2",
          "--color-deep-line",
          "--color-mist",
          "--color-surface-2",
          "--color-line",
          "--color-line-2",
          "--color-ink",
          "--color-ink-2",
          "--color-ink-3",
          "--color-ink-on-dark",
          "--color-info",
          "--color-info-soft",
          "--color-info-text",
          "--color-contrast",
        ]
          .map(tok)
          .filter(Boolean);
        const old = SHIPPED.map(toRgb).filter(
          (o) => !tokens.some((t) => t[0] === o[0] && t[1] === o[1] && t[2] === o[2])
        );
        const near = (a, o, d = 1) =>
          Math.abs(a[0] - o[0]) <= d && Math.abs(a[1] - o[1]) <= d && Math.abs(a[2] - o[2]) <= d;
        const own = (a) => tokens.some((t) => near(a, t, 2));
        const hsl = ([r, g, b]) => {
          r /= 255;
          g /= 255;
          b /= 255;
          const mx = Math.max(r, g, b),
            mn = Math.min(r, g, b),
            l = (mx + mn) / 2,
            d = mx - mn;
          if (!d) return { h: 0, s: 0, l };
          const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
          const h = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
          return { h, s, l };
        };
        const colours = (s) =>
          [...s.matchAll(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/g)]
            .filter((x) => x[4] === undefined || +x[4] > 0.08)
            .map((x) => [+x[1], +x[2], +x[3]]);
        const hits = { shipped: [], teal: [], inkFill: [] };
        const label = (el) =>
          el.tagName.toLowerCase() +
          (el.id ? "#" + el.id : "") +
          "." +
          String(el.getAttribute("class") || "").slice(0, 70);
        for (const el of document.querySelectorAll("body *")) {
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden" || el.closest("[data-nextjs-toast],nextjs-portal"))
            continue;
          if (el.closest("[data-brand-swatch]")) continue;
          const props = [
            "color",
            "backgroundColor",
            "borderTopColor",
            "borderBottomColor",
            "borderLeftColor",
            "outlineColor",
            "fill",
            "stroke",
            "boxShadow",
            "backgroundImage",
            "textDecorationColor",
          ];
          for (const k of props) {
            if (k.startsWith("border") && parseFloat(cs[k.replace("Color", "Width")]) === 0) continue;
            if (k === "outlineColor" && cs.outlineStyle === "none") continue;
            if (k === "textDecorationColor" && !/underline/.test(cs.textDecorationLine)) continue;
            for (const a of colours(cs[k] ?? "")) {
              if (old.some((o) => near(a, o))) {
                hits.shipped.push(`${label(el)} [${k} rgb(${a})]`);
                break;
              }
              const { h, s, l } = hsl(a);
              if (s > 0.3 && l > 0.12 && l < 0.92 && h >= 165 && h <= 235 && !own(a)) {
                hits.teal.push(`${label(el)} [${k} rgb(${a})]`);
                break;
              }
            }
          }
          if (
            ink &&
            contrastTok &&
            (ink[0] !== contrastTok[0] || ink[1] !== contrastTok[1] || ink[2] !== contrastTok[2])
          ) {
            const bg = colours(cs.backgroundColor)[0];
            const r = el.getBoundingClientRect();
            if (bg && near(bg, ink) && r.width * r.height >= 100)
              hits.inkFill.push(`${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
          }
        }
        const links = [...document.querySelectorAll("a[href]")]
          .map((a) => a.getAttribute("href"))
          .filter((h) => h && h.startsWith("/") && !h.startsWith("//"));
        return { hits, links, brand: !!document.getElementById("nd-brand") };
      }, SHIPPED);
      const flag = [
        out.hits.shipped.length
          ? `SHIPPED ${out.hits.shipped.length}: ${out.hits.shipped.slice(0, 2).join(" | ")}`
          : "",
        out.hits.teal.length ? `TEAL ${out.hits.teal.length}: ${out.hits.teal.slice(0, 2).join(" | ")}` : "",
        out.hits.inkFill.length
          ? `INK-FILL ${out.hits.inkFill.length}: ${out.hits.inkFill.slice(0, 2).join(" | ")}`
          : "",
      ]
        .filter(Boolean)
        .join("  ");
      console.log(`${R.role.padEnd(10)} ${path.padEnd(52)} ${out.brand ? "" : "(no saved theme!) "}${flag || "ok"}`);
      summary.push({ role: R.role, path, ...out.hits });
      shots.push(await p.screenshot());
      for (const h of R.paths ? [] : out.links) {
        const clean = h.split("#")[0].split("?")[0];
        if (!clean || skip(clean) || !R.allow(clean) || seen.has(clean)) continue;
        queue.push(clean);
      }
    }
    // One contact sheet per role, for looking at.
    const tiles = await Promise.all(
      shots.map((s) =>
        sharp(s)
          .resize({ width: R.mobile ? 160 : 360 })
          .png()
          .toBuffer({ resolveWithObject: true })
      )
    );
    const cols = R.mobile ? 10 : 5,
      tw = R.mobile ? 160 : 360,
      th = Math.max(...tiles.map((t) => t.info.height), 1);
    const rows = Math.ceil(tiles.length / cols);
    if (tiles.length)
      await sharp({ create: { width: cols * (tw + 6), height: rows * (th + 6), channels: 3, background: "#bbb" } })
        .composite(
          tiles.map((t, i) => ({ input: t.data, left: (i % cols) * (tw + 6), top: Math.floor(i / cols) * (th + 6) }))
        )
        .png()
        .toFile(
          `lab/every/${process.env.INVOICE ? (process.env.PRINT ? "invoice-print-" : "invoice-") : process.env.EXTRA ? "extra-" : ""}${R.role}.png`
        );
    await c.close();
  }
} finally {
  await b.close();
}
fs.writeFileSync(
  process.env.INVOICE
    ? "lab/every/summary-invoice.json"
    : process.env.EXTRA
      ? "lab/every/summary-extra.json"
      : "lab/every/summary.json",
  JSON.stringify(summary, null, 1)
);
const bad = summary.filter((s) => s.shipped.length || s.teal.length || s.inkFill.length);
console.log(`\npages: ${summary.length}; with findings: ${bad.length}`);

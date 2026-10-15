// A short demo of the admin colour theme for the client: the shipped teal, the
// Settings card picking violet, then the website, patient app and admin console
// in it, and back. The colours are applied in the browser exactly as the server
// injects them (lab/demo-theme.css from lib/theme), so nothing is saved.
//   BASE=http://localhost:3000 node tools/demo-video.mjs <out.webm>
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "lab/demo/theme-demo.webm";
const CSS = fs.readFileSync("lab/demo-theme.css", "utf8");
const W = 1280,
  H = 720;
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });

const login = (p, email, password) => p.request.post(BASE + "/api/auth/login", { data: { email, password } });
const loginPatient = async (p) => {
  const q = await (await p.request.post(BASE + "/api/auth/otp/request", { data: { phone: "+919844471234" } })).json();
  await p.request.post(BASE + "/api/auth/otp/verify", { data: { phone: "+919844471234", code: q.data?.devCode } });
};

// Warm every page first, so the recording never waits on a compile.
{
  const c = await b.newContext({ viewport: { width: W, height: H } });
  const p = await c.newPage();
  for (const u of ["/", "/drips/hydrate-plus", "/login"])
    await p.goto(BASE + u, { waitUntil: "networkidle", timeout: 240000 });
  await login(p, "admin@nutridrip.com", "admin123");
  for (const u of ["/admin/settings", "/admin", "/admin/inventory"])
    await p.goto(BASE + u, { waitUntil: "networkidle", timeout: 240000 });
  await loginPatient(p);
  await p.goto(BASE + "/app", { waitUntil: "networkidle", timeout: 240000 });
  await c.close();
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const dir = path.join(path.dirname(OUT), "raw");
fs.rmSync(dir, { recursive: true, force: true });
const c = await b.newContext({
  viewport: { width: W, height: H },
  recordVideo: { dir, size: { width: W, height: H } },
});
await c.addInitScript((css) => {
  try {
    localStorage.setItem("nd_intro_at", String(Date.now()));
  } catch {}
  document.addEventListener("DOMContentLoaded", () => {
    if (sessionStorage.getItem("demo-theme") === "1") {
      const s = document.createElement("style");
      s.id = "demo-theme";
      s.textContent = css;
      document.head.appendChild(s);
    }
  });
}, CSS);
const p = await c.newPage();
const wait = (ms) => p.waitForTimeout(ms);

// A caption pill, bottom left: what this scene shows.
const cap = (text) =>
  p.evaluate((text) => {
    let el = document.getElementById("demo-cap");
    if (!el) {
      el = document.createElement("div");
      el.id = "demo-cap";
      Object.assign(el.style, {
        position: "fixed",
        left: "24px",
        bottom: "24px",
        zIndex: 2147483647,
        padding: "10px 16px",
        borderRadius: "999px",
        background: "rgba(10,10,12,0.86)",
        color: "#fff",
        font: "600 15px/1.3 Inter, system-ui, sans-serif",
        letterSpacing: "0.01em",
        boxShadow: "0 6px 24px rgba(0,0,0,0.25)",
        pointerEvents: "none",
        transition: "opacity .3s",
      });
      document.body.appendChild(el);
    }
    el.textContent = text;
  }, text);
const go = async (u, text) => {
  await p.goto(BASE + u, { waitUntil: "networkidle", timeout: 240000 });
  await wait(400);
  if (text) await cap(text);
};
const scroll = async (px, steps = 24, ms = 28) => {
  for (let i = 0; i < steps; i++) {
    await p.mouse.wheel(0, px / steps);
    await wait(ms);
  }
};
// Switch the theme on the open page, with a short colour cross-fade.
const theme = (on) =>
  p.evaluate(
    ({ on, css }) => {
      sessionStorage.setItem("demo-theme", on ? "1" : "0");
      const fade = document.createElement("style");
      fade.textContent =
        "*,*::before,*::after{transition:background-color .7s ease,color .7s ease,border-color .7s ease,fill .7s ease,box-shadow .7s ease !important}";
      document.head.appendChild(fade);
      requestAnimationFrame(() => {
        document.getElementById("demo-theme")?.remove();
        if (on) {
          const s = document.createElement("style");
          s.id = "demo-theme";
          s.textContent = css;
          document.head.appendChild(s);
        }
      });
      setTimeout(() => fade.remove(), 1200);
    },
    { on, css: CSS }
  );

try {
  // 1. As shipped.
  await go("/", "NutriDrip as shipped: the teal brand colour");
  await wait(1800);
  await scroll(500);
  await wait(900);

  // 2. The super admin picks colours. Previewed, not saved.
  await login(p, "admin@nutridrip.com", "admin123");
  await go("/admin/settings", "Admin → Settings → Brand colours");
  const card = p.locator("h2", { hasText: "Brand colours" });
  await card.scrollIntoViewIfNeeded();
  await scroll(260, 12);
  await wait(1200);
  await cap("Pick a brand colour: every shade is worked out from it");
  const violet = p.locator("button[aria-label='Violet']");
  await violet.hover();
  await wait(500);
  await violet.click();
  await wait(1600);
  await cap("Optional: a contrast colour for the black buttons, top bar and footer");
  const hex = p.locator("input[type=text]");
  if ((await hex.count()) >= 3) {
    const contrastInput = hex.nth(2);
    await contrastInput.click({ clickCount: 3 });
    await contrastInput.pressSequentially("#002e5c", { delay: 60 });
    await wait(1400);
  }
  await cap("The live preview shows the result before saving");
  const preview = p.locator("text=Live preview");
  await preview
    .first()
    .scrollIntoViewIfNeeded({ timeout: 2000 })
    .catch(() => {});
  await wait(2200);

  // 3. The website switches.
  await go("/", "After saving: the website…");
  await wait(900);
  await theme(true);
  await wait(2200);
  const toggle = p.locator("button[aria-label='Drips by goal']");
  await toggle.click();
  await wait(700);
  await cap("…menus, hovers and highlights follow the new colour");
  const tile = p.locator("#" + (await toggle.getAttribute("aria-controls")) + " a").first();
  await tile.hover();
  await wait(1800);
  await p.keyboard.press("Escape");
  await p.mouse.move(640, 600);
  await scroll(1400, 40, 30);
  await wait(800);
  await scroll(1600, 40, 30);
  await wait(1000);

  // 4. A drip page and its merge section.
  await go("/drips/hydrate-plus", "Every drip page, including the dark merge section");
  await wait(1200);
  await scroll(1100, 34, 30);
  await wait(700);
  await scroll(1400, 50, 34);
  await wait(1200);

  // 5. The patient app.
  await loginPatient(p);
  await go("/app", "The patient app");
  await wait(2400);

  // 6. The admin console.
  await login(p, "admin@nutridrip.com", "admin123");
  await go("/admin", "Every console: admin, doctor, nurse, clinic");
  await wait(2200);
  await go("/admin/inventory", "Clinical colours (critical, low, healthy) never change");
  await wait(2600);

  // 7. Back to the original.
  await go("/", "Reset any time: back to NutriDrip teal");
  await wait(1200);
  await theme(false);
  await wait(2600);
} finally {
  const video = p.video();
  await c.close();
  await b.close();
  const raw = await video.path();
  fs.copyFileSync(raw, OUT);
  console.log("recorded", OUT);
}

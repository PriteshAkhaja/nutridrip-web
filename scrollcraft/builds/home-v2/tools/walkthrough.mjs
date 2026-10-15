// A step-by-step walkthrough video of the brand colours setting, for the client.
// Drives the real product: the super admin picks and saves colours (the server
// then injects them everywhere), the website and apps are shown, and it ends
// with Reset, so the settings finish exactly as they started.
//
// Frames come from Chrome's own screencast at full quality (not Playwright's
// recorder), are timed by their timestamps, and are assembled with ffmpeg.
//   BASE=http://localhost:3000 node tools/walkthrough.mjs <out.mp4>
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "lab/demo/walkthrough.mp4";
const VW = 1600,
  VH = 900,
  DPR = 1.2; // 1920 × 1080 frames
const FR = "lab/demo/frames-walk";
const STEPS = 9;
const ADMIN = { email: "admin@nutridrip.com", password: "admin123" };

const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const ctx = await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR });

// Every page carries: the intro loader skipped, the dev badge hidden, a visible
// cursor, the current step card, and a white veil that lifts after navigation.
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("nd_intro_at", String(Date.now()));
  } catch {}
  const ss = (k) => {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  };
  const build = () => {
    if (document.getElementById("wt-style")) return;
    const st = document.createElement("style");
    st.id = "wt-style";
    st.textContent = `
      nextjs-portal, [data-nextjs-toast] { display: none !important; }
      #wt-cursor { position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none; width: 26px; height: 26px; transform: translate(-3px, -2px); }
      #wt-ring { position: fixed; z-index: 2147483646; pointer-events: none; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%; border: 3px solid rgba(20,20,24,.55); opacity: 0; }
      #wt-ring.go { animation: wtRing .5s ease-out; }
      @keyframes wtRing { from { opacity: .9; transform: scale(.35); } to { opacity: 0; transform: scale(1.25); } }
      #wt-step { position: fixed; left: 32px; bottom: 32px; z-index: 2147483645; pointer-events: none; display: flex; gap: 16px; align-items: stretch;
        max-width: 560px; padding: 16px 22px 16px 16px; border-radius: 18px; background: rgba(14,14,18,.94); color: #fff;
        box-shadow: 0 18px 50px rgba(0,0,0,.28); font-family: var(--font-sans, Inter, "Segoe UI", system-ui, sans-serif); }
      #wt-step.in { animation: wtIn .45s cubic-bezier(.2,.8,.2,1) both; }
      @keyframes wtIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
      #wt-step .n { flex: none; width: 46px; border-radius: 12px; background: rgba(255,255,255,.1); display: grid; place-items: center; font: 700 20px/1 var(--font-display, var(--font-sans, Inter, system-ui)); }
      #wt-step .k { font: 600 11.5px/1 var(--font-sans, Inter, system-ui); letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.6); }
      #wt-step .t { margin-top: 6px; font: 650 19px/1.25 var(--font-display, var(--font-sans, Inter, system-ui)); }
      #wt-step .d { margin-top: 4px; font: 400 14px/1.4 var(--font-sans, Inter, system-ui); color: rgba(255,255,255,.78); }
      #wt-veil { position: fixed; inset: 0; z-index: 2147483644; background: #fff; pointer-events: none; transition: opacity .45s ease; }
    `;
    document.head.appendChild(st);
    const cur = document.createElement("div");
    cur.id = "wt-cursor";
    cur.innerHTML =
      '<svg viewBox="0 0 26 26" width="26" height="26"><path d="M4 2.5v19.2l5.1-4.9 3.3 7.4 3.4-1.5-3.3-7.3h7.1z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    const ring = document.createElement("div");
    ring.id = "wt-ring";
    document.body.append(cur, ring);
    const at = JSON.parse(ss("wt-xy") || "[800,450]");
    const place = (x, y) => {
      cur.style.left = x + "px";
      cur.style.top = y + "px";
      ring.style.left = x + "px";
      ring.style.top = y + "px";
    };
    place(at[0], at[1]);
    addEventListener(
      "mousemove",
      (e) => {
        place(e.clientX, e.clientY);
        try {
          sessionStorage.setItem("wt-xy", JSON.stringify([e.clientX, e.clientY]));
        } catch {}
      },
      true
    );
    addEventListener(
      "mousedown",
      () => {
        ring.classList.remove("go");
        void ring.offsetWidth;
        ring.classList.add("go");
      },
      true
    );
    if (ss("wt-hide-cursor") === "1") cur.style.display = "none";
    const step = JSON.parse(ss("wt-step") || "null");
    if (step) {
      const el = document.createElement("div");
      el.id = "wt-step";
      el.innerHTML = `<div class="n">${step.n}</div><div><div class="k">Step ${step.n} of ${step.of}</div><div class="t"></div><div class="d"></div></div>`;
      el.querySelector(".t").textContent = step.t;
      el.querySelector(".d").textContent = step.d;
      document.body.appendChild(el);
    }
    if (ss("wt-veil") === "1") {
      const v = document.createElement("div");
      v.id = "wt-veil";
      document.body.appendChild(v);
      const lift = () =>
        setTimeout(() => {
          v.style.opacity = "0";
          setTimeout(() => v.remove(), 600);
        }, 150);
      if (document.readyState === "complete") lift();
      else addEventListener("load", lift, { once: true });
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
});

const p = await ctx.newPage();
const wait = (ms) => p.waitForTimeout(ms);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
let mx = 800,
  my = 450;
async function moveTo(x, y, ms = 700) {
  const n = Math.max(12, Math.round(ms / 16)),
    x0 = mx,
    y0 = my;
  for (let i = 1; i <= n; i++) {
    const k = ease(i / n);
    await p.mouse.move(x0 + (x - x0) * k, y0 + (y - y0) * k);
    await wait(16);
  }
  mx = x;
  my = y;
}
async function moveToEl(loc, ms = 750, dx = 0.5, dy = 0.5) {
  loc = loc.locator("visible=true").first();
  await loc.scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => {});
  const r = await loc.boundingBox({ timeout: 8000 });
  if (!r) throw new Error("not on screen: " + loc);
  await moveTo(r.x + r.width * dx, r.y + r.height * dy, ms);
}
async function click(loc, ms) {
  await moveToEl(loc, ms);
  await wait(180);
  await p.mouse.down();
  await wait(90);
  await p.mouse.up();
  await wait(250);
}
async function scrollTo(y, ms = 1200) {
  await p.evaluate(
    ({ y, ms }) =>
      new Promise((res) => {
        const y0 = scrollY,
          t0 = performance.now(),
          e = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
        const f = (now) => {
          const k = Math.min(1, (now - t0) / ms);
          scrollTo(0, y0 + (y - y0) * e(k));
          k < 1 ? requestAnimationFrame(f) : res();
        };
        requestAnimationFrame(f);
      }),
    { y, ms }
  );
  await wait(120);
}
const by = (yOf) =>
  p.evaluate((s) => {
    const el = document.querySelector(s);
    return el ? el.getBoundingClientRect().top + scrollY : 0;
  }, yOf);
async function setStep(n, t, d) {
  await p.evaluate(
    ({ n, t, d, of }) => {
      sessionStorage.setItem("wt-step", JSON.stringify({ n, t, d, of }));
      let el = document.getElementById("wt-step");
      if (!el) {
        el = document.createElement("div");
        el.id = "wt-step";
        document.body.appendChild(el);
      }
      el.innerHTML = `<div class="n">${n}</div><div><div class="k">Step ${n} of ${of}</div><div class="t"></div><div class="d"></div></div>`;
      el.querySelector(".t").textContent = t;
      el.querySelector(".d").textContent = d;
      el.classList.remove("in");
      void el.offsetWidth;
      el.classList.add("in");
    },
    { n, t, d, of: STEPS }
  );
}
async function go(u) {
  await p
    .evaluate(() => {
      sessionStorage.setItem("wt-veil", "1");
      const v = document.createElement("div");
      v.id = "wt-veil";
      v.style.opacity = "0";
      document.body.appendChild(v);
      requestAnimationFrame(() => (v.style.opacity = "1"));
    })
    .catch(() => {});
  await wait(450);
  await p.goto(BASE + u, { waitUntil: "networkidle", timeout: 240000 });
  await wait(700);
}
// A full-screen card (title or end) over the real site, in its own fonts.
async function card(html, ms) {
  await p.evaluate((html) => {
    const c = document.createElement("div");
    c.id = "wt-card";
    Object.assign(c.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483646",
      background: "#fff",
      display: "grid",
      placeItems: "center",
      opacity: "0",
      transition: "opacity .6s ease",
    });
    c.innerHTML = html;
    document.body.appendChild(c);
    document.getElementById("wt-cursor").style.display = "none";
    requestAnimationFrame(() => requestAnimationFrame(() => (c.style.opacity = "1")));
  }, html);
  await wait(ms);
}
async function uncard() {
  await p.evaluate(() => {
    const c = document.getElementById("wt-card");
    c.style.opacity = "0";
    document.getElementById("wt-cursor").style.display = "";
    setTimeout(() => c.remove(), 650);
  });
  await wait(650);
}
const login = (who) => p.request.post(BASE + "/api/auth/login", { data: who });
const loginPatient = async () => {
  const q = await (await p.request.post(BASE + "/api/auth/otp/request", { data: { phone: "+919844471234" } })).json();
  await p.request.post(BASE + "/api/auth/otp/verify", { data: { phone: "+919844471234", code: q.data?.devCode } });
};
const resetColours = async () => {
  await login(ADMIN);
  const r = await p.request.patch(BASE + "/api/admin/settings", {
    data: { brandColor: null, deepColor: null, contrastColor: null },
  });
  return r.status();
};

// Warm every page, so the recording never waits on a compile; start from the shipped colours.
console.log("reset before:", await resetColours());
for (const u of ["/", "/drips/hydrate-plus", "/admin", "/admin/settings", "/admin/inventory/alerts"])
  await p.goto(BASE + u, { waitUntil: "networkidle", timeout: 240000 });
await loginPatient();
await p.goto(BASE + "/app", { waitUntil: "networkidle", timeout: 240000 });
await p.request.post(BASE + "/api/auth/logout").catch(() => {});
await ctx.clearCookies();

// Record.
fs.rmSync(FR, { recursive: true, force: true });
fs.mkdirSync(FR, { recursive: true });
const cdp = await ctx.newCDPSession(p);
const frames = [];
cdp.on("Page.screencastFrame", async (f) => {
  const file = path.join(FR, String(frames.length).padStart(6, "0") + ".jpg");
  fs.writeFileSync(file, Buffer.from(f.data, "base64"));
  frames.push({ file, t: f.metadata.timestamp });
  cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
});

const logo = BASE + "/brand-mark.svg";
let failed = null;
try {
  await p.goto(BASE + "/", { waitUntil: "networkidle", timeout: 240000 });
  await p.evaluate(() => {
    const c = document.createElement("div");
    c.id = "wt-card";
    Object.assign(c.style, { position: "fixed", inset: "0", zIndex: "2147483646", background: "#fff" });
    document.body.appendChild(c);
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 92,
    maxWidth: 1920,
    maxHeight: 1080,
    everyNthFrame: 1,
  });
  await p.evaluate(() => document.getElementById("wt-card").remove());

  // Title.
  await card(
    `<div style="text-align:center;font-family:var(--font-sans)">
      <img src="${logo}" width="64" height="64" alt="" style="display:block;margin:0 auto 26px">
      <div style="font:600 13px/1 var(--font-sans);letter-spacing:.18em;text-transform:uppercase;color:#6b7178">NutriDrip · Super admin</div>
      <div style="margin-top:16px;font:650 64px/1.05 var(--font-display);letter-spacing:-.02em;color:#0a0c0e">Brand colours</div>
      <div style="margin-top:16px;font:400 21px/1.45 var(--font-sans);color:#434a50;max-width:640px">Change the look of the whole product, from one setting</div>
      <div style="margin-top:30px;display:inline-flex;gap:10px;font:500 14px/1 var(--font-sans);color:#434a50">
        <span style="padding:9px 14px;border:1px solid #e3e7eb;border-radius:999px">${STEPS} steps</span>
        <span style="padding:9px 14px;border:1px solid #e3e7eb;border-radius:999px">Under 2 minutes</span>
      </div></div>`,
    3400
  );
  await setStep(1, "Today: the NutriDrip teal", "Every page uses the shipped brand colour.");
  await uncard();
  await wait(1400);
  await moveTo(1020, 520, 900);
  await scrollTo(620, 1500);
  await wait(900);
  await scrollTo(0, 1100);
  await wait(500);

  // 2. Settings, reached from the console's own navigation.
  await login(ADMIN);
  await setStep(2, "Open Admin → Settings", "Signed in as the super admin.");
  await go("/admin");
  await wait(900);
  await click(p.locator("a[href='/admin/settings']"), 1000);
  await p.waitForURL("**/admin/settings", { timeout: 60000 });
  await p.waitForLoadState("networkidle");
  await wait(600);
  const brandTop = await p.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((x) => x.textContent.trim() === "Brand colours");
    return h ? h.getBoundingClientRect().top + scrollY : 0;
  });
  await wait(500);
  await scrollTo(Math.max(0, brandTop - 110), 1500);
  await wait(700);

  // 3. A brand colour.
  await setStep(3, "Choose a brand colour", "Every shade is worked out from it, with text contrast checked.");
  await wait(900);
  const violet = p.locator("button[aria-label='Violet']");
  await moveToEl(p.locator("button[aria-label='Ocean blue']"), 900);
  await wait(350);
  await click(violet, 600);
  await wait(1800);

  // 4. The contrast colour.
  await setStep(4, "Optional: the contrast colour", "The near-black of buttons, the top bar and the footer.");
  const contrast = p.getByLabel("Contrast colour", { exact: true });
  await click(contrast, 900);
  await p.keyboard.press("Control+A");
  await wait(150);
  await p.keyboard.insertText("#002E5C"); // whole, as if pasted: typed one key at a time the form flags the half-typed code
  await wait(1300);

  // 5. The preview.
  await setStep(5, "Check the live preview", "A small page in the picked colours. Point at a button to see its hover.");
  const preview = p.locator("[aria-label='Preview of the picked colours']");
  await moveToEl(preview.locator("button, a").first(), 1000);
  await wait(1100);
  await moveToEl(preview.locator("button, a").nth(1), 700);
  await wait(1100);

  // 6. Save.
  await setStep(6, "Save: live for everyone", "Every page, for every visitor, from the next page they open.");
  await click(p.getByRole("button", { name: "Save colours" }), 1100);
  await p.waitForLoadState("networkidle");
  await wait(2400);

  // 7. The website.
  await setStep(7, "The website follows", "Buttons, menus, highlights, the dark sections and the footer.");
  await go("/");
  await wait(1100);
  const toggle = p.locator("button[aria-label='Drips by goal']");
  await moveToEl(toggle, 1000);
  await wait(900);
  const menu = p.locator("#" + (await toggle.getAttribute("aria-controls")));
  await moveToEl(menu.locator("a").first(), 700);
  await wait(700);
  await moveToEl(menu.locator("a").nth(1), 500);
  await wait(900);
  await p.keyboard.press("Escape");
  await moveTo(1400, 640, 600);
  const scrollMax = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  await scrollTo(Math.min(scrollMax, 1600), 2600);
  await wait(500);
  await scrollTo(Math.min(scrollMax, 3400), 2600);
  await wait(800);
  await go("/drips/hydrate-plus");
  await wait(1200);
  await scrollTo(900, 1800);
  await wait(900);

  // 8. The apps and consoles.
  await loginPatient();
  await setStep(
    8,
    "Every app and console follows",
    "The patient and nurse apps, and the doctor, clinic and admin consoles."
  );
  await go("/app");
  await wait(2200);
  await login(ADMIN);
  await go("/admin/inventory/alerts");
  await setStep(
    8,
    "Clinical colours never change",
    "Critical, caution and healthy stay red, amber and green whatever the brand."
  );
  await wait(2800);

  // 9. Reset.
  await setStep(9, "Reset any time", "One click returns every page to the NutriDrip colours.");
  await go("/admin/settings");
  const top2 = await p.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((x) => x.textContent.trim() === "Brand colours");
    return h ? h.getBoundingClientRect().top + scrollY : 0;
  });
  await scrollTo(Math.max(0, top2 - 110), 1300);
  await wait(500);
  await click(p.getByRole("button", { name: "Reset to NutriDrip colours" }), 1100);
  await p.waitForLoadState("networkidle");
  await wait(1800);
  await go("/");
  await wait(1600);

  // End.
  await p.evaluate(() => sessionStorage.removeItem("wt-step"));
  await p.evaluate(() => document.getElementById("wt-step")?.remove());
  const tick = (t) =>
    `<div style="display:flex;gap:14px;align-items:flex-start;text-align:left"><span style="flex:none;width:26px;height:26px;border-radius:50%;background:#0a7fa1;color:#fff;display:grid;place-items:center;font:700 14px/1 var(--font-sans);margin-top:1px">✓</span><span>${t}</span></div>`;
  await card(
    `<div style="font-family:var(--font-sans);max-width:720px">
      <img src="${logo}" width="52" height="52" alt="" style="display:block;margin:0 0 22px">
      <div style="font:650 46px/1.1 var(--font-display);letter-spacing:-.02em;color:#0a0c0e">One setting. The whole product.</div>
      <div style="margin-top:28px;display:grid;gap:16px;font:400 19px/1.45 var(--font-sans);color:#2b3035">
        ${tick("Pick one brand colour: every shade is worked out from it, with text contrast checked")}
        ${tick("The website, the patient and nurse apps, and every console follow")}
        ${tick("Clinical colours never change, and Reset brings back the NutriDrip teal")}
      </div>
      <div style="margin-top:30px;font:500 14px/1 var(--font-sans);color:#6b7178">Admin → Settings → Brand colours</div></div>`,
    4600
  );
  // A last repaint, so the end card's still holds for its full time (frames only come on change).
  await p.evaluate(() => {
    const d = document.createElement("div");
    Object.assign(d.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "1px",
      height: "1px",
      background: "#fefefe",
      zIndex: "2147483647",
    });
    document.body.appendChild(d);
  });
  await wait(300);
} catch (e) {
  failed = e;
} finally {
  await cdp.send("Page.stopScreencast").catch(() => {});
  console.log("reset after:", await resetColours());
  await b.close();
}
if (failed) {
  console.error("FAILED:", failed.message.slice(0, 700));
  process.exit(1);
}

// Assemble: each frame lasts until the next one; constant 30 fps out.
const list =
  frames
    .map(
      (f, i) =>
        `file '${path.resolve(f.file).replace(/\\/g, "/")}'\nduration ${Math.max(0.001, (frames[i + 1]?.t ?? f.t + 0.5) - f.t).toFixed(4)}`
    )
    .join("\n") + `\nfile '${path.resolve(frames.at(-1).file).replace(/\\/g, "/")}'\n`;
fs.writeFileSync(path.join(FR, "list.txt"), list);
const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
execFileSync(ffmpeg, [
  "-y",
  "-loglevel",
  "error",
  "-f",
  "concat",
  "-safe",
  "0",
  "-i",
  path.join(FR, "list.txt"),
  "-vf",
  "scale=1920:1080:flags=lanczos,fps=30,format=yuv420p",
  "-c:v",
  "libx264",
  "-preset",
  "slow",
  "-crf",
  "18",
  "-movflags",
  "+faststart",
  OUT,
]);
console.log("frames:", frames.length, "→", OUT);

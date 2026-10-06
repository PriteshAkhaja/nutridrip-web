// Tab through the home page from the top until focus leaves the assembly act.
// For each stop: what it is, whether it is on screen and not covered, and how
// opaque it is where it sits (after the act's 0.6 s scrub has settled).
import { chromium } from "playwright-core";
const [W = "1440", H = "900"] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const c = await b.newContext({ viewport: { width: +W, height: +H } });
  await c.addInitScript(() => {
    try {
      localStorage.setItem("nd_intro_at", String(Date.now()));
    } catch {}
  });
  const p = await c.newPage();
  await p.goto((process.env.BASE ?? "http://localhost:3000") + "/", { waitUntil: "networkidle", timeout: 120000 });
  await p.waitForTimeout(1200);
  const rows = [];
  for (let k = 0; k < 40; k++) {
    await p.keyboard.press("Tab");
    await p.waitForTimeout(900);
    const r = await p.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return null;
      const act = document.querySelector("section[aria-labelledby='home-title']");
      const inAct = !!act?.contains(a);
      const rect = a.getBoundingClientRect();
      const onScreen = rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
      let op = 1;
      for (let n = a; n && n !== document.body; n = n.parentElement) op *= +getComputedStyle(n).opacity;
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const covered = !(hit && (a === hit || a.contains(hit)));
      return {
        text: (a.textContent || a.getAttribute("aria-label") || a.tagName).trim().replace(/\s+/g, " ").slice(0, 40),
        inAct,
        onScreen,
        opacity: +op.toFixed(2),
        covered,
      };
    });
    if (!r) continue;
    rows.push(r);
    if (rows.length > 3 && !r.inAct && rows.some((x) => x.inAct)) break;
  }
  for (const r of rows)
    console.log(
      `${r.inAct ? "ACT " : "    "} ${r.text.padEnd(42)} onScreen=${r.onScreen} opacity=${r.opacity} covered=${r.covered}`
    );
} finally {
  await b.close();
}

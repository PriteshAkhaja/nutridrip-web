// Ad hoc: the preview under reduced motion has no stops and no snapping.
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const c = await b.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const p = await c.newPage();
  await p.goto("http://localhost:3001/drips/myers-revive/preview", { waitUntil: "networkidle" });
  await p.waitForTimeout(1000);
  await p.mouse.move(700, 450);
  for (let k = 0; k < 8; k++) {
    await p.mouse.wheel(0, 100);
    await p.waitForTimeout(40);
  }
  await p.waitForTimeout(800);
  console.log(
    await p.evaluate(() => ({
      stops: document.querySelectorAll(".nd-drip > i[aria-hidden]").length,
      snap: document.documentElement.style.scrollSnapType || "none",
      y: Math.round(scrollY),
    }))
  );
} finally {
  await b.close();
}

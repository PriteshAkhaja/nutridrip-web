import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await c.newPage();
p.on("console", (m) => {
  if (m.type() === "error") console.log("console error:", m.text().slice(0, 200));
});
p.on("pageerror", (e) => console.log("page error:", String(e).slice(0, 300)));
await p.request.post("http://localhost:3001/api/auth/login", {
  data: { email: "admin@nutridrip.com", password: "admin123" },
});
await p.goto("http://localhost:3001/admin/images", { waitUntil: "networkidle", timeout: 240000 });
await p.locator('[id="pricing.hero"]').scrollIntoViewIfNeeded();
await p.locator('[id="pricing.hero"]').click();
const d = p.getByRole("dialog");
await d.waitFor();
await p.waitForTimeout(600);
const desk = d.locator("[aria-label^='Desktop preview']");
const info = async () =>
  d.locator("[aria-label^='Phone preview'] img").evaluate((i) => getComputedStyle(i).objectPosition);
const box = await desk.boundingBox();
console.log("desk box", JSON.stringify(box));
const at = await p.evaluate(
  ({ x, y }) => {
    const e = document.elementFromPoint(x, y);
    return e ? e.tagName + " " + (e.getAttribute("aria-label") || e.className).toString().slice(0, 60) : null;
  },
  { x: box.x + box.width / 2, y: box.y + box.height / 2 }
);
console.log("element at centre:", at);
console.log("position before:", await info());
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await p.mouse.down();
await p.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 8 });
await p.mouse.up();
console.log("position after :", await info());
console.log("footer:", (await d.innerText()).match(/Unsaved changes|Changes go live[^\n]*/)?.[0]);
await b.close();

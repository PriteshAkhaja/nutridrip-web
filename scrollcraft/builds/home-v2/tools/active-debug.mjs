import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await c.newPage();
await p.request.post("http://localhost:3001/api/auth/login", {
  data: { email: "admin@nutridrip.com", password: "admin123" },
});
await p.goto("http://localhost:3001/admin/images", { waitUntil: "networkidle", timeout: 240000 });
const report = async (label) => {
  await p.waitForTimeout(700);
  const r = await p.evaluate(() => ({
    scrollY: Math.round(scrollY),
    active: document.querySelector("nav[aria-label='Pages'] a[aria-current='true']")?.innerText.replace(/\n/g, " "),
    sections: [...document.querySelectorAll("section[id^='page-']")]
      .map(
        (s) =>
          `${s.id.slice(5)}:${Math.round(s.getBoundingClientRect().top)}→${Math.round(s.getBoundingClientRect().bottom)}`
      )
      .join("  "),
  }));
  console.log(label, JSON.stringify(r));
};
await report("start        ");
await p.evaluate(() => document.getElementById("page-pricing").scrollIntoView());
await report("to pricing   ");
await p.evaluate(() => document.getElementById("page-zones").scrollIntoView());
await report("to zones     ");
await p.mouse.move(700, 500);
await p.mouse.wheel(0, 700);
await report("wheel 700 on ");
await b.close();

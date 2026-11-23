// Loads a page and prints console errors, the title and whether the stage exists. Ad hoc.
import { chromium } from "playwright-core";
const url = process.argv[2] ?? "http://localhost:3001/drips/hydrate-plus";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERR " + String(e).slice(0, 400)));
  p.on("console", (m) => m.type() === "error" && errs.push("CONSOLE " + m.text().slice(0, 400)));
  await p.goto(url, { waitUntil: "load", timeout: 240000 });
  await p.waitForTimeout(4000);
  console.log(
    JSON.stringify(
      await p.evaluate(() => ({
        title: document.title,
        bs: !!document.querySelector("[data-bs]"),
        h: document.querySelector("[data-bs]")?.getBoundingClientRect().height,
        body: document.body.innerText.slice(0, 200),
      }))
    )
  );
  console.log(errs.join("\n") || "no errors");
} finally {
  await b.close();
}

// Admin → Site images, redesigned: the library and its editor, end to end, with screenshots.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:3001";
const OUT = "lab/media/library";
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (n, p, d = "") => {
  results.push(p);
  console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};
const jpg = (w, h, bg = "#6a9bd1") =>
  sharp({ create: { width: w, height: h, channels: 3, background: bg } })
    .jpeg()
    .toBuffer();

const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  // Every width: no sideways scroll; screenshots of the top.
  for (const w of [1920, 1440, 1024, 768, 390]) {
    const c = await b.newContext({ viewport: { width: w, height: 900 } });
    const p = await c.newPage();
    await p.request.post(BASE + "/api/auth/login", { data: { email: "admin@nutridrip.com", password: "admin123" } });
    await p.goto(BASE + "/admin/images", { waitUntil: "networkidle", timeout: 240000 });
    await p.waitForTimeout(700);
    const m = await p.evaluate(() => {
      const grid = document.querySelector("#page-home ul");
      const tiles = [...(grid?.children ?? [])].map((li) => li.getBoundingClientRect());
      const cols = new Set(tiles.map((r) => Math.round(r.left))).size;
      const gap =
        tiles.length > 1 && Math.round(tiles[1].top) === Math.round(tiles[0].top)
          ? Math.round(tiles[1].left - tiles[0].right)
          : null;
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        cols,
        gap,
        tileW: Math.round(tiles[0]?.width ?? 0),
      };
    });
    check(`${w}px: no sideways scroll`, !m.overflow, JSON.stringify(m));
    await p.screenshot({ path: `${OUT}/library-${w}.png` });
    await c.close();
  }

  const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await c.newPage();
  await p.request.post(BASE + "/api/auth/login", { data: { email: "admin@nutridrip.com", password: "admin123" } });
  await p.goto(BASE + "/admin/images", { waitUntil: "networkidle", timeout: 240000 });

  // Summary and filter.
  const summary = await p.getByText("Photos", { exact: true }).first().locator("xpath=..").innerText();
  check("summary counts the photos", /\b43\b/.test(summary), summary.replace(/\n/g, " | "));
  await p.getByRole("radio", { name: /Changed/ }).click();
  const changedTiles = await p.locator("section[id^='page-'] li button[id]").count();
  check("Changed shows only changed photos", changedTiles >= 0, `${changedTiles} shown`);
  await p.getByRole("radio", { name: /^All/ }).click();

  // Search.
  await p.getByPlaceholder(/Search pages, sections, drips/).fill("closing");
  const found = await p.locator("section[id^='page-'] li button[id]").evaluateAll((els) => els.map((e) => e.id));
  check(
    "search finds every closing panel and nothing else",
    found.length >= 8 && found.every((id) => id.endsWith(".closing")),
    `${found.length}: ${found.slice(0, 3).join(", ")}…`
  );
  await p.getByPlaceholder(/Search pages, sections, drips/).fill("zzzz");
  check("an empty search says so, with a way back", await p.getByText("No photo matches").isVisible());
  await p.getByRole("button", { name: "Show every photo" }).click();

  // The page list follows the scroll.
  await p.evaluate(() => document.getElementById("page-pricing").scrollIntoView());
  await p.waitForTimeout(1800);
  const current = await p.locator("nav[aria-label='Pages'] a[aria-current='true']").innerText();
  const spy = await p.evaluate(
    () =>
      [...document.querySelectorAll("section[id^='page-']")]
        .map((s) => s.id.slice(5) + ":" + Math.round(s.getBoundingClientRect().top))
        .join(" ") +
      " | scrollY " +
      Math.round(scrollY) +
      " h " +
      innerHeight
  );
  check("page list marks the section in view", /Pricing/.test(current), current.split("\n").join(" ") + " | " + spy);
  await p.evaluate(() => scrollTo(0, 0));

  // Open the editor from a tile.
  const tile = p.locator('[id="pricing.hero"]');
  await tile.scrollIntoViewIfNeeded();
  await tile.hover();
  await p.waitForTimeout(300);
  await tile.click();
  const dialog = p.getByRole("dialog");
  await dialog.waitFor();
  await p.waitForTimeout(450);
  check("the editor opens beside the library", await dialog.isVisible());
  const shapes = await dialog
    .locator("[aria-label$='to choose what shows']")
    .evaluateAll((els) =>
      els.map((e) => Math.round((e.getBoundingClientRect().width / e.getBoundingClientRect().height) * 100) / 100)
    );
  check(
    "desktop and phone previews in the page's own shapes",
    shapes.length === 2 && Math.abs(shapes[0] - 557 / 512) < 0.03 && Math.abs(shapes[1] - 342 / 257) < 0.03,
    JSON.stringify(shapes)
  );
  check("quality says Sharp for the shipped photo", (await dialog.innerText()).includes("Sharp"));
  await p.screenshot({ path: `${OUT}/editor-open.png` });

  // Drag the desktop preview: both previews move together; Reset position wakes.
  const desk = dialog.locator("[aria-label^='Desktop preview']");
  const pos = (sel) =>
    dialog
      .locator(sel)
      .locator("img")
      .evaluate((i) => getComputedStyle(i).objectPosition);
  const before = await pos("[aria-label^='Phone preview']");
  const box = await desk.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  check("says this photo moves up and down here", (await dialog.innerText()).includes("up and down"));
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 40, { steps: 8 });
  await p.mouse.up();
  const afterPhone = await pos("[aria-label^='Phone preview']");
  check("dragging one preview moves the other too", afterPhone !== before, `${before} → ${afterPhone}`);
  check("the footer says there are unsaved changes", (await dialog.innerText()).includes("Unsaved changes"));

  // Escape with changes: asks first.
  await p.keyboard.press("Escape");
  check("closing with changes asks first", await dialog.getByText("Discard your changes to this photo?").isVisible());
  await dialog.getByRole("button", { name: "Keep editing" }).click();
  await dialog.getByRole("button", { name: "Reset position" }).click();

  // A too-small file is refused with the place's size; a good one is taken.
  await dialog
    .locator("input[type=file]")
    .setInputFiles({ name: "small.jpg", mimeType: "image/jpeg", buffer: await jpg(400, 300) });
  await p.waitForTimeout(400);
  check("too small: refused, naming this place's size", /needs at least 560 × 520 px/.test(await dialog.innerText()));
  await dialog
    .locator("input[type=file]")
    .setInputFiles({ name: "new-hero.jpg", mimeType: "image/jpeg", buffer: await jpg(1500, 1100, "#8a6bc4") });
  await p.waitForTimeout(500);
  const text = await dialog.innerText();
  check(
    "a good file: shown with its size, quality updated",
    text.includes("new-hero.jpg") && text.includes("1500 × 1100 px") && /Good|Sharp/.test(text)
  );
  check("save waits for a description", await dialog.getByRole("button", { name: "Upload and save" }).isDisabled());
  await dialog.locator("#photo-alt").fill("A test photo in violet");
  await p.screenshot({ path: `${OUT}/editor-new-file.png` });
  await dialog.getByRole("button", { name: "Upload and save" }).click();
  await p.getByText("New photo is live on the website").waitFor({ timeout: 30000 });
  check(
    "saved: the panel closes and says it is live",
    !(await p
      .getByRole("dialog")
      .isVisible()
      .catch(() => false))
  );
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/saved-toast.png` });
  check("the tile now says Replaced", (await p.locator('[id="pricing.hero"]').innerText()).includes("Replaced"));
  const page = await (await p.request.get(BASE + "/pricing")).text();
  check(
    "live on the Pricing page",
    page.includes("/media/images/site/pricing/hero/") ||
      page.includes(encodeURIComponent("/media/images/site/pricing/hero/"))
  );

  // The size rule is per place: the same 900 x 500 photo suits a small card and not a tall step.
  const sizeCase = async (slot, w, h) => {
    const t2 = p.locator('[id="' + slot + '"]');
    await t2.scrollIntoViewIfNeeded();
    await t2.click();
    const d2 = p.getByRole("dialog");
    await d2.waitFor();
    await p.waitForTimeout(450);
    await d2
      .locator("input[type=file]")
      .setInputFiles({ name: "size.jpg", mimeType: "image/jpeg", buffer: await jpg(w, h) });
    await p.waitForTimeout(500);
    const text2 = await d2.innerText();
    const out = { text: text2, enabled: await d2.getByRole("button", { name: "Upload and save" }).count() };
    await d2.getByRole("button", { name: "Cancel" }).click();
    if (await d2.getByRole("button", { name: "Discard" }).count())
      await d2.getByRole("button", { name: "Discard" }).click();
    await p.waitForTimeout(500);
    return out;
  };
  let sz = await sizeCase("about.physicians", 900, 500);
  check(
    "900 x 500: fine for a small card, with a gentle note",
    /a little soft on high-resolution ones/.test(sz.text) &&
      /Good/.test(sz.text) &&
      sz.enabled === 1 &&
      !/needs at least/.test(sz.text)
  );
  sz = await sizeCase("how-it-works.step-slot", 900, 500);
  check(
    "900 x 500: refused for a tall step, naming its size",
    /needs at least 590 x 680 px/.test(sz.text.replace(/×/g, "x")) && sz.enabled === 0
  );
  sz = await sizeCase("how-it-works.step-slot", 1300, 1500);
  check("1300 x 1500: allowed there with no note", sz.enabled === 1 && !/soft|needs at least/.test(sz.text));

  // Restore from the editor.
  await p.locator('[id="pricing.hero"]').click();
  await p.getByRole("dialog").waitFor();
  await p.getByRole("dialog").getByRole("button", { name: "Restore original" }).click();
  await p.getByRole("dialog").getByRole("button", { name: "Yes, restore" }).click();
  await p.getByText("Original photo restored").waitFor({ timeout: 30000 });
  await p.waitForTimeout(600);
  check(
    "restored: the tile is back to the original",
    !(await p.locator('[id="pricing.hero"]').innerText()).includes("Replaced")
  );

  // Phone: the editor fills the screen.
  await p.setViewportSize({ width: 390, height: 844 });
  await p.locator('[id="pricing.hero"]').scrollIntoViewIfNeeded();
  await p.locator('[id="pricing.hero"]').click();
  await p.getByRole("dialog").waitFor();
  await p.waitForTimeout(450);
  const dw = await p.getByRole("dialog").evaluate((e) => Math.round(e.getBoundingClientRect().width));
  check(
    "phone: the editor fills the screen, no sideways scroll",
    dw === 390 && !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)),
    String(dw)
  );
  await p.screenshot({ path: `${OUT}/editor-phone.png` });
  await c.close();
} finally {
  await b.close();
}
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);

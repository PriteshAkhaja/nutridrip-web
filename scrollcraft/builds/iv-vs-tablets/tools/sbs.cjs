// Section-aligned side by side for IV vs Tablets: the client's page on the
// left, ours on the right, captured at the same points in each shared section.
//
//   node scrollcraft/builds/iv-vs-tablets/tools/sbs.cjs <W> <H> <outDir>   (from nutridrip-new/)
//
// Adapted from the home-v3 sheet script. Sections are matched by position:
// both pages run page head, routes act, absorbed, different, cards, limits,
// book, footer in the same order.
const {
  chromium,
} = require("C:/Trakshym/Nutridrip/nutridrip-new/scrollcraft/builds/home-v2/node_modules/playwright-core");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const [W, H, OUT] = [+process.argv[2], +process.argv[3], process.argv[4]];
// [section index among main > section, then footer; points: "in" or act progress]
const PLAN = [
  [0, ["top"]],
  [1, [0, 0.18, 0.38, 0.58, 0.76, 1]],
  [2, ["in"]],
  [3, ["in"]],
  [4, ["in"]],
  [5, ["in"]],
  [6, ["in"]],
  ["foot", ["in"]],
];
(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  try {
    for (const [tag, url] of [
      ["a", "http://localhost:4530/iv-vs-tablets.html"],
      ["b", "http://localhost:4550/"],
    ]) {
      const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: W < 900, hasTouch: W < 900 });
      const p = await ctx.newPage();
      await p.goto(url, { waitUntil: "networkidle" });
      await p.evaluate(() => document.fonts.ready);
      let n = 0;
      for (const [sec, pts] of PLAN) {
        for (const q of pts) {
          const y = await p.evaluate(
            ([sec, q]) => {
              const el =
                sec === "foot" ? document.querySelector("footer") : document.querySelectorAll("main > section")[sec];
              if (!el) return null;
              const t = el.getBoundingClientRect().top + scrollY,
                h = el.offsetHeight,
                vh = innerHeight;
              if (q === "top") return 0;
              if (q === "in") return Math.max(0, t - vh * 0.08);
              return t + Math.max(0, h - vh) * q;
            },
            [sec, q]
          );
          const f = path.join(OUT, `${tag}-${String(n++).padStart(2, "0")}.png`);
          await p.evaluate((v) => scrollTo({ top: v, behavior: "instant" }), y ?? 0);
          await p.waitForTimeout(750);
          await p.screenshot({ path: f });
        }
      }
      await ctx.close();
    }
  } finally {
    await b.close();
  }
  const files = fs
    .readdirSync(OUT)
    .filter((f) => f.startsWith("a-"))
    .sort();
  const pairs = files.map((f) => [path.join(OUT, f), path.join(OUT, f.replace("a-", "b-"))]);
  const per = W >= 900 ? 4 : 3;
  let s = 0;
  for (let i = 0; i < pairs.length; i += per) {
    const chunk = pairs.slice(i, i + per);
    const args = ["-v", "error", "-y"];
    chunk.forEach(([a, c]) => args.push("-i", a, "-i", c));
    const rows = chunk.map((_, k) => `[${2 * k}][${2 * k + 1}]hstack=2,pad=iw+16:ih+16:8:8:color=0x2B3330[r${k}]`);
    const fc =
      chunk.length > 1
        ? `${rows.join(";")};${chunk.map((_, k) => `[r${k}]`).join("")}${W >= 900 ? "vstack=" + chunk.length : "hstack=" + chunk.length}${W >= 900 ? ",scale=1800:-2" : ""}`
        : rows[0].replace(/\[r0\]$/, "");
    args.push("-filter_complex", fc, "-frames:v", "1", "-q:v", "3", path.join(OUT, `sbs-${++s}.jpg`));
    execFileSync("ffmpeg", args);
  }
  console.log("pairs", pairs.length, "sheets", s);
})();

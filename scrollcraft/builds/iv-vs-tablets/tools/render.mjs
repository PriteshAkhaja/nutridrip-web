// Renders the IV vs Tablets prototype: the client's page
// (_reference/NutriDrip IV Nutrient Therapy/iv-vs-tablets.html) inside the v3
// landing's chrome, with our durations and our primary action, the health quiz.
//
//   node scrollcraft/builds/iv-vs-tablets/tools/render.mjs   (from nutridrip-new/)
//
// Copied from home-v3 at 2026-10-30 18:11 (site.css c048bee9, drips.json
// 6e229184): the engine, site.css, fonts, data/ and the two photographs. The
// header, footer and booking section are home-v3's markup; only the nav gains
// "IV vs Tablets" and the question ledger becomes the client's page menu.
//
// Writes index.html and ivtabs.css (the client's file plus the patches marked
// "v3:", so the client's base stays readable as theirs).
import fs from "node:fs";
import path from "node:path";

const ROOT = "scrollcraft/builds/iv-vs-tablets";
const CLIENT = "_reference/NutriDrip IV Nutrient Therapy";
const drips = JSON.parse(fs.readFileSync(path.join(ROOT, "data/drips.json"), "utf8"));
const site = JSON.parse(fs.readFileSync(path.join(ROOT, "data/site.json"), "utf8"));

// content.ts keys. All NEW: the port adds them to CONTENT_DEFAULTS with these
// values, the client's own wording, so the admin can edit them. "{duration}"
// is filled from the drips at render, never typed in.
const COPY = {
  "ivtabs.heading": "Why IV and not tablets?",
  "ivtabs.lede": "The difference is the route a nutrient takes to reach your blood. Follow one dose each way.",
  "ivtabs.tab.label": "By tablet",
  "ivtabs.tab.1.title": "Swallowed",
  "ivtabs.tab.1.short": "Mouth",
  "ivtabs.tab.1.body": "One dose, taken by mouth.",
  "ivtabs.tab.2.title": "Stomach",
  "ivtabs.tab.2.body":
    "The tablet has to break down and dissolve first. B12 also needs intrinsic factor, made in the stomach.",
  "ivtabs.tab.3.title": "Small intestine",
  "ivtabs.tab.3.short": "Gut",
  "ivtabs.tab.3.body":
    "Nutrients cross the gut wall through transporters that can fill up. Vitamin C, for one, is absorbed less efficiently at higher doses.",
  "ivtabs.tab.4.title": "Liver",
  "ivtabs.tab.4.body":
    "Blood from the gut passes through the liver first. For some substances, part of the dose is processed here (the first-pass effect).",
  "ivtabs.tab.5.title": "Bloodstream",
  "ivtabs.tab.5.short": "Blood",
  "ivtabs.tab.5.body": "What remains reaches your blood. How much varies with the nutrient, the dose and your gut.",
  "ivtabs.iv.label": "By IV drip",
  "ivtabs.iv.1.title": "Into a vein",
  "ivtabs.iv.1.body": "The drip runs into a vein in your arm, over {duration}.",
  "ivtabs.iv.2.title": "Bloodstream",
  "ivtabs.iv.2.body": "The nutrients are in your blood directly. No stomach, gut or liver on the way.",
  "ivtabs.level.full": "Full dose",
  "ivtabs.level.less": "A little less",
  "ivtabs.level.lessAgain": "Less again",
  "ivtabs.level.part": "Part of the dose",
  "ivtabs.summary": "Same dose, two routes. By mouth, part of it is absorbed. By IV, all of it enters the blood.",
  "ivtabs.note": "Illustration, not to scale. Real amounts depend on the nutrient, the dose and the person.",
  "ivtabs.absorbed.heading": "How tablets are absorbed",
  "ivtabs.absorbed.body":
    "A tablet dissolves in the stomach. Nutrients are absorbed mostly in the small intestine, through carriers in the gut wall that can only move so much at once. Blood from the gut then flows through the liver before reaching the rest of the body. Some of the dose is lost or held back along the way, and how much depends on the nutrient, the dose, food in the gut and the health of the gut itself.",
  "ivtabs.different.heading": "How an IV drip is different",
  "ivtabs.different.body":
    "An IV drip puts nutrients into a vein, so they are in the blood straight away. They skip the stomach, the gut wall and the first pass through the liver. That is why IV doses are set by a doctor, run slowly, and given only after tests.",
  "ivtabs.enough.heading": "When tablets are enough",
  "ivtabs.enough.body":
    "For many people with a varied diet and a healthy gut, food and tablets are enough, and they are usually the first thing a doctor tries. We'll tell you if that's you.",
  "ivtabs.choose.heading": "When a doctor may choose IV",
  "ivtabs.choose.1": "Poor absorption from the gut.",
  "ivtabs.choose.2": "A deficiency found on your blood tests.",
  "ivtabs.choose.3": "Gut conditions that make tablets hard to take or absorb.",
  "ivtabs.choose.4": "When nutrients are needed quickly, as with IV iron for low iron stores.",
  "ivtabs.limits.heading": "The limits, honestly",
  "ivtabs.limits.body":
    "IV is a medical procedure. It needs tests, a doctor's prescription and a trained team. It carries small risks that tablets don't, such as bruising at the cannula site or, rarely, an allergic reaction, which is why emergency drugs are at the chair.",
  "ivtabs.limits.body2":
    "IV isn't better for everyone. It's another route, and the doctor chooses it only when it fits your results.",
  "ivtabs.limits.link": "See what's in every drip",
  ...site.contentOverrides,
};
// Already in content.ts (home-v3 reads them too).
const FOOTER = {
  legalName: COPY["footer.legalName"] ?? "NutriDrip Health Pvt. Ltd.",
  registration: COPY["footer.registration"] ?? "KA/CEA/2024/11872",
  emergency: COPY["footer.emergency"] ?? "Not a substitute for emergency care. In an emergency call 108.",
};

// Real figures, as home-v3 reads them.
const ZONES = site.servedZones.length;
const LATE = { windowHours: site.latePolicy?.windowHours ?? 4 };
const durMin = Math.min(...drips.map((d) => d.durationMin));
const durMax = Math.max(...drips.map((d) => d.durationToMin ?? d.durationMin));
const prices = drips.map((d) => d.priceInr);

// The landing's drip palette (home-v3 TINT): the booking slip carries the
// drip a visitor picked on the landing, else the landing default's tint.
const TINT = {
  "hydrate-plus": "#16A6B6",
  "jetlag-reset": "#4B96E6",
  "myers-revive": "#7B5BD6",
  "immune-shield": "#C13E8D",
  "post-viral-rebuild": "#A47DDB",
  "iron-restore": "#8C3E8A",
  "athletic-recovery": "#4A4FB5",
  "deep-recharge": "#B65CC8",
  "glow-protocol": "#DB5B93",
};
const tintOf = (d) => TINT[d.slug] ?? "#7B5BD6";

// ------------------------------------------------------------------ helpers
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
const num = (n) => Number(n).toLocaleString("en-IN");
const inr = (n) => `₹${num(n)}`;
const hours = (h) => `${h} hour${h === 1 ? "" : "s"}`;
const duration = (d) =>
  d.durationToMin && d.durationToMin > d.durationMin
    ? `${d.durationMin}–${d.durationToMin} min`
    : `${d.durationMin} min`;
const fill = (s) => s.replace("{duration}", `${durMin} to ${durMax} minutes`);

const mark = (cls = "") =>
  `<span class="nd-mark ${cls}"><b>NutriDrip<sup>™</sup></b><small>IV NUTRIENT THERAPY</small></span>`;
const QUIZ = (slug) => `/quiz${slug ? `?drip=${encodeURIComponent(slug)}` : ""}`;
const cta = (label = "Take the health quiz", note = "A physician reads every answer", slug) =>
  `<div class="nd-cta"><a class="nd-btn" href="${QUIZ(slug)}" data-quiz-link>${esc(label)}</a><span class="nd-cta__free">${esc(note)}</span></div>`;

// A stop on a route: the long name, and the short one the phone row shows.
const stop = (key, at, drop) => {
  const title = COPY[`${key}.title`],
    short = COPY[`${key}.short`];
  const name = short ? `<span class="lg">${esc(title)}</span><span class="sm">${esc(short)}</span>` : esc(title);
  return `<li data-at="${at}"${drop == null ? "" : ` data-drop="${drop}"`}><b>${name}</b><p>${esc(fill(COPY[`${key}.body`]))}</p></li>`;
};
const LEVELS = JSON.stringify([
  COPY["ivtabs.level.full"],
  COPY["ivtabs.level.less"],
  COPY["ivtabs.level.lessAgain"],
  COPY["ivtabs.level.part"],
]);

const NAV = [
  ["/drips", "Drips"],
  ["/how-it-works", "How it works"],
  ["/pricing", "Pricing"],
  ["/safety", "Safety"],
  ["/iv-vs-tablets", "IV vs Tablets"],
  ["/zones", "Zones"],
  ["/for-clinics", "For clinics"],
];
const HERE = "/iv-vs-tablets";
const navLink = ([href, label]) => `<a href="${href}"${href === HERE ? ' aria-current="page"' : ""}>${esc(label)}</a>`;

// ------------------------------------------------------------------ page
const DRIP_DATA = drips.map((d) => ({
  slug: d.slug,
  name: d.name,
  tint: tintOf(d),
  price: d.priceInr,
  duration: duration(d),
}));
const fallback = drips.find((d) => d.slug === "myers-revive") ?? drips[0];

const html = `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>IV vs Tablets · NutriDrip</title>
<meta name="description" content="How tablets are absorbed compared with an IV drip, when tablets are enough, and when a doctor may choose IV.">
<meta name="theme-color" content="#F5F7F5">
<link rel="icon" href="data:,">
<link rel="preload" href="fonts/outfit-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/geist-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="scrollcraft.css">
<link rel="stylesheet" href="site.css">
<link rel="stylesheet" href="ivtabs.css">
</head>
<body class="nd-page nd-ivt" style="--tint:${tintOf(fallback)}" data-levels='${esc(LEVELS)}'>
<div id="sc-root">
<span data-sc-progress></span>
<a class="visually-hidden" href="#main">Skip to content</a>

<!-- Stand-in for the restyled shared SiteChrome header (home-v3's markup). -->
<header class="nd-bar">
  <div class="nd-bar__in">
    <a class="nd-mark-link" href="/" aria-label="NutriDrip, IV nutrient therapy, home">${mark()}</a>
    <nav class="nd-bar__nav" aria-label="Site">
      ${NAV.map(navLink).join("")}
    </nav>
    <div class="nd-bar__end">
      <button class="nd-ledger-btn nd-menu-btn" type="button" data-menu-btn aria-expanded="false" aria-controls="nd-ledger">Menu</button>
      <div class="nd-bar__book"><a class="nd-btn" href="/login">Sign in</a></div>
      <div class="nd-bar__book">${cta("Take the quiz", "Physician-reviewed before every session")}</div>
    </div>
  </div>
</header>
<div class="nd-ledger" id="nd-ledger" role="dialog" aria-label="Menu">
  <h2>NutriDrip</h2>
  <div class="nd-ledger__pages"><a href="/">Home</a>${NAV.map(navLink).join("")}<a href="/about">About</a></div>
</div>

<main id="main">
<section class="nd-pagehead">
  <div class="nd-wrap">
    <p class="nd-crumb"><a href="/">Home</a> · IV vs Tablets</p>
    <h1 class="nd-q">${esc(COPY["ivtabs.heading"])}</h1>
    <p class="nd-lede">${esc(COPY["ivtabs.lede"])}</p>
  </div>
</section>

<section class="routes act-res" data-sc-act="pin" data-sc-span="4.2" style="--span:4.2;--span-m:4.6" aria-label="One dose by tablet and one by IV, stage by stage">
  <div data-sc-stage class="routes__stage" data-sc-verify-state="0">
    <div class="routes__grid">
      <div class="route route--tab" data-route="tab">
        <div class="route__head">
          <p class="route__k">${esc(COPY["ivtabs.tab.label"])}</p>
          <div class="route__meter" aria-hidden="true"><span></span></div>
          <p class="route__lv" data-lv>${esc(COPY["ivtabs.level.full"])}</p>
        </div>
        <ol class="route__path">
          ${stop("ivtabs.tab.1", "0.00")}
          ${stop("ivtabs.tab.2", "0.22", "0.88")}
          ${stop("ivtabs.tab.3", "0.46", "0.62")}
          ${stop("ivtabs.tab.4", "0.70", "0.46")}
          ${stop("ivtabs.tab.5", "0.92")}
        </ol>
        <span class="route__dose" aria-hidden="true"></span>
      </div>
      <div class="route route--iv" data-route="iv">
        <div class="route__head">
          <p class="route__k">${esc(COPY["ivtabs.iv.label"])}</p>
          <div class="route__meter" aria-hidden="true"><span></span></div>
          <p class="route__lv" data-lv>${esc(COPY["ivtabs.level.full"])}</p>
        </div>
        <ol class="route__path">
          ${stop("ivtabs.iv.1", "0.00")}
          ${stop("ivtabs.iv.2", "0.40")}
        </ol>
        <span class="route__dose" aria-hidden="true"></span>
      </div>
    </div>
    <div class="routes__end">
      <p class="routes__sum">${esc(COPY["ivtabs.summary"])}</p>
      <p class="nd-small">${esc(COPY["ivtabs.note"])}</p>
      ${cta()}
    </div>
  </div>
</section>

<section class="sc-section" aria-labelledby="a-h">
  <div class="nd-wrap ivt__grid">
    <img class="ivt__pic" src="assets/tablets.webp" width="1800" height="1018" alt="White tablets and capsules on a white surface in window light" loading="lazy">
    <div class="sc-stack">
      <h2 id="a-h" class="nd-q nd-q--sm">${esc(COPY["ivtabs.absorbed.heading"])}</h2>
      <p class="nd-body">${esc(COPY["ivtabs.absorbed.body"])}</p>
    </div>
  </div>
</section>

<section class="sc-section" style="background:#fff" aria-labelledby="b-h">
  <div class="nd-wrap ivt__grid ivt__grid--flip">
    <img class="ivt__pic" src="assets/ivline.webp" width="1800" height="1018" alt="A clear IV line with a roller clamp on a white surface in window light" loading="lazy">
    <div class="sc-stack">
      <h2 id="b-h" class="nd-q nd-q--sm">${esc(COPY["ivtabs.different.heading"])}</h2>
      <p class="nd-body">${esc(COPY["ivtabs.different.body"])}</p>
    </div>
  </div>
</section>

<section class="sc-section" aria-labelledby="c-h">
  <div class="nd-wrap nd-grid2 ivt__cards">
    <div class="ivt__card">
      <h2 id="c-h" class="nd-q nd-q--sm">${esc(COPY["ivtabs.enough.heading"])}</h2>
      <p class="nd-body">${esc(COPY["ivtabs.enough.body"])}</p>
    </div>
    <div class="ivt__card">
      <h2 class="nd-q nd-q--sm">${esc(COPY["ivtabs.choose.heading"])}</h2>
      <ul class="ivt__list">${[1, 2, 3, 4].map((i) => `<li>${esc(COPY[`ivtabs.choose.${i}`])}</li>`).join("")}</ul>
    </div>
  </div>
</section>

<section class="sc-section nd-dark" aria-labelledby="d-h">
  <div class="nd-wrap nd-grid2">
    <div class="sc-stack">
      <h2 id="d-h" class="nd-q nd-q--sm">${esc(COPY["ivtabs.limits.heading"])}</h2>
      <p class="nd-body">${esc(COPY["ivtabs.limits.body"])}</p>
    </div>
    <div class="sc-stack">
      <p class="nd-body">${esc(COPY["ivtabs.limits.body2"])}</p>
      <p><a class="nd-link ivt__dlink" href="/drips">${esc(COPY["ivtabs.limits.link"])}</a></p>
      ${cta()}
    </div>
  </div>
</section>

<!-- READY TO BOOK? home-v3's section. The slip shows the drip picked on the
     landing (localStorage nd-drip), else none: the physician suggests one. -->
<section class="sc-section nd-book" id="book">
  <div class="nd-wrap nd-grid2">
    <div class="nd-book__intro">
      <h2 class="nd-q">Ready to book?</h2>
      <p class="nd-lede">Three minutes of questions, read by a registered physician. If a drip is not right for you, they will say so, and tell you what is.</p>
      <ul class="nd-book__facts">
        <li><b>A physician reviews you first</b>, before anything is booked.</li>
        <li><b>A nurse comes to your home</b> in ${ZONES} zones across Bengaluru.</li>
        <li><b>Free to move or cancel</b> up to ${esc(hours(LATE.windowHours))} before your slot.</li>
      </ul>
    </div>
    <div class="nd-slip">
      <div class="nd-slip__head">
        <div>
          <p class="nd-tag">Your drip</p>
          <p class="nd-slip__drip" data-chosen-name>Drip to be suggested</p>
          <p class="nd-slip__free"><span data-chosen-duration>${esc(`${durMin}–${durMax} min`)}</span> · at your home</p>
        </div>
        <p class="nd-slip__price">per session<b data-chosen-price>From ${esc(inr(Math.min(...prices)))}</b></p>
      </div>
      <p class="nd-body nd-slip__body" data-slip-body>The quiz asks what a physician needs to know before they will put their name to a protocol. Not sure which drip? Answer anyway: the physician chooses with you.</p>
      ${cta("Take the quiz to book this", "No card needed to get a protocol reviewed")}
    </div>
  </div>
</section>

</main>

<!-- Stand-in for the restyled shared SiteChrome footer (home-v3's markup). -->
<footer class="nd-foot">
  <div class="nd-wrap">
    <div class="nd-foot__grid">
      <div>
        <a class="nd-mark-link" href="/">${mark()}</a>
        <p class="nd-small" style="margin-top:1rem;max-width:36ch">IV nutrient therapy at home in Bengaluru, reviewed by a registered physician and given by a council-registered nurse.</p>
        <p class="nd-small" style="margin-top:.8rem">${esc(FOOTER.legalName)} · Clinical establishment reg. ${esc(FOOTER.registration)}</p>
      </div>
      <div>
        <h3>Now serving</h3>
        <ul class="nd-foot__zones">${site.servedZones.map((z) => `<li>${esc(z)}</li>`).join("")}</ul>
      </div>
      <div>
        <h3>Pages</h3>
        <ul><li><a href="/drips">Drips</a></li><li><a href="/how-it-works">How it works</a></li><li><a href="/pricing">Pricing</a></li><li><a href="/safety">Safety</a></li><li><a href="/iv-vs-tablets">IV vs Tablets</a></li><li><a href="/zones">Zones</a></li><li><a href="/faqs">FAQs</a></li><li><a href="/consult">Ask a clinician</a></li><li><a href="/for-clinics">For clinics</a></li><li><a href="/legal/terms">Terms</a></li><li><a href="/legal/privacy">Privacy</a></li></ul>
      </div>
    </div>
    <div class="nd-foot__legal"><p><b>IV nutrient therapy is a medical procedure.</b> Every protocol is reviewed by a registered physician before anything is booked, and may not be suitable for everyone. ${esc(FOOTER.emergency)}</p></div>
  </div>
</footer>
<div class="nd-sticky" aria-label="Booking">
  <a class="nd-btn" href="${QUIZ()}" data-quiz-link>Take the health quiz</a>
  <span class="nd-sticky__free">A physician reads every answer</span>
</div>
</div>
<script>window.ND_DRIPS = ${JSON.stringify(DRIP_DATA)};</script>
<script src="scrollcraft.js"></script>
<script src="page.js"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, "index.html"), html);

// ivtabs.css: the client's file, then our patches.
const base = fs.readFileSync(path.join(CLIENT, "assets/css/ivtabs.css"), "utf8");
const patches = fs.readFileSync(path.join(ROOT, "tools/ivtabs-patch.css"), "utf8");
fs.writeFileSync(
  path.join(ROOT, "ivtabs.css"),
  `/* The client's ivtabs.css, unchanged, then the v3 patches (tools/ivtabs-patch.css). */\n${base}\n${patches}`
);
console.log(
  `index.html + ivtabs.css · IV runs ${durMin} to ${durMax} minutes · ${ZONES} zones · from ${inr(Math.min(...prices))}`
);

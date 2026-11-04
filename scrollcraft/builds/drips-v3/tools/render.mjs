// Renders the Drips list prototype (BRIEF.md): the landing's formulary cards
// as a grid, under the site's page heading, with the goal filter and search.
//
//   node scrollcraft/builds/drips-v3/tools/render.mjs   (from nutridrip-new/)
//
// Writes index.html (every drip as the dev data has it: no uploaded photos,
// stock fine) and test/photos.html (two stand-in "uploads" and two stock
// states, to see how they look). Data: data/drips.json and data/site.json,
// copied from drip-v3.
import fs from "node:fs";
import path from "node:path";

const ROOT = "scrollcraft/builds/drips-v3";
const drips = JSON.parse(fs.readFileSync(path.join(ROOT, "data/drips.json"), "utf8"));
const site = JSON.parse(fs.readFileSync(path.join(ROOT, "data/site.json"), "utf8"));

// The seeded drips' colours (src/lib/tints.ts SEED_TINTS), under Drip.tint.
const SEED_TINTS = {
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
const tintOf = (d) => d.tint ?? SEED_TINTS[d.slug] ?? "#7B5BD6";
// The goals in the order the app lists them (src/lib/models/types.ts DRIP_CATEGORIES).
const GOALS = ["Energy", "Immunity", "Skin", "Hydration", "Athletic recovery", "Post-viral"];

// ------------------------------------------------------------------ helpers
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
const num = (n) => Number(n).toLocaleString("en-IN");
const inr = (n) => `₹${num(n)}`;
const unitOf = (u) => (u === "ml" ? "mL" : u);
const dose = (i) => `${num(i.dose)} ${unitOf(i.unit)}`;
const duration = (d) =>
  d.durationToMin && d.durationToMin > d.durationMin
    ? `${d.durationMin}–${d.durationToMin} min`
    : `${d.durationMin} min`;
const WORDS = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
];
const Word = (n) => WORDS[n] ?? String(n);
const QUIZ = (slug) => `/quiz${slug ? `?drip=${encodeURIComponent(slug)}` : ""}`;
const cta = (label = "Take the health quiz", note = "A physician reads every answer", slug) =>
  `<div class="nd-cta"><a class="nd-btn" href="${QUIZ(slug)}">${esc(label)}</a><span class="nd-cta__free">${esc(note)}</span></div>`;
// What a search looks through, as src/lib/data/drip-search.ts normalises it.
const normalise = (v) =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9%+\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const haystack = (d) =>
  normalise([d.name, d.category, d.carrier?.name, ...d.items.map((i) => i.name), d.tagline].filter(Boolean).join(" "));

// ------------------------------------------------------------------ chrome (as drip-v3)
const NAV = [
  ["/drips", "Drips"],
  ["/how-it-works", "How it works"],
  ["/pricing", "Pricing"],
  ["/safety", "Safety"],
  ["/iv-vs-tablets", "IV vs Tablets"],
  ["/zones", "Zones"],
  ["/for-clinics", "For clinics"],
];
const MENU = [
  ["/drips", "All drips"],
  ["/how-it-works", "How it works"],
  ["/pricing", "Pricing"],
  ["/safety", "Safety"],
  ["/iv-vs-tablets", "IV vs Tablets"],
  ["/zones", "Zones"],
  ["/about", "About"],
  ["/for-clinics", "For clinics"],
];
const mark = `<span class="nd-mark"><b>NutriDrip<sup>™</sup></b><small>IV NUTRIENT THERAPY</small></span>`;
const header = () => `<a class="nd-skip" href="#main">Skip to content</a>
<header class="nd-bar"><div class="nd-bar__in">
  <a class="nd-mark-link" href="/" aria-label="NutriDrip, IV nutrient therapy, home">${mark}</a>
  <nav class="nd-bar__nav" aria-label="Site">${NAV.map(([h, l]) => `<a href="${h}"${h === "/drips" ? ' aria-current="page"' : ""}>${esc(l)}</a>`).join("")}</nav>
  <div class="nd-bar__end">
    <button class="nd-ledger-btn nd-menu-btn" type="button" aria-expanded="false" aria-controls="nd-ledger" data-menu-btn>Menu</button>
    <div class="nd-bar__book"><a class="nd-btn nd-btn--account" href="/login">Sign in</a></div>
    <div class="nd-bar__book">${cta("Take the quiz", "Physician-reviewed before every session")}</div>
  </div>
</div></header>
<div class="nd-ledger" id="nd-ledger" role="dialog" aria-label="Menu"><h2>NutriDrip</h2><div class="nd-ledger__pages">${MENU.map(([h, l]) => `<a href="${h}">${esc(l)}</a>`).join("")}</div></div>`;
const footer = () => `<footer class="nd-foot"><div class="nd-wrap">
  <div class="nd-foot__grid">
    <div><a class="nd-mark-link" href="/">${mark}</a><p class="nd-small" style="margin-top:1rem;max-width:36ch">IV nutrient therapy at home in Bengaluru, reviewed by a registered physician and given by a council-registered nurse.</p><p class="nd-small" style="margin-top:.8rem">NutriDrip Health Pvt. Ltd. · Clinical establishment reg. KA/CEA/2024/11872</p></div>
    <div><h3>Now serving</h3><ul class="nd-foot__zones">${site.servedZones.map((z) => `<li>${esc(z)}</li>`).join("")}</ul></div>
    <nav aria-label="Pages"><h3>Pages</h3><ul>${[...NAV, ["/about", "About"], ["/faqs", "FAQs"], ["/consult", "Ask a clinician"], ["/legal/terms", "Terms"], ["/legal/privacy", "Privacy"]].map(([h, l]) => `<li><a href="${h}">${esc(l)}</a></li>`).join("")}</ul></nav>
  </div>
  <div class="nd-foot__legal"><p><b>IV nutrient therapy is a medical procedure.</b> Every protocol is reviewed by a registered physician before anything is booked, and may not be suitable for everyone. Not a substitute for emergency care. In an emergency call 108.</p></div>
</div></footer>`;

// ------------------------------------------------------------------ the card (the landing's Fcard)
function card(d, { photo = null, stock = null } = {}) {
  const inBag = d.items.filter((i) => !i.separate);
  const sep = d.items.filter((i) => i.separate);
  // The admin's upload in the bag's place; without one, the bag in the drip's colour.
  const visual = photo
    ? `<img class="fcard__photo" src="${esc(photo.src)}" alt="${esc(photo.alt)}" width="${photo.width}" height="${photo.height}" style="object-position:${esc(photo.position)}" loading="lazy" decoding="async">`
    : `<div class="nd-bag" style="--tint:${tintOf(d)};--fill:1" aria-hidden="true"><div class="nd-bag__fill"></div><img class="nd-bag__img" src="/site/v3/bag-empty.webp" width="577" height="1200" alt="" loading="lazy" decoding="async"></div>`;
  return `<article class="fcard" style="--tint:${tintOf(d)}" aria-labelledby="fc-${d.slug}" data-card data-goal="${esc(d.category)}" data-search="${esc(haystack(d))}">
      <div class="fcard__top">
        <div class="fcard__bag${photo ? " fcard__bag--photo" : ""}"${photo ? "" : ' data-sc-tilt="6"'}>${visual}</div>
        <div class="fcard__head">
          <h3 id="fc-${d.slug}">${esc(d.name)}</h3>
          <p class="fcard__cat">${esc(d.category ?? "Wellness")}<span>${esc(duration(d))}</span></p>
          <p class="fcard__price">${esc(inr(d.priceInr))}</p>
          ${d.isPopular ? `<p class="fcard__prem">Most booked</p>` : ""}
        </div>
      </div>
      <div>
        <p class="fcard__k">Inside the bag</p>
        <ul>${d.carrier ? `<li>${esc(d.carrier.name)} ${esc(dose(d.carrier))}</li>` : ""}${inBag.map((i) => `<li>${esc(i.name)} ${esc(dose(i))}</li>`).join("")}</ul>
      </div>
      ${sep.length ? `<div><p class="fcard__k">Given separately</p><ul class="fcard__sep">${sep.map((i) => `<li>${esc(i.name)} ${esc(dose(i))}${i.notes ? ` (${esc(i.notes.toLowerCase())})` : ""}</li>`).join("")}</ul></div>` : ""}
      ${d.tagline ? `<p class="fcard__for">${esc(d.tagline)}.</p>` : ""}
      ${stock !== null && stock <= 3 ? `<p class="fcard__stock${stock === 0 ? " fcard__stock--out" : ""}">${stock === 0 ? "Out of stock" : `Only ${stock} left today`}</p>` : ""}
      <a class="nd-link fcard__link" href="/drips/${d.slug}">Every dose, in full<span class="visually-hidden"> for ${esc(d.name)}</span></a>
    </article>`;
}

// ------------------------------------------------------------------ the page
function page({ photos = {}, stock = {}, note = "", base = "" } = {}) {
  const counts = new Map();
  for (const d of drips) counts.set(d.category, (counts.get(d.category) ?? 0) + 1);
  // Only goals that have a drip: a chip leading to an empty list helps no one.
  const goals = GOALS.filter((g) => counts.get(g));
  const chip = (href, label, n, current) =>
    `<li><a class="dl-chip" href="${href}"${current ? ' aria-current="page"' : ""} data-goal-chip="${esc(label === "All" ? "" : label)}">${esc(label)}<span>${n}</span></a></li>`;
  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Drips · NutriDrip</title>
<meta name="description" content="Every NutriDrip drip with every dose: what is in the bag, what is given beside it, how long it takes and what it costs.">
<base href="${base}">
<link rel="icon" href="data:,">
<link rel="preload" href="/fonts/v3/outfit-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/v3/geist-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/scrollcraft.css">
<link rel="stylesheet" href="/site.css">
<link rel="stylesheet" href="/drips.css">
</head>
<body>
<div id="sc-root">
<span data-sc-progress></span>
${header()}
<main id="main">
${note ? `<p class="dl-proto">${note}</p>` : ""}
<section class="nd-pagehead dl-head">
  <div class="nd-wrap">
    <p class="nd-crumb"><a href="/">Home</a> · Drips</p>
    <h1 class="nd-q">${Word(drips.length)} drips, every dose published.</h1>
    <p class="nd-lede">Each is a fixed recipe a physician can adjust for you. Prices are per session, everything included.</p>
    <div class="dl-tools">
      <form class="dl-search" role="search" action="/drips" method="get" data-search-form>
        <label class="visually-hidden" for="dl-q">Search drips</label>
        <input id="dl-q" name="q" type="search" placeholder="Search by name, goal or ingredient" autocomplete="off" enterkeyhint="search">
        <input type="hidden" name="goal" value="" data-goal-field>
      </form>
      <nav class="dl-goals" aria-label="Filter by goal">
        <ul>${chip("/drips", "All", drips.length, true)}${goals.map((g) => chip(`/drips?goal=${encodeURIComponent(g)}`, g, counts.get(g), false)).join("")}</ul>
      </nav>
    </div>
    <p class="dl-count" aria-live="polite" data-count>Showing all ${drips.length} drips</p>
  </div>
</section>

<section class="dl-list" aria-label="Drips">
  <div class="nd-wrap">
    <div class="dl-grid" data-grid>
      ${drips.map((d) => card(d, { photo: photos[d.slug] ?? null, stock: stock[d.slug] ?? null })).join("\n      ")}
    </div>
    <div class="dl-none" data-none hidden>
      <p data-none-text></p>
      <a class="nd-btn nd-btn--ghost" href="/drips" data-clear>Clear the search</a>
    </div>
  </div>
</section>

<section class="sc-section dl-end" aria-labelledby="end-h">
  <div class="nd-wrap"><div class="dl-end__in" data-sc-in>
    <h2 id="end-h" class="nd-q nd-q--sm">Not sure which?</h2>
    <p class="nd-body">Take the health quiz. A registered physician reads it, then approves a protocol, changes the doses, or tells you what would suit you better.</p>
    <div class="dl-end__acts">${cta()}<a class="nd-btn nd-btn--ghost" href="/consult">Ask a clinician</a></div>
  </div></div>
</section>
</main>
${footer()}
</div>
<script src="/scrollcraft.js"></script>
<script src="/page.js"></script>
</body>
</html>
`;
}

fs.writeFileSync(path.join(ROOT, "index.html"), page());
fs.mkdirSync(path.join(ROOT, "test"), { recursive: true });
// Two stand-ins for an admin's upload (the shipped photos, which the real
// page never shows), a portrait and a landscape, and two stock states.
fs.writeFileSync(
  path.join(ROOT, "test/photos.html"),
  page({
    note: "Prototype test: Myers' Revive and Glow Protocol show stand-in photos as if an admin had uploaded them; Iron Restore is low on stock and Deep Recharge is out.",
    photos: {
      "myers-revive": {
        src: "/images/site/drip-bag.jpg",
        alt: "An IV bag and its drip chamber hanging from a stand in soft light",
        width: 1400,
        height: 2100,
        position: "50% 28%",
      },
      "glow-protocol": {
        src: "/images/site/goal-skin.jpg",
        alt: "Portrait of a young woman in soft natural light",
        width: 1600,
        height: 1065,
        position: "56% 34%",
      },
    },
    stock: { "iron-restore": 2, "deep-recharge": 0 },
  })
);
console.log(`index.html and test/photos.html: ${drips.length} drips`);

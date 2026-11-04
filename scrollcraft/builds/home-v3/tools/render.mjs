// Renders the v3 landing prototype: the client's layout and motion
// (_reference/NutriDrip IV Nutrient Therapy/index.html), filled from our data.
//
//   node scrollcraft/builds/home-v3/tools/render.mjs
//
// Decisions (scrollcraft/lab/client-artifact/REVIEW.md §5, §7): UI and motion
// only; every drip, dose, price, zone and line of copy comes from the Drip
// documents (data/drips.json), content.ts (COPY below) or real constants in
// src/lib. The primary action is the health quiz. Writes index.html and
// test/<slug>.html (the build on every drip, picked by ?drip=).
import fs from "node:fs";
import path from "node:path";

const ROOT = "scrollcraft/builds/home-v3";
const drips = JSON.parse(fs.readFileSync(path.join(ROOT, "data/drips.json"), "utf8"));
const site = JSON.parse(fs.readFileSync(path.join(ROOT, "data/site.json"), "utf8"));

// content.ts defaults this page reads, under any live overrides. Keys marked
// NEW do not exist yet: the port adds them to CONTENT_DEFAULTS so the admin
// can edit them. "Why IV" carries the client's own wording (REVIEW.md §7).
const COPY = {
  "home.headline": "IV nutrient therapy, at home, with a doctor in the loop.",
  "home.sub":
    "Answer a 16-point health quiz, get a protocol reviewed by a registered physician, and have a nurse administer it in your own home. No walk-in, no guesswork.",
  "home.cta": "Take the health quiz · 3 min",
  "home.safety.heading": "Where the safety actually sits",
  "home.contra.heading": "Not for everyone",
  "home.contra.body":
    "IV therapy is unsuitable during pregnancy, in renal or cardiac failure, and with certain drug interactions. The quiz screens for these and a physician can decline.",
  "about.intro":
    "NutriDrip is a clinical service first and a wellness brand a long way second. A registered physician reviews everyone before anything is prepared, a council-registered nurse comes to you, and every dose and batch number is written down.",
  "footer.legalName": "NutriDrip Health Pvt. Ltd.",
  "footer.registration": "KA/CEA/2024/11872",
  "footer.emergency": "Not a substitute for emergency care. In an emergency call 108.",
  // NEW, the client's wording:
  "home.why.heading": "Why IV and not tablets?",
  "home.why.lede":
    "A tablet passes through your stomach, gut and liver before what's left reaches your blood. An IV drip goes straight into a vein.",
  "home.why.body":
    "Tablets are enough for many people. A doctor may choose IV when absorption is poor, a test shows a deficiency, or nutrients are needed quickly.",
  ...site.contentOverrides,
};

// Real figures from the code, as the route imports them.
const CHECKLIST_STEPS = 29; // CHECKLIST_STEPS.length, lib/clinical/checklist.ts
const APPROVAL_VALID_DAYS = 90; // lib/clinical/validity.ts
const VITALS = [
  // VITAL_RANGES, lib/clinical/checklist.ts
  ["Blood pressure", "90–140 / 60–90 mmHg"],
  ["Heart rate", "60–100 bpm"],
  ["SpO₂", "95–100%"],
  ["Temperature", "97.0–99.5 °F"],
];
const ZONES = site.servedZones.length;
// getLatePolicy(): no saved row, so LATE_POLICY_DEFAULTS (4 h, ₹500, ₹500).
const LATE = {
  windowHours: site.latePolicy?.windowHours ?? 4,
  rescheduleFee: site.latePolicy?.rescheduleFee ?? 500,
  cancelFee: site.latePolicy?.cancelFee ?? 500,
};

// The safe palette (REVIEW.md §5): no hue near the clinical safe, caution,
// critical or info colours. The port stores one per drip (Drip.tint), set in
// the builder; these are the proposed starting values.
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
const FALLBACK_TINT = "#7B5BD6";
const tintOf = (d) => TINT[d.slug] ?? FALLBACK_TINT;

// CATEGORIES, lib/data/marketing.ts: the picker's six goals.
const CATEGORIES = [
  ["Energy", "Fatigue that sleep has not fixed"],
  ["Immunity", "Before travel, after illness"],
  ["Skin", "Glutathione protocols"],
  ["Hydration", "The fastest session we run"],
  ["Athletic recovery", "After the effort, not before"],
  ["Post-viral", "The flat weeks afterwards"],
];

// ------------------------------------------------------------------ helpers
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
const num = (n) => Number(n).toLocaleString("en-IN");
const inr = (n) => `₹${num(n)}`;
const WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];
const word = (n) => WORDS[n] ?? String(n);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const duration = (d) =>
  d.durationToMin && d.durationToMin > d.durationMin
    ? `${d.durationMin}–${d.durationToMin} min`
    : `${d.durationMin} min`;
// Litres are written mL, as on the client's labels.
const unitOf = (u) => (u === "ml" ? "mL" : u);
const dose = (i) => `${num(i.dose)} ${unitOf(i.unit)}`;
// The same amount one unit up ("1,000 mcg" is "1 mg"), the second line the
// client's labels print under a dose. Derived, never invented.
const altDose = (i) =>
  i.unit === "mcg" && i.dose >= 1000
    ? `(${num(i.dose / 1000)} mg)`
    : i.unit === "mg" && i.dose >= 1000
      ? `(${num(i.dose / 1000)} g)`
      : null;
const hours = (h) => `${h} hour${h === 1 ? "" : "s"}`;
const lateSentence = () => {
  const free = `Move or cancel freely up to ${hours(LATE.windowHours)} before your slot.`;
  const fees =
    LATE.rescheduleFee === 0 && LATE.cancelFee === 0
      ? "Inside that, there is still no late fee"
      : LATE.rescheduleFee === LATE.cancelFee
        ? `Inside that, moving or cancelling carries a ${inr(LATE.cancelFee)} late fee`
        : `Inside that, a late fee applies (${inr(LATE.rescheduleFee)} to move, ${inr(LATE.cancelFee)} to cancel)`;
  return `${free} ${fees}, because the nurse is already dispatched with your batch drawn.`;
};

// The drip the build shows first: the landing default, Myers' Revive.
const landing = drips.find((d) => d.slug === "myers-revive") ?? drips.find((d) => d.isPopular) ?? drips[0];
// One drip per goal: the "Most popular" one in that category, else the cheapest.
const goalDrip = (cat) => {
  const inCat = drips.filter((d) => d.category === cat);
  return inCat.find((d) => d.isPopular) ?? inCat[0] ?? null;
};
const prices = drips.map((d) => d.priceInr);
const durMin = Math.min(...drips.map((d) => d.durationMin));
const durMax = Math.max(...drips.map((d) => d.durationToMin ?? d.durationMin));

// The data page.js needs to rebuild the bag for whichever drip is chosen.
const DRIP_DATA = drips.map((d) => ({
  slug: d.slug,
  name: d.name,
  tint: tintOf(d),
  price: d.priceInr,
  duration: duration(d),
  volume: d.volumeMl ?? 500,
  carrier: d.carrier?.name ?? null,
  inBag: d.items
    .filter((i) => !i.separate)
    .map((i) => ({ name: i.name, dose: dose(i), alt: altDose(i), molecule: i.molecule ?? null, form: i.form })),
  separate: d.items.filter((i) => i.separate).map((i) => ({ name: i.name, dose: dose(i), notes: i.notes })),
}));

// The client's label mark: an infinity, drawn once, used by both bag labels.
const INFINITY = `<svg viewBox="0 0 100 50" aria-hidden="true"><path d="M50 25C40 11 33 7 25 7 15 7 7 15 7 25s8 18 18 18c8 0 15-4 25-18s17-18 25-18c10 0 18 8 18 18s-8 18-18 18c-8 0-15-4-25-18Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/></svg>`;

// The build act: 3.2 screens plus 0.3 per ingredient that goes into the bag,
// between 4 and 6, so the fill keeps one steady pace whatever the count.
const buildSpan = (d) => Math.min(6, Math.max(4, 3.2 + 0.3 * d.items.filter((i) => !i.separate).length)).toFixed(2);

// ------------------------------------------------------------- fragments
/** The wordmark, the client's lockup. Public site only; invoices keep the LogoMark. */
const mark = (cls = "") =>
  `<span class="nd-mark ${cls}"><b>NutriDrip<sup>™</sup></b><small>IV NUTRIENT THERAPY</small></span>`;

/** A clear bag that fills with the drip's tint, with its label in HTML. */
function bag(d, { cls = "", fill = 1, label = "full", lazy = true } = {}) {
  const lab =
    label === "none"
      ? ""
      : `<div class="nd-bag__label" aria-hidden="true">${mark("nd-bag__mark")}<p class="nd-bag__name">${esc(d.name)}</p>${
          label === "full" ? `<p class="nd-bag__vol">${num(d.volumeMl ?? 500)} mL</p>` : ""
        }</div>`;
  return `<div class="nd-bag ${cls}" style="--tint:${tintOf(d)};--fill:${fill}" aria-hidden="true"><div class="nd-bag__fill"></div><img class="nd-bag__img" src="assets/bag-empty.webp" width="577" height="1200" alt=""${lazy ? ' loading="lazy"' : ""} decoding="async">${lab}</div>`;
}

function fcard(d, k) {
  const inBag = d.items.filter((i) => !i.separate);
  const sep = d.items.filter((i) => i.separate);
  return `<article class="fcard" style="--tint:${tintOf(d)};--i:${k}" aria-labelledby="fc-${esc(d.slug)}">
  <div class="fcard__top"><div class="fcard__bag" data-sc-tilt="6">${bag(d, { label: "none" })}</div><div class="fcard__head"><h3 id="fc-${esc(d.slug)}">${esc(d.name)}</h3><p class="fcard__cat">${esc(d.category ?? "Wellness")}<span>${esc(duration(d))}</span></p><p class="fcard__price">${esc(inr(d.priceInr))}</p>${d.isPopular ? '<p class="fcard__prem">Most booked</p>' : ""}</div></div>
  <div><p class="fcard__k">Inside the bag</p><ul>${d.carrier ? `<li>${esc(d.carrier.name)} ${esc(dose(d.carrier))}</li>` : ""}${inBag.map((i) => `<li>${esc(i.name)} ${esc(dose(i))}</li>`).join("")}</ul></div>
  ${sep.length ? `<div><p class="fcard__k">Given separately</p><ul class="fcard__sep">${sep.map((i) => `<li>${esc(i.name)} ${esc(dose(i))}${i.notes ? ` (${esc(i.notes.toLowerCase())})` : ""}</li>`).join("")}</ul></div>` : ""}
  ${d.tagline ? `<p class="fcard__for">${esc(d.tagline)}.</p>` : ""}
  <a class="nd-link fcard__link" href="/drips/${esc(d.slug)}">Every dose, in full<span class="visually-hidden"> for ${esc(d.name)}</span></a>
</article>`;
}

const QUIZ = (slug) => `/quiz${slug ? `?drip=${encodeURIComponent(slug)}` : ""}`;
const cta = (label = "Take the health quiz", note = "A physician reads every answer", slug) =>
  `<div class="nd-cta"><a class="nd-btn" href="${QUIZ(slug)}" data-quiz-link>${esc(label)}</a><span class="nd-cta__free">${esc(note)}</span></div>`;

// Separately given components across the catalogue, for the rail's note.
const sepNotes = [
  ...new Map(
    drips.flatMap((d) => d.items.filter((i) => i.separate && i.notes).map((i) => [i.name, i.notes]))
  ).entries(),
];

const FAQS = [
  [
    "Does a real doctor look at my quiz?",
    "Yes. A registered physician reads every submission and either approves the protocol, changes the doses, or declines it. Their name and council registration number appear on your session report.",
  ],
  [
    "Do I have to take the quiz every time I book?",
    `No. One approval covers all your bookings for ${APPROVAL_VALID_DAYS} days. It lapses after that because a physician's approval is a judgement about you on the day: weight, medication and kidney function all move.`,
  ],
  [
    "What if the nurse finds something wrong?",
    `The ${CHECKLIST_STEPS}-step checklist gates the session. If your vitals fall outside the reference range the infusion does not start. The nurse escalates to the reviewing physician, and a session that does not run is refunded in full.`,
  ],
  ["Can I cancel or reschedule?", lateSentence()],
  [
    "Do you serve my pincode?",
    `We cover ${ZONES} zones across Bengaluru. Enter your pincode at booking and you get a straight yes or no, not a waitlist.`,
  ],
  [
    "What happens to my health data?",
    "Your record is visible to you, the reviewing physician and the attending nurse. Nobody else. Access attempts are logged, and you can export or delete your record from your profile at any time.",
  ],
];

// Real "only where needed" checks, read off the drips' own notes.
const conditional = drips.flatMap((d) =>
  (d.goodToKnow ?? []).filter((g) => /lab|screen|g6pd|test/i.test(g)).map((g) => [d.name, g])
);

// ------------------------------------------------------------------ page
function page(chosen, { base = "" } = {}) {
  const t = tintOf(chosen);
  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>NutriDrip · IV nutrient therapy at home</title>
<meta name="description" content="Answer a health quiz, get a protocol reviewed by a registered physician, and have a nurse give it in your own home.">
<meta name="theme-color" content="#F5F7F5">
<base href="${base}">
<link rel="icon" href="data:,">
<link rel="preload" href="fonts/outfit-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/geist-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/room.webp" as="image" media="(min-width: 861px)">
<link rel="preload" href="assets/room-p.webp" as="image" media="(max-width: 860px)">
<link rel="stylesheet" href="scrollcraft.css">
<link rel="stylesheet" href="site.css">
<link rel="stylesheet" href="home.css">
</head>
<body style="--tint:${t}">
<div id="sc-root">
<span data-sc-progress></span>
<a class="visually-hidden" href="#main">Skip to content</a>

<!-- Stand-in for the restyled shared SiteChrome header. -->
<header class="nd-bar">
  <div class="nd-bar__in">
    <a class="nd-mark-link" href="/" aria-label="NutriDrip, IV nutrient therapy, home">${mark()}</a>
    <nav class="nd-bar__nav" aria-label="Site">
      <a href="/drips">Drips</a><a href="/how-it-works">How it works</a><a href="/pricing">Pricing</a><a href="/safety">Safety</a><a href="/iv-vs-tablets">IV vs Tablets</a><a href="/zones">Zones</a><a href="/for-clinics">For clinics</a>
    </nav>
    <div class="nd-bar__end">
      <button class="nd-ledger-btn" type="button" data-ledger-btn aria-expanded="false" aria-controls="nd-ledger"><span class="nd-ledger-btn__count">0/10</span><span class="nd-ledger-btn__q">What is this?</span></button>
      <div class="nd-bar__book"><a class="nd-btn" href="/login">Sign in</a></div>
      <div class="nd-bar__book">${cta("Take the quiz", "Physician-reviewed before every session")}</div>
    </div>
  </div>
</header>
<div class="nd-ledger" id="nd-ledger" role="dialog" aria-label="Your questions">
  <h2>Your questions, answered as you read</h2><ol></ol>
  <div class="nd-ledger__pages"><a href="/drips">All drips</a><a href="/how-it-works">How it works</a><a href="/pricing">Pricing</a><a href="/safety">Safety</a><a href="/iv-vs-tablets">IV vs Tablets</a><a href="/zones">Zones</a><a href="/about">About</a><a href="/for-clinics">For clinics</a></div>
</div>

<main id="main">

<!-- 1 · WHAT IS THIS? Planes; the headline recedes behind the bag. -->
<section id="q-what" class="hero act-res" data-q="What is this?" data-hero data-sc-act="pin" data-sc-span="2.1" style="--span:2.1;--span-m:1.8">
  <div data-sc-stage class="hero__stage" data-sc-verify-state="0">
    <div class="hero__plane hero__room" data-depth="0.2">
      <picture><source media="(max-width: 860px)" srcset="assets/room-p.webp"><img src="assets/room.webp" width="2400" height="1357" alt="" fetchpriority="high"></picture>
    </div>
    <img class="hero__plane hero__back hero__back--1" src="assets/hero-back-1.webp" width="279" height="640" alt="">
    <img class="hero__plane hero__back hero__back--2" src="assets/hero-back-2.webp" width="279" height="640" alt="">
    <div class="hero__plane hero__head"><h1 class="hero__h1">${esc(COPY["home.headline"])}</h1></div>
    <div class="hero__plane hero__bag">
      <img src="assets/bag-hero-clean.webp" width="611" height="1400" alt="A NutriDrip ${num(chosen.volumeMl ?? 500)} mL IV nutrient bag hanging in a sunlit infusion room" fetchpriority="high">
    </div>
    <!-- v3e: the bag's print, a plane of its own that moves with the bag. The
         photo plane is rasterised once and moved as a bitmap (will-change),
         which blurred live text; this one is redrawn at each size, sharp. -->
    <div class="hero__plane hero__bag hero__bagprint" aria-hidden="true">
      <div class="hb-label">
        <span class="hb-word">NutriDrip<sup>™</sup></span>
        <span class="hb-sub">IV NUTRIENT THERAPY</span>
        <span class="hb-foot">${INFINITY}<i></i><b>${num(chosen.volumeMl ?? 500)} mL</b></span>
      </div>
    </div>
    <img class="hero__plane hero__front" src="assets/hero-front.webp" width="279" height="640" alt="">
    <div class="hero__plane hero__light" aria-hidden="true"></div>
    <div class="hero__copy">
      <p class="hero__sub">${esc(COPY["home.sub"])}</p>
      ${cta(COPY["home.cta"], "No card needed to get a protocol reviewed")}
    </div>
    <p class="hero__second" aria-hidden="true">Reviewed by a physician. Given by a nurse at home. Every dose on your report.</p>
  </div>
</section>
<p class="visually-hidden">Reviewed by a physician. Given by a nurse at home. Every dose on your report.</p>

<!-- 2 · IS IT SAFE? WHO IS BEHIND IT? Real figures only. -->
<div id="q-safe" data-q="Is it safe? Who is behind it?">
  <section class="sc-section trust">
    <div class="nd-wrap trust__grid">
      <div class="sc-stack" data-sc-in data-sc-stagger="70">
        <h2 class="nd-q">Is it safe? Who is behind it?</h2>
        <p class="nd-lede">${esc(COPY["about.intro"])}</p>
        <p><a class="nd-link" href="/about">About NutriDrip</a></p>
      </div>
      <dl class="trust__stats">
        <div><dt>steps in every session checklist, none skippable</dt><dd class="nd-num"><span data-sc-count="0 ${CHECKLIST_STEPS}">${CHECKLIST_STEPS}</span></dd></div>
        <div><dt>days a physician's approval lasts</dt><dd class="nd-num"><span data-sc-count="0 ${APPROVAL_VALID_DAYS}">${APPROVAL_VALID_DAYS}</span></dd></div>
        <div><dt>zones served in Bengaluru</dt><dd class="nd-num"><span data-sc-count="0 ${ZONES}">${ZONES}</span></dd></div>
        <div><dt>drips, every dose published</dt><dd class="nd-num"><span data-sc-count="0 ${drips.length}">${drips.length}</span></dd></div>
      </dl>
    </div>
  </section>

  <section class="path act-res" data-sc-act="pin" data-sc-span="2.8" style="--span:2.8;--span-m:2.4" aria-labelledby="path-h">
    <div data-sc-stage class="path__stage" data-sc-verify-state="0">
      <div class="nd-wrap path__grid">
        <div class="path__intro">
          <h3 id="path-h" class="nd-q nd-q--sm">Every session follows the same six steps.</h3>
          <p class="nd-body">No step is skipped. If any step says no, there is no drip.</p>
        </div>
        <ol class="path__steps">
          <li><span class="path__n">1</span><div><b>Health quiz</b><p>About three minutes: your symptoms, medication, allergies and history.</p></div></li>
          <li><span class="path__n">2</span><div><b>Physician review</b><p>A registered doctor approves a protocol, changes the doses, asks you for more, or declines.</p></div></li>
          <li><span class="path__n">3</span><div><b>Booking</b><p>A slot in your zone. Free to move up to ${esc(hours(LATE.windowHours))} before.</p></div></li>
          <li><span class="path__n">4</span><div><b>A sealed kit</b><p>Your nurse checks the seal and every vial's expiry in front of you.</p></div></li>
          <li><span class="path__n">5</span><div><b>The infusion, at home</b><p>Baseline vitals first, then a ${CHECKLIST_STEPS}-step checklist that cannot be skipped.</p></div></li>
          <li><span class="path__n">6</span><div><b>Your report</b><p>Vitals, every dose, every batch number and the physician's name, the same day.</p></div></li>
        </ol>
      </div>
    </div>
  </section>

  <section class="sc-section nd-section--tight tests" aria-labelledby="tests-h">
    <div class="nd-wrap">
      <div class="tests__panel" data-sc-reveal="right" data-sc-reveal-at="0.04 0.42">
        <div class="tests__head">
          <h3 id="tests-h" class="nd-q nd-q--sm">Checked before anything is infused.</h3>
          <p class="nd-body">The nurse records baseline vitals at every session. A reading outside its range stops the infusion until the physician clears it.</p>
        </div>
        <div class="tests__cols">
          <div>
            <p class="nd-tag">Every session</p>
            <ul class="tests__list">${VITALS.map(([k, v]) => `<li><b>${esc(k)}</b><span>${esc(v)}</span></li>`).join("")}</ul>
          </div>
          <div>
            <p class="nd-tag">Only where needed</p>
            <ul class="tests__list tests__list--cond">${conditional.map(([n, g]) => `<li><b>${esc(n)}</b><span>${esc(g)}</span></li>`).join("")}<li><b>Every quiz</b><span>${esc(COPY["home.contra.body"])}</span></li></ul>
          </div>
        </div>
        <p class="tests__chair"><b>At every session:</b> the nurse confirms the anaphylaxis kit is present and in date before the sealed kit is opened. <a class="nd-link" href="/safety">${esc(COPY["home.safety.heading"])}</a></p>
      </div>
    </div>
  </section>
</div>

<!-- 3 · WHY IV AND NOT TABLETS? (client's wording, editable) -->
<section id="q-why" class="sc-section teaser" data-q="Why IV and not tablets?">
  <div class="nd-wrap teaser__grid">
    <div class="teaser__pics" aria-hidden="true">
      <img class="teaser__pic teaser__pic--a" data-sc-parallax="-0.6" src="assets/tablets.webp" width="1800" height="1018" alt="" loading="lazy">
      <img class="teaser__pic teaser__pic--b" data-sc-parallax="0.6" src="assets/ivline.webp" width="1800" height="1018" alt="" loading="lazy">
    </div>
    <div class="sc-stack" data-sc-in data-sc-stagger="70">
      <h2 class="nd-q">${esc(COPY["home.why.heading"])}</h2>
      <p class="nd-lede">${esc(COPY["home.why.lede"])}</p>
      <p class="nd-body">${esc(COPY["home.why.body"])}</p>
      <p><a class="nd-btn nd-btn--ghost" href="/how-it-works">How it works</a></p>
    </div>
  </div>
</section>

<!-- 4 · WHICH ONE IS FOR ME? Goal picker, the drop, then the build. -->
<div id="q-which" data-q="Which one is for me?">
  <section class="sc-section picker" aria-labelledby="pick-h">
    <div class="nd-wrap">
      <div class="picker__head">
        <h2 id="pick-h" class="nd-q">Which one is for me?</h2>
        <p class="nd-lede">Start with what you are trying to fix. Then keep scrolling and watch that drip being built.</p>
      </div>
      <div class="picker__grid" role="group" aria-label="What are you trying to fix?">
        ${CATEGORIES.map(([cat, blurb]) => {
          const d = goalDrip(cat);
          if (!d) return "";
          return `<button type="button" class="feel" aria-pressed="${d.slug === chosen.slug}" data-feel="${esc(d.slug)}" style="--t:${tintOf(d)}"><i aria-hidden="true"></i>${esc(blurb)}<small>${esc(cat)} · ${esc(d.name)} · ${esc(inr(d.priceInr))}</small></button>`;
        }).join("\n        ")}
      </div>
      <p class="picker__note nd-small" role="status" data-pick-status>Not sure? A physician confirms it after the quiz. Showing <b data-chosen-name>${esc(chosen.name)}</b> for now.</p>
    </div>
  </section>

  <section class="drop act-res" data-sc-act="scrub" data-sc-span="2.2" data-sc-dwell="0.3" style="--span:2.2;--span-m:2.2" aria-label="A drop forming in the drip chamber">
    <div data-sc-stage class="drop__stage">
      <picture><source media="(max-width: 860px)" srcset="assets/chamber-poster-m.webp"><img class="sc-stage__poster" src="assets/chamber-poster.webp" width="1914" height="1080" alt="" loading="lazy"></picture>
      <video data-sc-scrub data-sc-src="assets/chamber.mp4" data-sc-src-mobile="assets/chamber-m.mp4" muted playsinline preload="none"></video>
      <div class="drop__scrim" aria-hidden="true"></div>
      <div class="sc-copy drop__copy" data-sc-cue="0.12 0.9">
        <h2 class="drop__h">It starts with one drop.</h2>
        <p class="drop__p"><span data-chosen-name>${esc(chosen.name)}</span> runs over <span data-chosen-duration>${esc(duration(chosen))}</span>. What goes into the bag is decided before the first drop falls.</p>
      </div>
    </div>
  </section>

  <section id="build" class="build act-res" data-sc-act="pin" data-sc-span="${buildSpan(chosen)}" style="--span:${buildSpan(chosen)};--span-m:${(buildSpan(chosen) * 0.9).toFixed(2)}" aria-labelledby="build-h">
    <div data-sc-stage class="build__stage" data-sc-verify-state="0">
      <picture class="build__plate"><source media="(max-width: 860px)" srcset="assets/prep-p.webp"><img src="assets/prep.webp" width="2400" height="1357" alt="" loading="lazy"></picture>
      <div class="build__flood" aria-hidden="true"></div>
      <div class="build__copy">
        <h2 id="build-h" class="build__h">Your <span data-chosen-name>${esc(chosen.name)}</span>, built to protocol.</h2>
        <ol class="build__steps">
          <li data-bstep="0"><span>The bag is the carrier: <span data-chosen-carrier>${esc(chosen.carrier?.name ?? "the carrier")}</span>, <span data-chosen-volume>${num(chosen.volumeMl ?? 500)}</span> mL.</span></li>
          <li data-bstep="1"><span>Each ingredient goes in from its own ampoule or vial, at the dose on the protocol.</span></li>
          <li data-bstep="2"><span>Anything that must not sit in the bag is given beside it.</span></li>
          <li data-bstep="3"><span>A physician approves it for you before a nurse brings it home.</span></li>
        </ol>
        <p class="build__mstep" data-build-mstep aria-hidden="true"></p>
      </div>
      <div class="build__rig">
        <div class="build__vials" data-vials aria-hidden="true"></div>
        <div class="nd-bag build__bag" data-build-bag style="--fill:0">
          <!-- v3e: the liquid. page.js eases the level to where the scroll
               puts it; the surface rolls, and drops fall while it rises. -->
          <div class="nd-bag__fill">
            <div class="liq"><div class="liq__level" data-liq-level><div class="liq__wave liq__wave--back"><svg viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true"><path class="liq__body" d="M0 6Q12.5 2 25 6T50 6T75 6T100 6T125 6T150 6T175 6T200 6V12H0Z"/><path class="liq__shine" d="M0 6Q12.5 2 25 6T50 6T75 6T100 6T125 6T150 6T175 6T200 6"/></svg></div><div class="liq__wave"><svg viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true"><path class="liq__body" d="M0 6Q12.5 2 25 6T50 6T75 6T100 6T125 6T150 6T175 6T200 6V12H0Z"/><path class="liq__shine" d="M0 6Q12.5 2 25 6T50 6T75 6T100 6T125 6T150 6T175 6T200 6"/></svg></div></div></div>
            <i class="liq__drop"></i><i class="liq__drop"></i><i class="liq__drop"></i><i class="liq__drop"></i><i class="liq__drop"></i>
            <i class="liq__ring"></i><i class="liq__ring"></i><i class="liq__ring"></i>
          </div>
          <img class="nd-bag__img" src="assets/bag-empty.webp" width="577" height="1200" alt="" loading="lazy">
          <!-- v3d: the hero bag's label design (wordmark, tagline, ∞ | volume),
               with the drip's name and its doses printed between. -->
          <div class="build__label" data-build-label>
            <div class="bl-head"><p class="bl-word">NutriDrip<sup>™</sup></p><p class="bl-sub">IV NUTRIENT THERAPY</p></div>
            <p class="build__lname bl-band" data-chosen-name>${esc(chosen.name)}</p>
            <ul class="build__lines" data-build-lines></ul>
            <div class="bl-end"><i class="bl-rule"></i><p class="bl-foot">${INFINITY}<i></i><b><span data-chosen-volume>${num(chosen.volumeMl ?? 500)}</span> mL</b></p></div>
          </div>
        </div>
      </div>
      <div class="build__sep" data-build-sep></div>
      <div class="build__end" data-build-end>
        <p class="build__endk"><span data-chosen-name>${esc(chosen.name)}</span> · <span data-chosen-price>${esc(inr(chosen.priceInr))}</span> per session</p>
        ${cta("Take the quiz to book this", "A physician approves it first", chosen.slug)}
        <a class="nd-link build__more" data-drip-page href="/drips/${esc(chosen.slug)}">Every dose, in full</a>
      </div>
    </div>
  </section>
  <div class="visually-hidden" data-build-sr aria-live="polite"></div>
</div>

<!-- 5 · WHAT EXACTLY IS IN IT? Every public drip, from the DB. -->
<section id="q-inside" class="formulary act-res" data-q="What exactly is in it?" data-sc-act="pan" data-sc-span="5" style="--span:5;--span-m:0">
  <div data-sc-stage class="formulary__stage">
    <div class="formulary__rail" data-sc-pan="0.04">
      <div class="formulary__lead">
        <h2 class="nd-q">What exactly is in it?</h2>
        <p class="nd-lede">All ${word(drips.length)} drips, with every dose. Prices are per session, everything included.</p>
        ${sepNotes.length ? `<p class="nd-small">Some components are given beside the bag, never in it: ${sepNotes.map(([n, note]) => `${esc(n)} (${esc(note.toLowerCase())})`).join(", ")}.</p>` : ""}
      </div>
      ${drips.map((d, k) => fcard(d, k)).join("\n      ")}
      <div class="formulary__end">
        <p class="nd-q nd-q--sm">Not sure which?</p>
        <p class="nd-body">Your answers point to one. The physician decides.</p>
        ${cta()}
      </div>
    </div>
  </div>
</section>

<!-- 6 · WHAT HAPPENS ON THE DAY? -->
<section id="q-day" class="day act-res" data-q="What happens on the day?" data-sc-act="pin" data-sc-span="2.6" style="--span:2.6;--span-m:2.4">
  <div data-sc-stage class="day__stage" data-sc-verify-state="0">
    <div class="nd-wrap">
      <h2 class="nd-q">What happens on the day?</h2>
      <p class="nd-lede day__lede">From the door to the report. Most of it you spend sitting back.</p>
      <div class="day__track">
        <div class="day__line" aria-hidden="true"><span></span></div>
        <ol class="day__steps">
          <li><span class="day__dot"></span><b>The nurse arrives</b><p>With a sealed kit, and checks your identity and the protocol on file.</p></li>
          <li><span class="day__dot"></span><b>Baseline vitals</b><p>A reading outside its range stops the session until the physician clears it.</p></li>
          <li><span class="day__dot"></span><b>Consent, then a cannula</b><p>One small cannula in a vein in your arm.</p></li>
          <li><span class="day__dot"></span><b>${esc(`${durMin} to ${durMax} minutes`)}</b><p>Depending on the drip. Observed every 10 minutes.</p></li>
          <li><span class="day__dot"></span><b>Ten minutes after</b><p>Closing vitals and a short observation before the nurse leaves.</p></li>
          <li><span class="day__dot"></span><b>Your report</b><p>Every dose and batch number in your account, the same day.</p></li>
        </ol>
      </div>
    </div>
  </div>
</section>

<!-- 7 · WHAT DOES IT COST? Live prices. -->
<section id="q-cost" class="sc-section cost" data-q="What does it cost?">
  <div class="nd-wrap">
    <div class="cost__offer" data-sc-in>
      <p class="cost__offer-k">Before you pay</p>
      <p class="cost__offer-t">No card needed to get a protocol reviewed.</p>
    </div>
    <div class="cost__grid">
      <div class="sc-stack" data-sc-in data-sc-stagger="60">
        <h2 class="nd-q">What does it cost?</h2>
        <p class="nd-lede">From ${esc(inr(Math.min(...prices)))} to ${esc(inr(Math.max(...prices)))} per session, depending on what goes into the bag. The kit, the nurse and the report are included.</p>
        <div class="cost__course">
          <p class="cost__course-n nd-num">${LATE.windowHours}</p>
          <p><b>Free to move or cancel up to ${esc(hours(LATE.windowHours))} before your slot.</b> ${esc(lateSentence().split(". ").slice(1).join(". "))}</p>
        </div>
        ${cta()}
      </div>
      <table class="nd-table cost__table" data-sc-in>
        <caption class="visually-hidden">Price per session for each drip</caption>
        <thead><tr><th scope="col">Drip</th><th scope="col">Time</th><th scope="col">Per session</th></tr></thead>
        <tbody>${drips.map((d) => `<tr><td><span class="dot" style="background:${tintOf(d)}"></span><a href="/drips/${esc(d.slug)}">${esc(d.name)}</a></td><td>${esc(duration(d))}</td><td>${esc(inr(d.priceInr))}</td></tr>`).join("")}</tbody>
      </table>
    </div>
  </div>
</section>

<!-- 8 · WHAT IF IT'S NOT RIGHT FOR ME? -->
<section id="q-notright" class="sc-section notright" data-q="What if it's not right for me?">
  <div class="nd-wrap notright__grid" data-sc-in data-sc-stagger="70">
    <h2 class="nd-q nd-q--sm">What if it's not right for me?</h2>
    <p class="notright__big">We turn people away, and that is the point.</p>
    <p class="nd-body">${esc(COPY["home.contra.body"])} A session that does not run is refunded in full.</p>
  </div>
</section>

<!-- 9 · FAQ -->
<section id="q-faq" class="sc-section faq" data-q="What else should I know?">
  <div class="nd-wrap nd-grid2">
    <div class="sc-stack faq__side">
      <h2 class="nd-q nd-q--sm">What else should I know?</h2>
      <p class="nd-body">The questions people ask us most. Anything else, ask our clinical team.</p>
      <p><a class="nd-btn nd-btn--ghost" href="/consult">Ask a clinician</a></p>
    </div>
    <div class="nd-faq">${FAQS.map(([q, a]) => `<details><summary>${esc(q)}</summary><div><p>${esc(a)}</p></div></details>`).join("")}</div>
  </div>
</section>

<!-- 10 · READY TO BOOK? The quiz, with the chosen drip on the slip. -->
<section class="sc-section nd-book" id="book" data-q="Ready to book?">
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
          <p class="nd-slip__drip" data-chosen-name>${esc(chosen.name)}</p>
          <p class="nd-slip__free"><span data-chosen-duration>${esc(duration(chosen))}</span> · at your home</p>
        </div>
        <p class="nd-slip__price">per session<b data-chosen-price>${esc(inr(chosen.priceInr))}</b></p>
      </div>
      <p class="nd-body nd-slip__body">The quiz asks what a physician needs to know before they will put their name to a protocol. Not sure about this drip? Answer anyway: the physician chooses with you.</p>
      ${cta("Take the quiz to book this", "No card needed to get a protocol reviewed", chosen.slug)}
    </div>
  </div>
</section>

</main>

<!-- Stand-in for the restyled shared SiteChrome footer. -->
<footer class="nd-foot">
  <div class="nd-wrap">
    <div class="nd-foot__grid">
      <div>
        <a class="nd-mark-link" href="/">${mark()}</a>
        <p class="nd-small" style="margin-top:1rem;max-width:36ch">IV nutrient therapy at home in Bengaluru, reviewed by a registered physician and given by a council-registered nurse.</p>
        <p class="nd-small" style="margin-top:.8rem">${esc(COPY["footer.legalName"])} · Clinical establishment reg. ${esc(COPY["footer.registration"])}</p>
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
    <div class="nd-foot__legal"><p><b>IV nutrient therapy is a medical procedure.</b> Every protocol is reviewed by a registered physician before anything is booked, and may not be suitable for everyone. ${esc(COPY["footer.emergency"])}</p></div>
  </div>
</footer>
<div class="nd-sticky" aria-label="Booking">
  <a class="nd-btn" href="${QUIZ(chosen.slug)}" data-quiz-link>Take the health quiz</a>
  <span class="nd-sticky__free">A physician reads every answer</span>
</div>
</div>
<script>window.ND_DRIPS = ${JSON.stringify(DRIP_DATA)}; window.ND_DEFAULT = ${JSON.stringify(chosen.slug)};</script>
<script src="scrollcraft.js"></script>
<script src="page.js"></script>
</body>
</html>
`;
}

fs.writeFileSync(path.join(ROOT, "index.html"), page(landing));
fs.mkdirSync(path.join(ROOT, "test"), { recursive: true });
for (const d of drips) fs.writeFileSync(path.join(ROOT, `test/${d.slug}.html`), page(d, { base: "../" }));
console.log(
  `index.html: ${landing.name} · test/: ${drips.length} drips · conditional checks: ${conditional.length} · separate notes: ${sepNotes.length}`
);

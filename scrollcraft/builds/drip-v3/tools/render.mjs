// Renders the drip page prototype (BRIEF.md): the client's drip page
// (_reference/NutriDrip IV Nutrient Therapy/drip-glow.html) filled from our
// Drip documents, with the user's choice of motion: as each ingredient is
// read, its labelled bottle drops into the sticky bag and the liquid rises.
//
//   node scrollcraft/builds/drip-v3/tools/render.mjs   (from nutridrip-new/)
//
// Writes index.html (Myers' Revive) and test/<slug>.html (every drip).
// Data: data/drips.json and data/site.json (tools/export.mjs).
import fs from "node:fs";
import path from "node:path";

const ROOT = "scrollcraft/builds/drip-v3";
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
const ZONES = site.servedZones.length;
const LATE = {
  windowHours: site.latePolicy?.windowHours ?? 4,
  rescheduleFee: site.latePolicy?.rescheduleFee ?? 500,
  cancelFee: site.latePolicy?.cancelFee ?? 500,
};

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
const altDose = (i) =>
  i.unit === "mcg" && i.dose >= 1000
    ? `(${num(i.dose / 1000)} mg)`
    : i.unit === "mg" && i.dose >= 1000
      ? `(${num(i.dose / 1000)} g)`
      : null;
const duration = (d) =>
  d.durationToMin && d.durationToMin > d.durationMin
    ? `${d.durationMin}–${d.durationToMin} min`
    : `${d.durationMin} min`;
const minutes = (d) =>
  d.durationToMin && d.durationToMin > d.durationMin
    ? `${d.durationMin} to ${d.durationToMin} minutes`
    : `${d.durationMin} minutes`;
const hours = (h) => `${h} hour${h === 1 ? "" : "s"}`;
const lateFees = () =>
  LATE.rescheduleFee === 0 && LATE.cancelFee === 0
    ? "Inside that, there is still no late fee"
    : LATE.rescheduleFee === LATE.cancelFee
      ? `Inside that, moving or cancelling carries a ${inr(LATE.cancelFee)} late fee`
      : `Inside that, a late fee applies (${inr(LATE.rescheduleFee)} to move, ${inr(LATE.cancelFee)} to cancel)`;
const INFINITY = `<svg viewBox="0 0 100 50" aria-hidden="true"><path d="M50 25C40 11 33 7 25 7 15 7 7 15 7 25s8 18 18 18c8 0 15-4 25-18s17-18 25-18c10 0 18 8 18 18s-8 18-18 18c-8 0-15-4-25-18Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/></svg>`;
const QUIZ = (slug) => `/quiz${slug ? `?drip=${encodeURIComponent(slug)}` : ""}`;
const cta = (label = "Take the health quiz", note = "A physician reads every answer", slug) =>
  `<div class="nd-cta"><a class="nd-btn" href="${QUIZ(slug)}">${esc(label)}</a><span class="nd-cta__free">${esc(note)}</span></div>`;

// The FAQ (src/lib/data/marketing.ts FAQS), with the live late-change rule and zone count.
const FAQS = [
  [
    "Does a real doctor look at my quiz?",
    "Yes. A registered physician reads every submission and either approves the protocol, changes the doses, or declines it. Their name and council registration number appear on your session report.",
  ],
  [
    "Do I have to take the quiz every time I book?",
    "No. One approval covers all your bookings for 90 days. It lapses after that because a physician's approval is a judgement about you on the day: weight, medication and kidney function all move.",
  ],
  [
    "What if the nurse finds something wrong?",
    "The 29-step checklist gates the session. If your vitals fall outside the reference range the infusion does not start. The nurse escalates to the reviewing physician, and a session that does not run is refunded in full.",
  ],
  [
    "Can I cancel or reschedule?",
    `Move or cancel freely up to ${hours(LATE.windowHours)} before your slot. ${lateFees()}, because the nurse is already dispatched with your batch drawn.`,
  ],
  [
    "Do you serve my pincode?",
    `We cover ${ZONES} zones across Bengaluru. Enter your pincode at booking and you get a straight yes or no, not a waitlist.`,
  ],
  [
    "What happens to my health data?",
    "Your record is visible to you, the reviewing physician and the attending nurse. Nobody else. Access attempts are logged, and you can export or delete your record from your profile at any time.",
  ],
];

// ------------------------------------------------- the labelled glass (home motion.ts)
const A = "/site/v3";
const AMPOULE = { src: `${A}/ampoule-blank.webp`, w: 196, h: 900, lt: "49.6%", lh: 370, vial: false };
const VIAL = { src: `${A}/vial-calcium-blank.webp`, w: 338, h: 900, lt: "35.8%", lh: 288, vial: true };
const VIAL_C = { src: `${A}/vial-vitc-blank.webp`, w: 349, h: 900, lt: "36.7%", lh: 279, vial: true };
const isVitaminC = (it) => /ascorbic|vitamin c\b/i.test(`${it.name} ${it.molecule ?? ""}`);
const glassOf = (it) => (it.form === "Ampoule" ? AMPOULE : isVitaminC(it) ? VIAL_C : VIAL);
const BANDS = ["#CDBFEF", "#BBD4EE", "#F0C4D6", "#B6E2DD", "#DCC8EF", "#C5CDF2"];
const CAPS = ["#8C6FD8", "#4F8FD6", "#D9578E", null, "#A779D6", "#6E7FE0"];
const LEMON = "#F5DC6A";
const OWN = [
  [/b[- ]?complex/i, 0],
  [/magnesium/i, 1],
  [/cobalamin|vitamin b12/i, 2],
  [/calcium/i, 3],
];
const hashBand = (name) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % BANDS.length;
};
const ownBand = (it) => OWN.find(([re]) => re.test(`${it.name} ${it.molecule ?? ""}`))?.[1] ?? null;
function bandColours(items) {
  const used = new Set();
  items.forEach((it) => {
    const o = ownBand(it);
    if (o != null) used.add(o);
  });
  return items.map((it) => {
    if (isVitaminC(it)) return { band: LEMON, cap: null };
    let c = ownBand(it);
    if (c == null) {
      c = hashBand(it.name);
      for (let j = 0; j < BANDS.length && used.has(c); j++) c = (c + 1) % BANDS.length;
      used.add(c);
    }
    return { band: BANDS[c], cap: CAPS[c] };
  });
}
function bandLines(it) {
  const words = it.name.toUpperCase().split(/\s+/);
  let lines = words;
  if (words.length > 1) {
    let cut = 1,
      best = 1e9;
    for (let i = 1; i < words.length; i++) {
      const d = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
      if (d < best) {
        best = d;
        cut = i;
      }
    }
    lines = [words.slice(0, cut).join(" "), words.slice(cut).join(" ")];
  }
  const vit = it.molecule ? /^vitamin\s+(.+)$/i.exec(it.molecule) : null;
  if (vit && !it.name.toLowerCase().includes(it.molecule.toLowerCase()))
    lines = lines.concat(`(${vit[1].toUpperCase()})`);
  return lines;
}
function glassHTML(it, colour) {
  const g = glassOf(it);
  return (
    `<div class="vial__glass" style="aspect-ratio:${g.w}/${g.h};--band:${colour.band}"><img src="${g.src}" alt="">` +
    (g.vial ? (colour.cap ? `<i class="vcap" style="--cap:${colour.cap}"></i>` : "") : `<i class="vring"></i>`) +
    `<div class="vlabel${g.vial ? " vlabel--vial" : ""}" style="--lt:${g.lt};--lh:${g.lh}px">` +
    `<p class="vlabel__word">NutriDrip<sup>™</sup></p><p class="vlabel__sub">IV NUTRIENT THERAPY</p>` +
    `<p class="vlabel__band">${bandLines(it)
      .map((l) => `<b>${esc(l)}</b>`)
      .join("")}</p>` +
    `<div class="vlabel__low"><p class="vlabel__dose">${esc(dose(it))}${altDose(it) ? `<small>${esc(altDose(it))}</small>` : ""}</p>` +
    `<i class="vlabel__rule"></i>${INFINITY.replace("<svg ", '<svg class="vlabel__inf" ')}<p class="vlabel__foot">For IV Use Only</p></div></div></div>`
  );
}

// ------------------------------------------------------------------ chrome
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

// ------------------------------------------------------------------ the page
function page(d, { base = "", photo = null, note = "" } = {}) {
  const tint = tintOf(d);
  const inBag = d.items.filter((i) => !i.separate);
  const sep = d.items.filter((i) => i.separate);
  const colours = bandColours(inBag);
  const sepColours = bandColours(sep);
  const vol = num(d.volumeMl ?? 500);
  // The rows, in reading order: the carrier, what goes in the bag, what is given beside it.
  const rows = [
    ...(d.carrier
      ? [
          {
            kind: "carrier",
            name: d.carrier.name,
            dose: dose(d.carrier),
            where: "The bag itself",
            note: "The carrier every other ingredient goes into.",
          },
        ]
      : []),
    ...inBag.map((i, k) => ({
      kind: "bag",
      k,
      name: i.name,
      dose: dose(i),
      where: `In the ${vol} mL bag`,
      note: i.molecule && !i.name.toLowerCase().includes(i.molecule.toLowerCase()) ? i.molecule : null,
    })),
    ...sep.map((i, k) => ({
      kind: "sep",
      k,
      name: i.name,
      dose: dose(i),
      where: `Given separately${i.notes ? `: ${i.notes.toLowerCase()}` : ""}`,
      note: "Never mixed into the bag.",
    })),
  ];
  // "Only where needed": the drip's own notes that name a check; the rest are notes.
  const checks = d.goodToKnow.filter((g) => /lab|screen|g6pd|test/i.test(g));
  const notes = d.goodToKnow.filter((g) => !/lab|screen|g6pd|test/i.test(g));
  const others = drips.filter((x) => x.slug !== d.slug && x.category === d.category);
  const also = others.length
    ? others
    : drips
        .filter((x) => x.slug !== d.slug)
        .sort((a, b) => Math.abs(a.priceInr - d.priceInr) - Math.abs(b.priceInr - d.priceInr))
        .slice(0, 3);

  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(d.name)} · NutriDrip</title>
<meta name="description" content="${esc(d.description ?? d.tagline ?? d.name)}">
<base href="${base}">
<link rel="icon" href="data:,">
<link rel="preload" href="/fonts/v3/outfit-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/v3/geist-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/scrollcraft.css">
<link rel="stylesheet" href="/site.css">
<link rel="stylesheet" href="/glass.css">
<link rel="stylesheet" href="/drip.css">
</head>
<body style="--tint:${tint}">
<div id="sc-root">
<span data-sc-progress></span>
${header()}
<main id="main">
${note ? `<p class="dp-proto">${note}</p>` : ""}
<div class="dp nd-wrap">
  <!-- The companion bag. As each ingredient below is read, its bottle drops
       in, the liquid rises and the label prints its line. -->
  <div class="dp__bagcol" aria-hidden="true">
    <div class="dp__bagstick">
      <div class="dp__rig">
        <div class="dp__drops">${inBag.map((i, k) => `<div class="dp__glass" data-glass="${k}">${glassHTML(i, colours[k])}</div>`).join("")}</div>
        <div class="nd-bag dp__bag" data-dp-bag>
          <div class="nd-bag__fill">
            <div class="liq"><div class="liq__level" data-liq-level><div class="liq__wave liq__wave--back"><svg viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true"><path class="liq__body" d="M0 6Q12.5 2 25 6T50 6T75 6T100 6T125 6T150 6T175 6T200 6V12H0Z"/><path class="liq__shine" d="M0 6Q12.5 2 25 6T50 6T75 6T100 6T125 6T150 6T175 6T200 6"/></svg></div><div class="liq__wave"><svg viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true"><path class="liq__body" d="M0 6Q12.5 2 25 6T50 6T75 6T100 6T125 6T150 6T175 6T200 6V12H0Z"/><path class="liq__shine" d="M0 6Q12.5 2 25 6T50 6T75 6T100 6T125 6T150 6T175 6T200 6"/></svg></div></div></div>
            <i class="liq__drop"></i><i class="liq__drop"></i><i class="liq__drop"></i><i class="liq__drop"></i>
            <i class="liq__ring"></i><i class="liq__ring"></i>
          </div>
          <img class="nd-bag__img" src="/site/v3/bag-empty.webp" width="577" height="1200" alt="">
          <!-- The client's compact label (wordmark, name, volume) in the upper
               middle, with a ruled row for each ingredient. Each row prints
               as its bottle lands (page.js printLine), in the home label's
               two columns, name and dose. -->
          <div class="dpl">
            <p class="bl-word">NutriDrip<sup>™</sup></p><p class="bl-sub">IV NUTRIENT THERAPY</p>
            <p class="bl-band">${esc(d.name)}</p>
            <ul class="build__lines">${[
              ...(d.carrier ? [`<li data-line="c"><span>${esc(d.carrier.name)}</span><b>${vol} mL</b></li>`] : []),
              ...inBag.map((i, k) => `<li data-line="${k}"><span>${esc(i.name)}</span><b>${esc(dose(i))}</b></li>`),
              ...(sep.length
                ? [
                    `<li class="build__lsep" data-line="s"><span>Given separately: ${sep.map((i) => esc(i.name)).join(", ")}</span></li>`,
                  ]
                : []),
            ].join("")}</ul>
            <p class="bl-foot">${INFINITY}<i></i><b>${vol} mL</b></p>
          </div>
        </div>
        ${sep.length ? `<div class="dp__beside">${sep.map((i, k) => `<div class="dp__side" data-side="${k}">${glassHTML(i, sepColours[k])}<p>Given beside the bag</p></div>`).join("")}</div>` : ""}
      </div>
      <p class="dp__count"><span data-dp-count>0</span> of ${rows.length} read</p>
    </div>
  </div>

  <div class="dp__main">
    <header class="dp__hero">
      <p class="nd-crumb"><a href="/drips">All drips</a>${d.category ? ` · ${esc(d.category)}` : ""}</p>
      <h1 class="nd-q">${esc(d.name)}</h1>
      ${d.description ? `<p class="nd-lede">${esc(d.description)}</p>` : ""}
      ${photo ? `<figure class="dp__photo"><img src="${esc(photo.src)}" alt="${esc(photo.alt)}" width="${photo.width}" height="${photo.height}" style="object-position:${esc(photo.position)}"></figure>` : ""}
      <p class="dp__meta">${esc(duration(d))} · one ${vol} mL bag${d.tagline ? ` · ${esc(d.tagline)}` : ""}</p>
      <div class="dp__buy">
        <p class="dp__price"><b>${esc(inr(d.priceInr))}</b> per session</p>
        ${cta("Take the quiz to book this", "A physician reads every answer", d.slug)}
      </div>
      ${d.bestFor.length ? `<p class="dp__for"><span>Best for</span> ${d.bestFor.map((b) => `<i>${esc(b)}</i>`).join("")}</p>` : ""}
    </header>

    <section class="dp__sec" aria-labelledby="in-h">
      <h2 id="in-h" class="nd-q nd-q--sm">What's inside</h2>
      <p class="nd-body">Every ingredient, at the dose the protocol starts from. The physician who reads your quiz can change any of them for you.</p>
      <ol class="ings" data-ings>${rows.map((r) => `<li class="ing ing--${r.kind}" data-ing data-kind="${r.kind}"${r.k != null ? ` data-k="${r.k}"` : ""}><span class="ing__dot" aria-hidden="true"></span><div><h3>${esc(r.name)} <span class="ing__dose">${esc(r.dose)}</span></h3><p class="ing__where">${esc(r.where)}</p>${r.note ? `<p>${esc(r.note)}</p>` : ""}</div></li>`).join("")}</ol>
    </section>

    ${
      d.benefits.length
        ? `<section class="dp__sec" aria-labelledby="w-h">
      <h2 id="w-h" class="nd-q nd-q--sm">What it's for</h2>
      <ul class="dp__session">${d.benefits.map((b) => `<li><b>${esc(b.title)}</b>${b.description ? `<span>${esc(b.description)}</span>` : ""}</li>`).join("")}</ul>
    </section>`
        : ""
    }

    <section class="dp__sec" aria-labelledby="t-h">
      <h2 id="t-h" class="nd-q nd-q--sm">Before your drip</h2>
      <div class="dp__tests">
        <div><p class="nd-tag">For everyone</p><ul class="dp__tlist">
          <li><b>A health quiz</b><span>About three minutes, read by a registered physician before anything is booked.</span></li>
          <li><b>Baseline vitals</b><span>Blood pressure, heart rate, SpO₂ and temperature at every session. A reading outside its range stops the infusion until the physician clears it.</span></li>
          <li><b>A sealed kit</b><span>Your nurse checks the seal and every vial's expiry in front of you.</span></li>
        </ul></div>
        <div><p class="nd-tag">For this drip</p><ul class="dp__tlist">${checks.length ? checks.map((c) => `<li><b>${esc(c)}</b></li>`).join("") : `<li><b>Nothing extra</b><span>The quiz and the checks for everyone are enough for ${esc(d.name)}.</span></li>`}</ul></div>
      </div>
      <p class="nd-small" style="margin-top:1rem"><a class="nd-link" href="/safety">Where the safety actually sits</a></p>
    </section>

    <section class="dp__sec" aria-labelledby="s-h">
      <h2 id="s-h" class="nd-q nd-q--sm">The session</h2>
      <ul class="dp__session">
        <li><b>A small cannula</b><span>One small cannula in a vein in your arm.</span></li>
        <li><b>${esc(minutes(d))}</b><span>At home, observed every 10 minutes.</span></li>
        ${sep.length ? `<li><b>${esc(sep.map((s) => s.name).join(" and "))} separately</b><span>${esc(d.infusionNotes ?? "Never mixed into the bag.")}</span></li>` : `<li><b>Everything in one bag</b><span>${vol} mL, all of it in one bag.</span></li>`}
        <li><b>Your report</b><span>Every dose and batch number in your account, the same day.</span></li>
      </ul>
    </section>

    <section class="dp__sec dp__cost" aria-labelledby="c-h">
      <h2 id="c-h" class="nd-q nd-q--sm">Price</h2>
      <div class="dp__costgrid">
        <p><b class="nd-num">${esc(inr(d.priceInr))}</b><span>per session: the kit, the nurse and the report included</span></p>
        <p><b class="nd-num">${LATE.windowHours} h</b><span>free to move or cancel before your slot. ${esc(lateFees())}.</span></p>
      </div>
      ${notes.length ? `<ul class="dp__notes">${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
      <p class="dp__offer">No card needed to get a protocol reviewed.</p>
      ${cta("Take the quiz to book this", "The physician decides how many sessions suit you", d.slug)}
    </section>

    <section class="dp__sec" aria-labelledby="f-h">
      <h2 id="f-h" class="nd-q nd-q--sm">Questions people ask</h2>
      <div class="nd-faq">${FAQS.map(([q, a]) => `<details><summary>${esc(q)}</summary><div><p>${esc(a)}</p></div></details>`).join("")}</div>
      <p class="nd-small" style="margin-top:1.2rem">${others.length ? `Also in ${esc(d.category.toLowerCase())}:` : "Other drips:"} ${also.map((x) => `<a class="nd-link" href="/drips/${esc(x.slug)}">${esc(x.name)}</a>`).join(" · ")}</p>
    </section>
  </div>
</div>

<section class="sc-section nd-book" id="book">
  <div class="nd-wrap nd-grid2">
    <div class="nd-book__intro">
      <h2 class="nd-q">Ready to book?</h2>
      <p class="nd-lede">Three minutes of questions, read by a registered physician. If ${esc(d.name)} is not right for you, they will say so, and tell you what is.</p>
      <ul class="nd-book__facts">
        <li><b>A physician reviews you first</b>, before anything is booked.</li>
        <li><b>A nurse comes to your home</b> in ${ZONES} zones across Bengaluru.</li>
        <li><b>Free to move or cancel</b> up to ${esc(hours(LATE.windowHours))} before your slot.</li>
      </ul>
    </div>
    <div class="nd-slip">
      <div class="nd-slip__head">
        <div><p class="nd-tag">Your drip</p><p class="nd-slip__drip">${esc(d.name)}</p><p class="nd-slip__free">${esc(duration(d))} · at your home</p></div>
        <p class="nd-slip__price">per session<b>${esc(inr(d.priceInr))}</b></p>
      </div>
      <p class="nd-body nd-slip__body">The quiz asks what a physician needs to know before they will put their name to a protocol. Answer it, and the physician confirms ${esc(d.name)} or suggests what fits you better.</p>
      ${cta("Take the quiz to book this", "No card needed to get a protocol reviewed", d.slug)}
    </div>
  </div>
</section>
</main>
${footer()}
<div class="nd-sticky" aria-label="Booking"><a class="nd-btn" href="${QUIZ(d.slug)}">Take the health quiz</a><span class="nd-sticky__free">A physician reads every answer</span></div>
</div>
<script src="/scrollcraft.js"></script>
<script src="/page.js"></script>
</body>
</html>
`;
}

const landing = drips.find((d) => d.slug === "myers-revive") ?? drips[0];
fs.writeFileSync(path.join(ROOT, "index.html"), page(landing));
fs.mkdirSync(path.join(ROOT, "test"), { recursive: true });
for (const d of drips) fs.writeFileSync(path.join(ROOT, `test/${d.slug}.html`), page(d));
// An admin's upload shows in the hero, under the description; the bag stays
// (the user's choice, 2026-11-03). A shipped stand-in plays the upload here.
fs.writeFileSync(
  path.join(ROOT, "test/myers-revive-photo.html"),
  page(landing, {
    note: "Prototype test: Myers' Revive with a stand-in photo, as if an admin had uploaded one.",
    photo: {
      src: "/images/site/drip-bag.jpg",
      alt: "An IV bag and its drip chamber hanging from a stand in soft light",
      width: 1400,
      height: 2100,
      position: "50% 28%",
    },
  })
);
console.log(`index.html: ${landing.name} · test/: ${drips.length} drips`);

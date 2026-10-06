// Bakes the data the page needs into index.html's JSON island, the way the
// port's server component will render it: the drip, the cutout anchors, the
// served-zone count and the last bookable slot. Run after export-drips.mjs or
// prepare.mjs:   node tools/bake.mjs [slug]
import fs from "node:fs";

const slug = process.argv[2] ?? "myers-revive";
const drips = JSON.parse(fs.readFileSync("data/drips.json", "utf8"));
const site = JSON.parse(fs.readFileSync("data/site.json", "utf8"));
const assets = JSON.parse(fs.readFileSync("data/assets.json", "utf8"));
const drip = drips.find((d) => d.slug === slug);
if (!drip) throw new Error(`no drip ${slug}`);

const data = {
  drip,
  drips: drips.map(({ slug, name, tagline, category, priceInr, durationMin, durationToMin, isPopular, items }) => ({
    slug,
    name,
    tagline,
    category,
    priceInr,
    durationMin,
    durationToMin,
    isPopular,
    count: items.length,
  })),
  zones: site.servedZones.length,
  lastSlot: site.lastSlot,
  assets,
};
const file = process.argv[3] ?? "index.html";
let html = fs.readFileSync(file, "utf8");
html = html.replace(
  /<script type="application\/json" id="page-data">[\s\S]*?<\/script>/,
  `<script type="application/json" id="page-data">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`
);
fs.writeFileSync(file, html);
console.log(`baked ${drip.name} (${drip.items.length} items) into ${file}`);

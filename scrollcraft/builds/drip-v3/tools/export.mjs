// The drip page prototype's data: the home page's export (run
// home-v3/tools/export-drips.mjs first) plus what only this page shows, read
// from the dev database. Read-only.
//   node scrollcraft/builds/drip-v3/tools/export.mjs   (from nutridrip-new/)
import mongoose from "mongoose";
import fs from "node:fs";

const HOME = "scrollcraft/builds/home-v3/data";
const OUT = "scrollcraft/builds/drip-v3/data";
const env = fs.readFileSync(".env", "utf8");
const uri = env.match(/^MONGODB_URI=(.*)$/m)?.[1]?.trim();
if (!uri) throw new Error("MONGODB_URI missing from .env");
await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
const db = mongoose.connection.db;

const drips = JSON.parse(fs.readFileSync(`${HOME}/drips.json`, "utf8"));
const docs = await db
  .collection("drips")
  .find(
    { slug: { $in: drips.map((d) => d.slug) } },
    { projection: { slug: 1, benefits: 1, bestFor: 1, infusionNotes: 1, requiresApproval: 1, tint: 1 } }
  )
  .toArray();
const bySlug = new Map(docs.map((d) => [d.slug, d]));
const out = drips.map((d) => {
  const x = bySlug.get(d.slug) ?? {};
  return {
    ...d,
    benefits: (x.benefits ?? []).map((b) => ({ title: b.title, description: b.description ?? null })),
    bestFor: x.bestFor ?? [],
    infusionNotes: x.infusionNotes ?? null,
    requiresApproval: x.requiresApproval ?? true,
    tint: x.tint ?? null,
  };
});
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/drips.json`, JSON.stringify(out, null, 2));
fs.copyFileSync(`${HOME}/site.json`, `${OUT}/site.json`);
console.log(
  `${out.length} drips; benefits on ${out.filter((d) => d.benefits.length).length}, bestFor on ${out.filter((d) => d.bestFor.length).length}, notes on ${out.filter((d) => d.infusionNotes).length}`
);
await mongoose.disconnect();

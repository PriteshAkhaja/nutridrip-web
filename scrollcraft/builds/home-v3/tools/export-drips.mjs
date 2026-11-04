// Exports the live public catalogue from the dev database into data/drips.json,
// so the prototype renders the same Drip documents the real route reads.
// Read-only. Run from nutridrip-new/: node scrollcraft/builds/home-v3/tools/export-drips.mjs
// v3 adds each drip's description and goodToKnow, and the late-change policy.
//
// Copied from v1 (scrollcraft/builds/home/tools/export-drips.mjs) and extended:
// - `form`: each ingredient's container, from its master's stock lots: the most
//   common unitForm among unexpired, unquarantined, active lots, Vial when
//   there are none. Only the form is read: never a batch, lot or expiry.
// - `separate`: given beside the bag rather than in it (a pre-med, or notes
//   that say it is a push).
// - `carrier`: the FLUID ingredient. The bag is the carrier, so it is never a vial.
// - site.json gains the served zones' last bookable slot, for the evening stamp.
import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";

const OUT = "scrollcraft/builds/home-v3/data";
const env = fs.readFileSync(".env", "utf8");
const uri = env.match(/^MONGODB_URI=(.*)$/m)?.[1]?.trim();
if (!uri) throw new Error("MONGODB_URI missing from .env");
await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
const db = mongoose.connection.db;
const now = new Date();

// The form most usable lots come in, and what one of those holds (the lot
// that expires first, as dispatch takes it): the print on a real ampoule.
async function formOf(masterId) {
  const lots = await db
    .collection("batchlots")
    .find(
      { masterId, expiry: { $gt: now }, isQuarantined: { $ne: true }, isActive: { $ne: false } },
      { projection: { unitForm: 1, contentValue: 1, contentUnit: 1, packVolumeMl: 1, expiry: 1 } }
    )
    .sort({ expiry: 1 })
    .toArray();
  const tally = {};
  for (const l of lots) tally[l.unitForm ?? "Vial"] = (tally[l.unitForm ?? "Vial"] ?? 0) + 1;
  const form = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Vial";
  const lot = lots.find((l) => (l.unitForm ?? "Vial") === form);
  return {
    form,
    pack: lot ? { value: lot.contentValue ?? null, unit: lot.contentUnit ?? null, ml: lot.packVolumeMl ?? null } : null,
  };
}

const drips = await db.collection("drips").find({ isActive: true, isPublic: true }).sort({ priceInr: 1 }).toArray();
const out = [];
for (const d of drips) {
  const ingredients = [];
  for (const i of d.ingredients ?? []) {
    ingredients.push({
      name: i.name ?? "",
      dose: i.dose,
      unit: i.unit,
      role: i.role,
      notes: i.notes ?? null,
      ...(i.role === "FLUID" ? { form: "Bag", pack: null } : await formOf(i.masterId)),
      // The master's molecule ("Vitamin B6" for pyridoxine): the second line of
      // a printed ampoule label, as the client's products carry one.
      molecule:
        (await db.collection("productmasters").findOne({ _id: i.masterId }, { projection: { molecule: 1 } }))
          ?.molecule ?? null,
      separate: i.role === "PREMED" || /push/i.test(i.notes ?? ""),
    });
  }
  const carrier = ingredients.find((i) => i.role === "FLUID") ?? null;
  out.push({
    slug: d.slug,
    name: d.name,
    tagline: d.tagline ?? null,
    description: d.description ?? null,
    goodToKnow: d.goodToKnow ?? [],
    category: d.category ?? null,
    volumeMl: d.volumeMl ?? carrier?.dose ?? null,
    priceInr: d.priceInr,
    durationMin: d.durationMin,
    durationToMin: d.durationToMin ?? null,
    isPopular: Boolean(d.isPopular),
    carrier: carrier ? { name: carrier.name, dose: carrier.dose, unit: carrier.unit } : null,
    items: ingredients.filter((i) => i.role !== "FLUID"),
  });
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "drips.json"), JSON.stringify(out, null, 2));
console.log(`wrote ${out.length} drips`);
for (const d of out)
  console.log(
    `${d.slug.padEnd(20)} ${String(d.items.length).padStart(2)} items  ${d.volumeMl} ml  ${d.carrier?.name}  ${d.items.map((i) => `${i.form[0]}${i.separate ? "*" : ""}`).join("")}`
  );

// Editable copy overrides, the served zones, and their last bookable slot
// (opensAt, closesAt and slotMinutes are on each Zone; DEFAULT_HOURS in
// lib/clinical/slots.ts fills any that are missing).
const content = await db.collection("contentblocks").find({}).toArray();
const zones = await db.collection("zones").find({}).toArray();
const served = zones.filter((z) => z.status !== "paused");
const DEFAULT = { opensAt: "08:00", closesAt: "20:00", slotMinutes: 60 };
const mins = (t) => {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + (m || 0);
};
let last = 0;
for (const z of served) {
  const hrs = {
    opensAt: z.opensAt ?? DEFAULT.opensAt,
    closesAt: z.closesAt ?? DEFAULT.closesAt,
    slotMinutes: z.slotMinutes ?? DEFAULT.slotMinutes,
  };
  const open = mins(hrs.opensAt),
    close = mins(hrs.closesAt),
    step = hrs.slotMinutes > 0 ? hrs.slotMinutes : 60;
  for (let t = open; t + step <= close; t += step) last = Math.max(last, t);
}
const lastSlot = `${String(Math.floor(last / 60)).padStart(2, "0")}:${String(last % 60).padStart(2, "0")}`;
fs.writeFileSync(
  path.join(OUT, "site.json"),
  JSON.stringify(
    {
      contentOverrides: Object.fromEntries(content.filter((c) => c.value?.trim()).map((c) => [c.key, c.value])),
      servedZones: served.map((z) => z.name),
      lastSlot,
      // getLatePolicy() in lib/billing/settings.ts, before tidyPolicy's clamps.
      latePolicy: await (async () => {
        const b = await db.collection("billingsettings").findOne({ singleton: "billing" });
        return {
          windowHours: b?.lateWindowHours ?? null,
          rescheduleFee: b?.lateRescheduleFee ?? null,
          cancelFee: b?.lateCancelFee ?? null,
        };
      })(),
    },
    null,
    2
  )
);
console.log(`content overrides: ${content.length}, zones served: ${served.length}, last slot ${lastSlot}`);
await mongoose.disconnect();

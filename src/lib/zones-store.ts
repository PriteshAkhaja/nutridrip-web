import { cache } from "react";
import { connectDB } from "@/lib/db/mongoose";
import { Zone as ZoneModel } from "@/lib/models";
import { ZONE_DEFAULTS, windowFor, type Zone, type ZoneStatus } from "@/lib/zones";

type ZoneRow = {
  _id: unknown;
  name: string;
  pincodes: string[];
  opensAt: string;
  closesAt: string;
  slotMinutes?: number;
  status: ZoneStatus;
};

function toZone(r: ZoneRow): Zone {
  return {
    id: String(r._id),
    name: r.name,
    pincodes: [...(r.pincodes ?? [])],
    opensAt: r.opensAt,
    closesAt: r.closesAt,
    window: windowFor(r.opensAt, r.closesAt),
    // Zones saved before the step existed book on the hour.
    slotMinutes: r.slotMinutes ?? 60,
    status: r.status ?? "open",
  };
}

/**
 * Writes the launch zones the first time the collection is found empty, so an
 * existing database picks up the editor without a reseed. The super admin can
 * never empty it again (the last zone cannot be deleted, only paused), so this
 * cannot bring back zones somebody removed.
 */
export function seedZones(): Promise<void> {
  // One seeding per process: a page asks for the zones from its layout, its
  // metadata and its body at once, and each would otherwise find the
  // collection empty and write all fourteen.
  seeding ??= seedOnce().catch((err: unknown) => {
    seeding = null;
    throw err;
  });
  return seeding;
}

let seeding: Promise<void> | null = null;

async function seedOnce(): Promise<void> {
  await connectDB();
  // The unique indexes (name, pincodes) must exist before the first insert, so
  // that two servers seeding at once collide instead of both succeeding.
  await ZoneModel.init();
  if ((await ZoneModel.estimatedDocumentCount()) > 0) return;
  await ZoneModel.insertMany(
    ZONE_DEFAULTS.map(({ name, pincodes, opensAt, closesAt, slotMinutes, status }, position) => ({
      name,
      pincodes,
      opensAt,
      closesAt,
      slotMinutes,
      status,
      position,
    }))
  ).catch((err: unknown) => {
    // Another server seeded it first; its fourteen are the ones kept.
    if ((err as { code?: number })?.code !== 11000) throw err;
  });
}

/**
 * Every zone, paused ones included, in display order. Callers that decide
 * whether a pincode is served go through `zoneForPincode`, which skips paused
 * zones; the public pages use `servedZones`.
 *
 * Cached for one render, so a page that asks in three places reads once.
 */
export const getZones = cache(async (): Promise<Zone[]> => {
  try {
    await seedZones();
    const rows = await ZoneModel.find({}).sort({ position: 1, name: 1 }).lean<ZoneRow[]>();
    return rows.map(toZone);
  } catch (err) {
    // A database hiccup must not tell every patient "we do not serve you".
    console.error("getZones() fell back to the launch zones:", err);
    return ZONE_DEFAULTS;
  }
});

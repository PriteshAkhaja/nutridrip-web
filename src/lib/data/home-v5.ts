import { connectDB } from "@/lib/db/mongoose";
import { Drip } from "@/lib/models";
import { DRIP_CATEGORIES } from "@/lib/models/types";
import { listAssemblyDrips, type CatalogueDrip } from "@/lib/data/assembly";
import { getZones } from "@/lib/zones-store";
import { fillZoneCount, servedZones } from "@/lib/zones";
import { getLatePolicy } from "@/lib/billing/settings";
import { fillLatePolicy } from "@/lib/billing/late-policy";
import { getClockFormat } from "@/lib/settings/clock";
import { clockRange } from "@/lib/time";
import { FAQS } from "@/lib/data/marketing";

/**
 * The home page's data, in the shape its script reads (the preview in scrollcraft/builds/home-v5 runs on its own
 * copy of the same shape; the app passes this one in its place). Every drip, price, dose, count, zone and fee on the
 * page comes from here, so an admin adding or retiring a drip, opening a zone or changing the late-change fee
 * changes the page without an edit.
 */
export type HomeDrip = {
  /** The slug. */
  id: string;
  name: string;
  /** Its category, which is the goal it is listed under. */
  goal: string;
  price: number;
  /** "45–60 min". */
  time: string;
  /** Its colour on the site (lib/tints). */
  tint: string;
  /** The tagline. */
  tag: string;
  /** The carrier, as the bag's label prints it: "Normal saline 0.9% 500 mL". */
  base: string;
  pop: 0 | 1;
  desc: string;
  best: string;
  know: string[];
  /** [name, dose, "vial" | "ampoule", given beside the bag (1) or not (0), note] */
  items: [string, string, "vial" | "ampoule", 0 | 1, string][];
};
export type HomeData = {
  drips: HomeDrip[];
  /** [goal, its one line, the morning picture it uses] for each goal a public drip is listed under. */
  goals: [string, string, string][];
  /** [name, pincodes, "open" | "limited", hours] for each served zone. */
  zones: [string, string[], "open" | "limited", string][];
  faq: [string, string][];
  late: { windowHours: number; fee: number };
  /** The drip the page opens on. */
  first: string;
};

/** Each goal's line on the page, and its morning picture (public/site/home/morning-*.webp). */
const GOAL_COPY: Record<string, [string, string]> = {
  Energy: ["Fatigue that sleep has not fixed", "energy"],
  Immunity: ["Before travel, after illness", "immunity"],
  Skin: ["Glutathione protocols", "skin"],
  Hydration: ["The fastest session we run", "hydration"],
  "Athletic recovery": ["After the effort, not before", "athletic"],
  "Post-viral": ["The flat weeks afterwards", "postviral"],
};
/** The drip the page builds first: the default first drip, else a popular one, else the first. */
const HOME_DRIP = "myers-revive";

const num = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

function toHome(d: CatalogueDrip, extra: { description?: string | null; bestFor?: string[] } | undefined): HomeDrip {
  const carrier = d.carrier;
  return {
    id: d.slug,
    name: d.name,
    goal: d.category ?? "",
    price: d.priceInr,
    time:
      d.durationToMin && d.durationToMin !== d.durationMin
        ? `${d.durationMin}–${d.durationToMin} min`
        : `${d.durationMin} min`,
    tint: d.tint,
    tag: d.tagline ?? "",
    base: carrier ? `${carrier.name} ${num(carrier.dose)} ${carrier.unit}` : `${num(d.volumeMl)} mL`,
    pop: d.isPopular ? 1 : 0,
    desc: extra?.description ?? d.tagline ?? "",
    best: (extra?.bestFor ?? []).join(", "),
    know: d.goodToKnow ?? [],
    items: (d.items ?? []).map((i) => [
      i.name,
      `${num(i.dose)} ${i.unit}`,
      /amp/i.test(i.form) ? "ampoule" : "vial",
      i.separate ? 1 : 0,
      i.notes ?? (i.separate ? "Given beside the bag" : ""),
    ]),
  };
}

export async function getHomeData(): Promise<HomeData> {
  const [drips, zones, late, fmt] = await Promise.all([
    listAssemblyDrips(),
    getZones(),
    getLatePolicy(),
    getClockFormat(),
  ]);
  await connectDB();
  const more = await Drip.find({ slug: { $in: drips.map((d) => d.slug) } })
    .select("slug description bestFor")
    .lean<Array<{ slug: string; description?: string | null; bestFor?: string[] }>>();
  const extra = new Map(more.map((m) => [m.slug, m]));
  const home = drips.map((d) => toHome(d, extra.get(d.slug)));
  const present = new Set(home.map((d) => d.goal));
  const served = servedZones(zones);
  const first = home.find((d) => d.id === HOME_DRIP) ?? home.find((d) => d.pop) ?? home[0];
  return {
    drips: home,
    goals: DRIP_CATEGORIES.filter((c) => present.has(c)).map((c) => [
      c,
      GOAL_COPY[c]?.[0] ?? "",
      GOAL_COPY[c]?.[1] ?? "energy",
    ]),
    zones: served.map((z) => [
      z.name,
      z.pincodes,
      z.status === "limited" ? "limited" : "open",
      clockRange(z.opensAt, z.closesAt, fmt),
    ]),
    faq: FAQS.map((f) => [f.q, fillZoneCount(fillLatePolicy(f.a, late), zones)]),
    late: { windowHours: late.windowHours, fee: late.cancelFee },
    first: first?.id ?? "",
  };
}

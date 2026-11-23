import { BAG_CM, ROOM } from "@/components/site/scroll/assembly-assets";

/**
 * The pure arithmetic of the drip page's build (./motion.ts and ./stand.ts
 * run it): how far each ingredient has been read, how its bottle travels and
 * pours, the liquid's level, and the bag coming down onto the stand. No DOM,
 * so it is unit-tested (tests/drip-build-math.test.ts).
 *
 *   step 1  the page scrolls as it always did; as each ingredient row rises
 *           past the reading line, its bottle leaves the shelf beside the bag,
 *           docks under its medication port and goes in (what is given
 *           separately stays)
 *   step 2  after the list, the finished bag comes down onto the stand in the
 *           evening room
 *   step 3  the morning after, and what the drip is for
 */

export type RowKind = "carrier" | "bag" | "sep";

/** A row counts as read (lit) once its top passes this share of the screen: the original page's reading line. */
export const READ_LINE = 0.62;

/**
 * The bottles go in one at a time. Each item has a progress t (0 on the shelf,
 * 1 poured) and a target (1 once its row is read, 0 if read back up past it).
 * In one step of `dt` ms only one item moves: the first in reading order that
 * still has to go in, or, when the reader has gone back up, the last one that
 * has to come out (going back first). An item takes `ms[i]` to go in, and
 * `backMs` to come out; the more are waiting behind it, the faster it goes
 * (`queueSpeed`), so a fast scroll is never left far behind. Returns the new
 * progress and which item moved (-1: none).
 */
export function stepQueue(
  ts: number[],
  targets: number[],
  dt: number,
  ms: number[],
  backMs = 450
): { ts: number[]; active: number } {
  const next = ts.slice();
  const back = ts.map((t, i) => (t > targets[i] ? i : -1)).filter((i) => i >= 0);
  if (back.length) {
    const i = back[back.length - 1];
    next[i] = Math.max(targets[i], ts[i] - (dt / backMs) * queueSpeed(back.length));
    return { ts: next, active: i };
  }
  const fwd = ts.map((t, i) => (t < targets[i] ? i : -1)).filter((i) => i >= 0);
  if (!fwd.length) return { ts: next, active: -1 };
  const i = fwd[0];
  next[i] = Math.min(targets[i], ts[i] + (dt / ms[i]) * queueSpeed(fwd.length));
  return { ts: next, active: i };
}

/** How much faster the moving item goes with `n` items waiting in all: its own pace alone, up to 3.2 times with a long backlog. */
export const queueSpeed = (n: number) => Math.min(3.2, 1 + 0.6 * Math.max(0, n - 1));

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Eases in and out. */
export const smooth = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
export const easeOut = (t: number) => 1 - (1 - clamp(t)) ** 3;
/** t within [a, b], 0 to 1. */
export const within = (t: number, a: number, b: number) => clamp((t - a) / (b - a));

// ---------------------------------------------------------------- bottles

export type Pose = {
  x: number;
  y: number;
  scale: number;
  rotate: number;
  opacity: number;
  /** How much of its share has gone into the bag, 0 to 1. */
  poured: number;
  /** Its glow on the shelf as its turn comes, 0 to 1. */
  glow?: number;
};

/** How far a bottle rises on the shelf as its turn comes, px. */
export const CUE_LIFT = 9;

/**
 * A bottle's cue, 0 to 1, from where its row is: it starts as the row comes
 * within an eighth of a screen of the reading line (less than the rows'
 * spacing, so it is the next bottle that lights, not the next two), and is
 * whole once the row is read. `top` is the row's top on screen, `h` the
 * screen's height.
 */
export function shelfCue(top: number, h: number) {
  const line = h * READ_LINE;
  return smooth(within(line + 0.12 * h - top, 0, 0.12 * h));
}

export type Geometry = {
  /** Rest to the port, px: from the bottle's neck (top centre, its transform origin) to the port's open end. */
  dx: number;
  dy: number;
  /** How far the path dips below the straight line, px, so the bottle comes up into the port. */
  arc: number;
};

/**
 * The left medication port on the client's bag image (577 x 1200): the centre
 * of its open end, as shares of the box. (Measured: the port is 172-210 px
 * across, its end at 1066 px. The long centre port is the giving set's.)
 */
export const PORT = { x: 0.331, y: 0.888 };

/** A bottle docks at the port at this size, upright, before it goes in. */
export const DOCK_SCALE = 0.8;

/**
 * Where a bottle at rest must move so that its neck (`neck`: the top centre of
 * its box, where it scales from) is at the port, px.
 */
export function portAim(port: { x: number; y: number }, neck: { x: number; y: number }) {
  return { dx: port.x - neck.x, dy: port.y - neck.y };
}

/**
 * A bottle's pose at t, 0 to 1 through its row: it lifts off the shelf,
 * travels (leaning into the way it goes) and docks upright under the bag's
 * medication port, then goes in, shrinking into the port's end. At 0, with no
 * cue, it is exactly at rest, so a row not yet reached leaves it where it
 * stands. `cue` (shelfCue) lifts it a little and lights it as its turn comes;
 * it carries that lift onto its way and lets it go as it travels, so the
 * hand-over from the cue to the move never jumps.
 */
export function bottlePose(t: number, g: Geometry, cue = 0): Pose {
  // Over a turn of 1.5 s (motion): about half a second on the way, a beat
  // docked, and half a second going in.
  const lift = smooth(within(t, 0, 0.1));
  const go = smooth(within(t, 0.1, 0.45));
  const into = smooth(within(t, 0.52, 0.86));
  const held = clamp(cue) * (1 - go);
  return {
    x: g.dx * go,
    y: -8 * lift + (g.dy + 8) * go + Math.sin(Math.PI * go) * g.arc - CUE_LIFT * held + 0, // + 0: never -0
    scale: (1 + 0.06 * lift - (0.06 + 1 - DOCK_SCALE) * go) * (1 - into) * (1 + 0.05 * held),
    rotate: 14 * Math.sin(Math.PI * go) + 0,
    opacity: 1 - within(t, 0.8, 0.88),
    poured: into,
    glow: held,
  };
}

/**
 * The ring at the port's end while a bottle goes in (the motion plan's
 * collapse): it shows as the bottle docks and closes in as it enters, then
 * fades. A pure function of the bottle's t, so reading back opens it again.
 */
export function portRing(t: number): { scale: number; opacity: number } {
  const show = smooth(within(t, 0.4, 0.52)) * (1 - smooth(within(t, 0.84, 0.97)));
  return { scale: 1.9 - 0.9 * smooth(within(t, 0.45, 0.86)), opacity: show };
}

/** How long one bloom lasts, ms. */
export const BLOOM_MS = 2200;

/**
 * One of a bloom's three clouds, k (0 to 1) through its life: from the port's
 * end it rises into the liquid, swirling (each cloud its own way) and
 * spreading, comes in quickly and thins out slowly into the liquid. `rise` is
 * how far up it goes and `spread` how far it swings either side, px; x and y
 * are from the port's end, up negative.
 */
export function bloomPose(k: number, j: number, rise: number, spread: number) {
  const kk = within(k, 0.1 * j, 0.1 * j + 0.8);
  const up = easeOut(kk);
  return {
    x: Math.sin(kk * Math.PI * (1.1 + 0.35 * j) + j * 2.1) * spread * up + 0,
    y: -rise * up * (0.75 + 0.12 * j) + 0,
    scale: 0.2 + 1.3 * up,
    opacity: kk <= 0 || kk >= 1 ? 0 : 0.8 * smooth(within(kk, 0, 0.14)) * (1 - smooth(within(kk, 0.32, 1))),
  };
}

/**
 * A bottle that is given separately, never in the bag: on its turn it does not
 * travel, it settles a little and fades from the shelf (the label prints it
 * apart), so the shelf ends empty rather than with one bottle left unexplained.
 */
export function sepPose(t: number): Pose {
  const s = smooth(t);
  return { x: 0, y: 12 * s, scale: 1 - 0.08 * s, rotate: 0, opacity: 1 - s, poured: 0 };
}

/**
 * The liquid level, 0 to 1, given the carrier's progress and each in-bag
 * ingredient's pour. The carrier raises the first share, the others split the
 * rest evenly, so the bag is full only when the last ingredient is in. A drip
 * with nothing but its carrier fills with the carrier.
 */
export function bagLevel(carrier: number, pours: number[]): number {
  const base = pours.length ? 0.12 : 1;
  return clamp(base * carrier + (pours.length ? ((1 - base) * pours.reduce((n, v) => n + v, 0)) / pours.length : 0));
}

// ---------------------------------------------------------------- the room

/** The ring on the client's bag image (577 x 1200): where it hangs from, as shares of its box. */
/** (Measured: the hole is centred at 0.499 x 0.0465; its inner top edge, which rests on the hook, at 0.034.) */
export const RING = { x: 0.499, y: 0.034 };

export type RoomPlacement = {
  /** The cover scale of the room image at this screen. */
  sc: number;
  /** Where the image's top-left lands, px. */
  offX: number;
  offY: number;
  /** The stand's hook on screen, px. */
  hook: { x: number; y: number };
};

/**
 * The room as a cover crop with the stand about 70% across (64% on a phone,
 * where the text sits above), and the hook where that puts it.
 */
export function roomPlacement(W: number, H: number, phone: boolean): RoomPlacement {
  return scenePlacement(ROOM, W, H, phone ? 0.64 : 0.7);
}

/** A picture with a stand in it: its size, the pole's x and the hook, in its own pixels. */
export type Scene = { w: number; h: number; pole: number; hook: { x: number; y: number } };

/**
 * Any such picture as a cover crop with its pole `share` of the way across the
 * screen, as far as the picture allows. Cropped top and bottom alike, unless
 * that would put the hook within `topClear` px of the top (under the site
 * header): then it is cropped from the bottom instead, as far as it can be.
 */
export function scenePlacement(scene: Scene, W: number, H: number, share: number, topClear = 0): RoomPlacement {
  const sc = Math.max(W / scene.w, H / scene.h);
  const offX = clamp(share * W - scene.pole * sc, W - scene.w * sc, 0) || 0;
  const offY = clamp(Math.max((H - scene.h * sc) / 2, topClear - scene.hook.y * sc), H - scene.h * sc, 0) || 0;
  return { sc, offX, offY, hook: { x: offX + scene.hook.x * sc, y: offY + scene.hook.y * sc } };
}

/** How much bigger than life the hung bag is drawn, so its label can be read. */
export const HANG_SIZE = 2;
/** On a phone the room is cropped closer, so the bag is drawn smaller against it. */
export const HANG_SIZE_PHONE = 1.35;

/**
 * The bag hanging on the hook: its scale against the bag at rest (height
 * `bagH`), and where its centre goes so that its ring is on the hook.
 */
export function hangPose(
  room: RoomPlacement,
  bagH: number,
  bagW: number,
  phone = false,
  pxPerCm: number = ROOM.pxPerCm
) {
  const px = BAG_CM * pxPerCm * room.sc * (phone ? HANG_SIZE_PHONE : HANG_SIZE);
  const scale = px / bagH;
  return {
    scale,
    x: room.hook.x + (0.5 - RING.x) * bagW * scale,
    y: room.hook.y + (0.5 - RING.y) * bagH * scale,
  };
}

// ---------------------------------------------------------------- the stand

export type StandPhase = {
  /** The list and the shelf pushed up and away by the room sliding in, 0 to 1. */
  page: number;
  /** The evening with the nurse sliding up from below the screen, 0 (below) to 1 (in place). */
  room: number;
  /** The page's own bag on its way from beside the list to the stand's hook, 0 to 1 (hung). */
  fly: number;
  /** Its swing once hung, in degrees. */
  sway: number;
  /** The words block (its tag, the time, its line): in as the bag lands, out for the morning. */
  a2: number;
  /** The tube drawing from the bag's port to the cannula, 0 to 1. */
  tube: number;
  /** How far the drip has run, 0 (just started) to 1 (finished): the bag drains, the clock runs. */
  run: number;
  /** The block's tag and line changing from the arrival to the drip running, 0 to 1; the time stays and runs. */
  a25: number;
  /** The scene with the bag and its tube, fading for the morning (1: fully there). */
  bag: number;
  /** The morning dissolving in over the evening, 0 to 1. */
  feel: number;
  /** When the morning's words begin to come in, 0 to 1 (each line staggers after it). */
  a3: number;
};

/** Where each part of the scene ends in its progress p, with and without the morning. */
const STAGES = {
  morning: { arrive: 0.24, run: 0.6 },
  evening: { arrive: 0.42, run: 1 },
};

/**
 * The stand scene at p, 0 to 1 through its pinned screen. It starts where the
 * list ends, the full bag still beside it:
 *   the evening at home with the nurse comes up around the bag, the same bag
 *   travels onto the stand beside the patient and swings to rest, and the
 *   arrival words come in ("At your home", the time);
 *   the tube runs down to the patient's arm and the drip runs, the clock with it;
 *   then, when the drip has something to say for the morning, the morning.
 */
export function standPhase(p: number, act3: boolean): StandPhase {
  const s = act3 ? STAGES.morning : STAGES.evening;
  const e = within(p, 0, s.arrive);
  // As in v2 (assembly.ts "ground"): one progress drives both. The evening
  // room slides up from below like the next page while the bag, shrinking,
  // goes straight to the hook: they arrive together.
  // From the scene's first pixel, at about the scroll's own speed (the held
  // list carries on as the page would), easing out onto the hook: the scroll
  // after the last bottle moves it. (x + x² − x³: rises all the way, starts at
  // speed 1, stops at 1.)
  const r0 = within(e, 0, 0.6);
  const room = r0 + r0 * r0 - r0 * r0 * r0;
  const page = room;
  const fly = room;
  const swing = within(e, 0.6, 0.9);
  const sway = fly >= 1 ? Math.sin(swing * Math.PI * 3) * (1 - swing) * 2.6 : 0;
  const r = within(p, s.arrive, s.run);
  // The words: one block that comes in as the bag lands and stays while the drip runs.
  const a2 = smooth(within(e, 0.66, 0.9));
  const tube = smooth(within(r, 0, 0.22));
  const run = smooth(within(r, 0.18, 0.92));
  // Its tag and line change from the arrival to the drip running; the time stays.
  const a25 = smooth(within(r, 0.06, 0.24));
  if (!act3) return { page, room, fly, sway, a2, tube, run, a25, bag: 1, feel: 0, a3: 0 };
  const m = within(p, s.run, 1);
  // The whole evening (the room, the bag on its stand, the tube, the words)
  // dissolves into the morning together: nothing leaves the scene first.
  const feel = smooth(within(m, 0.05, 0.45));
  return {
    page,
    room,
    fly,
    sway,
    a2: a2 * (1 - feel),
    tube,
    run,
    a25,
    bag: 1 - feel,
    feel,
    a3: within(m, 0.45, 0.95),
  };
}

import { describe, expect, it } from "vitest";
import { BAG_CM, ROOM } from "@/components/site/scroll/assembly-assets";
import {
  HANG_SIZE,
  HANG_SIZE_PHONE,
  BLOOM_MS,
  CUE_LIFT,
  DOCK_SCALE,
  READ_LINE,
  shelfCue,
  PORT,
  RING,
  bagLevel,
  bloomPose,
  bottlePose,
  hangPose,
  portAim,
  portRing,
  sepPose,
  roomPlacement,
  scenePlacement,
  queueSpeed,
  stepQueue,
  standPhase,
  type Geometry,
} from "@/components/site/drip/build-math";

describe("one bottle at a time", () => {
  const ms = [500, 1000, 1000];
  it("moves only the first item still to go in, even when several rows are read at once", () => {
    const r = stepQueue([0, 0, 0], [1, 1, 1], 100, ms);
    expect(r.active).toBe(0);
    expect(r.ts[1]).toBe(0);
    expect(r.ts[2]).toBe(0);
  });
  it("starts the next only when the one before is fully in", () => {
    let ts = [0, 0, 0];
    const moved: number[] = [];
    for (let k = 0; k < 400; k++) {
      const r = stepQueue(ts, [1, 1, 1], 16, ms);
      if (r.active >= 0) moved.push(r.active);
      ts = r.ts;
    }
    expect(ts).toEqual([1, 1, 1]);
    // In order, and never back to an earlier one.
    for (let k = 1; k < moved.length; k++) expect(moved[k]).toBeGreaterThanOrEqual(moved[k - 1]);
  });
  it("goes faster with others waiting, at its own pace alone", () => {
    const alone = stepQueue([0, 0, 0], [1, 0, 0], 100, ms).ts[0];
    const queued = stepQueue([0, 0, 0], [1, 1, 0], 100, ms).ts[0];
    expect(alone).toBeCloseTo(100 / 500, 8);
    expect(queued).toBeGreaterThan(alone);
  });
  it("catches up faster the longer the backlog, within a limit", () => {
    expect(queueSpeed(1)).toBe(1);
    expect(queueSpeed(2)).toBeGreaterThan(1);
    expect(queueSpeed(5)).toBeGreaterThan(queueSpeed(2));
    expect(queueSpeed(50)).toBe(3.2);
  });
  it("read back up: takes the last one out first, before anything goes in", () => {
    const r = stepQueue([1, 1, 0.3], [1, 0, 0], 50, ms);
    expect(r.active).toBe(2);
    expect(r.ts[1]).toBe(1);
  });
  it("never passes its target, and rests when everything is where it should be", () => {
    expect(stepQueue([0.95], [1], 1000, [1000]).ts[0]).toBe(1);
    expect(stepQueue([0.05], [0], 1000, [1000]).ts[0]).toBe(0);
    expect(stepQueue([1, 0], [1, 0], 16, [1000, 1000]).active).toBe(-1);
  });
});

describe("the stand", () => {
  it("starts on the page as it was: nothing of the scene yet, the bag still beside the list", () => {
    for (const act3 of [true, false]) {
      const s = standPhase(0, act3);
      expect([s.page, s.room, s.fly, s.tube, s.run, s.a2, s.a25, s.feel]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
      expect(s.bag).toBe(1);
    }
  });
  it("slides the room up while the bag goes to the hook, as v2 does: one progress, arriving together", () => {
    for (const f of [0.1, 0.3, 0.5, 0.7]) {
      const s = standPhase(0.24 * f, true);
      expect(s.fly).toBe(s.room);
      expect(s.page).toBe(s.room);
    }
    const mid = standPhase(0.24 * 0.32, true);
    expect(mid.room).toBeGreaterThan(0.3);
    expect(mid.room).toBeLessThan(0.7);
    const hung = standPhase(0.24 * 0.62, true);
    expect(hung.room).toBe(1);
    expect(hung.fly).toBe(1);
  });
  it("hangs the same bag beside the patient, settles it, the arrival words in, before the tube", () => {
    const s = standPhase(0.235, true);
    expect(s.fly).toBe(1);
    expect(Math.abs(s.sway)).toBeLessThan(0.3);
    expect(s.a2).toBeGreaterThan(0.9);
    expect(s.tube).toBe(0);
    expect(s.run).toBe(0);
  });
  it("then draws the tube, and only then runs the drip, the words staying in, their tag and line swapped in place", () => {
    const mid = standPhase(0.46, true);
    expect(mid.tube).toBe(1);
    expect(mid.run).toBeGreaterThan(0);
    expect(mid.run).toBeLessThan(1);
    expect(mid.a2).toBe(1); // the time never leaves the screen
    expect(mid.a25).toBe(1);
    expect(standPhase(0.61, true).run).toBe(1);
  });
  it("ends on the morning, the scene and bag gone, every word in", () => {
    const s = standPhase(1, true);
    expect(s.bag).toBe(0);
    expect(s.feel).toBe(1);
    expect(s.a2).toBe(0);
    expect(s.a3).toBe(1);
  });
  it("ends on the drip finished at home when the drip has nothing to say for the morning", () => {
    const s = standPhase(1, false);
    expect(s.room).toBe(1);
    expect(s.run).toBe(1);
    expect(s.a25).toBe(1);
    expect(s.bag).toBe(1);
    expect(s.feel).toBe(0);
  });
  it("never leaves the screen empty, wherever the reader stops", () => {
    // Something to see at every point: the bag (crossing or hung), the scene,
    // or the morning sweeping in over it.
    for (let p = 0; p <= 1; p += 0.002) {
      const s = standPhase(p, true);
      const seen = Math.max(s.bag * (s.page < 1 || s.room > 0 || s.fly > 0 ? 1 : 0), s.room, s.feel);
      expect(seen).toBeGreaterThan(0.3);
    }
  });
  it("never jumps between frames", () => {
    for (const act3 of [true, false]) {
      let prev = standPhase(0, act3);
      for (let p = 0.002; p <= 1; p += 0.002) {
        const s = standPhase(p, act3);
        for (const k of ["page", "room", "fly", "tube", "run", "a2", "a25", "bag", "feel"] as const)
          expect(Math.abs(s[k] - prev[k])).toBeLessThan(0.06);
        prev = s;
      }
    }
  });
});

describe("a bottle on its way into the bag", () => {
  const g: Geometry = { dx: 300, dy: -150, arc: 30 };
  it("is exactly at rest at the start", () => {
    const p = bottlePose(0, g);
    expect([p.x, p.y, p.scale, p.rotate, p.opacity, p.poured]).toEqual([0, 0, 1, 0, 1, 0]);
  });
  it("docks under the port, upright and smaller, before it goes in", () => {
    for (const t of [0.46, 0.51]) {
      const at = bottlePose(t, g);
      expect(at.x).toBeCloseTo(g.dx, 5);
      expect(at.y).toBeCloseTo(g.dy, 5);
      expect(at.rotate).toBeCloseTo(0, 5);
      expect(at.scale).toBeCloseTo(DOCK_SCALE, 5);
      expect(at.poured).toBe(0);
    }
  });
  it("then goes in, shrinking into the port's end where it docked, and is gone", () => {
    const half = bottlePose(0.74, g);
    expect(half.x).toBeCloseTo(g.dx, 5);
    expect(half.y).toBeCloseTo(g.dy, 5);
    expect(half.scale).toBeLessThan(DOCK_SCALE);
    const end = bottlePose(1, g);
    expect(end.scale).toBe(0);
    expect(end.opacity).toBe(0);
    expect(end.poured).toBe(1);
  });
  it("takes its time going in: about a third of its turn, as long as its way to the port", () => {
    const firstIn = (() => {
      for (let t = 0; t <= 1; t += 0.001) if (bottlePose(t, g).poured > 0) return t;
      return 1;
    })();
    const allIn = (() => {
      for (let t = 0; t <= 1; t += 0.001) if (bottlePose(t, g).poured >= 1) return t;
      return 1;
    })();
    expect(allIn - firstIn).toBeGreaterThan(0.3);
    // Docked a beat before it goes in.
    expect(bottlePose(0.48, g).poured).toBe(0);
    expect(bottlePose(0.48, g).x).toBeCloseTo(g.dx, 5);
  });
  it("comes up into the port from below: the path dips under the straight line", () => {
    const mid = bottlePose(0.1 + 0.35 / 2, g);
    expect(mid.y).toBeGreaterThan(g.dy * 0.5 + 4);
  });
  it("never pours backwards, and pours only once it has arrived", () => {
    let last = 0;
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const p = bottlePose(t, g).poured;
      expect(p).toBeGreaterThanOrEqual(last - 1e-9);
      last = p;
    }
    expect(bottlePose(0.4, g).poured).toBe(0);
    expect(bottlePose(0.9, g).poured).toBe(1);
  });
  it("does not jump between frames", () => {
    let prev = bottlePose(0, g);
    for (let t = 0.005; t <= 1; t += 0.005) {
      const p = bottlePose(t, g);
      expect(Math.abs(p.x - prev.x)).toBeLessThan(18);
      expect(Math.abs(p.y - prev.y)).toBeLessThan(18);
      expect(Math.abs(p.rotate - prev.rotate)).toBeLessThan(8);
      prev = p;
    }
  });
  it("lifts and lights on the shelf as its turn comes, staying where it stands", () => {
    expect(shelfCue(900, 1000)).toBe(0); // the row is well below the reading line
    expect(shelfCue(1000 * READ_LINE, 1000)).toBe(1); // read
    const mid = shelfCue(1000 * READ_LINE + 100, 1000);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    const cued = bottlePose(0, g, 1);
    expect(cued.x).toBe(0);
    expect(cued.y).toBe(-CUE_LIFT);
    expect(cued.scale).toBeGreaterThan(1);
    expect(cued.glow).toBe(1);
    expect(bottlePose(0, g, 0).glow).toBe(0);
  });
  it("carries its cue onto its way without a jump, and has let it go by the port", () => {
    let prev = bottlePose(0, g, 1);
    for (let t = 0.005; t <= 1; t += 0.005) {
      const p = bottlePose(t, g, 1);
      expect(Math.abs(p.y - prev.y)).toBeLessThan(18);
      expect(Math.abs(p.scale - prev.scale)).toBeLessThan(0.05);
      prev = p;
    }
    const docked = bottlePose(0.5, g, 1);
    expect(docked.y).toBeCloseTo(g.dy, 5);
    expect(docked.scale).toBeCloseTo(DOCK_SCALE, 5);
    expect(docked.glow).toBe(0);
  });
  it("is a pure function of t, so scrolling back undoes it exactly", () => {
    expect(bottlePose(0.3, g)).toEqual(bottlePose(0.3, g));
  });
  it("puts its neck (where it scales from) at the port's end when it has docked", () => {
    const port = { x: 870, y: 640 };
    const neck = { x: 530, y: 300 };
    const p = bottlePose(0.5, { ...portAim(port, neck), arc: 0 });
    expect(neck.x + p.x).toBeCloseTo(port.x, 5);
    expect(neck.y + p.y).toBeCloseTo(port.y, 5);
  });
  it("enters by the bag's medication port, at its foot, not the hole it hangs from", () => {
    expect(PORT.y).toBeGreaterThan(0.85);
    expect(PORT.y).toBeGreaterThan(RING.y + 0.8);
    expect(Math.abs(PORT.x - 0.5)).toBeGreaterThan(0.1); // a side port, not the giving set's
  });
  it("the port's ring shows as the bottle docks, closes in as it enters, and is gone after", () => {
    expect(portRing(0).opacity).toBe(0);
    expect(portRing(0.35).opacity).toBe(0);
    expect(portRing(0.6).opacity).toBe(1);
    expect(portRing(0.52).scale).toBeGreaterThan(portRing(0.8).scale);
    expect(portRing(1).opacity).toBe(0);
    let prev = portRing(0);
    for (let t = 0.005; t <= 1; t += 0.005) {
      const r = portRing(t);
      expect(Math.abs(r.scale - prev.scale)).toBeLessThan(0.05);
      expect(Math.abs(r.opacity - prev.opacity)).toBeLessThan(0.08);
      prev = r;
    }
  });
  it("a bloom rises from the port into the liquid, swirling, and thins out into it", () => {
    expect(BLOOM_MS).toBeGreaterThan(1000);
    for (let j = 0; j < 3; j++) {
      const start = bloomPose(0, j, 200, 40);
      expect(start.opacity).toBe(0);
      expect(bloomPose(1, j, 200, 40).opacity).toBe(0);
      // Rises (up is negative), never above the rise it was given.
      const late = bloomPose(0.9, j, 200, 40);
      expect(late.y).toBeLessThan(-100);
      expect(late.y).toBeGreaterThanOrEqual(-200);
      let prev = start;
      let seen = 0;
      for (let k = 0.005; k <= 1; k += 0.005) {
        const p = bloomPose(k, j, 200, 40);
        expect(Math.abs(p.opacity - prev.opacity)).toBeLessThan(0.08);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(40);
        seen = Math.max(seen, p.opacity);
        prev = p;
      }
      expect(seen).toBeGreaterThan(0.4);
    }
    // The three clouds go their own ways.
    expect(bloomPose(0.5, 0, 200, 40).x).not.toBeCloseTo(bloomPose(0.5, 1, 200, 40).x, 1);
  });
  it("a bottle given separately never travels to the bag: it fades where it stands", () => {
    expect(sepPose(0)).toMatchObject({ x: 0, y: 0, scale: 1, opacity: 1, poured: 0 });
    const end = sepPose(1);
    expect(end.opacity).toBe(0);
    expect(end.x).toBe(0);
    expect(end.poured).toBe(0);
    expect(sepPose(0.5).opacity).toBeGreaterThan(0);
  });
});

describe("the liquid level", () => {
  it("rises with each ingredient and is full only when the last is in", () => {
    expect(bagLevel(0, [0, 0])).toBe(0);
    expect(bagLevel(1, [0, 0])).toBeCloseTo(0.12, 8);
    expect(bagLevel(1, [1, 0])).toBeCloseTo(0.12 + 0.44, 8);
    expect(bagLevel(1, [1, 1])).toBeCloseTo(1, 8);
  });
  it("fills with the carrier alone when nothing else goes in", () => {
    expect(bagLevel(0.5, [])).toBeCloseTo(0.5, 8);
    expect(bagLevel(1, [])).toBe(1);
  });
  it("never leaves 0 to 1", () => {
    expect(bagLevel(2, [3, 3])).toBe(1);
    expect(bagLevel(-1, [-1])).toBe(0);
  });
});

describe("the bag on the stand", () => {
  it("puts the stand's hook where the room's own data says, at any screen", () => {
    for (const [W, H, phone] of [
      [1440, 900, false],
      [1920, 1080, false],
      [390, 844, true],
    ] as const) {
      const r = roomPlacement(W, H, phone);
      expect(r.hook.x).toBeCloseTo(r.offX + ROOM.hook.x * r.sc, 8);
      expect(r.hook.y).toBeCloseTo(r.offY + ROOM.hook.y * r.sc, 8);
      // The room covers the screen: no gap at any edge.
      expect(r.offX).toBeLessThanOrEqual(0);
      expect(r.offY).toBeLessThanOrEqual(0);
      expect(r.offX + ROOM.w * r.sc).toBeGreaterThanOrEqual(W - 1e-6);
      expect(r.offY + ROOM.h * r.sc).toBeGreaterThanOrEqual(H - 1e-6);
    }
  });
  it("stands the pole about 70% across on a desktop and 64% on a phone, where the room allows", () => {
    const d = roomPlacement(1440, 900, false);
    expect((d.offX + ROOM.pole * d.sc) / 1440).toBeCloseTo(0.7, 2);
    const p = roomPlacement(390, 844, true);
    expect((p.offX + ROOM.pole * p.sc) / 390).toBeGreaterThan(0.5);
  });
  it("keeps the hook clear of the header on a wide screen, cropping from the bottom instead", () => {
    const scene = { w: 2200, h: 1238, pole: 1737, hook: { x: 1654, y: 183 } };
    const centred = scenePlacement(scene, 1920, 920, 0.86);
    expect(centred.hook.y).toBeLessThan(100);
    const clear = scenePlacement(scene, 1920, 920, 0.86, 64 + 92);
    expect(clear.hook.y).toBeCloseTo(156, 5);
    // Still a cover: no gap at the top or the bottom.
    expect(clear.offY).toBeLessThanOrEqual(0);
    expect(clear.offY + scene.h * clear.sc).toBeGreaterThanOrEqual(920 - 1e-6);
  });
  it("hangs the bag by its ring: the ring lands on the hook", () => {
    const room = roomPlacement(1440, 900, false);
    const bagH = 594;
    const bagW = (bagH * 577) / 1200;
    const h = hangPose(room, bagH, bagW);
    const ringX = h.x - (0.5 - RING.x) * bagW * h.scale;
    const ringY = h.y - (0.5 - RING.y) * bagH * h.scale;
    expect(ringX).toBeCloseTo(room.hook.x, 6);
    expect(ringY).toBeCloseTo(room.hook.y, 6);
  });
  it("draws the hung bag at its real size, a little larger so its label can be read, and smaller on a phone", () => {
    const room = roomPlacement(1440, 900, false);
    const h = hangPose(room, 600, 288);
    expect(h.scale * 600).toBeCloseTo(BAG_CM * ROOM.pxPerCm * room.sc * HANG_SIZE, 6);
    const pr = roomPlacement(390, 844, true);
    const hp = hangPose(pr, 600, 288, true);
    expect(hp.scale * 600).toBeCloseTo(BAG_CM * ROOM.pxPerCm * pr.sc * HANG_SIZE_PHONE, 6);
    expect(HANG_SIZE_PHONE).toBeLessThan(HANG_SIZE);
  });
});

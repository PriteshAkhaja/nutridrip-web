import { createLiquid } from "@/components/site/v3/liquid";
import { CARE } from "@/lib/feel";
import { READ_LINE, RING, clamp, hangPose, lerp, scenePlacement, smooth, standPhase, within } from "./build-math";

/**
 * Steps 2 and 3 (StandStage.tsx), moved by scroll: one pinned screen that
 * begins where the list ends (it sits a screen up, over the end of the list,
 * transparent until it starts), read as a progress p from 0 to 1 and drawn as
 * a pure function of it (build-math.ts standPhase), so scrolling back undoes
 * it exactly. The evening at home with the nurse comes up around the full bag;
 * the same bag (the
 * page's, handed over to a copy drawn exactly over it) travels to the stand
 * and swings to rest on the hook; the evening's words come in; then the
 * morning takes over and the drip's benefits read in. Only transforms,
 * opacity and visibility are written. Where it cannot pin (reduced motion, a
 * screen under 501 px tall, or before the script runs) it is the still version
 * the server drew. The returned cleanup removes every listener and style it
 * added.
 */
const PIN_QUERY = "(min-height: 501px) and (prefers-reduced-motion: no-preference)";

export function mountStand(root: HTMLElement): () => void {
  const st = root.querySelector<HTMLElement>("[data-st]");
  if (!st) return () => {};
  const $ = (s: string) => st.querySelector<HTMLElement>(s);
  const pin = $(".st__pin");
  const bagw = $("[data-st-bag]");
  const bagEl = $("[data-st-bagin]");
  const feel = $("[data-st-feel]");
  const a2 = $("[data-st-a2]");
  const a3 = $("[data-st-a3]");
  const care = $("[data-st-care]");
  const wire = $("[data-st-wire]");
  const was = [...st.querySelectorAll<HTMLElement>("[data-st-was]")];
  const nowEls = [...st.querySelectorAll<HTMLElement>("[data-st-now]")];
  const tube = st.querySelector<SVGSVGElement>("[data-st-tube]");
  const line = st.querySelector<SVGPathElement>("[data-st-line]");
  const drop = st.querySelector<SVGCircleElement>("[data-st-drop]");
  const clock = $("[data-st-clock]");
  let times: string[] = [];
  try {
    times = JSON.parse(clock?.dataset.times ?? "[]");
  } catch {}
  if (!pin || !care || !bagw || !bagEl) return () => {};
  const act3 = !!(feel && a3);

  // Still, the bag is shown full. Pinned, it is the page's bag carried on: it
  // takes the page bag's level, and keeps filling while the last bottles go in.
  const liquid = createLiquid(bagEl, { ease: 0.92, every: 110, stretch: false });
  liquid.snap(1);
  if (!matchMedia(PIN_QUERY).matches) return () => {};

  let dead = false;
  const off: Array<() => void> = [];
  const on = (t: EventTarget, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions) => {
    t.addEventListener(type, fn, opts);
    off.push(() => t.removeEventListener(type, fn, opts));
  };

  // The page's own bag, beside the list: the scene takes it from there. While
  // the scene is under way this one is hidden and the scene's copy, drawn
  // exactly over it, travels on; scroll back above the scene and it is back.
  const pageBag = root.querySelector<HTMLElement>("[data-dp-bag]");
  const stick = root.querySelector<HTMLElement>(".dp__bagstick");
  let handed = false;
  function hand(v: boolean) {
    if (v === handed || !pageBag) return;
    handed = v;
    pageBag.style.visibility = v ? "hidden" : "";
    if (v) {
      // From exactly the level the page's bag shows, then on with it.
      liquid.snap(level());
      follow();
    }
  }
  // The level the page's bag is filling to (motion writes it); full without one.
  const pageLevel = () => {
    const v = Number(pageBag?.dataset.level);
    return Number.isFinite(v) ? v : 1;
  };
  // While the drip runs, the bag drains (it never shows quite empty).
  let drain = 0;
  const level = () => pageLevel() * (1 - 0.9 * drain);
  let lraf = 0;
  function lloop(now: number) {
    lraf = 0;
    if (dead || !handed) return;
    liquid.set(level());
    if (liquid.tick(now) || pageLevel() < 1) lraf = requestAnimationFrame(lloop);
  }
  function follow() {
    if (!lraf) lraf = requestAnimationFrame(lloop);
  }
  // Whatever is left on the shelf, and the list itself, are pushed up and away
  // by the room sliding in from below.
  const leftovers = [...root.querySelectorAll<HTMLElement>(".dp__rack, .dp--build .dp__main")];
  function clear(room: number) {
    // Pushed up by the room sliding in from below, as the page would scroll.
    const t = room > 0 ? `translate3d(0,${(-room * (G?.H ?? innerHeight)).toFixed(1)}px,0)` : "";
    // And fades as it goes, so the bag on its way to the stand never crosses its words.
    const o = room > 0 ? (1 - smooth(Math.min(1, room * 2.2))).toFixed(3) : "";
    leftovers.forEach((el) => {
      el.style.transform = t;
      el.style.opacity = o;
    });
  }

  type Ring = { x: number; y: number };
  let G: {
    H: number;
    /** The scene's bag at rest: where its ring is, in the pin. */
    rest: Ring;
    /** Where the page's bag's ring sits on screen while it is stuck beside the list, and its scale against the scene's bag. */
    from: Ring & { scale: number };
    /** The stand's hook beside the patient, the hung bag's scale, and where the cannula is. */
    careTo: Ring & { scale: number };
    cannula: Ring;
    /** The scene's bag box at rest, to find its port as it moves. */
    bw: number;
    bh: number;
  } | null = null;
  // The scene starts (its p leaves 0) when the bottom of the page's bag column
  // reaches the bottom of the screen. Room under the list sets that moment: here
  // it is set so the scene starts just after the last ingredient is read (its
  // row passes the reading line), whatever the screen or the list.
  const main = root.querySelector<HTMLElement>(".dp--build .dp__main");
  const dp = root.querySelector<HTMLElement>(".dp--build");
  const lastRow = [...root.querySelectorAll<HTMLElement>("[data-ing]")].at(-1) ?? null;
  const holdEl = root.querySelector<HTMLElement>("[data-hold]");
  const roomEl = root.querySelector<HTMLElement>("[data-room]");
  function fitHandOff() {
    if (!main || !dp || !lastRow || !roomEl) return;
    // On the layout: the list not stuck (motion's hold), not pushed (clear).
    const pos = holdEl?.style.position ?? "";
    const tf = main.style.transform;
    if (holdEl) holdEl.style.position = "static";
    main.style.transform = "";
    roomEl.style.height = "0px";
    main.style.marginBottom = "";
    const H = innerHeight;
    const d0 = dp.getBoundingClientRect().bottom - lastRow.getBoundingClientRect().top;
    // Read at READ_LINE; the scene starts on the next wheel notch. A notch is
    // about 100 px, so a gap of exactly that always lands on the next one,
    // wherever in its notch the last row was read; more lands one later.
    const want = (1 - READ_LINE) * H + Math.max(100, 0.105 * H);
    // The room runs on under the scene, so the list stays held while the room
    // slides in and pushes it away (it has faded long before this runs out);
    // the column's negative margin keeps that out of the page's length.
    const under = Math.round(1.5 * H);
    roomEl.style.height = `${(Math.max(0, want - d0) + under).toFixed(0)}px`;
    main.style.marginBottom = `${-under}px`;
    if (holdEl) holdEl.style.position = pos;
    main.style.transform = tf;
  }
  function measure() {
    if (dead) return;
    fitHandOff();
    bagw!.style.transform = "";
    liquid.measure();
    liquid.snap(handed ? level() : 1);
    if (handed) follow();
    const pr = pin!.getBoundingClientRect();
    const W = pr.width;
    const H = pr.height;
    const phone = matchMedia("(max-width: 860px)").matches;
    // The scene's bag at rest: its box, top-left of the pin.
    const b = bagw!.getBoundingClientRect();
    const rest = { x: b.left - pr.left + RING.x * b.width, y: b.top - pr.top + RING.y * b.height };
    // The page's bag where it stays while stuck: its sticky top plus its place in the stuck column.
    let from = { ...rest, scale: 1 };
    if (pageBag && stick) {
      const pb = pageBag.getBoundingClientRect();
      const sb = stick.getBoundingClientRect();
      const top = (parseFloat(getComputedStyle(stick).top) || 0) + (pb.top - sb.top);
      from = { x: pb.left + RING.x * pb.width, y: top + RING.y * pb.height, scale: pb.height / b.height };
    }
    // The evening with the nurse: its pole well to the right, so the words sit
    // over the dark wall on the left and clear of the nurse.
    // The hook kept clear below the site header, with room for the bag's ring.
    const cp = scenePlacement(CARE, W, H, phone ? 0.84 : 0.86, 64 + H * 0.1);
    const cimg = care?.querySelector<HTMLImageElement>("img");
    if (cimg) cimg.style.objectPosition = `${cp.offX.toFixed(1)}px ${cp.offY.toFixed(1)}px`;
    const ch = hangPose(cp, b.height, b.width, phone, CARE.pxPerCm);
    G = {
      H,
      rest,
      from,
      careTo: { x: cp.hook.x, y: cp.hook.y, scale: ch.scale },
      cannula: { x: cp.offX + CARE.cannula.x * cp.sc, y: cp.offY + CARE.cannula.y * cp.sc },
      bw: b.width,
      bh: b.height,
    };
    tube?.setAttribute("viewBox", `0 0 ${W.toFixed(0)} ${H.toFixed(0)}`);
    render(progress());
  }
  function progress() {
    const r = st!.getBoundingClientRect();
    const span = r.height - innerHeight;
    return span > 0 ? clamp(-r.top / span) : 0;
  }
  const show = (el: HTMLElement | null, o: number, rise = 14) => {
    if (!el) return;
    el.style.opacity = o.toFixed(3);
    el.style.transform = `translate3d(0,${((1 - o) * rise).toFixed(1)}px,0)`;
    el.style.visibility = o <= 0 ? "hidden" : "visible";
  };

  function render(p: number) {
    if (!G) return;
    const s = standPhase(p, act3);
    // Under way: the page's bag hands over to the scene's, drawn exactly over it.
    const on = p > 0;
    hand(on);
    // Once the room has come up, the page behind stays hidden through the rest of the scene.
    clear(on ? s.page : 0);
    // The wire through the hole shows only once the bag has reached the hook.
    if (wire) wire.style.opacity = smooth(within(s.fly, 0.94, 1)).toFixed(3);
    // As in v2: a straight line to the hook, shrinking as the room rises.
    const x = lerp(G.from.x, G.careTo.x, s.fly);
    const y = lerp(G.from.y, G.careTo.y, s.fly);
    const sc = lerp(G.from.scale, G.careTo.scale, s.fly);
    bagw!.style.transformOrigin = `${RING.x * 100}% ${RING.y * 100}%`;
    bagw!.style.transform = `translate3d(${(x - G.rest.x).toFixed(1)}px,${(y - G.rest.y).toFixed(1)}px,0) rotate(${s.sway.toFixed(2)}deg) scale(${sc.toFixed(4)})`;
    bagw!.style.opacity = (on ? s.bag : 0).toFixed(3);
    show(a2, s.a2);

    // The evening with the nurse, the tube to the arm, the drip running.
    // The evening stays under the morning's sweep, and goes once it is covered.
    // The room slides up from below the screen; whole, never faded in.
    const careOp = s.feel >= 1 || s.room <= 0 ? 0 : 1;
    if (care) {
      care.style.opacity = careOp.toFixed(3);
      care.style.visibility = careOp <= 0 ? "hidden" : "visible";
      care.style.transform = `translate3d(0,${((1 - s.room) * G.H).toFixed(1)}px,0)`;
    }
    if (drain !== s.run) {
      drain = s.run;
      if (handed) follow();
    }
    if (tube && line) {
      // The port at the foot of the bag, wherever the bag is now.
      const port = { x: x + (0.5 - RING.x) * G.bw * sc, y: y + (0.975 - RING.y) * G.bh * sc };
      const c = G.cannula;
      line.setAttribute(
        "d",
        `M${port.x.toFixed(1)},${port.y.toFixed(1)} C${port.x.toFixed(1)},${(port.y + (c.y - port.y) * 0.75).toFixed(1)} ${(c.x + (port.x - c.x) * 0.45).toFixed(1)},${(c.y + 30).toFixed(1)} ${c.x.toFixed(1)},${c.y.toFixed(1)}`
      );
      const L = line.getTotalLength();
      line.style.strokeDasharray = `${L.toFixed(1)}`;
      line.style.strokeDashoffset = (L * (1 - s.tube)).toFixed(1);
      tube.style.opacity = (s.tube > 0 ? careOp * (act3 ? s.bag : 1) : 0).toFixed(3);
      if (drop) {
        drop.setAttribute("cx", port.x.toFixed(1));
        drop.setAttribute("cy", (port.y + 6).toFixed(1));
        drop.classList.toggle("is-on", s.run > 0 && s.run < 1);
      }
    }
    // The tag and the line change in place; the time stays and runs.
    // One after the other, never overlapping: the old words out, then the new in.
    was.forEach((el) => (el.style.opacity = (1 - smooth(within(s.a25, 0, 0.5))).toFixed(3)));
    nowEls.forEach((el) => (el.style.opacity = smooth(within(s.a25, 0.5, 1)).toFixed(3)));
    if (clock && times.length) {
      const t = times[Math.round(s.run * (times.length - 1))];
      if (clock.textContent !== t) clock.textContent = t;
    }
    if (act3) {
      // A film dissolve: the morning over the evening, which stays whole under it.
      feel!.style.opacity = s.feel.toFixed(3);
      feel!.style.visibility = s.feel <= 0 ? "hidden" : "visible";
      feel!.style.transform = `scale(${(1.03 - 0.03 * s.feel).toFixed(4)})`;
      [...a3!.children].forEach((c, i) => {
        show(c as HTMLElement, smooth(within(s.a3, i * 0.12, 0.35 + i * 0.12)), 16);
      });
      a3!.style.visibility = s.a3 <= 0 ? "hidden" : "visible";
      a3!.style.pointerEvents = s.a3 >= 0.9 ? "auto" : "none";
    }
  }

  let ticking = false;
  on(
    window,
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (!dead) render(progress());
      });
    },
    { passive: true }
  );
  let resizing = 0;
  on(window, "resize", () => {
    clearTimeout(resizing);
    resizing = window.setTimeout(measure, 120);
  });
  document.fonts?.ready.then(() => !dead && measure());
  if (document.readyState !== "complete") on(window, "load", measure);
  const img = bagEl.querySelector("img");
  if (img && !img.complete) on(img, "load", measure);

  st.classList.add("is-pinned");
  measure();

  return () => {
    dead = true;
    cancelAnimationFrame(lraf);
    clearTimeout(resizing);
    off.forEach((f) => f());
    st.classList.remove("is-pinned");
    hand(false);
    if (main) main.style.marginBottom = "";
    if (roomEl) roomEl.style.height = "";
    clear(0);
    [bagw, feel, a2, a3, care, wire, ...was, ...nowEls, ...(a3 ? [...a3.children] : [])].forEach((el) =>
      el?.removeAttribute("style")
    );
    tube?.removeAttribute("style");
    line?.removeAttribute("style");
  };
}

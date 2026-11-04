import type { ScrollCraftApi } from "@/components/site/scroll/engine";
import { mountBook, type SlipDrip } from "@/components/site/v3/book";
import { SHORT_SCREEN } from "@/components/site/scroll/short-screen";

/**
 * The IV vs Tablets page's own motion, ported from the approved prototype
 * (scrollcraft/builds/iv-vs-tablets/page.js) and run by IvTabsMotion through
 * useScrollCraft. One dose travels each route, stop by stop; the tablet's
 * words change as it goes ("Full dose" … "Part of the dose") while the IV's
 * stay "Full dose". No gauge: a fill on this site always shows a real
 * quantity, and these stages are an illustration. Everything it adds, the
 * returned cleanup removes.
 */

export type { SlipDrip };

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const GLIDE_MS = 320;
const GLIDE = `transform ${GLIDE_MS}ms cubic-bezier(.2, .7, .2, 1), color 240ms cubic-bezier(.2, .7, .2, 1)`;

type Stop = { el: HTMLElement; at: number; word: string | null };
type Route = {
  el: HTMLElement;
  stops: Stop[];
  dose: HTMLElement;
  lv: HTMLElement;
  path: HTMLElement;
  state?: string;
  lineKey?: string | null;
};

export function mountIvTabs(root: HTMLElement, engine: () => Promise<ScrollCraftApi>, drips: SlipDrip[]): () => void {
  const $ = <T extends Element = HTMLElement>(s: string, c: ParentNode = root) => c.querySelector<T>(s);
  const $$ = <T extends Element = HTMLElement>(s: string, c: ParentNode = root) => [...c.querySelectorAll<T>(s)];
  const site = root.closest<HTMLElement>(".sc-site") ?? root;
  // Reduced motion, or a screen too short to hold both routes (a phone on its
  // side): the still version, every stop and note shown.
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || matchMedia(SHORT_SCREEN).matches;
  const small = matchMedia("(max-width: 860px)").matches;
  const act = $(".routes");
  const stage = $(".routes__stage");
  const endEl = $(".routes__end");
  if (!act || !stage || !endEl) return () => {};

  let dead = false;
  const off: Array<() => void> = [];
  const on = (t: EventTarget, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions) => {
    t.addEventListener(type, fn, opts);
    off.push(() => t.removeEventListener(type, fn, opts));
  };

  // ---------------------------------------------------- prepare the act
  if (reduce) {
    act.setAttribute("data-sc-act", "flow");
    act.removeAttribute("data-sc-span");
    stage.classList.add("sc-stage", "nd-still");
    site.classList.add("is-static");
  } else if (small) {
    // The phone span comes from the markup (--span-m), the number the CSS
    // reserves from first paint, so mounting moves nothing.
    act.setAttribute("data-sc-span", getComputedStyle(act).getPropertyValue("--span-m").trim());
  }

  // ---------------------------------------------------- the slip and the phone bar
  // The sticky bar stays down while the routes act holds the screen: its end
  // carries the same action, and the bar would cover the bottom of the stage.
  const unbook = mountBook(root, drips, [act]);

  // ---------------------------------------------------- the routes
  const routes: Route[] = $$(".route").flatMap((r) => {
    const dose = $(".route__dose", r);
    const lv = $("[data-lv]", r);
    const path = $(".route__path", r);
    if (!dose || !lv || !path) return [];
    const stops = $$(".route__path li", r).map((li) => ({
      el: li,
      at: Number(li.getAttribute("data-at") ?? 0),
      word: li.getAttribute("data-word"),
    }));
    return [{ el: r, stops, dose, lv, path }];
  });
  if (routes.length !== 2)
    return () => {
      unbook();
      off.forEach((f) => f());
    };

  // Where each node's centre sits inside its <li>, read from the node's own
  // style (::before), not per-layout constants.
  let node = { x: 0, y: 0 };
  function measureNode() {
    const li = $(".route__path li");
    if (!li) return;
    const cs = getComputedStyle(li, "::before");
    const tr = (cs.translate && cs.translate !== "none" ? cs.translate : "0 0").split(" ");
    node = {
      x: parseFloat(cs.left) + parseFloat(cs.width) / 2 + (parseFloat(tr[0]) || 0),
      y: parseFloat(cs.top) + parseFloat(cs.height) / 2 + (parseFloat(tr[1] ?? tr[0]) || 0),
    };
  }
  // A node's centre as drawn (its stop may be gliding), inside the route,
  // where the dose is positioned.
  function centre(R: Route, s: Stop): [number, number] {
    const r = s.el.getBoundingClientRect();
    const o = R.el.getBoundingClientRect();
    return [r.left - o.left + node.x, r.top - o.top + node.y];
  }
  // The line from the first node's centre to the last's, along whichever axis
  // the path runs (down on desktop, across on a phone).
  function measureLine(R: Route) {
    const a = centre(R, R.stops[0]);
    const b = centre(R, R.stops[R.stops.length - 1]);
    const pr = R.path.getBoundingClientRect();
    const rr = R.el.getBoundingClientRect();
    const across = Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]);
    const o = [pr.left - rr.left, pr.top - rr.top];
    const l0 = across ? a[0] - o[0] : a[1] - o[1];
    const lh = across ? b[0] - a[0] : b[1] - a[1];
    const lc = across ? a[1] - o[1] : a[0] - o[0];
    const key = `${l0}/${lh}/${lc}`;
    if (R.lineKey === key) return;
    R.lineKey = key;
    R.path.style.setProperty("--l0", `${l0}px`);
    R.path.style.setProperty("--lh", `${lh}px`);
    R.path.style.setProperty("--lc", `${lc}px`);
  }
  function alignNotes() {
    $$(".route__path li").forEach((li) => {
      const p = $("p", li);
      if (p) p.style.left = small && !reduce ? `${-li.offsetLeft}px` : "";
    });
  }

  let glideUntil = 0;
  function place(R: Route, t: number) {
    // t: 0..1 along this route's path. The dose sits between stop nodes.
    const stops = R.stops;
    let a = stops[0];
    let b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++)
      if (t >= stops[i].at && t <= stops[i + 1].at) {
        a = stops[i];
        b = stops[i + 1];
        break;
      }
    if (t > stops[stops.length - 1].at) a = b = stops[stops.length - 1];
    let now = 0;
    stops.forEach((s, i) => {
      if (t >= s.at - 0.001) now = i;
    });
    const state = stops.map((s, i) => (i === now ? "N" : t >= s.at - 0.001 ? "o" : "-")).join("");
    if (state !== R.state) {
      // Only the current stop shows its note, so every change of stop reflows
      // the path. Each stop glides from where it was drawn to where it lands
      // (FLIP), and the dose and line follow the drawn positions.
      const before = stops.map((s) => s.el.getBoundingClientRect().top);
      stops.forEach((s, i) => {
        s.el.classList.toggle("is-on", state.charAt(i) !== "-");
        s.el.classList.toggle("is-now", i === now);
        s.el.style.transition = "none";
        s.el.style.transform = "";
      });
      let moved = false;
      stops.forEach((s, i) => {
        const d = before[i] - s.el.getBoundingClientRect().top;
        if (R.state && Math.abs(d) > 0.5) {
          s.el.style.transform = `translateY(${d}px)`;
          moved = true;
        }
      });
      if (moved) {
        void R.path.offsetWidth;
        stops.forEach((s) => {
          s.el.style.transition = GLIDE;
          s.el.style.transform = "";
        });
        glideUntil = performance.now() + GLIDE_MS + 40;
      } else stops.forEach((s) => (s.el.style.transition = ""));
      R.state = state;
      // The stage's words, carried by the stop the dose has reached.
      const word = stops.slice(0, now + 1).reduce<string | null>((w, s) => s.word ?? w, null);
      if (word) R.lv.textContent = word;
    }
    measureLine(R);
    const k = a === b ? 0 : (t - a.at) / (b.at - a.at);
    const ca = centre(R, a);
    const cb = centre(R, b);
    R.dose.style.translate = `${ca[0] + (cb[0] - ca[0]) * k}px ${ca[1] + (cb[1] - ca[1]) * k}px`;
    return now;
  }
  function render(p: number) {
    const t = clamp(p / 0.82, 0, 1);
    const tn = place(routes[0], t);
    const iv = place(routes[1], clamp(t * 1.6, 0, 1));
    const e = clamp((p - 0.82) / 0.1, 0, 1);
    endEl!.style.opacity = String(e);
    endEl!.style.visibility = e > 0.01 ? "visible" : "hidden";
    stage!.setAttribute("data-sc-verify-state", `${t.toFixed(2)}/${tn}/${iv}/${e.toFixed(2)}`);
  }
  function prog() {
    const r = act!.getBoundingClientRect();
    const tr = r.height - innerHeight;
    return tr < 2 ? 1 : clamp(-r.top / tr, 0, 1);
  }

  // The end's quiz link only exists once the end shows: a keyboard user
  // arriving on it lands on the finished act, not on a link still at 0.
  on(endEl, "focusin", () => {
    if (reduce) return;
    const top = act.getBoundingClientRect().top + scrollY;
    scrollTo({ top: top + 0.96 * (act.offsetHeight - innerHeight), behavior: "instant" });
  });

  let last = -1;
  let raf = 0;
  const relayout = () => {
    if (dead) return;
    measureNode();
    alignNotes();
    routes.forEach((R) => (R.lineKey = null));
    last = -1;
    if (reduce) render(1);
  };
  on(window, "resize", relayout);

  engine()
    .then(() => {
      if (dead) return;
      relayout();
      document.fonts?.ready.then(relayout);
      if (reduce) {
        render(1);
        return;
      }
      // While a stop glides the dose and line keep following it, scroll or not.
      const loop = () => {
        if (dead) return;
        const p = prog();
        if (p !== last || performance.now() < glideUntil) {
          render(p);
          last = p;
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    })
    .catch(() => {
      // Unmounted before the engine loaded: nothing was started.
    });
  site.classList.add("nd-js");

  return () => {
    dead = true;
    cancelAnimationFrame(raf);
    unbook();
    off.forEach((f) => f());
    site.classList.remove("nd-js", "is-static");
  };
}

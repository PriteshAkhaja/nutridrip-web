import type { ScrollCraftApi } from "@/components/site/scroll/engine";
import { mountBook, type SlipDrip } from "@/components/site/v3/book";
import { SHORT_SCREEN } from "@/components/site/scroll/short-screen";

/**
 * About: the line. The act's progress is cut into one stretch per row of the
 * matrix and one to finish; at each, the next row fills in (Can / Cannot for
 * each team) and its reason shows under the table. Before the script runs,
 * and under reduced motion, every row is filled and each reason sits in its
 * row. Everything it adds, the returned cleanup removes.
 */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function mountAbout(root: HTMLElement, engine: () => Promise<ScrollCraftApi>, drips: SlipDrip[]): () => void {
  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s);
  const $$ = <T extends Element = HTMLElement>(s: string) => [...root.querySelectorAll<T>(s)];
  const site = root.closest<HTMLElement>(".sc-site") ?? root;
  // Reduced motion, or a screen too short to hold the matrix (a phone on its
  // side): the still version, every row filled.
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || matchMedia(SHORT_SCREEN).matches;
  const small = matchMedia("(max-width: 860px)").matches;

  const act = $(".ab-line");
  const stage = $(".ab-line__stage");
  const table = $(".ab-matrix");
  const rows = $$(".ab-matrix tbody tr");
  const whys = $$(".ab-line__why > li");

  const unbook = mountBook(root, drips, act ? [act] : []);
  let dead = false;
  const start = () =>
    engine().catch(() => {
      // Unmounted before the engine loaded: nothing was started.
    });

  if (!act || !stage || !table || !rows.length) {
    start();
    return () => {
      dead = true;
      unbook();
    };
  }
  if (reduce) {
    act.setAttribute("data-sc-act", "flow");
    act.removeAttribute("data-sc-span");
    site.classList.add("is-static");
    start();
    return () => {
      dead = true;
      unbook();
      site.classList.remove("is-static");
    };
  }
  if (small) act.setAttribute("data-sc-span", getComputedStyle(act).getPropertyValue("--span-m").trim());

  // Live: rows not yet reached are faint, and the reasons move under the table.
  table.classList.add("is-live");
  const N = rows.length;
  let state = -1;
  function set(s: number) {
    if (s === state) return;
    state = s;
    rows.forEach((r, i) => {
      r.classList.toggle("is-in", i <= s);
      r.classList.toggle("is-now", i === s && s < N);
    });
    whys.forEach((w, i) => w.classList.toggle("is-now", i === Math.min(s, N - 1)));
    stage!.setAttribute("data-sc-verify-state", String(s));
  }
  function prog() {
    const r = act!.getBoundingClientRect();
    const tr = r.height - innerHeight;
    return tr < 2 ? 1 : clamp(-r.top / tr, 0, 1);
  }
  // N rows and the finish: N + 1 equal stretches.
  const render = () => set(Math.min(N, Math.floor(prog() * (N + 1))));
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      if (!dead) render();
    });
  };
  addEventListener("scroll", onScroll, { passive: true });
  render();
  start();

  return () => {
    dead = true;
    unbook();
    removeEventListener("scroll", onScroll);
    table.classList.remove("is-live");
  };
}

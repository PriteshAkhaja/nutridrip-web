import type { ScrollCraftApi } from "@/components/site/scroll/engine";
import { mountBook, type SlipDrip } from "@/components/site/v3/book";

/**
 * Safety: the vitals gate. The act's progress is cut into one stretch per
 * stage; at each, the example readings move on their gauges, the checklist's
 * next steps say Ready, Blocked or Cleared, and the words beside change.
 * Under reduced motion the act is a list beside the panel at its blocked
 * stage, the rule the page is about. Everything it adds, the cleanup removes.
 */

export type GateState = {
  /** over: the stretch past the band, from the limit to the reading (equal when inside it). */
  rows: Array<{ value: string; x: number; over: [number, number]; out: boolean }>;
  steps: "ready" | "blocked" | "cleared";
  note: string;
};

const WORD = { ready: "Ready", blocked: "Blocked", cleared: "Cleared" } as const;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function mountSafety(
  root: HTMLElement,
  engine: () => Promise<ScrollCraftApi>,
  drips: SlipDrip[],
  gate: GateState[]
): () => void {
  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s);
  const $$ = <T extends Element = HTMLElement>(s: string) => [...root.querySelectorAll<T>(s)];
  const site = root.closest<HTMLElement>(".sc-site") ?? root;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = matchMedia("(max-width: 860px)").matches;

  const act = $(".sf-gate");
  const stage = $(".sf-gate__stage");
  const says = $$(".sf-says > li");
  const rows = $$(".sf-vitals > li");
  const next = $(".sf-next");
  const note = $(".sf-panel__note");

  const unbook = mountBook(root, drips, act ? [act] : []);
  let dead = false;
  const start = () =>
    engine().catch(() => {
      // Unmounted before the engine loaded: nothing was started.
    });

  let state = -1;
  function set(s: number) {
    if (s === state || !gate[s]) return;
    state = s;
    const g = gate[s];
    says.forEach((li, i) => li.classList.toggle("is-now", i === s));
    rows.forEach((li, i) => {
      const r = g.rows[i];
      if (!r) return;
      li.classList.toggle("is-out", r.out);
      const val = li.querySelector(".sf-v__val");
      const word = li.querySelector(".sf-v__state");
      const mark = li.querySelector<HTMLElement>(".sf-v__mark");
      if (val) val.textContent = r.value;
      if (word) word.textContent = r.out ? "Out of range" : "In range";
      mark?.style.setProperty("--x", String(r.x));
      const over = li.querySelector<HTMLElement>(".sf-v__over");
      over?.style.setProperty("--o0", String(r.over[0]));
      over?.style.setProperty("--o1", String(r.over[1]));
    });
    if (next) {
      next.dataset.state = g.steps;
      next.querySelectorAll(".sf-next__s").forEach((el) => (el.textContent = WORD[g.steps]));
    }
    if (note) {
      note.dataset.state = g.steps;
      note.textContent = g.note;
    }
    stage?.setAttribute("data-sc-verify-state", String(s));
  }

  if (!act || !stage || !says.length) {
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
    set(1);
    says.forEach((li) => li.classList.add("is-now"));
    start();
    return () => {
      dead = true;
      unbook();
      site.classList.remove("is-static");
    };
  }
  if (small) act.setAttribute("data-sc-span", getComputedStyle(act).getPropertyValue("--span-m").trim());

  function prog() {
    const r = act!.getBoundingClientRect();
    const tr = r.height - innerHeight;
    return tr < 2 ? 1 : clamp(-r.top / tr, 0, 1);
  }
  const render = () => set(Math.min(gate.length - 1, Math.floor(prog() * gate.length)));
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
  start().then(() => {
    if (!dead) render();
  });

  return () => {
    dead = true;
    unbook();
    removeEventListener("scroll", onScroll);
  };
}

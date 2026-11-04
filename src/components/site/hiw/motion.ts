import type { ScrollCraftApi } from "@/components/site/scroll/engine";
import { mountBook, type SlipDrip } from "@/components/site/v3/book";
import { SHORT_SCREEN } from "@/components/site/scroll/short-screen";

/**
 * How it works: the relay. The act's progress is cut into one stretch per
 * step and one for the report; at each, the step's words show, its row is
 * stamped on the card, and the card glides to the desk that holds it. After
 * the last step the card turns over as the report. Under reduced motion the
 * act is a list beside the finished card. Everything it adds, the returned
 * cleanup removes.
 */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function mountHiw(root: HTMLElement, engine: () => Promise<ScrollCraftApi>, drips: SlipDrip[]): () => void {
  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s);
  const $$ = <T extends Element = HTMLElement>(s: string) => [...root.querySelectorAll<T>(s)];
  const site = root.closest<HTMLElement>(".sc-site") ?? root;
  // Reduced motion, or a screen too short to hold the relay (a phone on its
  // side): the still version, a list beside the finished card.
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || matchMedia(SHORT_SCREEN).matches;
  const small = matchMedia("(max-width: 860px)").matches;

  const act = $(".hw-relay");
  const stage = $(".hw-relay__stage");
  const desks = $(".hw-desks");
  const card = $(".hw-card");
  const count = $("[data-step-n]");
  const steps = $$(".hw-steps > li");
  const rows = $$(".hw-card__rows > li");
  const deskEls = $$("[data-desk]");

  const unbook = mountBook(root, drips, act ? [act] : []);
  let dead = false;
  const done = () => {
    dead = true;
    unbook();
    site.classList.remove("is-static");
  };
  const start = () =>
    engine().catch(() => {
      // Unmounted before the engine loaded: nothing was started.
    });

  if (!act || !stage || !desks || !card || !steps.length || steps.length !== rows.length) {
    start();
    return done;
  }

  // ---------------------------------------------------- prepare the act
  if (reduce) {
    act.setAttribute("data-sc-act", "flow");
    act.removeAttribute("data-sc-span");
    site.classList.add("is-static");
    rows.forEach((r) => r.classList.add("is-in"));
    rows.forEach((r) => r.classList.remove("is-now"));
    start();
    return done;
  }
  // The phone span comes from the markup (--span-m), the number the CSS
  // reserves from first paint, so mounting moves nothing.
  if (small) act.setAttribute("data-sc-span", getComputedStyle(act).getPropertyValue("--span-m").trim());

  // ---------------------------------------------------- where the card sits
  // Its offset from the centre (where the CSS puts it) to each desk's centre,
  // kept inside the row: on a phone the card is wider than a desk.
  let xs: Record<string, number> = {};
  function measure() {
    const box = desks!.getBoundingClientRect();
    const w = card!.offsetWidth;
    const centre = (k: string) => {
      const d = deskEls.find((el) => el.dataset.desk === k);
      if (!d) return box.width / 2;
      const r = d.getBoundingClientRect();
      return r.left - box.left + r.width / 2;
    };
    const home = (box.width - w) / 2;
    const fit = (c: number) => clamp(c - w / 2, 0, box.width - w) - home;
    xs = {
      physician: fit(centre("physician")),
      you: fit(centre("you")),
      nurse: fit(centre("nurse")),
      both: fit((centre("you") + centre("nurse")) / 2),
    };
  }

  // ---------------------------------------------------- one state per stretch
  const N = steps.length;
  let state = -1;
  function set(s: number, force = false) {
    if (s === state && !force) return;
    state = s;
    const i = Math.min(s, N - 1);
    const at = steps[i].dataset.at ?? "you";
    steps.forEach((li, j) => li.classList.toggle("is-now", j === i));
    rows.forEach((r, j) => {
      r.classList.toggle("is-in", j <= i);
      r.classList.toggle("is-now", j === i && s < N);
    });
    deskEls.forEach((d) => {
      const k = d.dataset.desk;
      d.classList.toggle("is-on", k === at || (at === "both" && (k === "you" || k === "nurse")));
    });
    card!.style.transform = `translateX(${(xs[at] ?? 0).toFixed(1)}px)`;
    card!.classList.toggle("is-report", s >= N);
    if (count) count.textContent = String(i + 1);
    stage!.setAttribute("data-sc-verify-state", String(s));
  }
  function prog() {
    const r = act!.getBoundingClientRect();
    const tr = r.height - innerHeight;
    return tr < 2 ? 1 : clamp(-r.top / tr, 0, 1);
  }
  // N steps and the report: N + 1 equal stretches.
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
  const relayout = () => {
    if (dead) return;
    measure();
    set(Math.max(state, 0), true);
  };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", relayout);

  start().then(() => {
    if (dead) return;
    // The card glides only once it is in place: the first placing is instant.
    card.style.transition = "none";
    measure();
    render();
    void card.offsetWidth;
    card.style.transition = "";
    document.fonts?.ready.then(relayout);
  });

  return () => {
    done();
    removeEventListener("scroll", onScroll);
    removeEventListener("resize", relayout);
    card.style.transform = "";
    card.style.transition = "";
  };
}

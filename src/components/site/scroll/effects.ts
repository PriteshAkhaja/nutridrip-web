/**
 * The public site's scroll moments, one per page that has one, ported from the
 * approved prototypes in scrollcraft/builds/<page>/ (see each BRIEF.md). Each
 * takes the server-rendered section it animates and returns its cleanup.
 * GSAP ScrollTrigger maps scroll to progress with a short scrub; everything
 * written is a transform, an opacity, a colour or a data-state attribute.
 *
 * Mounted by <ScrollEffect>, never under reduced motion: there, and without
 * JavaScript, each section stays exactly as the server drew it.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export type Cleanup = () => void;
const all = <T extends Element>(root: Element, sel: string) => [...root.querySelectorAll<T & HTMLElement>(sel)];

/* --------------------------------------------------------------------------
   /safety: the checklist works itself through as you read it.
   A reading line 45% down the screen moves through the step list. Rows above
   it are ticked, the one at it is highlighted; the sticky card's phase bars
   fill segment by segment, the current one by the fraction read; on phones a
   strip under the header carries the phase and "step n of 29".
   -------------------------------------------------------------------------- */
export function checklist(root: HTMLElement): Cleanup {
  const list = root.querySelector<HTMLElement>("[data-cl-list]");
  const rows = all(root, "[data-cl-step]");
  if (!list || !rows.length) return () => {};
  gsap.registerPlugin(ScrollTrigger);
  root.dataset.live = "";

  const fills = all(root, "[data-cl-fill]");
  const counts = all(root, "[data-cl-count]");
  const now = all(root, "[data-cl-now]");
  const stripPhase = root.querySelector<HTMLElement>("[data-cl-strip-phase]");
  const stripBar = root.querySelector<HTMLElement>("[data-cl-strip-bar]");
  const phases = [...new Set(rows.map((r) => r.dataset.clPhase ?? ""))];
  const total = rows.length;

  let box: Array<{ t: number; h: number }> = [];
  const layout = () => {
    const top = list.getBoundingClientRect().top;
    box = rows.map((r) => {
      const b = r.getBoundingClientRect();
      return { t: b.top - top, h: b.height };
    });
  };

  const state = { p: 0 };
  let last = { cur: -2, frac: -1 };
  const render = () => {
    const y = state.p * list.offsetHeight;
    let cur = -1,
      frac = 0,
      done = 0;
    for (let i = 0; i < box.length; i++) {
      if (y >= box[i].t + box[i].h) done = i + 1;
      else {
        if (y >= box[i].t) {
          cur = i;
          frac = (y - box[i].t) / box[i].h;
        }
        break;
      }
    }
    if (cur === last.cur && Math.abs(frac - last.frac) < 0.004) return;
    last = { cur, frac };
    rows.forEach((row, k) => {
      const s = k < done ? "done" : k === cur ? "current" : "ahead";
      if (row.dataset.state !== s) row.dataset.state = s;
      const f = k < done ? 1 : k === cur ? frac : 0;
      if (fills[k]) fills[k].style.transform = `scaleX(${f.toFixed(3)})`;
    });
    const perPhase = phases.map(() => 0);
    for (let d = 0; d < done; d++) perPhase[phases.indexOf(rows[d].dataset.clPhase ?? "")]++;
    counts.forEach((c, i) => (c.textContent = String(perPhase[i] ?? 0)));
    // "Step n": the step being read, or the last one closed between phases.
    const n = cur >= 0 ? cur + 1 : Math.max(done, 1);
    now.forEach((e) => (e.textContent = String(n)));
    if (stripPhase) stripPhase.textContent = rows[Math.min(n, total) - 1]?.dataset.clPhase ?? "";
    if (stripBar) stripBar.style.transform = `scaleX(${((done + (cur >= 0 ? frac : 0)) / total).toFixed(4)})`;
  };

  layout();
  const tween = gsap.fromTo(
    state,
    { p: 0 },
    {
      p: 1,
      ease: "none",
      onUpdate: render,
      scrollTrigger: { trigger: list, start: "top 45%", end: "bottom 45%", scrub: 0.35, invalidateOnRefresh: true },
    }
  );
  const onRefresh = () => {
    layout();
    last.cur = -2;
    render();
  };
  ScrollTrigger.addEventListener("refresh", onRefresh);
  render();

  return () => {
    ScrollTrigger.removeEventListener("refresh", onRefresh);
    tween.scrollTrigger?.kill();
    tween.kill();
    delete root.dataset.live;
    rows.forEach((r) => delete r.dataset.state);
    fills.forEach((f) => (f.style.transform = ""));
  };
}

/* --------------------------------------------------------------------------
   /for-clinics: the price splits as you scroll.
   The whole session price sits at the top of the economics card. As the card
   comes up the screen, a copy of each share slides from its place in the whole
   bar into its own row and lands exactly on that row's bar (the same fraction
   of the price in both places, so the same width). It fades to a ghost while
   it crosses the rows above; its part of the whole dims while it is away and is
   full again once it lands, so the price is never shown empty.
   -------------------------------------------------------------------------- */
export function split(card: HTMLElement): Cleanup {
  const whole = card.querySelector<HTMLElement>("[data-split-whole]");
  const rows = all(card, "[data-split-row]");
  if (!whole || !rows.length) return () => {};
  gsap.registerPlugin(ScrollTrigger);
  const parts = [...whole.children] as HTMLElement[];
  const pieces = rows.map((row) => {
    const p = document.createElement("i");
    p.setAttribute("aria-hidden", "true");
    Object.assign(p.style, {
      position: "absolute",
      borderRadius: "999px",
      pointerEvents: "none",
      willChange: "transform",
      background: row.dataset.color ?? "",
    });
    card.appendChild(p);
    return p;
  });
  card.dataset.live = "";

  let geo: Array<{ fromX: number; fromY: number }> = [];
  const measure = () => {
    const c = card.getBoundingClientRect();
    const w = whole.getBoundingClientRect();
    let acc = 0;
    geo = rows.map((row, i) => {
      // The row's own bar: FillBar's track (role="img").
      const t = (row.querySelector("[role='img']") ?? row).getBoundingClientRect();
      const pct = Number(row.dataset.pct ?? 0) / 100;
      Object.assign(pieces[i].style, {
        left: `${t.left - c.left}px`,
        top: `${t.top - c.top}px`,
        width: `${t.width * pct}px`,
        height: `${t.height}px`,
      });
      const g = { fromX: w.left - t.left + acc * w.width, fromY: w.top - t.top };
      acc += pct;
      return g;
    });
  };
  measure();

  const tl = gsap.timeline({
    defaults: { ease: "power2.inOut" },
    scrollTrigger: {
      trigger: card,
      start: "top 78%",
      end: "bottom 52%",
      scrub: 0.5,
      invalidateOnRefresh: true,
      onRefreshInit: measure,
    },
  });
  tl.to({}, { duration: 0.25 }, 0); // the whole bar is read first
  pieces.forEach((p, i) => {
    const at = 0.25 + i * 0.14;
    tl.fromTo(p, { x: () => geo[i].fromX, y: () => geo[i].fromY }, { x: 0, y: 0, duration: 0.5 }, at);
    tl.fromTo(p, { opacity: 1 }, { opacity: 0.22, duration: 0.12, ease: "power1.out" }, at + 0.04);
    tl.to(p, { opacity: 1, duration: 0.14, ease: "power1.in" }, at + 0.36);
    if (parts[i]) {
      tl.fromTo(parts[i], { opacity: 1 }, { opacity: 0.3, duration: 0.08, ease: "none" }, at);
      tl.to(parts[i], { opacity: 1, duration: 0.1, ease: "none" }, at + 0.5);
    }
  });

  return () => {
    tl.scrollTrigger?.kill();
    tl.kill();
    pieces.forEach((p) => p.remove());
    parts.forEach((x) => (x.style.opacity = ""));
    delete card.dataset.live;
  };
}

/* --------------------------------------------------------------------------
   /about: the mission statement lights up as you read it.
   Editable copy, so its words are wrapped at run time, whatever the text is.
   Each turns from the muted ink to full ink in reading order as the paragraph
   crosses the screen. The text itself never changes.
   -------------------------------------------------------------------------- */
export function lit(p: HTMLElement): Cleanup {
  gsap.registerPlugin(ScrollTrigger);
  const original = p.innerHTML;
  const words: HTMLElement[] = [];
  const wrap = (node: Node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        (n.textContent ?? "").split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) return void frag.appendChild(document.createTextNode(part));
          const s = document.createElement("span");
          s.textContent = part;
          words.push(s);
          frag.appendChild(s);
        });
        (n as ChildNode).replaceWith(frag);
      } else if (n.nodeType === Node.ELEMENT_NODE) wrap(n);
    });
  };
  wrap(p);
  // GSAP blends real colours, not var() strings: resolve the two tokens.
  const resolve = (v: string) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${v})`;
    p.appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  };
  const tw = gsap.fromTo(
    words,
    { color: resolve("--color-ink-3") },
    {
      color: resolve("--color-ink"),
      ease: "none",
      stagger: 0.12,
      scrollTrigger: { trigger: p, start: "top 78%", end: "bottom 48%", scrub: 0.4 },
    }
  );
  return () => {
    tw.scrollTrigger?.kill();
    tw.kill();
    p.innerHTML = original;
  };
}

/* --------------------------------------------------------------------------
   /how-it-works: a thread draws through the seven people as you read.
   A reading line at mid-screen moves through the step list. The thread in the
   gutter grows from the first numbered circle to the last; circles above the
   line are ringed, the one being read is filled; the sticky picture
   cross-dissolves into the next over the last 18% of a step and settles
   (scale 1.05 to 1) while its step is read; the bars under it follow.
   -------------------------------------------------------------------------- */
export function thread(root: HTMLElement): Cleanup {
  const list = root.querySelector<HTMLElement>("[data-st-list]");
  const items = all(root, "[data-st-item]");
  const pics = all(root, "[data-st-pic]");
  const bars = all(root, "[data-st-bar]");
  const line = root.querySelector<HTMLElement>("[data-st-thread]");
  const ink = root.querySelector<HTMLElement>("[data-st-thread-ink]");
  const dots = items.map((li) => li.querySelector<HTMLElement>("[data-st-dot]"));
  if (!list || !items.length || !line || !ink || dots.some((d) => !d)) return () => {};
  gsap.registerPlugin(ScrollTrigger);
  root.dataset.live = "";

  let box: Array<{ t: number; h: number }> = [],
    dotY: number[] = [],
    c0 = 0,
    c1 = 1;
  const layout = () => {
    const lr = list.getBoundingClientRect();
    box = items.map((li) => {
      const r = li.getBoundingClientRect();
      return { t: r.top - lr.top, h: r.height };
    });
    dotY = dots.map((d) => {
      const r = d!.getBoundingClientRect();
      return r.top + r.height / 2 - lr.top;
    });
    c0 = dotY[0];
    c1 = dotY[dotY.length - 1];
    const d0 = dots[0]!.getBoundingClientRect();
    Object.assign(line.style, {
      top: `${c0}px`,
      height: `${Math.max(c1 - c0, 1)}px`,
      left: `${d0.left - lr.left + d0.width / 2 - 0.75}px`,
    });
  };

  const state = { p: 0 };
  let lastKey = "";
  const render = () => {
    const y = state.p * list.offsetHeight;
    ink.style.transform = `scaleY(${Math.min(1, Math.max(0, (y - c0) / (c1 - c0))).toFixed(4)})`;
    let cur = 0,
      frac = 0;
    for (let i = 0; i < box.length; i++) {
      if (y >= box[i].t) {
        cur = i;
        frac = Math.min(1, (y - box[i].t) / box[i].h);
      }
    }
    const key = `${cur}:${frac.toFixed(3)}`;
    if (key === lastKey) return;
    lastKey = key;
    items.forEach((li, k) => {
      const s = k === cur ? "current" : y >= dotY[k] ? "done" : "ahead";
      if (li.dataset.state !== s) li.dataset.state = s;
    });
    bars.forEach((b, k) => (b.dataset.on = k <= cur ? "1" : "0"));
    const X = 0.18;
    let mix = cur < pics.length - 1 ? Math.max(0, (frac - (1 - X)) / X) : 0;
    mix = mix * mix * (3 - 2 * mix);
    pics.forEach((pic, k) => {
      const o = k === cur ? 1 : k === cur + 1 ? mix : 0;
      pic.style.opacity = o.toFixed(3);
      pic.style.transform = `scale(${(1.05 - 0.05 * (k === cur ? frac : 0)).toFixed(4)})`;
      pic.style.zIndex = k === cur + 1 ? "2" : k === cur ? "1" : "0";
      pic.setAttribute("aria-hidden", k === cur ? "false" : "true");
    });
  };

  layout();
  const tween = gsap.fromTo(
    state,
    { p: 0 },
    {
      p: 1,
      ease: "none",
      onUpdate: render,
      scrollTrigger: { trigger: list, start: "top 50%", end: "bottom 50%", scrub: 0.4, invalidateOnRefresh: true },
    }
  );
  const onRefresh = () => {
    layout();
    lastKey = "";
    render();
  };
  ScrollTrigger.addEventListener("refresh", onRefresh);
  render();

  return () => {
    ScrollTrigger.removeEventListener("refresh", onRefresh);
    tween.scrollTrigger?.kill();
    tween.kill();
    delete root.dataset.live;
    items.forEach((li) => delete li.dataset.state);
    pics.forEach((pic) => {
      pic.style.opacity = "";
      pic.style.transform = "";
      pic.style.zIndex = "";
    });
  };
}

export const EFFECTS = { checklist, split, lit, thread } as const;
export type EffectName = keyof typeof EFFECTS;

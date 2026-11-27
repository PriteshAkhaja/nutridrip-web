"use client";

import { useLayoutEffect, useRef } from "react";
import type { HomeData } from "@/lib/data/home-v5";
import { HOME_V5_HTML } from "./port/markup";
import { HOME_V5_BOOT } from "./port/boot";
import { homeBootData } from "./boot-data";

type Mount = (el: HTMLElement, data: HomeData) => () => void;
declare global {
  interface Window {
    __ndHome?: { mount: Mount };
    __ndHomeData?: HomeData;
  }
}
/** The wrapper, as the boot script leaves it when it has already mounted the page during the page load. */
type Wrapper = HTMLDivElement & { __ndRun?: () => void };

/** The page's script, running on one element with one set of data, and its pending teardown if it is being left. */
type Running = { data: HomeData; destroy: () => void; leaving: ReturnType<typeof setTimeout> | null; dead: boolean };
const running = new WeakMap<HTMLElement, Running>();

/** The page script: already loaded with the page, or fetched now (a client-side navigation runs no page scripts). */
let loading: Promise<Mount> | null = null;
function pageScript(): Promise<Mount> {
  if (window.__ndHome) return Promise.resolve(window.__ndHome.mount);
  loading ??= new Promise<Mount>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = HOME_V5_BOOT;
    s.onload = () => (window.__ndHome ? resolve(window.__ndHome.mount) : reject(new Error("home script did not load")));
    s.onerror = () => {
      loading = null;
      reject(new Error("home script did not load"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * After the markup, inside it: the page's data, then the page script. On a page load the browser runs them as it
 * reads the page, before the first paint (parser-blocking on purpose). On a client-side navigation React sets this
 * HTML with innerHTML, where scripts never run, and the component mounts the page itself.
 */
const boot = (data: HomeData) =>
  `<script>${homeBootData(data)}</script><script src="${HOME_V5_BOOT}" data-auto="1"></script>`;

/**
 * The home page: the markup ported from the preview (scrollcraft/builds/home-v5, `npm run home-port`), served as
 * HTML so every word is there before any script, and its script run over it with the app's data.
 *
 * On a page load the script, sent at the end of this markup (boot), runs as the page is read, so it builds and places the ring
 * before the first paint and the ring arrives with the heading; this component then adopts the running page. On a
 * client-side navigation it loads the script and mounts it itself; the ring and its caption wait unseen
 * (is-waiting) and then make their entrance (ring-late).
 *
 * Leaving the page calls the script's destroy(), which stops everything it started and puts the markup back as
 * served. The teardown waits one tick: React mounts, unmounts and mounts again at once in development, and tearing
 * down there would rebuild the hero and restart its opening. A mount that comes straight back to the same element
 * with the same data keeps the running script.
 */
export function HomeV5({ data }: { data: HomeData }) {
  const ref = useRef<Wrapper>(null);
  // A layout effect, so on a client-side navigation the still version (reduced motion, a phone held sideways) is in
  // place before the first paint.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let run = running.get(el);
    if (run && run.data === data && run.leaving) {
      clearTimeout(run.leaving);
      run.leaving = null;
    } else if (!run && el.__ndRun) {
      // the boot script mounted it during the page load
      run = { data, destroy: el.__ndRun, leaving: null, dead: false };
      el.__ndRun = undefined;
      running.set(el, run);
      el.classList.remove("is-waiting");
    } else {
      if (run) {
        if (run.leaving) clearTimeout(run.leaving);
        run.dead = true;
        run.destroy();
      }
      const mine: Running = { data, destroy: () => {}, leaving: null, dead: false };
      running.set(el, mine);
      run = mine;
      const start = (mount: Mount, late: boolean) => {
        if (mine.dead) return;
        mine.destroy = mount(el, data);
        el.classList.remove("is-waiting");
        // only if the script had to be fetched: the ring arrives after the rest, so it fades in
        if (late) el.classList.add("ring-late");
      };
      if (window.__ndHome) start(window.__ndHome.mount, false);
      else
        pageScript().then(
          (mount) => start(mount, true),
          (e: unknown) => console.error(e)
        );
    }
    const mine = run;
    return () => {
      mine.leaving = setTimeout(() => {
        mine.dead = true;
        mine.destroy();
        if (running.get(el) === mine) running.delete(el);
      }, 0);
    };
  }, [data]);
  return (
    <div
      ref={ref}
      className="hv5 js is-waiting"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: HOME_V5_HTML + boot(data) }}
    />
  );
}

"use client";

import { useLayoutEffect, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import type { CatalogueDrip } from "@/lib/data/assembly";
import type { SiteImage } from "@/lib/site-images";
import { matchesDrip, noMatchMessage } from "@/lib/data/drip-search";
import { Fcard } from "@/components/site/v3/Fcard";

export type ListDrip = {
  drip: CatalogueDrip;
  /** What a search finds it by, beyond its name and goal: ingredients, tags, tagline. */
  keywords: string[];
  photo: SiteImage | null;
  stock: number | null;
};

const GLIDE = "transform 320ms cubic-bezier(.2,.7,.2,1), opacity 240ms cubic-bezier(.2,.7,.2,1)";

/**
 * The Drips list's chips, search and grid (approved prototype:
 * scrollcraft/builds/drips-v3). The address is the state (?goal=&q=): a chip
 * or the search box updates it in place (the native history API, which the
 * Next router follows), and the grid is filtered from it, so a filtered list
 * can be shared and Back and Forward step through the filters. Without the
 * script, the chips are links and the search a form, and the server answers
 * them with the same filter. The search is the app's own (drip-search.ts),
 * the one every drip picker uses. The cards that stay glide to their new
 * places; the heading above comes from the server as children.
 */
export function DripsBrowser({
  drips,
  goals,
  children,
}: {
  drips: ListDrip[];
  /** Goals that have a drip, with their counts, in the app's order. */
  goals: Array<{ name: string; count: number }>;
  children: ReactNode;
}) {
  const params = useSearchParams();
  const asked = params.get("goal") ?? "";
  const goal = goals.some((g) => g.name === asked) ? asked : "";
  const q = params.get("q") ?? "";

  // The box shows what is typed at once; the address follows a beat later.
  // Back and Forward change the address, and the box follows it.
  const [text, setText] = useState(q);
  const [seenQ, setSeenQ] = useState(q);
  if (q !== seenQ) {
    setSeenQ(q);
    setText(q);
  }

  const total = drips.length;
  const shown = drips.filter(
    (x) =>
      (!goal || x.drip.category === goal) &&
      matchesDrip({ name: x.drip.name, category: x.drip.category ?? undefined, keywords: x.keywords }, q)
  );
  const visible = new Set(shown.map((x) => x.drip.slug));

  const href = (g: string, t: string) => {
    const p = new URLSearchParams();
    if (g) p.set("goal", g);
    if (t.trim()) p.set("q", t.trim());
    const qs = p.toString();
    return qs ? `/drips?${qs}` : "/drips";
  };

  // The glide: where each showing card sits before a change (First), then,
  // once the grid has re-laid (Last), each is moved back and let go.
  const cards = useRef(new Map<string, HTMLElement>());
  const first = useRef<Map<string, DOMRect> | null>(null);
  function go(g: string, t: string, push: boolean) {
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const at = new Map<string, DOMRect>();
      cards.current.forEach((el, slug) => {
        if (!el.hidden) at.set(slug, el.getBoundingClientRect());
      });
      first.current = at;
    }
    window.history[push ? "pushState" : "replaceState"](null, "", href(g, t));
  }
  useLayoutEffect(() => {
    const before = first.current;
    first.current = null;
    if (!before) return;
    cards.current.forEach((el, slug) => {
      if (el.hidden) return;
      const was = before.get(slug);
      const now = el.getBoundingClientRect();
      el.style.transition = "none";
      if (was) {
        const dx = was.left - now.left;
        const dy = was.top - now.top;
        if (!dx && !dy) return;
        el.style.transform = `translate(${dx}px,${dy}px)`;
      } else {
        el.style.opacity = "0";
        el.style.transform = "translateY(10px)";
      }
      void el.offsetWidth;
      el.style.transition = GLIDE;
      el.style.transform = "";
      el.style.opacity = "";
    });
  }, [goal, q]);

  const typing = useRef(0);
  const onType = (v: string) => {
    setText(v);
    clearTimeout(typing.current);
    typing.current = window.setTimeout(() => go(goal, v, false), 120);
  };
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearTimeout(typing.current);
    go(goal, text, false);
    e.currentTarget.querySelector("input")?.blur();
  };
  // A plain click is handled here; a click meant for a new tab keeps the link's own behaviour.
  const own = (e: MouseEvent) => !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button);
  const pick = (g: string) => (e: MouseEvent) => {
    if (!own(e)) return;
    e.preventDefault();
    clearTimeout(typing.current);
    go(g, text, true);
  };
  const clear = (e: MouseEvent) => {
    if (!own(e)) return;
    e.preventDefault();
    clearTimeout(typing.current);
    setText("");
    go(goal, "", true);
  };

  const chip = (g: string, label: string, n: number) => (
    <li key={label}>
      <a className="dl-chip" href={href(g, q)} aria-current={g === goal ? "page" : undefined} onClick={pick(g)}>
        {label}
        <span>{n}</span>
      </a>
    </li>
  );

  return (
    <>
      <section className="nd-pagehead dl-head">
        <div className="nd-wrap">
          {children}
          <div className="dl-tools">
            <form className="dl-search" role="search" action="/drips" method="get" onSubmit={onSubmit}>
              <label className="visually-hidden" htmlFor="dl-q">
                Search drips
              </label>
              <input
                id="dl-q"
                name="q"
                type="search"
                placeholder="Search by name, goal or ingredient"
                autoComplete="off"
                enterKeyHint="search"
                value={text}
                onChange={(e) => onType(e.target.value)}
              />
              {goal ? <input type="hidden" name="goal" value={goal} /> : null}
            </form>
            <nav className="dl-goals" aria-label="Filter by goal">
              <ul>
                {chip("", "All", total)}
                {goals.map((g) => chip(g.name, g.name, g.count))}
              </ul>
            </nav>
          </div>
          <p className="dl-count" aria-live="polite">
            {shown.length === total ? `Showing all ${total} drips` : `Showing ${shown.length} of ${total} drips`}
          </p>
        </div>
      </section>

      <section className="dl-list" aria-label="Drips">
        <div className="nd-wrap">
          <div className="dl-grid">
            {drips.map((x, k) => (
              <Fcard
                key={x.drip.slug}
                d={x.drip}
                k={k}
                photo={x.photo}
                stock={x.stock}
                hidden={!visible.has(x.drip.slug)}
                ref={(el: HTMLElement | null) => {
                  if (el) cards.current.set(x.drip.slug, el);
                  else cards.current.delete(x.drip.slug);
                }}
              />
            ))}
          </div>
          {shown.length ? null : (
            <div className="dl-none">
              <p>{noMatchMessage(q)}</p>
              <a className="nd-btn nd-btn--ghost" href={href(goal, "")} onClick={clear}>
                Clear the search
              </a>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

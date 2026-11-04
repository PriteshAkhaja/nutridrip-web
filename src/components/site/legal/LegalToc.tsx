"use client";

import { useEffect, useState } from "react";

/**
 * "On this page" beside a legal document, marking the section being read: the
 * last whose heading has passed the top third of the screen (the last one at
 * the very bottom of the page). A click marks its section at once, before the
 * scroll arrives. Without the script it is a plain list of links.
 */
export function LegalToc({ items }: { items: Array<{ id: string; label: string }> }) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  useEffect(() => {
    let ticking = false;
    const pick = () => {
      ticking = false;
      const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
      let now = items[0]?.id ?? "";
      for (const it of items) {
        const el = document.getElementById(it.id);
        if (el && el.getBoundingClientRect().top <= innerHeight * 0.33) now = it.id;
      }
      if (atEnd && items.length) now = items[items.length - 1].id;
      setActive(now);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(pick);
    };
    pick();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => {
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
    };
  }, [items]);

  return (
    <nav aria-label="On this page" className="lg-toc">
      <p className="nd-tag">On this page</p>
      <ol>
        {items.map((it) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              aria-current={active === it.id ? "location" : undefined}
              onClick={() => setActive(it.id)}
            >
              {it.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

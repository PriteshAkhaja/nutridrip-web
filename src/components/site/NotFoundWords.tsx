"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** A drip's own page: a dead one is most likely a drip that was retired. */
const DRIP_PAGE = /^\/drips\/[^/]+\/?$/;

const WORDS = {
  page: {
    tag: "Page not found",
    head: "We could not find that page.",
    body: "The address may be mistyped, or the page may have moved. Everything on the site is one click from here.",
    back: { label: "Home page", href: "/" },
  },
  drip: {
    tag: "Drip not found",
    head: "That drip is not on the list.",
    body: "It may have been retired, or the address may be mistyped. Every drip on offer today is on the Drips page.",
    back: { label: "See all drips", href: "/drips" },
  },
};

/**
 * The 404's words, by the address it was asked for: a not-found page gets no
 * params, and only the address tells a dead drip link from any other.
 * `primary` is the way on, decided on the server (NotFound).
 */
export function NotFoundWords({ primary }: { primary: React.ReactNode }) {
  const w = DRIP_PAGE.test(usePathname() ?? "") ? WORDS.drip : WORDS.page;
  return (
    <>
      <p className="nd-tag">404 · {w.tag}</p>
      <h1 className="nd-q">{w.head}</h1>
      <p className="nd-lede">{w.body}</p>
      <div className="nf__go">
        {primary}
        <Link className="nd-btn nd-btn--ghost" href={w.back.href} prefetch={false}>
          {w.back.label}
        </Link>
      </div>
    </>
  );
}

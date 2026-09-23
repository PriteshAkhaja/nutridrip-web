import type { ReactNode } from "react";
import Link from "next/link";

/**
 * A person's name that opens their page.
 *
 * Plain ink until it is pointed at, then the brand colour and an underline: a
 * table of names is not a table of blue links, but a name that goes somewhere
 * should say so the moment you reach for it.
 *
 * Only ever pass `href` for a page the reader is allowed to open. Whether to link
 * a name at all is the caller's decision, made from the role -- this component
 * does not know who is looking, and a link to a page that refuses them is worse
 * than no link.
 */
export function NameLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="font-medium text-[var(--color-ink)] no-underline hover:underline hover:text-[var(--color-primary)] focus-visible:underline"
    >
      {children}
    </Link>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The header's page links; the current page (or its section) is marked. */
export function SiteNav({ links }: { links: Array<[label: string, href: string]> }) {
  const pathname = usePathname();
  return (
    <nav className="nd-bar__nav" aria-label="Site">
      {links.map(([label, href]) => (
        <Link
          key={href}
          href={href}
          prefetch={false}
          aria-current={pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

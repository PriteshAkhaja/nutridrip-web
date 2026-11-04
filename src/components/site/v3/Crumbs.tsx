import Link from "next/link";

/** One step after Home; the last is the page itself and takes no link. */
export type Crumb = { name: string; href?: string };

/**
 * Where a page sits: Home, then its trail, the current page last. The client's
 * design opens every page with it. It earns its place for a visitor who lands
 * on an inner page from a search, and it gives search engines the same trail
 * as BreadcrumbList data (absolute URLs from SITE_URL, as the metadata uses).
 */
export function Crumbs({ trail }: { trail: Crumb[] }) {
  const base = process.env.SITE_URL ?? "http://localhost:3000";
  const steps: Crumb[] = [{ name: "Home", href: "/" }, ...trail];
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: steps.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: s.name,
      ...(s.href ? { item: new URL(s.href, base).toString() } : {}),
    })),
  };
  return (
    <nav className="nd-crumbs" aria-label="Breadcrumb">
      <ol>
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          return (
            <li key={`${s.name}-${i}`} aria-current={last ? "page" : undefined}>
              {last || !s.href ? (
                <span>{s.name}</span>
              ) : (
                <Link href={s.href} prefetch={false} className={i === 0 ? "nd-crumbs__home" : undefined}>
                  {i === 0 ? (
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                      <path
                        d="M2.5 7.2 8 2.8l5.5 4.4V13a.5.5 0 0 1-.5.5H9.6V10H6.4v3.5H3a.5.5 0 0 1-.5-.5Z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                  {s.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
      />
    </nav>
  );
}

import Link from "next/link";
import { Wordmark } from "@/components/site/v3/Wordmark";
import { ClientTheme } from "./ClientTheme";

const LEGAL: Array<[string, string]> = [
  ["Terms", "/legal/terms"],
  ["Privacy", "/legal/privacy"],
  ["Grievance officer", "/legal/grievance"],
];

/**
 * Sign-in (/login) and a new patient's address step (/welcome), in the
 * client's design (ClientTheme, styles/account.css): the wordmark and the
 * site's ground around the form, without the site's header and footer, so
 * nothing on the page competes with it. `end` is the right of the bar (the
 * way back to the site, or Sign out); `layout` sizes the column.
 */
export function AccountFrame({
  children,
  end,
  layout = "narrow",
}: {
  children: React.ReactNode;
  end?: React.ReactNode;
  layout?: "narrow" | "wide" | "demo";
}) {
  return (
    <ClientTheme>
      <header className="acc-bar">
        <Link className="nd-mark-link" href="/" prefetch={false} aria-label="NutriDrip, IV nutrient therapy, home">
          <Wordmark />
        </Link>
        {end ?? (
          <Link className="acc-back" href="/" prefetch={false}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M13 8H3.5M7.5 4l-4 4 4 4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back to the site
          </Link>
        )}
      </header>
      <main id="main" className={`acc-main${layout === "narrow" ? "" : ` acc-main--${layout}`}`}>
        {children}
      </main>
      <footer className="acc-foot">
        {LEGAL.map(([label, href]) => (
          <Link key={href} href={href} prefetch={false}>
            {label}
          </Link>
        ))}
      </footer>
    </ClientTheme>
  );
}

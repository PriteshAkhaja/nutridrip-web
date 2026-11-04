import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { HOME_FOR_ROLE } from "@/lib/auth/rbac";
import { Cta } from "@/components/site/v3/Cta";
import { NotFoundWords } from "./NotFoundWords";

/** The main pages, each with what it is for: the way on from a dead link. */
const PAGES: Array<{ name: string; href: string; what: string }> = [
  { name: "Drips", href: "/drips", what: "Every drip, and what is in each bag" },
  { name: "How it works", href: "/how-it-works", what: "A session, from the quiz to the report" },
  { name: "Pricing", href: "/pricing", what: "What a session costs" },
  { name: "Safety", href: "/safety", what: "The checks before and during a session" },
  { name: "Zones", href: "/zones", what: "Whether we come to your pincode" },
  { name: "FAQs", href: "/faqs", what: "The usual questions, answered" },
  { name: "Ask a clinician", href: "/consult", what: "A question for our clinical team" },
];

/**
 * "Page not found", in the client's design (app/not-found.tsx, inside
 * SiteShell): any unknown address, and any notFound() — a drip that is
 * retired, hidden or mistyped, a legal page that is not one, a record in a
 * console. What happened (NotFoundWords, by the address), a way on, and the
 * main pages. For reading, so no scroll motion (AGENTS.md, "None").
 *
 * The way on is the quiz for a visitor, and their own dashboard for anyone
 * signed in, as in the header: a nurse who follows a stale link to a session
 * is sent back to their work, not to the quiz.
 */
export async function NotFound() {
  const session = await getSession();
  const firstName = session?.name?.trim().split(/\s+/)[0] ?? "";
  const home = session ? (HOME_FOR_ROLE[session.role] ?? "/login") : null;

  return (
    <section className="nd-pagehead nf">
      <div className="nd-wrap nf__grid">
        <div className="nf__words">
          <NotFoundWords
            primary={
              home ? (
                <Link className="nd-btn" href={home} prefetch={false}>
                  {firstName ? `${firstName}'s dashboard` : "Your dashboard"}
                </Link>
              ) : (
                <Cta />
              )
            }
          />
        </div>
        <nav className="nf__pages" aria-labelledby="nf-pages">
          <p className="nd-tag" id="nf-pages">
            Main pages
          </p>
          <ul>
            {PAGES.map((p) => (
              <li key={p.href}>
                <Link href={p.href} prefetch={false}>
                  <span className="nf__name">{p.name}</span>
                  <span className="nf__what">{p.what}</span>
                  <svg className="nf__arrow" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path
                      d="M3 8h9.5M8.5 4l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  );
}

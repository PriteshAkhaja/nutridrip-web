import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { HOME_FOR_ROLE } from "@/lib/auth/rbac";
import { getContent } from "@/lib/content";
import { getZones } from "@/lib/zones-store";
import { servedZones } from "@/lib/zones";
import { Wordmark } from "@/components/site/v3/Wordmark";
import { Cta } from "@/components/site/v3/Cta";
import { SiteNav } from "@/components/site/v3/SiteNav";
import { SiteLedger } from "@/components/site/v3/SiteLedger";

/**
 * The public site's header and footer, in the client's design (ported from
 * the approved prototype, scrollcraft/builds/home-v3). Styled by the scoped
 * site stylesheet (components/site/v3/styles); the (site) layout wraps every
 * public page in .sc-site so the styles reach nowhere else.
 */

const NAV: Array<[string, string]> = [
  ["Drips", "/drips"],
  ["How it works", "/how-it-works"],
  ["Pricing", "/pricing"],
  ["Safety", "/safety"],
  ["IV vs Tablets", "/iv-vs-tablets"],
  ["Zones", "/zones"],
  ["For clinics", "/for-clinics"],
];

/** Every page link, for the menu where the nav links do not fit. */
const MENU: Array<[string, string]> = [
  ["All drips", "/drips"],
  ["How it works", "/how-it-works"],
  ["Pricing", "/pricing"],
  ["Safety", "/safety"],
  ["IV vs Tablets", "/iv-vs-tablets"],
  ["Zones", "/zones"],
  ["About", "/about"],
  ["For clinics", "/for-clinics"],
];

const FOOTER_PAGES: Array<[string, string]> = [
  ["Drips", "/drips"],
  ["How it works", "/how-it-works"],
  ["Pricing", "/pricing"],
  ["Safety", "/safety"],
  ["IV vs Tablets", "/iv-vs-tablets"],
  ["Zones", "/zones"],
  ["About", "/about"],
  ["FAQs", "/faqs"],
  ["Ask a clinician", "/consult"],
  ["For clinics", "/for-clinics"],
  ["Terms", "/legal/terms"],
  ["Privacy", "/legal/privacy"],
  ["Grievance officer", "/legal/grievance"],
];

export async function SiteHeader() {
  const session = await getSession();
  const firstName = session?.name?.trim().split(/\s+/)[0] ?? "";
  const account = session
    ? { label: firstName ? `${firstName}'s dashboard` : "Your dashboard", href: HOME_FOR_ROLE[session.role] }
    : { label: "Sign in", href: "/login" };

  return (
    <>
      <a className="nd-skip" href="#main">
        Skip to content
      </a>
      <header className="nd-bar">
        <div className="nd-bar__in">
          <Link className="nd-mark-link" href="/" prefetch={false} aria-label="NutriDrip, IV nutrient therapy, home">
            <Wordmark />
          </Link>
          <SiteNav links={NAV} />
          <div className="nd-bar__end">
            <SiteLedger pages={MENU} />
            <div className="nd-bar__book">
              <Link className="nd-btn nd-btn--account" href={account.href} prefetch={false}>
                {account.label}
              </Link>
            </div>
            <div className="nd-bar__book">
              <Cta label="Take the quiz" note="Physician-reviewed before every session" compact />
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

export async function SiteFooter() {
  const [copy, zones] = await Promise.all([getContent(), getZones()]);
  const served = servedZones(zones);

  return (
    <footer className="nd-foot">
      <div className="nd-wrap">
        <div className="nd-foot__grid">
          <div>
            <Link className="nd-mark-link" href="/" prefetch={false} aria-label="NutriDrip, home">
              <Wordmark />
            </Link>
            <p className="nd-small" style={{ marginTop: "1rem", maxWidth: "36ch" }}>
              IV nutrient therapy at home in Bengaluru, reviewed by a registered physician and given by a
              council-registered nurse.
            </p>
            <p className="nd-small" style={{ marginTop: ".8rem" }}>
              {copy["footer.legalName"]} · Clinical establishment reg. {copy["footer.registration"]}
            </p>
          </div>
          <div>
            <h3>Now serving</h3>
            {served.length ? (
              <ul className="nd-foot__zones">
                {served.map((z) => (
                  <li key={z.name}>{z.name}</li>
                ))}
              </ul>
            ) : (
              <p className="nd-small">
                <Link href="/zones" prefetch={false}>
                  See where we serve
                </Link>
              </p>
            )}
          </div>
          <nav aria-label="Pages">
            <h3>Pages</h3>
            <ul>
              {FOOTER_PAGES.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} prefetch={false}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="nd-foot__legal">
          <p>
            <b>IV nutrient therapy is a medical procedure.</b> Every protocol is reviewed by a registered physician
            before anything is booked, and may not be suitable for everyone. {copy["footer.emergency"]}
          </p>
          <p>
            © {new Date().getFullYear()} {copy["footer.legalName"]}
          </p>
        </div>
      </div>
    </footer>
  );
}

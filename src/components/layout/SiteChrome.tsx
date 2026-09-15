import Link from "next/link";
import { Logo } from "./Logo";
import { ButtonLink } from "@/components/ui/Button";
import { getSession } from "@/lib/auth/session";
import { HOME_FOR_ROLE } from "@/lib/auth/rbac";
import { getContent } from "@/lib/content";
import { MobileNav } from "./MobileNav";

const NAV = [
  { label: "Drips", href: "/drips" },
  { label: "Pricing", href: "/pricing" },
  { label: "Safety", href: "/safety" },
  { label: "Zones", href: "/zones" },
  { label: "For clinics", href: "/for-clinics" },
];

export async function SiteHeader() {
  const session = await getSession();

  return (
    <header className="sticky top-0 z-40">
      <div
        className="border-b"
        style={{ background: "var(--color-ink)", borderColor: "var(--color-ink)" }}
      >
        <div className="mx-auto max-w-[1280px] px-6 md:px-10 py-[7px] flex items-center justify-center gap-3 flex-wrap">
          <span className="t-small" style={{ color: "rgba(255,255,255,.86)" }}>
            Physician-reviewed before every session · 14 zones across Bengaluru
          </span>
          <Link
            href="/safety"
            className="t-small font-semibold no-underline hover:underline"
            style={{ color: "var(--color-primary-on-dark)" }}
          >
            How we keep it safe →
          </Link>
        </div>
      </div>

      <div className="relative border-b border-[var(--color-line)] bg-[var(--color-paper)]">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10 py-[14px] flex items-center gap-8">
        <Logo />

        <nav className="hidden lg:flex gap-[26px] items-center" aria-label="Main">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="t-body font-medium text-[var(--color-ink-2)] hover:text-[var(--color-ink)] no-underline hover:no-underline"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex gap-[10px] items-center">
          <span className="hidden md:inline t-data text-[13px] text-[var(--color-ink-2)]">Bengaluru</span>
          <span className="hidden sm:inline-flex">
            {session ? (
              <ButtonLink href={HOME_FOR_ROLE[session.role]} variant="secondary">
                {session.name.split(" ")[0]}&apos;s dashboard
              </ButtonLink>
            ) : (
              <ButtonLink href="/login" variant="secondary">
                Sign in
              </ButtonLink>
            )}
          </span>
          <ButtonLink href="/quiz">Take the quiz</ButtonLink>
          <MobileNav
            links={NAV}
            account={
              session
                ? { label: `${session.name.split(" ")[0]}'s dashboard`, href: HOME_FOR_ROLE[session.role] }
                : { label: "Sign in", href: "/login" }
            }
          />
        </div>
        </div>
      </div>
    </header>
  );
}

export async function SiteFooter() {
  const copy = await getContent();

  return (
    <footer className="bg-[var(--color-ink)] px-6 md:px-10 py-8">
      <div className="mx-auto max-w-[1280px] flex justify-between gap-8 flex-wrap">
        <div className="flex flex-col gap-[6px]">
          <span className="text-[var(--color-paper)]" style={{ font: "600 16px/1 var(--font-display)" }}>
            {copy["footer.legalName"]}
          </span>
          <span className="t-small" style={{ color: "var(--color-ink-on-dark)" }}>
            Clinical establishment reg. <span className="t-data">{copy["footer.registration"]}</span>
          </span>
          <span className="t-small" style={{ color: "var(--color-ink-on-dark)" }}>
            {copy["footer.emergency"]}
          </span>
        </div>

        <div className="flex gap-12">
          <div className="flex flex-col gap-[7px]">
            <span className="t-micro" style={{ color: "var(--color-ink-on-dark)" }}>Service</span>
            {[
              ["Drips", "/drips"],
              ["Pricing", "/pricing"],
              ["Zones", "/zones"],
            ].map(([label, href]) => (
              <Link key={href} href={href} className="t-small text-[var(--color-paper)] no-underline hover:underline">
                {label}
              </Link>
            ))}
          </div>
          <div className="flex flex-col gap-[7px]">
            <span className="t-micro" style={{ color: "var(--color-ink-on-dark)" }}>Legal</span>
            {[
              ["Terms", "/legal/terms"],
              ["Privacy", "/legal/privacy"],
              ["Grievance officer", "/legal/grievance"],
            ].map(([label, href]) => (
              <Link key={href} href={href} className="t-small text-[var(--color-paper)] no-underline hover:underline">
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

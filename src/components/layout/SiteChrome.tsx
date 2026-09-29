import Link from "next/link";
import { Logo } from "./Logo";
import { ButtonLink } from "@/components/ui/Button";
import { getSession } from "@/lib/auth/session";
import { HOME_FOR_ROLE } from "@/lib/auth/rbac";
import { getContent } from "@/lib/content";
import { MobileNav } from "./MobileNav";
import { Arrow } from "@/components/ui/Arrow";
import { QuizButton } from "@/components/layout/QuizButton";
import { getZones } from "@/lib/zones-store";
import { servedZones } from "@/lib/zones";
import { HeaderShell, NavLinks } from "@/components/site/HeaderShell";
import { Marquee } from "@/components/site/Marquee";
import { DripsMenu } from "@/components/site/DripsMenu";
import { IconMapPin } from "@/components/site/Icons";
import { listDrips } from "@/lib/data/drips";

const NAV = [
  { label: "Drips", href: "/drips" },
  { label: "How it works", href: "/how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "Safety", href: "/safety" },
  { label: "Zones", href: "/zones" },
  { label: "For clinics", href: "/for-clinics" },
];

export async function SiteHeader() {
  const [session, zones, drips] = await Promise.all([getSession(), getZones(), listDrips()]);
  const zoneCount = servedZones(zones).length;
  const zoneLine = `${zoneCount} ${zoneCount === 1 ? "zone" : "zones"} across Bengaluru`;
  const firstName = session?.name?.trim().split(/\s+/)[0] ?? "";
  const account = session
    ? { label: `${firstName}'s dashboard`, href: HOME_FOR_ROLE[session.role] }
    : { label: "Sign in", href: "/login" };

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[70] focus:rounded-[var(--radius-sm)] focus:bg-[var(--color-ink)] focus:px-4 focus:py-3 focus:text-white focus:no-underline"
      >
        Skip to content
      </a>
      {/* The one-line promise. It scrolls away with the page; only the bar
          below it stays. */}
      <div className="bg-[var(--color-ink)] text-white">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10 py-2 flex items-center justify-center gap-x-3 gap-y-1 flex-wrap text-center">
          {/* The zone count goes on a phone, where the line would otherwise
              wrap to three rows before the page has started. */}
          <span className="t-small text-white/85">
            Physician-reviewed before every session
            <span className="hidden sm:inline">
              {" "}
              <span className="text-white/40">·</span> {zoneLine}
            </span>
          </span>
          <Link
            href="/safety"
            prefetch={false}
            className="t-small font-semibold no-underline hover:underline"
            style={{ color: "var(--color-primary-on-dark)" }}
          >
            How we keep it safe&nbsp;
            <Arrow />
          </Link>
        </div>
      </div>

      <HeaderShell>
        {/* A signed-in patient's button can read "Answer your physician": on a
            phone under 400px that leaves room for the mark but not the word. */}
        <Logo wordmarkClassName={session ? "max-[399px]:hidden" : ""} />

        <NavLinks links={NAV} dripsMenu={<DripsMenu drips={drips} />} />

        <div className="ml-auto flex items-center gap-2">
          <span className="mr-1 hidden items-center gap-[6px] rounded-full bg-[var(--color-surface-2)] px-3 py-[7px] text-[13px] text-[var(--color-ink-2)] 2xl:inline-flex">
            <IconMapPin size={14} />
            Bengaluru
          </span>
          <span className="hidden sm:inline-flex">
            <ButtonLink href={account.href} prefetch={false} variant="secondary" className="whitespace-nowrap">
              {/* A signed-in visitor sees their initial: the header knows them. */}
              {firstName ? (
                <span
                  aria-hidden
                  className="-ml-[6px] hidden h-7 w-7 flex-none items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[12px] font-bold text-[var(--color-primary-text)] 2xl:inline-flex"
                >
                  {firstName.charAt(0).toUpperCase()}
                </span>
              ) : null}
              {account.label}
            </ButtonLink>
          </span>
          <QuizButton compact prefetch={false} className="whitespace-nowrap">
            Take the quiz
          </QuizButton>
          <MobileNav
            links={NAV}
            account={account}
            cta={
              <QuizButton size="lg" block prefetch={false}>
                Take the health quiz
              </QuizButton>
            }
            note={`Physician-reviewed before every session · ${zoneLine}`}
          />
        </div>
      </HeaderShell>
    </>
  );
}

const FOOTER_COLUMNS: Array<{ title: string; links: Array<[string, string]> }> = [
  {
    title: "Service",
    links: [
      ["Drips", "/drips"],
      ["How it works", "/how-it-works"],
      ["Pricing", "/pricing"],
      ["Zones", "/zones"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/about"],
      ["Safety", "/safety"],
      ["FAQs", "/faqs"],
      ["Ask a clinician", "/consult"],
      ["For clinics", "/for-clinics"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Terms", "/legal/terms"],
      ["Privacy", "/legal/privacy"],
      ["Grievance officer", "/legal/grievance"],
    ],
  },
];

export async function SiteFooter() {
  const [copy, zones] = await Promise.all([getContent(), getZones()]);
  const served = servedZones(zones);

  return (
    <footer className="relative overflow-hidden bg-[var(--color-ink)] text-white">
      {/* Where a nurse can come, read out slowly: the one piece of news every
          page can carry. */}
      {served.length > 0 ? (
        <div className="border-b border-white/10">
          <div className="mx-auto flex max-w-[1280px] items-center gap-5 px-6 py-5 md:gap-8 md:px-10">
            <Link
              href="/zones"
              prefetch={false}
              className="inline-flex flex-none items-center gap-2 t-micro no-underline hover:underline"
              style={{ color: "var(--color-primary-on-dark)" }}
            >
              <IconMapPin size={14} />
              Now serving
            </Link>
            <Marquee
              label="Zones we serve"
              className="min-w-0 flex-1"
              fade="var(--color-ink)"
              duration={Math.max(36, served.length * 4)}
              gap={32}
              items={served.map((z) => (
                <span
                  key={z.name}
                  className="inline-flex items-center gap-3 whitespace-nowrap text-white/75"
                  style={{ font: "500 15px/1 var(--font-display)", letterSpacing: "-0.01em" }}
                >
                  <span
                    aria-hidden
                    className="h-[5px] w-[5px] rounded-full bg-[var(--color-primary-on-dark)] opacity-60"
                  />
                  {z.name}
                </span>
              ))}
            />
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-[1280px] px-6 md:px-10 pt-16 md:pt-20">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)] lg:gap-16">
          <div className="flex flex-col gap-5 max-w-[42ch]">
            <Logo tone="light" size={26} />
            <p className="t-body" style={{ color: "var(--color-ink-on-dark)" }}>
              IV nutrient therapy at home in Bengaluru, reviewed by a registered physician and given by a
              council-registered nurse.
            </p>
            <div className="flex flex-col gap-[6px]">
              <span className="text-white" style={{ font: "600 15px/1.3 var(--font-display)" }}>
                {copy["footer.legalName"]}
              </span>
              <span className="t-small" style={{ color: "var(--color-ink-on-dark)" }}>
                Clinical establishment reg. <span className="t-data">{copy["footer.registration"]}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3">
            {FOOTER_COLUMNS.map((col) => (
              <nav key={col.title} aria-label={col.title} className="flex flex-col gap-3">
                <span className="t-micro" style={{ color: "var(--color-ink-on-dark)" }}>
                  {col.title}
                </span>
                <ul className="list-none m-0 p-0 flex flex-col gap-[2px]">
                  {col.links.map(([label, href]) => (
                    <li key={href}>
                      <Link
                        href={href}
                        prefetch={false}
                        className="inline-flex min-h-[36px] items-center text-[15px] text-white/90 no-underline hover:no-underline hover:text-white link-sweep"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        {/* The wordmark, as wide as the page's content at every size and
            whole: a signature closing the footer, not letters falling off the
            bottom of it. The legal line sits under it, so the page plainly
            ends there. */}
        <div aria-hidden className="footer-wordmark pointer-events-none mt-12 select-none md:mt-14">
          <span>NutriDrip</span>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 py-7 md:flex-row md:items-center md:justify-between">
          <p className="t-small" style={{ color: "var(--color-ink-on-dark)" }}>
            {copy["footer.emergency"]}
          </p>
          <p className="t-small" style={{ color: "var(--color-ink-on-dark)" }}>
            © {new Date().getFullYear()} {copy["footer.legalName"]}
          </p>
        </div>
      </div>
    </footer>
  );
}

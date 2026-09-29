import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Section } from "@/components/ui/Marketing";
import { CHECKLIST_STEPS } from "@/lib/clinical/checklist";
import { APPROVAL_VALID_DAYS } from "@/lib/clinical/validity";
import { getContent } from "@/lib/content";
import { listDrips } from "@/lib/data/drips";
import { servedZones } from "@/lib/zones";
import { getZones } from "@/lib/zones-store";
import { QuizButton } from "@/components/layout/QuizButton";
import { SITE_IMAGES } from "@/lib/site-images";
import { PageHero } from "@/components/site/PageHero";
import { SectionHeader, delay } from "@/components/site/Layout";
import { Photo } from "@/components/site/Photo";
import { CountUp } from "@/components/site/CountUp";
import { CtaPanel } from "@/components/site/CtaPanel";
import { Arrow } from "@/components/ui/Arrow";

export const metadata: Metadata = {
  title: "About",
  description:
    "Who NutriDrip is, how the team is organised, and the numbers that describe the service today — all of them counted, none of them rounded up.",
};

// The figures below are counted live, and the paragraphs are editable copy.
export const dynamic = "force-dynamic";

const ROLES = [
  {
    title: "Physicians",
    image: SITE_IMAGES.physician,
    body: "Registered doctors read every health quiz and approve, change or decline the protocol. They write multi-week treatment plans, clear a session that was stopped on out-of-range vitals, and review anything a nurse files. Their name and council registration number sit on your session report.",
  },
  {
    title: "Nurses",
    image: SITE_IMAGES.nursePrep,
    body: "Council-registered nurses come to you, take baseline vitals, capture consent and work the checklist in order. They cannot skip a mandatory step and cannot clear their own vitals block — that is deliberate, and it is why they are trusted with the rest.",
  },
  {
    title: "Pharmacy and operations",
    image: SITE_IMAGES.pharmacist,
    body: "The team behind the scenes keeps stock by batch and expiry, dispatches from the soonest expiry first, seals the kits, and can name every patient who received a given batch if a manufacturer recalls it.",
  },
];

export default async function AboutPage() {
  const [copy, drips, zones] = await Promise.all([getContent(), listDrips(), getZones()]);

  // Counted, not claimed. Nothing here is a customer or revenue figure, because
  // none is recorded anywhere this page could honestly read it from.
  // A unit is set small beside its number, so "90 days" stays on one line in
  // a phone's narrow card.
  const FIGURES: Array<{ value: string; unit?: string; label: string }> = [
    { value: String(drips.length), label: "formulas on the menu" },
    { value: String(servedZones(zones).length), label: "zones across Bengaluru" },
    { value: String(CHECKLIST_STEPS.length), label: "steps in every session" },
    { value: String(APPROVAL_VALID_DAYS), unit: "days", label: "how long an approval lasts" },
  ];

  return (
    <>
      <PageHero
        eyebrow="About"
        title={copy["about.headline"]}
        lede={copy["about.intro"]}
        aside={
          <div className="grid grid-cols-2 gap-3 sm:gap-4" data-reveal="hero" style={delay(140)}>
            {FIGURES.map((f, i) => (
              <div
                key={f.label}
                className={`flex min-h-[150px] flex-col justify-between rounded-[var(--radius-xl)] p-6 sm:min-h-[180px] sm:p-7 ${
                  i === 0
                    ? "on-dark bg-[var(--color-deep)] text-white"
                    : "border border-[var(--color-line)] bg-[var(--color-surface)]"
                }`}
              >
                <span
                  className={`flex items-baseline gap-2 whitespace-nowrap ${i === 0 ? "text-white" : "text-[var(--color-ink)]"}`}
                >
                  <span className="t-data text-[clamp(34px,4vw,48px)] leading-none">
                    <CountUp value={f.value} />
                  </span>
                  {f.unit ? <span className="t-data text-[15px]">{f.unit}</span> : null}
                </span>
                <span className={`t-small ${i === 0 ? "text-white/70" : "text-[var(--color-ink-2)]"}`}>{f.label}</span>
              </div>
            ))}
            <p className="col-span-2 t-small text-[var(--color-ink-3)]">
              Counted from the live service, not rounded up.
            </p>
          </div>
        }
      />

      <Section tone="mist" labelledBy="about-mission">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
          <div>
            <span className="t-eyebrow" data-reveal>
              What we are trying to do
            </span>
            <h2 id="about-mission" className="t-section mt-4" data-reveal style={delay(70)}>
              A procedure, <span className="tone-2">not a treat.</span>
            </h2>
          </div>
          <p
            className="m-0 text-[var(--color-ink)]"
            data-reveal
            style={delay(140, {
              font: "500 clamp(20px, 1.2rem + 0.8vw, 28px)/1.5 var(--font-display)",
              letterSpacing: "-0.015em",
              textWrap: "pretty",
            })}
          >
            {copy["about.mission"]}
          </p>
        </div>
      </Section>

      <Section labelledBy="about-roles">
        <SectionHeader
          id="about-roles"
          eyebrow="Who does what"
          title={
            <>
              Three teams, <span className="tone-2">and a line between them.</span>
            </>
          }
          lede="The safeguards are not a policy document; they are what each role can and cannot do in the software."
        />
        <div className="grid grid-cols-1 gap-x-6 gap-y-12 md:grid-cols-3">
          {ROLES.map((r, i) => (
            <article key={r.title} className="flex flex-col" data-reveal style={delay(i * 100)}>
              <Photo
                image={r.image}
                sizes="(min-width: 768px) 30vw, 100vw"
                className="aspect-[4/3.6] rounded-[var(--radius-xl)] bg-[var(--color-surface-2)]"
              />
              <h3 className="t-title mt-6">{r.title}</h3>
              <p className="t-body text-[var(--color-ink-2)] mt-3">{r.body}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section tone="soft" labelledBy="about-entity">
        <h2 id="about-entity" className="sr-only">
          The company and where to read more
        </h2>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div
            className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-7 md:p-9"
            data-reveal
          >
            <span className="t-micro">The registered entity</span>
            <h3 className="t-title mt-3">{copy["footer.legalName"]}</h3>
            <p className="t-body text-[var(--color-ink-2)] mt-3">
              Clinical establishment registration{" "}
              <span className="t-data text-[14.5px] text-[var(--color-ink)]">{copy["footer.registration"]}</span>.
            </p>
            <div className="flex gap-x-6 flex-wrap mt-4">
              {[
                ["Terms", "/legal/terms"],
                ["Privacy", "/legal/privacy"],
                ["Grievance officer", "/legal/grievance"],
              ].map(([label, href]) => (
                <Link key={href} href={href} className="t-body font-medium inline-flex items-center min-h-[44px]">
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <div
            className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-7 md:p-9"
            data-reveal
            style={delay(100)}
          >
            <span className="t-micro">Read the detail</span>
            <h3 className="t-title mt-3">Rather see it than take our word?</h3>
            <p className="t-body text-[var(--color-ink-2)] mt-3">
              The Safety page lists all {CHECKLIST_STEPS.length} checklist steps and the vital-sign limits that stop an
              infusion. How it works follows one session from quiz to report.
            </p>
            <div className="flex gap-x-6 flex-wrap mt-4">
              {[
                ["Safety", "/safety"],
                ["How it works", "/how-it-works"],
                ["FAQs", "/faqs"],
              ].map(([label, href]) => (
                <Link key={href} href={href} className="t-body font-medium inline-flex items-center gap-2 min-h-[44px]">
                  {label} <Arrow />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <CtaPanel
        eyebrow="Start here"
        title="Start with the quiz."
        lede="A physician reads it before anything is booked. If you would rather ask a question first, we would like to hear it."
        actions={
          <>
            <QuizButton size="lg">Take the health quiz</QuizButton>
            <ButtonLink href="/consult" size="lg" variant="secondary">
              Ask a clinician
            </ButtonLink>
          </>
        }
        image={SITE_IMAGES.homeHero}
      />
    </>
  );
}

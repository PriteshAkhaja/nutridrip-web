import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Marketing";
import { CHECKLIST_STEPS } from "@/lib/clinical/checklist";
import { APPROVAL_VALID_DAYS } from "@/lib/clinical/validity";
import { getContent } from "@/lib/content";
import { listDrips } from "@/lib/data/drips";
import { servedZones } from "@/lib/zones";
import { getZones } from "@/lib/zones-store";
import { QuizButton } from "@/components/layout/QuizButton";

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
    body: "Registered doctors read every health quiz and approve, change or decline the protocol. They write multi-week treatment plans, clear a session that was stopped on out-of-range vitals, and review anything a nurse files. Their name and council registration number sit on your session report.",
  },
  {
    title: "Nurses",
    body: "Council-registered nurses come to you, take baseline vitals, capture consent and work the checklist in order. They cannot skip a mandatory step and cannot clear their own vitals block — that is deliberate, and it is why they are trusted with the rest.",
  },
  {
    title: "Pharmacy and operations",
    body: "The team behind the scenes keeps stock by batch and expiry, dispatches from the soonest expiry first, seals the kits, and can name every patient who received a given batch if a manufacturer recalls it.",
  },
];

export default async function AboutPage() {
  const [copy, drips, zones] = await Promise.all([getContent(), listDrips(), getZones()]);

  // Counted, not claimed. Nothing here is a customer or revenue figure, because
  // none is recorded anywhere this page could honestly read it from.
  const FIGURES = [
    { value: String(drips.length), label: "formulas on the menu" },
    { value: String(servedZones(zones).length), label: "zones across Bengaluru" },
    { value: String(CHECKLIST_STEPS.length), label: "steps in every session" },
    { value: `${APPROVAL_VALID_DAYS} days`, label: "how long an approval lasts" },
  ];

  return (
    <>
      <div className="mx-auto max-w-[1280px] px-6 md:px-10 py-12">
        <div className="max-w-[66ch]">
          <span className="t-micro">About</span>
          <h1 className="t-h1 mt-2 mb-4">{copy["about.headline"]}</h1>
          <p className="t-body-lg text-[var(--color-ink-2)]" style={{ textWrap: "pretty" }}>
            {copy["about.intro"]}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mt-10">
          {FIGURES.map((f) => (
            <Card key={f.label} padding="p-5">
              <div className="t-data text-[28px]">{f.value}</div>
              <span className="t-small text-[var(--color-ink-3)]">{f.label}</span>
            </Card>
          ))}
        </div>
      </div>

      <Section wide tone="soft">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.2fr] items-start">
          <div>
            <span className="t-micro">What we are trying to do</span>
            <h2 className="t-h2 mt-2 mb-4">A procedure, not a treat.</h2>
          </div>
          <p className="t-body-lg text-[var(--color-ink-2)] max-w-[62ch]" style={{ textWrap: "pretty" }}>
            {copy["about.mission"]}
          </p>
        </div>
      </Section>

      <Section wide>
        <div className="max-w-[66ch] mb-10">
          <span className="t-micro">Who does what</span>
          <h2 className="t-h2 mt-2 mb-3">Three teams, and a line between them.</h2>
          <p className="t-body-lg text-[var(--color-ink-2)]" style={{ textWrap: "pretty" }}>
            The safeguards are not a policy document; they are what each role can and cannot do in the software.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {ROLES.map((r) => (
            <Card key={r.title} padding="p-6">
              <h3 className="t-h3 mb-3">{r.title}</h3>
              <p className="t-body text-[var(--color-ink-2)]">{r.body}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section wide tone="soft">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-start">
          <Card padding="p-6">
            <span className="t-micro">The registered entity</span>
            <h2 className="t-h3 mt-2 mb-3">{copy["footer.legalName"]}</h2>
            <p className="t-body text-[var(--color-ink-2)]">
              Clinical establishment registration{" "}
              <span className="t-data text-[14.5px] text-[var(--color-ink)]">{copy["footer.registration"]}</span>.
            </p>
            <div className="flex gap-x-5 flex-wrap mt-2">
              <Link href="/legal/terms" className="t-body inline-flex items-center min-h-[44px]">Terms</Link>
              <Link href="/legal/privacy" className="t-body inline-flex items-center min-h-[44px]">Privacy</Link>
              <Link href="/legal/grievance" className="t-body inline-flex items-center min-h-[44px]">Grievance officer</Link>
            </div>
          </Card>
          <Card padding="p-6">
            <span className="t-micro">Read the detail</span>
            <h2 className="t-h3 mt-2 mb-3">Rather see it than take our word?</h2>
            <p className="t-body text-[var(--color-ink-2)]">
              The Safety page lists all {CHECKLIST_STEPS.length} checklist steps and the vital-sign limits that stop an
              infusion. How it works follows one session from quiz to report.
            </p>
            <div className="flex gap-x-5 flex-wrap mt-2">
              <Link href="/safety" className="t-body inline-flex items-center min-h-[44px]">Safety</Link>
              <Link href="/how-it-works" className="t-body inline-flex items-center min-h-[44px]">How it works</Link>
              <Link href="/faqs" className="t-body inline-flex items-center min-h-[44px]">FAQs</Link>
            </div>
          </Card>
        </div>
      </Section>

      <Section wide>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr] items-center">
          <div>
            <h2 className="t-h2 mb-3">Start with the quiz.</h2>
            <p className="t-body-lg text-[var(--color-ink-2)] max-w-[58ch]" style={{ textWrap: "pretty" }}>
              A physician reads it before anything is booked. If you would rather ask a question first, we would like
              to hear it.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <QuizButton size="lg" block>
              Take the health quiz
            </QuizButton>
            <ButtonLink href="/consult" variant="secondary" block>
              Ask a clinician
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  );
}

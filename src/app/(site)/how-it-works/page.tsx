import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { Section } from "@/components/ui/Marketing";
import { CHECKLIST_STEPS, PHASE_ORDER } from "@/lib/clinical/checklist";
import { APPROVAL_VALID_DAYS } from "@/lib/clinical/validity";
import { getLatePolicy } from "@/lib/billing/settings";
import { latePolicySentence } from "@/lib/billing/late-policy";
import { getContent } from "@/lib/content";
import { QuizButton } from "@/components/layout/QuizButton";
import { SITE_IMAGES, type SiteImageKey } from "@/lib/site-images";
import { PageHero } from "@/components/site/PageHero";
import { SectionHeader, delay } from "@/components/site/Layout";
import { Photo } from "@/components/site/Photo";
import { StickySteps, type Step } from "@/components/site/StickySteps";
import { QuizMock, ReportMock } from "@/components/site/Mockups";
import { CountUp } from "@/components/site/CountUp";
import { CtaPanel } from "@/components/site/CtaPanel";
import { FloatChip } from "@/components/site/FloatChip";
import { IconShield } from "@/components/site/Icons";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "From the health quiz to the session report: who reviews you, what the nurse does at your door, and what is written down at every step.",
};

// The typical review time is editable site copy, so it is read, not typed here.
export const dynamic = "force-dynamic";

export default async function HowItWorksPage() {
  // The late-change rule, with today's fees (set on the Billing page).
  const latePolicy = await getLatePolicy();
  const copy = await getContent();
  const stepsByPhase = PHASE_ORDER.map((phase) => ({
    phase,
    count: CHECKLIST_STEPS.filter((s) => s.phase === phase).length,
  }));

  const STEPS: Step[] = [
    {
      title: "You take the health quiz",
      kicker: "You",
      body: "About three minutes of questions on your symptoms, medication, allergies and history. It is not a diagnosis and it is not a sales funnel — it is the information a physician needs before they will put their name to a protocol for you.",
      note: "It screens for the conditions that rule IV therapy out, and tells you so straight away.",
    },
    {
      title: "A physician reviews it",
      kicker: "Physician",
      body: `A registered doctor reads your submission — typically within ${copy["home.stat2.value"]}. They approve a protocol, change the doses, ask you for more, or decline. Nothing is prepared on a quiz score alone.`,
      note: `An approval lasts ${APPROVAL_VALID_DAYS} days, because weight, medication and kidney function move.`,
    },
    {
      title: "You choose a drip and a slot",
      kicker: "You",
      body: "Pick the formula, a date and a time — at home, or at a partner clinic. Enter your pincode and you get a straight yes or no on whether we can reach you.",
      note: latePolicySentence(latePolicy),
    },
    {
      title: "Your nurse sets off",
      kicker: "Nurse",
      body: "A council-registered nurse is dispatched with a sealed kit for your protocol and presses On my way. Your session screen shows Nurse on the way with an estimate of the minutes, and you get a notification.",
      note: "At your door they inspect the seal and every vial's expiry. The batch numbers are fixed against your booking then, drawn from stock with the soonest expiry first — expired and quarantined lots are never counted as available.",
    },
    {
      title: "Proof they are with you",
      kicker: "You and the nurse",
      body: "Before the nurse can see your drugs and doses, a six-digit code is sent to your own phone and you read it out. Then they take baseline vitals and read you the risks. You sign, or confirm with a code, and the exact wording you agreed to is stored with your record.",
      note: "If your phone has died, a physician can authorise it, or the nurse can proceed under their own name after recording why. You are told either way.",
    },
    {
      title: "The session",
      kicker: "Nurse",
      body: `Your nurse works through a ${CHECKLIST_STEPS.length}-step checklist in order. Mandatory steps refuse to close out of sequence, and a baseline vital outside its reference range stops the infusion before it starts until the physician clears it.`,
    },
    {
      title: "Your report",
      kicker: "You",
      body: "The session report lands in your account: your vitals, the doses given, the batch number of every vial, the aftercare notes, and the physician's name and registration number. If a manufacturer later recalls a batch, we can name everyone who received it the same day.",
    },
  ];

  const photo = (key: SiteImageKey) => (
    <Photo key={key} image={SITE_IMAGES[key]} sizes="(min-width: 1024px) 44vw, 92vw" fill />
  );

  return (
    <>
      <PageHero
        eyebrow="How it works"
        title={
          <>
            From the quiz <span className="tone-2">to the report.</span>
          </>
        }
        lede={`${STEPS.length} steps, and a person accountable at each one. Here is what happens, who does it, and what is written down — including the parts that only matter when something goes wrong.`}
        actions={
          <>
            <QuizButton size="lg">Take the health quiz</QuizButton>
            <ButtonLink href="/safety" size="lg" variant="secondary">
              How we keep it safe
            </ButtonLink>
          </>
        }
        image={SITE_IMAGES.vialCheck}
        imageOverlay={
          <FloatChip
            className="absolute bottom-5 left-5 right-5 sm:right-auto"
            reveal="hero"
            style={delay(300)}
            icon={<IconShield size={18} />}
            title="The seal and every expiry"
            body="Checked at your door, in front of you"
          />
        }
      />

      <Section labelledBy="hiw-steps">
        <SectionHeader
          id="hiw-steps"
          eyebrow="Step by step"
          title={
            <>
              One session, <span className="tone-2">start to finish.</span>
            </>
          }
        />
        <StickySteps
          steps={STEPS}
          media={[
            <QuizMock key="quiz" />,
            photo("physicianPhone"),
            photo("citySkyline"),
            photo("cityStreet"),
            photo("vitalsHome"),
            photo("homeHero"),
            <ReportMock key="report" />,
          ]}
        />
      </Section>

      <Section tone="mist" labelledBy="hiw-phases">
        <SectionHeader
          id="hiw-phases"
          eyebrow="Inside the session"
          title={
            <>
              {CHECKLIST_STEPS.length} steps, <span className="tone-2">{PHASE_ORDER.length} phases.</span>
            </>
          }
          lede="The checklist is the same for every session. The Safety page lists every step."
          action={
            <ButtonLink href="/safety" variant="secondary">
              See the whole checklist
            </ButtonLink>
          }
        />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {stepsByPhase.map((p, i) => (
            <div
              key={p.phase}
              className="flex min-h-[170px] flex-col justify-between rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 md:p-7"
              data-reveal
              style={delay(i * 80)}
            >
              <span className="t-micro">
                <span className="t-data text-[var(--color-primary-text)] mr-2">{String(i + 1).padStart(2, "0")}</span>
                {p.phase}
              </span>
              <span className="flex items-baseline gap-2">
                <span className="t-data text-[clamp(36px,4vw,48px)] leading-none text-[var(--color-ink)]">
                  <CountUp value={String(p.count)} />
                </span>
                <span className="t-small text-[var(--color-ink-3)]">steps</span>
              </span>
            </div>
          ))}
        </div>
      </Section>

      <CtaPanel
        eyebrow="Ready?"
        title="Ready to start?"
        lede="The quiz takes about three minutes and nothing is booked until a physician has read it. If you would rather talk to somebody first, ask our clinical team."
        actions={
          <>
            <QuizButton size="lg">Take the health quiz</QuizButton>
            <ButtonLink href="/consult" size="lg" variant="secondary">
              Ask a clinician first
            </ButtonLink>
          </>
        }
        image={SITE_IMAGES.dripLineWindow}
      />
    </>
  );
}

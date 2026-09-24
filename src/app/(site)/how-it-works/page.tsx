import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Marketing";
import { CHECKLIST_STEPS, PHASE_ORDER } from "@/lib/clinical/checklist";
import { APPROVAL_VALID_DAYS } from "@/lib/clinical/validity";
import { getLatePolicy } from "@/lib/billing/settings";
import { latePolicySentence } from "@/lib/billing/late-policy";
import { getContent } from "@/lib/content";
import { QuizButton } from "@/components/layout/QuizButton";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "From the health quiz to the session report: who reviews you, what the nurse does at your door, and what is written down at every step.",
};

// The typical review time is editable site copy, so it is read, not typed here.
export const dynamic = "force-dynamic";

type Step = { title: string; who: string; body: string; note?: string };

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
      who: "You",
      body: "About three minutes of questions on your symptoms, medication, allergies and history. It is not a diagnosis and it is not a sales funnel — it is the information a physician needs before they will put their name to a protocol for you.",
      note: "It screens for the conditions that rule IV therapy out, and tells you so straight away.",
    },
    {
      title: "A physician reviews it",
      who: "Physician",
      body: `A registered doctor reads your submission — typically within ${copy["home.stat2.value"]}. They approve a protocol, change the doses, ask you for more, or decline. Nothing is prepared on a quiz score alone.`,
      note: `An approval lasts ${APPROVAL_VALID_DAYS} days, because weight, medication and kidney function move.`,
    },
    {
      title: "You choose a drip and a slot",
      who: "You",
      body: "Pick the formula, a date and a time — at home, or at a partner clinic. Enter your pincode and you get a straight yes or no on whether we can reach you.",
      note: latePolicySentence(latePolicy),
    },
    {
      title: "Your nurse sets off",
      who: "Nurse",
      body: "A council-registered nurse is dispatched with a sealed kit for your protocol and presses On my way. Your session screen shows Nurse on the way with an estimate of the minutes, and you get a notification.",
      note: "At your door they inspect the seal and every vial's expiry. The batch numbers are fixed against your booking then, drawn from stock with the soonest expiry first — expired and quarantined lots are never counted as available.",
    },
    {
      title: "Proof they are with you",
      who: "You and the nurse",
      body: "Before the nurse can see your drugs and doses, a six-digit code is sent to your own phone and you read it out. Then they take baseline vitals and read you the risks. You sign, or confirm with a code, and the exact wording you agreed to is stored with your record.",
      note: "If your phone has died, a physician can authorise it, or the nurse can proceed under their own name after recording why. You are told either way.",
    },
    {
      title: "The session",
      who: "Nurse",
      body: `Your nurse works through a ${CHECKLIST_STEPS.length}-step checklist in order. Mandatory steps refuse to close out of sequence, and a baseline vital outside its reference range stops the infusion before it starts until the physician clears it.`,
    },
    {
      title: "Your report",
      who: "You",
      body: "The session report lands in your account: your vitals, the doses given, the batch number of every vial, the aftercare notes, and the physician's name and registration number. If a manufacturer later recalls a batch, we can name everyone who received it the same day.",
    },
  ];

  return (
    <>
      <div className="mx-auto max-w-[1280px] px-6 md:px-10 py-12">
        <div className="max-w-[66ch] mb-12">
          <span className="t-micro">How it works</span>
          <h1 className="t-h1 mt-2 mb-4">From the quiz to the report.</h1>
          <p className="t-body-lg text-[var(--color-ink-2)]" style={{ textWrap: "pretty" }}>
            {STEPS.length} steps, and a person accountable at each one. Here is what happens, who does it, and what is
            written down — including the parts that only matter when something goes wrong.
          </p>
        </div>

        <ol className="list-none p-0 m-0 flex flex-col gap-4 max-w-[860px]">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className="relative grid grid-cols-[40px_1fr] sm:grid-cols-[48px_1fr] gap-4 sm:gap-5 items-start"
            >
              {/* The thread that makes seven cards read as one sequence: from the
                  bottom of this step's number, down through the gap, to the top
                  of the next one. Each number is lowered 15px to sit level with its
                  card's title (measured), and the line moves with it. A hairline, not a colour -- colour is kept for
                  real status. None after the last step: the path ends there. */}
              {i < STEPS.length - 1 ? (
                <span
                  aria-hidden
                  className="absolute left-5 sm:left-6 -translate-x-1/2 top-[55px] sm:top-[63px] -bottom-[31px] w-px bg-[var(--color-line-2)]"
                />
              ) : null}
              <span
                aria-hidden
                className="relative mt-[15px] t-data inline-flex items-center justify-center rounded-full border border-[var(--color-line-2)] bg-[var(--color-surface)] text-[var(--color-ink)] w-10 h-10 sm:w-12 sm:h-12 text-[15px]"
              >
                {i + 1}
              </span>
              <Card padding="p-5 sm:p-6">
                <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
                  <h2 className="t-h3">{s.title}</h2>
                  <span className="t-micro">{s.who}</span>
                </div>
                <p className="t-body text-[var(--color-ink-2)]" style={{ textWrap: "pretty" }}>
                  {s.body}
                </p>
                {s.note ? (
                  <p className="t-small text-[var(--color-ink-3)] mt-3 pt-3 border-t border-[var(--color-line)]">
                    {s.note}
                  </p>
                ) : null}
              </Card>
            </li>
          ))}
        </ol>
      </div>

      <Section wide tone="soft">
        <div className="max-w-[66ch] mb-8">
          <span className="t-micro">Inside the session</span>
          <h2 className="t-h2 mt-2 mb-3">
            {CHECKLIST_STEPS.length} steps, {PHASE_ORDER.length} phases.
          </h2>
          <p className="t-body-lg text-[var(--color-ink-2)]" style={{ textWrap: "pretty" }}>
            The checklist is the same for every session. The Safety page lists every step.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stepsByPhase.map((p) => (
            <Card key={p.phase} padding="p-5">
              <span className="t-micro">{p.phase}</span>
              <div className="t-data text-[28px] mt-2">{p.count}</div>
              <span className="t-small text-[var(--color-ink-3)]">steps</span>
            </Card>
          ))}
        </div>
      </Section>

      <Section wide>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr] items-center">
          <div>
            <h2 className="t-h2 mb-3">Ready to start?</h2>
            <p className="t-body-lg text-[var(--color-ink-2)] max-w-[58ch]" style={{ textWrap: "pretty" }}>
              The quiz takes about three minutes and nothing is booked until a physician has read it. If you would
              rather talk to somebody first, ask our clinical team.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <QuizButton size="lg" block>
              Take the health quiz
            </QuizButton>
            <ButtonLink href="/consult" variant="secondary" block>
              Ask a clinician first
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  );
}

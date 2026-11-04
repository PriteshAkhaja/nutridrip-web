import Link from "next/link";
import type { CSSProperties } from "react";
import { CHECKLIST_STEPS, PHASE_ORDER } from "@/lib/clinical/checklist";
import { APPROVAL_VALID_DAYS } from "@/lib/clinical/validity";
import { Cta } from "@/components/site/v3/Cta";
import { BookSection, type BookFacts } from "@/components/site/v3/BookSection";
import { word } from "@/components/site/home/format";
import { Photo } from "@/components/site/Photo";
import type { SiteImage } from "@/lib/site-images";
import { HiwMotion } from "./HiwMotion";
import { Crumbs } from "@/components/site/v3/Crumbs";

/**
 * How it works, in the client's design (no client page; their tokens and
 * parts). The peak is the relay: your booking is one card that travels
 * between the physician's desk, yours and the nurse's, and each step stamps
 * what it wrote down, until the card turns over as your report. Then what
 * stops a session, the checklist's phases, and the slip. Every fact is the
 * app's: the checklist, the approval's life, the late-change rule.
 */

type Desk = "physician" | "you" | "nurse";
type Step = {
  /** The desk the card sits on; "both" is between yours and the nurse's. */
  at: Desk | "both";
  who: string;
  title: string;
  body: string;
  note?: string;
  /** What the step writes on the card. */
  stamp: string;
};

const DESKS: Array<{ key: Desk; name: string; does: string }> = [
  { key: "physician", name: "Physician", does: "Reads, calls, decides" },
  { key: "you", name: "You", does: "Answers, books, receives" },
  { key: "nurse", name: "Nurse", does: "Brings it, gives it" },
];

const REPORT = [
  "Vitals, before and after",
  "Each dose given",
  "The batch number of every vial",
  "Aftercare notes",
  "The physician's name and registration",
];

const vars = (o: Record<string, string | number>) => o as CSSProperties;

export function HowItWorks({ facts, latePolicy, hero }: { facts: BookFacts; latePolicy: string; hero: SiteImage }) {
  const n = CHECKLIST_STEPS.length;
  const STEPS: Step[] = [
    {
      at: "you",
      who: "You",
      title: "You take the health quiz",
      body: "About three minutes of questions on your symptoms, medication, allergies and history. It is not a diagnosis: it is what a physician needs before they will put their name to a protocol.",
      note: "It screens for the conditions that make IV therapy unsuitable, such as pregnancy or renal or cardiac failure.",
      stamp: "Answers sent",
    },
    {
      at: "physician",
      who: "Physician",
      title: "A physician reads it and calls you",
      body: "A registered doctor reads your answers and talks them through with you on the phone. Then they approve a protocol, change the doses, ask you for more, or decline and tell you why.",
      note: "Nothing is prepared on a quiz score alone.",
      stamp: `Approved for ${APPROVAL_VALID_DAYS} days`,
    },
    {
      at: "you",
      who: "You",
      title: "You choose a drip and a time",
      body: "Pick the drip and a slot at home, at work or at a hotel; your pincode gets a straight yes or no. You can hold one slot from two hours after your call, and it is confirmed when the physician approves.",
      note: latePolicy,
      stamp: "Drip and time booked",
    },
    {
      at: "nurse",
      who: "Nurse",
      title: "Your nurse sets off",
      body: "A registered nurse leaves with a sealed kit made up for your protocol and presses On my way. Your screen shows how many minutes away they are.",
      note: "Stock goes out soonest expiry first. Expired and quarantined lots are never sent.",
      stamp: "Sealed kit on the way",
    },
    {
      at: "both",
      who: "You and the nurse",
      title: "Proof they are with you",
      body: "A six-digit code is sent to your phone, and you read it out before the nurse can see your doses. They check the seal and every vial's expiry in front of you, take your baseline vitals and read you the risks.",
      note: "You sign, and the exact wording you agreed to is kept with your record.",
      stamp: "Code read, consent signed",
    },
    {
      at: "nurse",
      who: "Nurse",
      title: "The session",
      body: `Your nurse works through a ${n}-step checklist in order: a mandatory step will not close while an earlier one is open. A baseline vital outside its range stops the drip before it starts, until the physician clears it.`,
      stamp: `${n}-step checklist, in order`,
    },
    {
      at: "you",
      who: "You",
      title: "Your report",
      body: "It lands in your account the same day: your vitals, each dose given, the batch number of every vial, the aftercare notes, and the physician's name and registration.",
      note: "If a maker recalls a batch, we can name everyone who received it the same day.",
      stamp: "Report in your account",
    },
  ];

  const STOPS: Array<[string, string]> = [
    [
      "The physician declines",
      "Nothing goes ahead. You are shown their reason, and a session you held or booked is called off with everything you paid refunded.",
    ],
    [
      `Your approval is over ${APPROVAL_VALID_DAYS} days old`,
      "You answer the quiz again before you book. Weight, medication and kidney function change, so an old approval may not fit you now.",
    ],
    [
      "A vital is out of range",
      "The drip does not start until the physician clears it, and a new reading out of range takes that clearance back. If the session is called off, everything you paid is refunded.",
    ],
    [
      "Your phone cannot get the code",
      "A physician can authorise the visit, or the nurse goes ahead under their own name after recording why. You are told either way.",
    ],
    [
      "A seal or an expiry is wrong",
      "Both are checked before anything is opened, and the checklist cannot move past a mandatory check that is not done.",
    ],
    ["You need to move or cancel", latePolicy],
  ];

  const phases = PHASE_ORDER.map((phase) => ({
    phase,
    count: CHECKLIST_STEPS.filter((s) => s.phase === phase).length,
  }));

  return (
    <HiwMotion drips={facts.drips}>
      <section className="nd-pagehead hw-head">
        <div className="nd-wrap hw-head__grid">
          <div>
            <Crumbs trail={[{ name: "How it works" }]} />
            <h1 className="nd-q">From the quiz to the report.</h1>
            <p className="nd-lede">
              {word(STEPS.length).replace(/^./, (c) => c.toUpperCase())} steps, and a person accountable at each one:
              what happens, who does it, and what is written down.
            </p>
            <div className="hw-head__go">
              <Cta />
              <Link className="nd-btn nd-btn--ghost" href="/safety" prefetch={false}>
                How we keep it safe
              </Link>
            </div>
          </div>
          {/* Admin → Site images, How it works: First screen. */}
          <Photo
            image={hero}
            className="hw-head__pic"
            radius="18px"
            sizes="(min-width: 861px) 44vw, 92vw"
            preload
            decorative={!hero.alt}
          />
        </div>
      </section>

      {/* The relay: the card moves desk to desk; each step stamps a row. */}
      <section
        className="hw-relay act-res"
        data-sc-act="pin"
        data-sc-span="5"
        style={vars({ "--span": 5, "--span-m": 5.6 })}
        aria-labelledby="relay-h"
      >
        <div data-sc-stage="" className="hw-relay__stage" data-sc-verify-state="0">
          <div className="nd-wrap hw-relay__in">
            <div className="hw-relay__top">
              <h2 id="relay-h" className="hw-relay__h">
                {word(STEPS.length).replace(/^./, (c) => c.toUpperCase())} steps, {word(DESKS.length)} people.
              </h2>
              <p className="hw-relay__count" aria-hidden="true">
                Step <span data-step-n="">1</span> of {STEPS.length}
              </p>
            </div>

            <div className="hw-desks" aria-hidden="true">
              {DESKS.map((d, i) => (
                <div
                  key={d.key}
                  className={`hw-desk hw-c${i + 1}${d.key === STEPS[0].at ? " is-on" : ""}`}
                  data-desk={d.key}
                >
                  <p className="hw-desk__name">{d.name}</p>
                  <p className="hw-desk__does">{d.does}</p>
                </div>
              ))}
              <div className="hw-card">
                <div className="hw-card__in">
                  <div className="hw-card__face hw-card__front">
                    <p className="hw-card__k">Your booking</p>
                    <ol className="hw-card__rows">
                      {STEPS.map((s, i) => (
                        <li key={s.stamp} className={i === 0 ? "is-in is-now" : undefined}>
                          <span className="hw-card__tick" />
                          <span className="hw-card__t">{s.stamp}</span>
                          <span className="hw-card__who">{s.who}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="hw-card__face hw-card__back">
                    <p className="hw-card__k">Your report</p>
                    <ul className="hw-card__report">
                      {REPORT.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <ol className="hw-steps">
              {STEPS.map((s, i) => (
                <li key={s.title} className={i === 0 ? "is-now" : undefined} data-at={s.at}>
                  <p className="hw-step__k">
                    <span className="hw-step__n">{i + 1}</span>
                    {s.who}
                  </p>
                  <h3 className="hw-step__t">{s.title}</h3>
                  <p className="hw-step__b">{s.body}</p>
                  {s.note ? <p className="hw-step__note">{s.note}</p> : null}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="sc-section hw-stops" aria-labelledby="stops-h">
        <div className="nd-wrap">
          <div className="hw-stops__head" data-sc-in="">
            <h2 id="stops-h" className="nd-q">
              When a step says no.
            </h2>
            <p className="nd-lede">Any step can stop a session. These are the stops, and what happens next.</p>
          </div>
          <ul className="hw-stops__list" data-sc-in="" data-sc-stagger="60">
            {STOPS.map(([k, v]) => (
              <li key={k}>
                <b>{k}</b>
                <p>{v}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="sc-section hw-phases" aria-labelledby="phases-h">
        <div className="nd-wrap">
          <div className="hw-phases__head" data-sc-in="">
            <p className="nd-tag">Inside the session</p>
            <h2 id="phases-h" className="nd-q nd-q--sm">
              {n} steps, {word(phases.length)} phases.
            </h2>
            <p className="nd-body">
              The checklist is the same at every session, and its mandatory steps cannot be skipped or closed out of
              order.{" "}
              <Link className="nd-link" href="/safety" prefetch={false}>
                Every step, on the Safety page
              </Link>
            </p>
          </div>
          <ol
            className="hw-phases__bar"
            data-sc-in=""
            aria-label={`${n} checklist steps by phase`}
            style={vars({ "--of": Math.max(...phases.map((p) => p.count)) })}
          >
            {phases.map((p) => (
              <li key={p.phase} style={vars({ "--n": p.count })}>
                <span className="hw-phases__seg">
                  <b className="nd-num">{p.count}</b>
                </span>
                <span className="hw-phases__name">{p.phase}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <BookSection facts={facts} />
    </HiwMotion>
  );
}

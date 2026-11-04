import Link from "next/link";
import type { CSSProperties } from "react";
import { CHECKLIST_STEPS, PHASE_ORDER, VITAL_RANGES } from "@/lib/clinical/checklist";
import { Cta } from "@/components/site/v3/Cta";
import { BookSection, type BookFacts } from "@/components/site/v3/BookSection";
import { word } from "@/components/site/home/format";
import { Photo } from "@/components/site/Photo";
import type { SiteImage } from "@/lib/site-images";
import { SafetyMotion } from "./SafetyMotion";
import type { GateState } from "./motion";
import { Crumbs } from "@/components/site/v3/Crumbs";

/**
 * Safety, in the shape of the client's page (head, the steps every drip
 * follows, the tests and their reasons, the rules, the dark "at the chair"
 * band, the slip) with the app's own guards in it. The peak is the vitals
 * gate: example readings cross a band and the checklist locks until the
 * physician decides, the rule `lib/clinical/checklist.ts` and the vitals
 * routes enforce. Every band, step and count is read from the checklist.
 */

const vars = (o: Record<string, string | number>) => o as CSSProperties;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// The gauge for each vital: the band inside a wider scale, so a reading can
// sit outside it. Blood pressure is gauged by its systolic number.
const SCALE = {
  systolic: [70, 180],
  heartRate: [40, 130],
  spo2: [86, 100],
  temperatureF: [95, 101.5],
} as const;
type Gauged = keyof typeof SCALE;
const pct = (k: Gauged, v: number) => {
  const [a, b] = SCALE[k];
  return Math.max(0, Math.min(100, ((v - a) / (b - a)) * 100));
};

// Example readings, one set per stage of the story; marked as examples on
// the page. Stage 1 crosses the blood-pressure band, stage 3 is a new reading.
const READINGS: Array<{ systolic: number; diastolic: number; heartRate: number; spo2: number; temperatureF: number }> =
  [
    { systolic: 122, diastolic: 78, heartRate: 76, spo2: 98, temperatureF: 98.4 },
    { systolic: 152, diastolic: 94, heartRate: 78, spo2: 98, temperatureF: 98.4 },
    { systolic: 152, diastolic: 94, heartRate: 78, spo2: 98, temperatureF: 98.4 },
    { systolic: 156, diastolic: 96, heartRate: 80, spo2: 98, temperatureF: 98.4 },
  ];

const CONTRAINDICATIONS = [
  {
    heading: "We will decline",
    tone: "critical" as const,
    items: [
      "Pregnancy, or actively trying to conceive.",
      "Established renal failure, or an eGFR below 30.",
      "Congestive cardiac failure, or any condition where fluid load is dangerous.",
      "Known anaphylaxis to any component of the requested formula.",
      "G6PD deficiency, for any high-dose ascorbic acid protocol.",
    ],
  },
  {
    heading: "A physician will want more first",
    tone: "caution" as const,
    items: [
      "Diabetes on insulin, because high-dose vitamin C interferes with glucometer readings.",
      "Iron protocols without a ferritin result inside 90 days.",
      "Anticoagulant therapy, which changes how the cannula is sited and removed.",
      "Active infection with a fever: you will usually be asked to wait.",
      "Any history of a reaction to IV therapy, however mild it seemed at the time.",
    ],
  },
];

export function Safety({ facts, hero }: { facts: BookFacts; hero: SiteImage }) {
  const n = CHECKLIST_STEPS.length;
  const mandatory = CHECKLIST_STEPS.filter((s) => s.mandatory).length;
  const label = (key: string) => CHECKLIST_STEPS.find((s) => s.key === key)?.label ?? key;

  const COMMITMENTS: Array<[string, string]> = [
    [
      "A named physician, not an algorithm",
      "A registered doctor reads every submission and approves a protocol, changes the doses, or declines. Their name and registration appear on your session report. Nothing is given on a quiz score alone.",
    ],
    [
      "A checklist the nurse cannot skip",
      `${n} steps in ${word(PHASE_ORDER.length)} phases bound every session. A mandatory step will not close while an earlier one is open.`,
    ],
    [
      "Vitals that stop the drip",
      "A baseline reading outside its band locks the line, the cannula and the infusion until the physician clears it. The nurse cannot override it.",
    ],
    [
      "Your code before your doses",
      "The nurse sees your drugs and doses only after you read out a six-digit code sent to your phone: the record shows they were with you.",
    ],
    [
      "Batch numbers, per session",
      "Every vial is recorded against your session by batch number. If a maker recalls a batch, we can name everyone who received it the same day.",
    ],
    [
      "Anything you report reaches the physician",
      "The nurse files it on the spot and the physician is told at once. A severe event reaches the operations team too.",
    ],
  ];

  // The gate's rows and its four stages.
  const ROWS: Array<{ key: Gauged; name: string; band: string; lo: number; hi: number }> = [
    {
      key: "systolic",
      name: "Blood pressure",
      band: `${VITAL_RANGES.systolic.min}–${VITAL_RANGES.systolic.max} / ${VITAL_RANGES.diastolic.min}–${VITAL_RANGES.diastolic.max} ${VITAL_RANGES.systolic.unit}`,
      lo: pct("systolic", VITAL_RANGES.systolic.min),
      hi: pct("systolic", VITAL_RANGES.systolic.max),
    },
    {
      key: "heartRate",
      name: VITAL_RANGES.heartRate.label,
      band: `${VITAL_RANGES.heartRate.min}–${VITAL_RANGES.heartRate.max} ${VITAL_RANGES.heartRate.unit}`,
      lo: pct("heartRate", VITAL_RANGES.heartRate.min),
      hi: pct("heartRate", VITAL_RANGES.heartRate.max),
    },
    {
      key: "spo2",
      name: VITAL_RANGES.spo2.label,
      band: `${VITAL_RANGES.spo2.min}–${VITAL_RANGES.spo2.max}${VITAL_RANGES.spo2.unit}`,
      lo: pct("spo2", VITAL_RANGES.spo2.min),
      hi: pct("spo2", VITAL_RANGES.spo2.max),
    },
    {
      key: "temperatureF",
      name: VITAL_RANGES.temperatureF.label,
      band: `${fmt(VITAL_RANGES.temperatureF.min)}–${fmt(VITAL_RANGES.temperatureF.max)} ${VITAL_RANGES.temperatureF.unit}`,
      lo: pct("temperatureF", VITAL_RANGES.temperatureF.min),
      hi: pct("temperatureF", VITAL_RANGES.temperatureF.max),
    },
  ];
  const out = (k: Gauged, v: { systolic: number; diastolic: number } & Record<Gauged, number>) =>
    k === "systolic"
      ? v.systolic < VITAL_RANGES.systolic.min ||
        v.systolic > VITAL_RANGES.systolic.max ||
        v.diastolic < VITAL_RANGES.diastolic.min ||
        v.diastolic > VITAL_RANGES.diastolic.max
      : v[k] < VITAL_RANGES[k].min || v[k] > VITAL_RANGES[k].max;
  const STEP_STATE = ["ready", "blocked", "cleared", "blocked"] as const;
  const NOTES = [
    "Every reading inside its band",
    "Out of range: the physician is alerted",
    "Cleared by the physician, under their name",
    "A new reading: the clearance is taken back",
  ];
  const gate: GateState[] = READINGS.map((v, i) => ({
    rows: ROWS.map((r) => {
      const x = pct(r.key, v[r.key]);
      // How far past its band the reading went, from the limit to the reading.
      const over: [number, number] = x > r.hi ? [r.hi, x] : x < r.lo ? [x, r.lo] : [r.hi, r.hi];
      return {
        value: r.key === "systolic" ? `${v.systolic} / ${v.diastolic}` : fmt(v[r.key]),
        x,
        over,
        out: out(r.key, v),
      };
    }),
    steps: STEP_STATE[i],
    note: NOTES[i],
  }));
  const NEXT = ["pr-05", "pr-07", "di-01"].map(label);
  const SAYS: Array<[string, string]> = [
    [
      "Before anything goes in, the nurse records your baseline.",
      "Blood pressure, heart rate, oxygen and temperature, each checked against its band.",
    ],
    [
      "One reading outside its band stops the drip.",
      "Priming the line, the cannula and the infusion all lock, and the physician is alerted. The nurse cannot override it.",
    ],
    [
      "Only the physician can clear it.",
      "They go ahead under their own name, or stop the session; you and the nurse are told either way. If it is stopped, everything you paid is refunded.",
    ],
    [
      "A new reading out of range takes the clearance back.",
      "The steps lock again, and the physician is alerted again, until they have seen the new number.",
    ],
  ];
  const STATE_WORD = { ready: "Ready", blocked: "Blocked", cleared: "Cleared" } as const;

  return (
    <SafetyMotion drips={facts.drips} gate={gate}>
      <section className="nd-pagehead sf-head">
        <div className="nd-wrap">
          <Crumbs trail={[{ name: "Safety" }]} />
          <div className="sf-head__grid">
            <h1 className="nd-q">Reviewed before you&apos;re treated. Watched while you&apos;re treated.</h1>
            <div className="sf-head__side">
              <p className="nd-lede">
                IV nutrient therapy is a medical procedure. This is how we make it a safe one, step by step, and where
                each guard sits.
              </p>
              <div className="sf-head__go">
                <Cta />
                <Link className="nd-btn nd-btn--ghost" href="/how-it-works" prefetch={false}>
                  How it works
                </Link>
              </div>
            </div>
          </div>
          {/* Admin → Site images, Safety: First screen. */}
          <Photo
            image={hero}
            className="sf-head__pic"
            radius="20px"
            sizes="(min-width: 1300px) 1248px, 94vw"
            preload
            decorative={!hero.alt}
          />
        </div>
      </section>

      <section className="sc-section nd-section--tight sf-commit" aria-labelledby="commit-h">
        <div className="nd-wrap nd-grid2">
          <div className="sc-stack" data-sc-in="">
            <h2 id="commit-h" className="nd-q nd-q--sm">
              Six things that hold at every session, no exceptions.
            </h2>
            <p className="nd-body">
              Each one is enforced by the app the physician and the nurse work in, not left to memory.
            </p>
          </div>
          <ol className="sf-list" data-sc-in="" data-sc-stagger="60">
            {COMMITMENTS.map(([t, b]) => (
              <li key={t}>
                <b>{t}</b>
                <span>{b}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* The gate: example readings cross a band; the checklist locks. */}
      <section
        className="sf-gate act-res"
        data-sc-act="pin"
        data-sc-span="4"
        style={vars({ "--span": 4, "--span-m": 4.6 })}
        aria-labelledby="gate-h"
      >
        <div data-sc-stage="" className="sf-gate__stage" data-sc-verify-state="0">
          <div className="nd-wrap sf-gate__in">
            <div className="sf-gate__copy">
              <p className="nd-tag">The vitals gate</p>
              <h2 id="gate-h" className="nd-q nd-q--sm">
                The numbers that stop a session.
              </h2>
              <ol className="sf-says">
                {SAYS.map(([t, b], i) => (
                  <li key={t} className={i === 0 ? "is-now" : undefined}>
                    <b>{t}</b>
                    <p>{b}</p>
                  </li>
                ))}
              </ol>
              <ul className="visually-hidden">
                {ROWS.map((r) => (
                  <li key={r.key}>
                    {r.name}: {r.band}
                  </li>
                ))}
              </ul>
            </div>

            <div className="sf-panel" aria-hidden="true">
              <p className="sf-panel__k">
                Baseline vitals <span>Example readings</span>
              </p>
              <ul className="sf-vitals">
                {ROWS.map((r, i) => {
                  const s = gate[0].rows[i];
                  return (
                    <li key={r.key} className={s.out ? "is-out" : undefined}>
                      <span className="sf-v__name">{r.name}</span>
                      <span className="sf-v__band">{r.band}</span>
                      <b className="sf-v__val">{s.value}</b>
                      <span className="sf-v__state">{s.out ? "Out of range" : "In range"}</span>
                      <span className="sf-v__track" style={vars({ "--lo": r.lo, "--hi": r.hi })}>
                        <span className="sf-v__over" style={vars({ "--o0": s.over[0], "--o1": s.over[1] })} />
                        <span className="sf-v__mark" style={vars({ "--x": s.x })} />
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="sf-panel__k">Next on the checklist</p>
              <ul className="sf-next" data-state={gate[0].steps}>
                {NEXT.map((t) => (
                  <li key={t}>
                    <span className="sf-next__t">{t}</span>
                    <span className="sf-next__s">{STATE_WORD[gate[0].steps]}</span>
                  </li>
                ))}
              </ul>
              <p className="sf-panel__note" data-state={gate[0].steps}>
                {gate[0].note}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="sc-section sf-steps" aria-labelledby="steps-h">
        <div className="nd-wrap">
          <div className="sf-steps__head" data-sc-in="">
            <p className="nd-tag">The checklist</p>
            <h2 id="steps-h" className="nd-q">
              The {n} steps.
            </h2>
            <p className="nd-lede">
              The whole checklist, not a summary of it. Your nurse works through it in order, and the {mandatory} marked
              mandatory cannot be skipped.
            </p>
          </div>
          <div className="sf-phases" data-sc-in="" data-sc-stagger="80">
            {PHASE_ORDER.map((phase) => {
              const steps = CHECKLIST_STEPS.filter((s) => s.phase === phase);
              return (
                <div key={phase} className="sf-phase">
                  <p className="sf-phase__h">
                    <b>{phase}</b>
                    <span>{steps.length} steps</span>
                  </p>
                  <ol>
                    {steps.map((s) => (
                      <li key={s.key}>
                        <span className="sf-phase__t">
                          {s.label}
                          {s.detail ? <small>{s.detail}</small> : null}
                        </span>
                        {s.mandatory ? <span className="sf-phase__m">Mandatory</span> : null}
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="sc-section nd-section--tight sf-contra" aria-labelledby="contra-h">
        <div className="nd-wrap">
          <div className="sf-contra__head" data-sc-in="">
            <h2 id="contra-h" className="nd-q nd-q--sm">
              When IV therapy is not right for you.
            </h2>
            <p className="nd-body">
              The quiz screens for all of these. A decline is not a refusal of care: it usually means there is a better
              route, and the physician will say which.
            </p>
          </div>
          <div className="sf-contra__grid" data-sc-in="" data-sc-stagger="90">
            {CONTRAINDICATIONS.map((g) => (
              <div key={g.heading} className={`sf-contra__card sf-contra__card--${g.tone}`}>
                <p className="sf-contra__h">
                  <span className="sf-contra__dot" aria-hidden="true" />
                  {g.heading}
                </p>
                <ul>
                  {g.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sc-section nd-section--tight nd-dark sf-chair" aria-labelledby="chair-h">
        <div className="nd-wrap nd-grid2">
          <div className="sc-stack" data-sc-in="">
            <h2 id="chair-h" className="nd-q nd-q--sm">
              At the chair, every session.
            </h2>
            <p className="sf-chair__sos">
              <b>This is not emergency care.</b> If you have chest pain, difficulty breathing or a severe allergic
              reaction, call <span className="nd-num">108</span>. Do not wait for a nurse.
            </p>
          </div>
          <ul className="nd-rule-list sf-chair__list" data-sc-in="" data-sc-stagger="60">
            <li>
              <b>The anaphylaxis kit, checked first</b>
              <span>Present and in date before the sealed kit is opened.</span>
            </li>
            <li>
              <b>Your consent, in its exact words</b>
              <span>You sign, or confirm with a code, and the wording you agreed to is kept with your record.</span>
            </li>
            <li>
              <b>Watched before the nurse leaves</b>
              <span>Closing vitals, then 10 minutes of observation, then your aftercare notes.</span>
            </li>
            <li>
              <b>Sharps and clinical waste</b>
              <span>Disposed of as clinical waste at the end of every session.</span>
            </li>
            <li>
              <b>Your record</b>
              <span>The approval, the batch numbers, every vital and every checklist step, kept for each session.</span>
            </li>
          </ul>
        </div>
      </section>

      <BookSection facts={facts} />
    </SafetyMotion>
  );
}

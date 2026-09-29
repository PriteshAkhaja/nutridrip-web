import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { FillSegments } from "@/components/ui/Fill";
import { Section } from "@/components/ui/Marketing";
import { CHECKLIST_STEPS, PHASE_ORDER, VITAL_RANGES } from "@/lib/clinical/checklist";
import { QuizButton } from "@/components/layout/QuizButton";
import { SITE_IMAGES } from "@/lib/site-images";
import { PageHero } from "@/components/site/PageHero";
import { Container, SectionHeader, delay } from "@/components/site/Layout";
import { Photo } from "@/components/site/Photo";
import { FloatChip } from "@/components/site/FloatChip";
import {
  IconAlert,
  IconClipboard,
  IconPulse,
  IconReport,
  IconShield,
  IconStethoscope,
  IconVial,
} from "@/components/site/Icons";

export const metadata: Metadata = {
  title: "Safety",
  description:
    "Where the safety actually sits: a named physician, a 29-step checklist a nurse cannot skip, vitals that block the infusion, and batch numbers recorded per session.",
};

const CONTRAINDICATIONS = [
  {
    heading: "Absolute — we will decline",
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
    heading: "Conditional — a physician will want more",
    tone: "caution" as const,
    items: [
      "Diabetes on insulin, because high-dose vitamin C interferes with glucometer readings.",
      "Iron protocols without a ferritin result inside 90 days.",
      "Anticoagulant therapy, which changes how we site and remove the cannula.",
      "Active infection with a fever — we will usually ask you to wait.",
      "Any history of a reaction to IV therapy, however mild it seemed at the time.",
    ],
  },
];

const GUARANTEES: Array<{ title: string; body: string; icon: ReactNode }> = [
  {
    title: "A named physician, not an algorithm",
    icon: <IconStethoscope size={20} />,
    body: "A registered doctor reads every submission and either approves the protocol, changes the doses, or declines it. Their name and council registration number appear on your session report. Nothing is dispensed on a quiz score alone.",
  },
  {
    title: "A checklist the nurse cannot skip",
    icon: <IconClipboard size={20} />,
    body: "Twenty-nine steps across four phases gate every session. Mandatory steps refuse to close out of order — the software will not let a nurse cannulate before consent is captured, whatever the pressure of the day.",
  },
  {
    title: "Vitals that stop the infusion",
    icon: <IconPulse size={20} />,
    body: "Baseline readings are taken before any cannulation. A reading outside its reference range blocks the next step and escalates to the reviewing physician. The nurse cannot override it; only the doctor can.",
  },
  {
    title: "Batch numbers, per session",
    icon: <IconVial size={20} />,
    body: "Every vial that goes into you is recorded against your session by batch number. If a manufacturer issues a recall, we can name every patient who received that lot the same day.",
  },
  {
    title: "An anaphylaxis kit, in date, sealed",
    icon: <IconShield size={20} />,
    body: "Every nurse carries one and confirms the seal is intact before the first session of the day. A broken seal means the kit is treated as spent, whatever it looks like inside.",
  },
  {
    title: "Adverse events are filed, not buried",
    icon: <IconReport size={20} />,
    body: "The nurse files anything the patient reports, however minor, and it reaches the physician immediately. Filing one is never held against a nurse. Not filing one is.",
  },
];

export default function SafetyPage() {
  const byPhase = PHASE_ORDER.map((phase) => ({
    phase,
    total: CHECKLIST_STEPS.filter((s) => s.phase === phase).length,
    mandatory: CHECKLIST_STEPS.filter((s) => s.phase === phase && s.mandatory).length,
  }));
  const mandatory = CHECKLIST_STEPS.filter((s) => s.mandatory).length;

  return (
    <>
      <PageHero
        eyebrow="Safety"
        title={
          <>
            Where the safety <span className="tone-2">actually sits.</span>
          </>
        }
        lede="IV therapy is a medical procedure, not a wellness treat. What makes it safe is not the ingredients — it is the physician who reviews you, the checklist that bounds the session, and the fact that a nurse cannot skip a step even when they are running late. Here is exactly how that works."
        image={SITE_IMAGES.vitalsHome}
        imageOverlay={
          <FloatChip
            className="absolute bottom-5 left-5 right-5 sm:right-auto"
            reveal="hero"
            style={delay(300)}
            icon={<IconPulse size={18} />}
            title="Baseline vitals, before anything"
            body="Out of range stops the infusion"
          />
        }
      />

      {/* ---------------- The six guarantees ---------------- */}
      <Section labelledBy="safety-guarantees">
        <SectionHeader
          id="safety-guarantees"
          eyebrow="Six commitments"
          title={
            <>
              What holds on <span className="tone-2">every single visit.</span>
            </>
          }
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {GUARANTEES.map((g, i) => (
            <article
              key={g.title}
              className="flex flex-col rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-7"
              data-reveal
              style={delay((i % 3) * 80)}
            >
              <span className="w-11 h-11 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary-text)] inline-flex items-center justify-center">
                {g.icon}
              </span>
              <h3 className="t-title mt-6 text-[20px]">{g.title}</h3>
              <p className="t-body text-[var(--color-ink-2)] mt-3">{g.body}</p>
            </article>
          ))}
        </div>
      </Section>

      {/* ---------------- The checklist itself ---------------- */}
      <Section tone="mist" labelledBy="safety-checklist">
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-16">
          <div className="lg:sticky lg:top-[calc(var(--site-header-h)+40px)]">
            <span className="t-eyebrow" data-reveal>
              The checklist
            </span>
            <h2 id="safety-checklist" className="t-section mt-4" data-reveal style={delay(70)}>
              The {CHECKLIST_STEPS.length} steps
            </h2>
            <p className="t-lead mt-5 max-w-[52ch]" data-reveal style={delay(140)}>
              This is the whole checklist, not a marketing summary of it. Your nurse works through it in order, and{" "}
              <span className="t-data text-[var(--color-ink)]">{mandatory}</span> of the steps are mandatory — the
              software refuses to advance past them.
            </p>
            <div
              className="mt-8 rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 md:p-7 flex flex-col gap-4"
              data-reveal
              style={delay(200)}
            >
              {byPhase.map((p) => (
                <FillSegments key={p.phase} name={p.phase} done={p.mandatory} total={p.total} />
              ))}
              <p className="t-small text-[var(--color-ink-3)] mt-1">
                Filled segments are the mandatory steps within each phase.
              </p>
            </div>
          </div>

          <div
            className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)]"
            data-reveal
            style={delay(120)}
          >
            {PHASE_ORDER.map((phase, pi) => (
              <div key={phase}>
                <div
                  className={`flex items-center justify-between px-6 py-3 bg-[var(--color-surface-2)] border-b border-[var(--color-line)] ${
                    pi > 0 ? "border-t" : ""
                  }`}
                >
                  <span className="t-micro">{phase}</span>
                  <span className="t-data text-[12.5px] text-[var(--color-ink-3)]">
                    {CHECKLIST_STEPS.filter((s) => s.phase === phase).length} steps
                  </span>
                </div>
                <ol className="list-none m-0 p-0">
                  {CHECKLIST_STEPS.filter((s) => s.phase === phase).map((s, i) => (
                    <li
                      key={s.key}
                      className="px-6 py-3 border-b border-[var(--color-line)] last:border-b-0 flex gap-3 items-baseline"
                    >
                      <span className="t-data text-[13px] text-[var(--color-ink-3)] flex-none w-[22px]">{i + 1}</span>
                      <span className="t-body flex-1">{s.label}</span>
                      {s.mandatory && (
                        <span className="t-small font-medium text-[var(--color-critical-text)] flex-none">
                          Mandatory
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ---------------- Reference ranges ---------------- */}
      <Section labelledBy="safety-ranges">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
          <div>
            <SectionHeader
              id="safety-ranges"
              eyebrow="Reference bands"
              title={
                <>
                  The numbers that <span className="tone-2">stop a session.</span>
                </>
              }
              lede="These are the bands your baseline vitals are checked against. A reading outside any of them blocks the infusion before it starts and escalates to the physician who approved your protocol."
              className="md:mb-10"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Object.entries(VITAL_RANGES).map(([key, r], i) => (
                <div
                  key={key}
                  className="flex items-end justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-4"
                  data-reveal
                  style={delay(i * 60)}
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="t-micro">
                      {r.label}
                      {key === "systolic" ? " · systolic" : key === "diastolic" ? " · diastolic" : ""}
                    </span>
                    <span className="t-data text-[22px] leading-tight text-[var(--color-ink)] whitespace-nowrap">
                      {r.min} – {r.max}
                    </span>
                  </div>
                  <span className="t-small text-[var(--color-ink-3)] flex-none">{r.unit}</span>
                </div>
              ))}
            </div>
          </div>
          <Photo
            image={SITE_IMAGES.vialsMono}
            sizes="(min-width: 1024px) 40vw, 100vw"
            reveal
            radius="var(--radius-2xl)"
            className="aspect-[4/3.4] rounded-[var(--radius-2xl)] lg:aspect-[4/4.8]"
          />
        </div>
      </Section>

      {/* ---------------- Contraindications ---------------- */}
      <Section tone="soft" labelledBy="safety-contra">
        <SectionHeader
          id="safety-contra"
          eyebrow="Contraindications"
          title={
            <>
              When IV therapy <span className="tone-2">is not right for you.</span>
            </>
          }
          lede="The quiz screens for all of these. A decline is not a refusal of care — it usually means there is a better route, and the physician will say which."
        />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {CONTRAINDICATIONS.map((group, i) => {
            const critical = group.tone === "critical";
            return (
              <div
                key={group.heading}
                className="rounded-[var(--radius-xl)] border bg-[var(--color-surface)] p-7 md:p-8"
                style={delay(i * 100, { borderColor: critical ? "var(--color-critical)" : "var(--color-caution)" })}
                data-reveal
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-10 h-10 rounded-full inline-flex items-center justify-center"
                    style={{
                      background: critical ? "var(--color-critical-soft)" : "var(--color-caution-soft)",
                      color: critical ? "var(--color-critical-text)" : "var(--color-caution-text)",
                    }}
                  >
                    <IconAlert size={19} />
                  </span>
                  <h3 className="t-title text-[20px]">{group.heading}</h3>
                </div>
                <ul className="flex flex-col gap-3 list-none p-0 m-0 mt-6">
                  {group.items.map((item) => (
                    <li key={item} className="flex gap-3 items-start">
                      <span
                        className="w-[6px] h-[6px] rounded-full flex-none mt-[9px]"
                        style={{ background: critical ? "var(--color-critical)" : "var(--color-caution)" }}
                      />
                      <span className="t-body">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ---------------- Emergency ---------------- */}
      <section className="section-y">
        <Container>
          <div
            className="on-dark grid grid-cols-1 items-center gap-8 rounded-[var(--radius-2xl)] bg-[var(--color-deep)] p-8 text-white md:p-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:p-14"
            data-reveal
          >
            <div>
              <span className="t-eyebrow">Emergencies</span>
              <h2 className="t-section mt-4">This is not emergency care.</h2>
              <p className="t-lead mt-5 max-w-[56ch]">
                NutriDrip is an elective service. If you are having chest pain, difficulty breathing, a severe allergic
                reaction or any other emergency, call <span className="t-data text-white">108</span> — do not wait for a
                nurse.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <QuizButton size="lg" block>
                Take the health quiz
              </QuizButton>
              <ButtonLink href="/drips" size="lg" variant="secondary" block>
                Read the formulas
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

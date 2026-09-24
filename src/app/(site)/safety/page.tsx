import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FillSegments } from "@/components/ui/Fill";
import { CHECKLIST_STEPS, PHASE_ORDER, VITAL_RANGES } from "@/lib/clinical/checklist";
import { QuizButton } from "@/components/layout/QuizButton";

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

const GUARANTEES = [
  {
    title: "A named physician, not an algorithm",
    body: "A registered doctor reads every submission and either approves the protocol, changes the doses, or declines it. Their name and council registration number appear on your session report. Nothing is dispensed on a quiz score alone.",
  },
  {
    title: "A checklist the nurse cannot skip",
    body: "Twenty-nine steps across four phases gate every session. Mandatory steps refuse to close out of order — the software will not let a nurse cannulate before consent is captured, whatever the pressure of the day.",
  },
  {
    title: "Vitals that stop the infusion",
    body: "Baseline readings are taken before any cannulation. A reading outside its reference range blocks the next step and escalates to the reviewing physician. The nurse cannot override it; only the doctor can.",
  },
  {
    title: "Batch numbers, per session",
    body: "Every vial that goes into you is recorded against your session by batch number. If a manufacturer issues a recall, we can name every patient who received that lot the same day.",
  },
  {
    title: "An anaphylaxis kit, in date, sealed",
    body: "Every nurse carries one and confirms the seal is intact before the first session of the day. A broken seal means the kit is treated as spent, whatever it looks like inside.",
  },
  {
    title: "Adverse events are filed, not buried",
    body: "The nurse files anything the patient reports, however minor, and it reaches the physician immediately. Filing one is never held against a nurse. Not filing one is.",
  },
];

export default function SafetyPage() {
  const byPhase = PHASE_ORDER.map((phase) => ({
    phase,
    total: CHECKLIST_STEPS.filter((s) => s.phase === phase).length,
    mandatory: CHECKLIST_STEPS.filter((s) => s.phase === phase && s.mandatory).length,
  }));

  return (
    <div className="mx-auto max-w-[1280px] px-6 md:px-10 py-12">
      <div className="max-w-[66ch] mb-12">
        <span className="t-micro">Safety</span>
        <h1 className="t-h1 mt-2 mb-4">Where the safety actually sits.</h1>
        <p className="t-body-lg text-[var(--color-ink-2)]" style={{ textWrap: "pretty" }}>
          IV therapy is a medical procedure, not a wellness treat. What makes it safe is not the ingredients — it is
          the physician who reviews you, the checklist that bounds the session, and the fact that a nurse cannot skip
          a step even when they are running late. Here is exactly how that works.
        </p>
      </div>

      {/* ---------------- The six guarantees ---------------- */}
      <section className="mb-14">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {GUARANTEES.map((g) => (
            <Card key={g.title} padding="p-6">
              <h2 className="t-h3 mb-2">{g.title}</h2>
              <p className="t-body text-[var(--color-ink-2)]">{g.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------------- The checklist itself ---------------- */}
      <section className="mb-14 grid gap-10 lg:grid-cols-[1fr_1fr] items-start">
        <div>
          <h2 className="t-h2 mb-3">The 29 steps</h2>
          <p className="t-body-lg text-[var(--color-ink-2)] mb-6 max-w-[54ch]" style={{ textWrap: "pretty" }}>
            This is the whole checklist, not a marketing summary of it. Your nurse works through it in order, and{" "}
            <span className="t-data text-[15px]">{CHECKLIST_STEPS.filter((s) => s.mandatory).length}</span> of the
            steps are mandatory — the software refuses to advance past them.
          </p>

          <Card padding="p-6" className="flex flex-col gap-[14px]">
            {byPhase.map((p) => (
              <FillSegments key={p.phase} name={p.phase} done={p.mandatory} total={p.total} />
            ))}
            <p className="t-small text-[var(--color-ink-3)] mt-1">
              Filled segments are the mandatory steps within each phase.
            </p>
          </Card>
        </div>

        <Card padding="p-0" className="overflow-hidden">
          {PHASE_ORDER.map((phase) => (
            <div key={phase}>
              <div className="px-5 py-3 bg-[var(--color-surface-2)] border-y border-[var(--color-line)] first:border-t-0">
                <span className="t-micro">{phase}</span>
              </div>
              {CHECKLIST_STEPS.filter((s) => s.phase === phase).map((s, i) => (
                <div
                  key={s.key}
                  className="px-5 py-3 border-b border-[var(--color-line)] last:border-b-0 flex gap-3 items-baseline"
                >
                  <span className="t-data text-[13px] text-[var(--color-ink-3)] flex-none w-[22px]">{i + 1}</span>
                  <span className="t-body flex-1">{s.label}</span>
                  {s.mandatory && (
                    <span className="t-small text-[var(--color-critical-text)] flex-none">Mandatory</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </Card>
      </section>

      {/* ---------------- Reference ranges ---------------- */}
      <section className="mb-14">
        <h2 className="t-h2 mb-3">The numbers that stop a session</h2>
        <p className="t-body-lg text-[var(--color-ink-2)] mb-6 max-w-[62ch]" style={{ textWrap: "pretty" }}>
          These are the bands your baseline vitals are checked against. A reading outside any of them blocks the
          infusion before it starts and escalates to the physician who approved your protocol.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(VITAL_RANGES).map(([key, r]) => (
            <Card key={key} padding="p-5">
              <span className="t-micro">{r.label}</span>
              <div className="t-data text-[22px] mt-2">
                {r.min} – {r.max}
              </div>
              <span className="t-small text-[var(--color-ink-3)]">{r.unit}</span>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------------- Contraindications ---------------- */}
      <section className="mb-14">
        <h2 className="t-h2 mb-3">When IV therapy is not right for you</h2>
        <p className="t-body-lg text-[var(--color-ink-2)] mb-6 max-w-[62ch]" style={{ textWrap: "pretty" }}>
          The quiz screens for all of these. A decline is not a refusal of care — it usually means there is a better
          route, and the physician will say which.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {CONTRAINDICATIONS.map((group) => (
            <Card key={group.heading} tone={group.tone} padding="p-6">
              <h3 className="t-h3 mb-4">{group.heading}</h3>
              <ul className="flex flex-col gap-3 list-none p-0 m-0">
                {group.items.map((item) => (
                  <li key={item} className="flex gap-3 items-start">
                    <span
                      className="w-[6px] h-[6px] rounded-full flex-none mt-[8px]"
                      style={{
                        background:
                          group.tone === "critical" ? "var(--color-critical)" : "var(--color-caution)",
                      }}
                    />
                    <span className="t-body">{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------------- Emergency ---------------- */}
      <section>
        <Card tone="muted" padding="p-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr] items-center">
            <div>
              <h2 className="t-h2 mb-3">This is not emergency care</h2>
              <p className="t-body-lg text-[var(--color-ink-2)] max-w-[58ch]" style={{ textWrap: "pretty" }}>
                NutriDrip is an elective service. If you are having chest pain, difficulty breathing, a severe
                allergic reaction or any other emergency, call{" "}
                <span className="t-data text-[16px] text-[var(--color-ink)]">108</span> — do not wait for a nurse.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <QuizButton size="lg" block>
                Take the health quiz
              </QuizButton>
              <ButtonLink href="/drips" variant="secondary" block>
                Read the formulas
              </ButtonLink>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}

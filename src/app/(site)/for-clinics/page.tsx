import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { FillBar } from "@/components/ui/Fill";
import { formatInr } from "@/lib/inventory/units";
import { ClinicEnquiryForm } from "./EnquiryForm";
import { listDrips } from "@/lib/data/drips";
import { Section, FaqList } from "@/components/ui/Marketing";
import { SITE_IMAGES } from "@/lib/site-images";
import { PageHero } from "@/components/site/PageHero";
import { SectionHeader, delay } from "@/components/site/Layout";
import { Photo } from "@/components/site/Photo";
import { CountUp } from "@/components/site/CountUp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "For clinics",
  description:
    "Run IV therapy out of your rooms without running a pharmacy. Physician review, nurse dispatch, FEFO stock and recall traceability, on our licence.",
};

const WHAT_YOU_GET = [
  {
    n: "01",
    title: "You do not run a pharmacy",
    body: "Order the drips you expect to run this week. Confirmation reserves the exact vials against your order, so a confirmed order is a promise you can staff against — not a hope.",
  },
  {
    n: "02",
    title: "Physician review is ours",
    body: "Every protocol is read and signed by a registered doctor before it reaches your room. Their council number is on the session report, not yours.",
  },
  {
    n: "03",
    title: "Nurses, or your own",
    body: "Use our council-registered nurses, or put your own on the platform. Either way they work the same 29-step checklist and the same record comes out.",
  },
  {
    n: "04",
    title: "Recall traceability, included",
    body: "Every dispatch writes an immutable ledger row: which batch fed which order. When a manufacturer issues a recall you answer it in minutes, from a screen.",
  },
];

const ECONOMICS = [
  { label: "Typical session price", value: 8400, pct: 100, note: "Myers' Revive, the usual first drip" },
  { label: "Your margin per session", value: 3200, pct: 38, note: "38% — room, staff time and aftercare" },
  { label: "Consumables and drug cost", value: 2900, pct: 35, note: "Billed at cost on your order" },
  { label: "Platform and physician review", value: 2300, pct: 27, note: "Our share — no monthly fee" },
];

const ONBOARDING = [
  ["Week 1", "Site visit", "We look at the room, the cold chain and your existing staff."],
  ["Week 2", "Agreement", "Split, volume target and liability, in writing before anything is ordered."],
  ["Week 3", "Training", "Your nurses take the checklist end to end on the platform, on real formulas."],
  ["Week 4", "First order", "Stock arrives with batch numbers already on your account."],
];

const FAQ = [
  {
    q: "What do we need in the room?",
    a: "A reclining chair, a hand-wash point, and somewhere lockable at 2–8 °C for the batches you hold. That is genuinely it — the drip stand, sets and cannulae come in the session kit.",
  },
  {
    q: "Who carries the clinical liability?",
    a: "The reviewing physician carries the prescribing decision and we carry the platform. You carry what you always carry: the premises, and the conduct of any staff who are yours. The partnership agreement sets this out in plain terms before you sign anything.",
  },
  {
    q: "Is there a monthly fee?",
    a: "No. We take a share of each completed session, so a quiet month costs you nothing. There is no minimum volume, though we do agree a target so we can plan stock.",
  },
  {
    q: "How fast is delivery?",
    a: "Orders confirmed before 4 PM are dispatched next working day inside Bengaluru. The availability figure you see when ordering is real stock, already checked against expiry — not a catalogue.",
  },
  {
    q: "Can we use our own formulas?",
    a: "Yes, once a physician on our panel has signed off on the recipe. It then appears in the builder like any other, with the same unit-slip checks and the same availability maths.",
  },
];

export default async function ForClinicsPage() {
  const total = ECONOMICS[0].value;
  const protocols = (await listDrips()).length;

  const figures = [
    { value: String(protocols), label: "protocols on the panel" },
    { value: "24 hr", label: "order to delivery" },
    { value: "0", label: "monthly platform fee" },
  ];

  return (
    <>
      <PageHero
        eyebrow="For clinics"
        title={
          <>
            Run IV therapy <span className="tone-2">without running a pharmacy.</span>
          </>
        }
        lede="You have the room and the patients. What stops most clinics is the rest of it — stock that expires, batches nobody can trace, and a prescribing decision somebody has to own. We do that part."
        actions={
          <>
            <ButtonLink href="#enquire" size="lg">
              Talk to us
            </ButtonLink>
            <ButtonLink href="/safety" size="lg" variant="secondary">
              Read the clinical model
            </ButtonLink>
          </>
        }
        below={
          <dl className="grid max-w-[520px] grid-cols-3 gap-5 border-t border-[var(--color-line)] pt-7">
            {figures.map((f) => (
              <div key={f.label} className="flex flex-col-reverse justify-end gap-1">
                <dt className="t-small text-[var(--color-ink-3)]">{f.label}</dt>
                <dd className="m-0 t-data text-[clamp(22px,2.4vw,30px)] leading-[1.1] text-[var(--color-ink)]">
                  <CountUp value={f.value} />
                </dd>
              </div>
            ))}
          </dl>
        }
        image={SITE_IMAGES.dripStand}
      />

      {/* ---------------- What you get ---------------- */}
      <Section labelledBy="clinics-covers">
        <SectionHeader
          id="clinics-covers"
          eyebrow="The partnership"
          title={
            <>
              What the partnership <span className="tone-2">actually covers.</span>
            </>
          }
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {WHAT_YOU_GET.map((w, i) => (
            <article
              key={w.n}
              className="grid grid-cols-1 gap-5 rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-7 sm:grid-cols-[52px_1fr] md:p-8"
              data-reveal
              style={delay((i % 2) * 90)}
            >
              <span className="t-data inline-flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[var(--color-mist)] text-[15px] text-[var(--color-primary-text)]">
                {w.n}
              </span>
              <div>
                <h3 className="t-title text-[21px]">{w.title}</h3>
                <p className="t-body text-[var(--color-ink-2)] mt-3">{w.body}</p>
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* ---------------- The economics ---------------- */}
      <Section tone="mist" labelledBy="clinics-economics">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
          <div>
            <SectionHeader
              id="clinics-economics"
              eyebrow="The economics"
              title={
                <>
                  Where a session&apos;s <span className="tone-2">{formatInr(total)} goes.</span>
                </>
              }
              className="md:mb-10"
            />
            <div
              className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 md:p-8"
              data-reveal
            >
              <div className="flex flex-col gap-6">
                {ECONOMICS.slice(1).map((e) => (
                  <FillBar
                    key={e.label}
                    label={
                      <span className="flex flex-col">
                        <span className="text-[var(--color-ink)] font-medium">{e.label}</span>
                        <span className="t-small text-[var(--color-ink-3)]">{e.note}</span>
                      </span>
                    }
                    value={formatInr(e.value)}
                    pct={e.pct}
                    height={8}
                    color={
                      e.label.includes("margin")
                        ? "var(--color-primary)"
                        : e.label.includes("Consumables")
                          ? "var(--color-primary-line)"
                          : "var(--color-line-2)"
                    }
                  />
                ))}
              </div>
              <p className="t-small text-[var(--color-ink-3)] mt-6 pt-5 border-t border-[var(--color-line)]">
                Indicative, on the current list price. Your agreement fixes the split for twelve months.
              </p>
            </div>
          </div>
          <Photo
            image={SITE_IMAGES.pharmacist}
            sizes="(min-width: 1024px) 42vw, 100vw"
            reveal
            radius="var(--radius-2xl)"
            className="aspect-[4/3.3] rounded-[var(--radius-2xl)] lg:aspect-[4/4.6]"
          />
        </div>
      </Section>

      {/* ---------------- How onboarding runs ---------------- */}
      <Section labelledBy="clinics-onboarding">
        <SectionHeader
          id="clinics-onboarding"
          eyebrow="Onboarding"
          title={
            <>
              From first call <span className="tone-2">to first session.</span>
            </>
          }
        />
        <ol className="relative grid grid-cols-1 gap-8 list-none m-0 p-0 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {/* The thread through the four weeks on a wide screen. */}
          <span
            aria-hidden
            className="absolute left-0 right-0 top-[22px] hidden h-px bg-[var(--color-line-2)] lg:block"
          />
          {ONBOARDING.map(([when, title, body], i) => (
            <li key={when} className="relative" data-reveal style={delay(i * 90)}>
              <span
                className={`t-data relative z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border text-[14px] ${
                  i === 0
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                    : "border-[var(--color-line-2)] bg-[var(--color-surface)] text-[var(--color-ink)]"
                }`}
              >
                {i + 1}
              </span>
              <span className="t-micro mt-5 block">{when}</span>
              <h3 className="t-title mt-2 text-[21px]">{title}</h3>
              <p className="t-body text-[var(--color-ink-2)] mt-2 max-w-[34ch]">{body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ---------------- FAQ ---------------- */}
      <Section tone="soft" labelledBy="clinics-faq">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <SectionHeader id="clinics-faq" eyebrow="Before you call" title="What clinics ask first" />
          <div data-reveal style={delay(120)}>
            <FaqList items={FAQ} />
          </div>
        </div>
      </Section>

      {/* ---------------- Enquiry ---------------- */}
      <Section id="enquire" labelledBy="clinics-enquire" className="scroll-mt-24">
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <div className="lg:sticky lg:top-[calc(var(--site-header-h)+40px)]">
            <SectionHeader
              id="clinics-enquire"
              eyebrow="Enquire"
              title={
                <>
                  Tell us <span className="tone-2">about your rooms.</span>
                </>
              }
              lede="We will come and look before either of us commits to anything. No deck, no pricing call — a nurse and an operations lead, in your clinic, for about an hour."
              className="md:mb-8"
            />
            <p className="t-body text-[var(--color-ink-2)]" data-reveal>
              Or write directly to <a href="mailto:partners@nutridrip.com">partners@nutridrip.com</a>.
            </p>
          </div>
          <div data-reveal style={delay(120)}>
            <ClinicEnquiryForm />
          </div>
        </div>
      </Section>
    </>
  );
}

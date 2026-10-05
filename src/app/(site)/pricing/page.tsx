import type { Metadata } from "next";
import { formatInr } from "@/lib/inventory/units";
import { listDrips } from "@/lib/data/drips";
import { QuizButton } from "@/components/layout/QuizButton";
import { getLatePolicy } from "@/lib/billing/settings";
import { LATE_POLICY_TOKEN, fillLatePolicy } from "@/lib/billing/late-policy";
import { getZones } from "@/lib/zones-store";
import { ZONE_COUNT_TOKEN, fillZoneCount } from "@/lib/zones";
import { Section, FaqList } from "@/components/ui/Marketing";
import { ButtonLink } from "@/components/ui/Button";
import { SITE_IMAGES } from "@/lib/site-images";
import { PageHero } from "@/components/site/PageHero";
import { SectionHeader, delay } from "@/components/site/Layout";
import { CtaPanel } from "@/components/site/CtaPanel";
import { IconBox, IconCheck, IconDrop, IconHome, IconStethoscope } from "@/components/site/Icons";

export const metadata: Metadata = { title: "Pricing" };

const PLANS = [
  {
    name: "Single",
    sessions: 1,
    discount: 0,
    blurb: "No commitment. Pay per session.",
    tag: null as string | null,
  },
  {
    name: "Course of 4",
    sessions: 4,
    discount: 0.1,
    blurb: "Save 10%. Price locked for 6 months.",
    tag: "Most chosen",
  },
  {
    name: "Course of 8",
    sessions: 8,
    discount: 0.2,
    blurb: "Save 20%. Includes two follow-up reviews.",
    tag: null,
  },
];

/** What the session price covers, as the lede states it. */
const INCLUDED = [
  { icon: <IconStethoscope size={20} />, title: "The physician review", body: "No separate consultation fee" },
  { icon: <IconHome size={20} />, title: "The nurse visit", body: "No travel charge inside our zones" },
  { icon: <IconBox size={20} />, title: "The sealed kit", body: "Set, cannula, swabs, gloves, sharps" },
  { icon: <IconDrop size={20} />, title: "The drip itself", body: "Every dose, published" },
];

const FAQ = [
  {
    q: "Does a real doctor look at my quiz?",
    a: "Yes. A registered physician reads every submission and either approves the protocol, changes the doses, or declines. Their name and council registration number appear on your session report.",
  },
  {
    q: "What if the nurse finds something wrong?",
    a: "The 29-step checklist gates the session. If your vitals fall outside the reference range, the infusion does not start — the nurse escalates to the reviewing physician, and a session that does not run is refunded in full.",
  },
  {
    q: "Can I cancel or reschedule?",
    // Filled in when the page is drawn, from the fees set on the Billing page.
    a: LATE_POLICY_TOKEN,
  },
  {
    q: "Do you serve my pincode?",
    a: `We currently cover ${ZONE_COUNT_TOKEN} zones across Bengaluru. Enter your pincode at booking and you will get a straight yes or no, not a waitlist.`,
  },
  {
    q: "Is this covered by insurance?",
    a: "Wellness infusions are not usually reimbursable. Therapeutic protocols — iron for confirmed deficiency, for example — sometimes are. We issue a GST invoice with the HSN codes either way.",
  },
  {
    q: "What happens to my health data?",
    a: "Your record is visible to you, the reviewing physician and the attending nurse. Nobody else. Access attempts are logged, and you can export or delete your record from your profile at any time.",
  },
];

export default async function PricingPage() {
  // The late-change rule, with today's fees (set on the Billing page).
  const [latePolicy, zones] = await Promise.all([getLatePolicy(), getZones()]);
  const drips = await listDrips();
  const base = drips.find((d) => d.slug === "myers-revive")?.priceInr ?? 8400;

  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title={
          <>
            One price, <span className="tone-2">everything included.</span>
          </>
        }
        lede={
          <>
            The session price covers the physician review, the nurse visit, the sealed kit and the drip itself. There is
            no separate consultation fee and no travel charge inside our service zones. Prices below use{" "}
            <span className="t-data text-[0.95em] text-[var(--color-ink)]">Myers&apos; Revive</span> as the base.
          </>
        }
        image={SITE_IMAGES.dripBag}
        imageAspect="aspect-[4/3] lg:aspect-[5/4.6]"
      />

      <Section labelledBy="pricing-plans" className="!pt-10 md:!pt-14">
        <h2 id="pricing-plans" className="sr-only">
          Plans
        </h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {PLANS.map((p, i) => {
            const per = Math.round(base * (1 - p.discount));
            const featured = p.tag !== null;
            return (
              <article
                key={p.name}
                className={`relative flex flex-col rounded-[var(--radius-2xl)] p-7 md:p-8 ${
                  featured
                    ? "on-dark bg-[var(--color-deep)] text-white md:-my-4 md:py-12"
                    : "border border-[var(--color-line)] bg-[var(--color-surface)]"
                }`}
                data-reveal
                style={delay(i * 100)}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="t-title">{p.name}</h3>
                  {p.tag && (
                    <span className="rounded-full bg-white/12 px-3 py-1 text-[12px] font-semibold tracking-[0.04em] text-[var(--color-primary-on-dark)]">
                      {p.tag}
                    </span>
                  )}
                </div>

                <div className="mt-7 flex items-baseline gap-2">
                  <span className="t-data text-[clamp(34px,3.4vw,44px)] leading-none">{formatInr(per)}</span>
                  <span className={`t-small ${featured ? "text-white/65" : "text-[var(--color-ink-3)]"}`}>
                    per session
                  </span>
                </div>

                <dl
                  className={`mt-7 flex flex-col gap-3 border-t pt-6 ${featured ? "border-white/15" : "border-[var(--color-line)]"}`}
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className={`t-body ${featured ? "text-white/75" : "text-[var(--color-ink-2)]"}`}>Total</dt>
                    <dd className="m-0 t-data text-[15px]">{formatInr(per * p.sessions)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className={`t-body ${featured ? "text-white/75" : "text-[var(--color-ink-2)]"}`}>You save</dt>
                    <dd className="m-0 t-data text-[15px]">{Math.round(p.discount * 100)}%</dd>
                  </div>
                </dl>

                <p className={`t-body mt-6 mb-8 ${featured ? "text-white/80" : "text-[var(--color-ink-2)]"}`}>
                  {p.blurb}
                </p>

                <div className="mt-auto">
                  <QuizButton variant={featured ? "primary" : "secondary"} size="lg" block>
                    {featured ? "Start with the quiz" : "Choose this"}
                  </QuizButton>
                </div>
              </article>
            );
          })}
        </div>
      </Section>

      <Section tone="mist" labelledBy="pricing-included">
        <SectionHeader
          id="pricing-included"
          eyebrow="In every session"
          title={
            <>
              What the price <span className="tone-2">already covers.</span>
            </>
          }
        />
        <ul className="grid grid-cols-1 gap-4 list-none m-0 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {INCLUDED.map((it, i) => (
            <li
              key={it.title}
              className="flex flex-col gap-5 rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 md:p-7"
              data-reveal
              style={delay(i * 80)}
            >
              <span className="w-11 h-11 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary-text)] inline-flex items-center justify-center">
                {it.icon}
              </span>
              <span className="flex flex-col gap-1">
                <span className="t-title text-[19px]">{it.title}</span>
                <span className="t-body text-[var(--color-ink-2)]">{it.body}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-8 inline-flex items-center gap-2 t-small text-[var(--color-ink-2)]" data-reveal>
          <span className="text-[var(--color-primary)]">
            <IconCheck size={15} />
          </span>
          A session that does not run because your vitals blocked it is refunded in full, automatically.
        </p>
      </Section>

      <Section labelledBy="pricing-faq">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <SectionHeader id="pricing-faq" eyebrow="Before you pay" title="Questions people actually ask" />
          <div data-reveal style={delay(120)}>
            <FaqList items={FAQ.map((f) => ({ ...f, a: fillZoneCount(fillLatePolicy(f.a, latePolicy), zones) }))} />
          </div>
        </div>
      </Section>

      <CtaPanel
        eyebrow="No card needed"
        title="Get a protocol reviewed first."
        lede="A physician reads your quiz before anything is booked. You pay when you book, and if the session does not go ahead it is refunded in full."
        actions={
          <>
            <QuizButton size="lg">Take the health quiz</QuizButton>
            <ButtonLink href="/drips" size="lg" variant="secondary">
              Compare the drips
            </ButtonLink>
          </>
        }
        image={SITE_IMAGES.dripChamber}
      />
    </>
  );
}

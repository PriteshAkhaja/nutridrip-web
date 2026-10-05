import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { listDrips, POPULAR_ON_HOME } from "@/lib/data/drips";
import { getContent } from "@/lib/content";
import {
  Section,
  RatingStrip,
  TestimonialCard,
  ComparisonTable,
  FaqList,
  TrustStrip,
  Stars,
} from "@/components/ui/Marketing";
import { TESTIMONIALS, AGGREGATE, COMPARISON, BRAND_BENEFITS, FAQS, CATEGORIES } from "@/lib/data/marketing";
import { Arrow } from "@/components/ui/Arrow";
import { QuizButton } from "@/components/layout/QuizButton";
import { getLatePolicy } from "@/lib/billing/settings";
import { fillLatePolicy } from "@/lib/billing/late-policy";
import { getZones } from "@/lib/zones-store";
import { fillZoneCount } from "@/lib/zones";
import { CHECKLIST_STEPS } from "@/lib/clinical/checklist";
import { APPROVAL_VALID_DAYS } from "@/lib/clinical/validity";
import { SITE_IMAGES, goalImage } from "@/lib/site-images";
import { Container, SectionHeader, delay } from "@/components/site/Layout";
import { Photo } from "@/components/site/Photo";
import { FloatChip } from "@/components/site/FloatChip";
import { CountUp } from "@/components/site/CountUp";
import { Rail } from "@/components/site/Rail";
import { DripCard } from "@/components/site/DripCard";
import { GoalTile } from "@/components/site/GoalTile";
import { StickySteps } from "@/components/site/StickySteps";
import { QuizMock, ReportMock } from "@/components/site/Mockups";
import { CtaPanel } from "@/components/site/CtaPanel";
import { CardMarquee } from "@/components/site/CardMarquee";
import { IconCheck, IconClipboard, IconHome, IconMessage, IconStethoscope, IconVial } from "@/components/site/Icons";

export const dynamic = "force-dynamic";

const HERO_POINTS = [
  { icon: <IconStethoscope size={18} />, title: "A physician reviews you first", body: "Before anything is booked" },
  { icon: <IconHome size={18} />, title: "A nurse comes to your home", body: "Council-registered" },
  { icon: <IconVial size={18} />, title: "Every dose and batch number", body: "Lands in your account" },
];

export default async function HomePage() {
  // latePolicy: the late-change rule, with today's fees (set on the Billing page).
  const [latePolicy, drips, copy, zones] = await Promise.all([getLatePolicy(), listDrips(), getContent(), getZones()]);

  // The drips the super admin ticked "Most popular" in the Drip builder (up to
  // four, one row). None ticked: the section is left out rather than filled
  // with a guess.
  const bestSellers = drips.filter((d) => d.isPopular).slice(0, POPULAR_ON_HOME);

  const perCategory = new Map<string, number>();
  for (const d of drips) perCategory.set(d.category, (perCategory.get(d.category) ?? 0) + 1);

  const figures = [
    { value: copy["home.stat1.value"], label: copy["home.stat1.label"] },
    { value: copy["home.stat2.value"], label: copy["home.stat2.label"] },
    { value: fillZoneCount(copy["home.stat3.value"], zones), label: copy["home.stat3.label"] },
  ];

  const photoFill = (key: keyof typeof SITE_IMAGES) => (
    <Photo key={key} image={SITE_IMAGES[key]} sizes="(min-width: 1024px) 44vw, 92vw" fill />
  );

  return (
    <>
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden bg-[linear-gradient(180deg,var(--color-paper)_0%,var(--color-paper)_45%,var(--color-mist)_100%)]">
        <Container className="grid grid-cols-1 items-center gap-12 pt-[calc(var(--site-header-h)+40px)] pb-16 sm:pb-20 md:pt-[calc(var(--site-header-h)+56px)] lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] lg:gap-14 lg:pt-[calc(var(--site-header-h)+64px)] lg:pb-24 xl:gap-20">
          <div className="@container min-w-0">
            <span
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-primary-line)] bg-[var(--color-primary-soft)] px-3 py-[6px] text-[12.5px] font-semibold text-[var(--color-primary-text)]"
              data-reveal="hero"
            >
              <IconCheck size={14} />
              {copy["home.badge"]}
            </span>

            <h1
              className="mt-6 max-w-[15ch]"
              data-reveal="hero"
              style={delay(60, {
                font: "600 clamp(40px, 10.6cqi, 80px)/0.98 var(--font-display)",
                letterSpacing: "-0.045em",
                textWrap: "balance",
              })}
            >
              {copy["home.headline"]}
            </h1>

            <p className="t-lead mt-6 max-w-[50ch]" data-reveal="hero" style={delay(120)}>
              {copy["home.sub"]}
            </p>

            <div className="mt-9 flex flex-wrap gap-3" data-reveal="hero" style={delay(180)}>
              <QuizButton size="lg">{copy["home.cta"]}</QuizButton>
              <ButtonLink href="/drips" size="lg" variant="secondary">
                Browse all {drips.length} drips
              </ButtonLink>
            </div>

            <div className="mt-7 flex items-center gap-3 flex-wrap" data-reveal="hero" style={delay(220)}>
              <Stars rating={AGGREGATE.rating} size={15} />
              <span className="t-data text-[13px]">{AGGREGATE.rating}</span>
              <span className="t-small text-[var(--color-ink-2)]">
                {AGGREGATE.count.toLocaleString("en-IN")} verified sessions
              </span>
            </div>

            <dl
              className="mt-10 grid max-w-[560px] grid-cols-3 gap-5 border-t border-[var(--color-line)] pt-8"
              data-reveal="hero"
              style={delay(260)}
            >
              {/* The label comes first in the markup, as a <dl> needs, and shows
                  under its figure. justify-end packs a reversed column from the
                  top, so the figures share a line whatever their labels wrap to. */}
              {figures.map((f) => (
                <div key={f.label} className="flex flex-col-reverse justify-end gap-1">
                  <dt className="t-small text-[var(--color-ink-3)]">{f.label}</dt>
                  <dd className="m-0 t-data text-[clamp(22px,2.4vw,30px)] leading-[1.1] text-[var(--color-ink)]">
                    <CountUp value={f.value} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* The photograph, with the three promises floating over it on a
              tablet and up. On a phone they would cover the people in it, so
              they sit under it as a list instead. */}
          <div className="relative min-w-0 sm:pb-10 lg:pb-0">
            <Photo
              image={SITE_IMAGES.homeHero}
              sizes="(min-width: 1280px) 640px, (min-width: 1024px) 52vw, 100vw"
              preload
              reveal="settle"
              radius="var(--radius-2xl)"
              className="aspect-[4/3.2] rounded-[var(--radius-2xl)] bg-[var(--color-surface-2)] lg:aspect-[4/4.1]"
            />
            <FloatChip
              className="absolute left-4 top-5 hidden sm:block lg:-left-8 lg:top-10"
              reveal="hero"
              style={delay(300)}
              icon={HERO_POINTS[0].icon}
              title={HERO_POINTS[0].title}
              body={HERO_POINTS[0].body}
            />
            <FloatChip
              className="absolute right-4 top-[46%] hidden sm:block lg:-right-6"
              reveal="hero"
              style={delay(380)}
              drift="late"
              icon={HERO_POINTS[2].icon}
              title={HERO_POINTS[2].title}
              body={HERO_POINTS[2].body}
            />
            <FloatChip
              className="absolute -bottom-2 left-8 hidden sm:block lg:-bottom-7 lg:left-10"
              reveal="hero"
              style={delay(460)}
              icon={HERO_POINTS[1].icon}
              title={HERO_POINTS[1].title}
              body={HERO_POINTS[1].body}
            />
            <ul className="mt-6 flex flex-col gap-3 list-none p-0 sm:hidden">
              {HERO_POINTS.map((p) => (
                <li key={p.title} className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary-text)] inline-flex items-center justify-center flex-none">
                    {p.icon}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-[14.5px] font-semibold leading-tight">{p.title}</span>
                    <span className="t-small text-[var(--color-ink-2)]">{p.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <TrustStrip
        items={[
          "Karnataka Medical Council",
          "KA/CEA/2024/11872",
          "Physician review before every protocol",
          `${CHECKLIST_STEPS.length}-step session checklist`,
          "Council-registered nurses",
          "Batch numbers on every report",
          "DPDP compliant",
          "GST invoiced",
        ]}
      />

      {/* ================= HOW IT WORKS ================= */}
      <Section labelledBy="home-how">
        <SectionHeader
          id="home-how"
          eyebrow="How it works"
          title={
            <>
              From the quiz <span className="tone-2">to the report.</span>
            </>
          }
          lede="A person accountable at every stage, and a record of what they did."
          action={
            <Link href="/how-it-works" className="t-body font-semibold inline-flex items-center gap-2">
              Every step, in detail <Arrow />
            </Link>
          }
        />
        <StickySteps
          steps={[
            {
              kicker: "You · about three minutes",
              title: "Take the health quiz",
              body: "Questions on your symptoms, medication, allergies and history. It is not a diagnosis; it is what a physician needs before they will put their name to a protocol.",
              note: "It screens for the conditions that rule IV therapy out, and tells you so straight away.",
            },
            {
              kicker: "Physician",
              title: "A physician reviews it",
              body: "A registered doctor approves a protocol, changes the doses, asks you for more, or declines. Nothing is prepared on a quiz score alone.",
              note: `An approval lasts ${APPROVAL_VALID_DAYS} days, because weight, medication and kidney function move.`,
            },
            {
              kicker: "Nurse · at your home",
              title: "A nurse comes to you",
              body: "A council-registered nurse arrives with a sealed kit, checks the seal and every vial's expiry in front of you, and takes baseline vitals before anything starts.",
              note: "A reading outside its reference range stops the infusion until the physician clears it.",
            },
            {
              kicker: "You · the same day",
              title: "Your report lands",
              body: "Your vitals, the doses given, the batch number of every vial, the aftercare notes, and the physician's name and registration number.",
              note: "If a manufacturer recalls a batch, we can name everyone who received it the same day.",
            },
          ]}
          media={[
            <QuizMock key="quiz" />,
            photoFill("physicianPhone"),
            photoFill("vitalsHome"),
            <ReportMock key="report" />,
          ]}
        />
      </Section>

      {/* ================= MOST BOOKED ================= */}
      {bestSellers.length > 0 && (
        <Section tone="mist" labelledBy="home-popular">
          <SectionHeader
            id="home-popular"
            eyebrow="Most booked"
            title="Where most people start"
            lede="Each formula is a fixed recipe a physician can adjust for you, and every dose in it is published."
            action={
              <ButtonLink href="/drips" variant="secondary">
                All {drips.length} drips
              </ButtonLink>
            }
          />
          {/* Three or more: an endless, slowly moving row. Fewer would repeat
              themselves too visibly to loop, so they stay a still row. */}
          {bestSellers.length >= 3 ? (
            <div className="-mx-6 md:-mx-10" data-reveal>
              <CardMarquee
                label="Most booked drips"
                items={bestSellers.map((d) => (
                  <DripCard key={d.slug} drip={d} sizes="(min-width: 640px) 288px, 70vw" />
                ))}
              />
            </div>
          ) : (
            <Rail
              label="Most booked drips"
              className="-mx-6 gap-5 px-6 scroll-px-6 md:-mx-10 md:px-10 md:scroll-px-10 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0"
            >
              {bestSellers.map((d, i) => (
                <div key={d.slug} className="w-[78%] flex-none sm:w-[44%] lg:w-auto" data-reveal style={delay(i * 90)}>
                  <DripCard drip={d} />
                </div>
              ))}
            </Rail>
          )}
        </Section>
      )}

      {/* ================= BY GOAL ================= */}
      <Section labelledBy="home-goals">
        <SectionHeader
          id="home-goals"
          eyebrow="By goal"
          title={
            <>
              What are you <span className="tone-2">trying to fix?</span>
            </>
          }
          action={
            <Link href="/drips" className="t-body font-semibold inline-flex items-center gap-2">
              Browse the catalogue <Arrow />
            </Link>
          }
        />
        <Rail
          label="Drips by goal"
          className="-mx-6 gap-4 px-6 scroll-px-6 sm:gap-5 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3"
        >
          {CATEGORIES.map((c, i) => (
            <div
              key={c.slug}
              className="w-[78%] flex-none sm:w-[46%] md:w-auto"
              data-reveal
              style={delay((i % 3) * 90)}
            >
              <GoalTile
                href={`/drips?goal=${encodeURIComponent(c.slug)}`}
                name={c.name}
                blurb={c.blurb}
                count={perCategory.get(c.slug) ?? 0}
                image={goalImage(c.slug)}
              />
            </div>
          ))}
        </Rail>
      </Section>

      {/* ================= WHERE THE SAFETY SITS ================= */}
      <Section tone="deep" labelledBy="home-safety">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-20">
          <div className="relative pb-8 lg:pb-0">
            <Photo
              image={SITE_IMAGES.vialsMono}
              sizes="(min-width: 1024px) 44vw, 100vw"
              reveal
              radius="var(--radius-2xl)"
              className="aspect-[4/3.6] rounded-[var(--radius-2xl)] lg:aspect-[4/4.6]"
            />
            <FloatChip
              className="absolute -bottom-2 left-5 right-5 sm:right-auto lg:-bottom-6 lg:-right-8 lg:left-auto"
              style={delay(300)}
              icon={<IconClipboard size={18} />}
              title={`${CHECKLIST_STEPS.length} steps, none skippable`}
              body="Mandatory steps refuse to close out of order"
            />
          </div>
          <div>
            <span className="t-eyebrow" data-reveal>
              Why us
            </span>
            <h2 id="home-safety" className="t-section mt-4 max-w-[16ch]" data-reveal style={delay(70)}>
              {copy["home.safety.heading"]}
            </h2>
            <p className="t-lead mt-5 max-w-[52ch]" data-reveal style={delay(140)}>
              {copy["home.safety.body"]}
            </p>
            <div className="mt-12 grid grid-cols-1 gap-x-10 gap-y-9 sm:grid-cols-2">
              {BRAND_BENEFITS.map((b, i) => (
                <div key={b.title} className="border-t border-white/15 pt-6" data-reveal style={delay(200 + i * 80)}>
                  <span className="t-data text-[13px] text-[var(--color-primary-on-dark)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3
                    className="mt-3 text-white"
                    style={{ font: "600 19px/1.3 var(--font-display)", letterSpacing: "-0.02em" }}
                  >
                    {b.title}
                  </h3>
                  <p className="t-body mt-2 text-white/70">{b.body}</p>
                </div>
              ))}
            </div>
            <Link
              href="/safety"
              className="mt-12 inline-flex items-center gap-2 t-body font-semibold text-[var(--color-primary-on-dark)] no-underline hover:underline"
              data-reveal
            >
              How we keep it safe <Arrow />
            </Link>
          </div>
        </div>
      </Section>

      {/* ================= REVIEWS ================= */}
      <Section labelledBy="home-reviews">
        <SectionHeader
          id="home-reviews"
          eyebrow="What people say"
          title={
            <>
              The reviews that mention <span className="tone-2">being told no.</span>
            </>
          }
          lede="Those are the ones worth reading. Anyone can be pleased when they get what they asked for."
          action={<RatingStrip rating={AGGREGATE.rating} count={AGGREGATE.count} />}
        />
        <Rail
          label="Reviews from verified sessions"
          autoplay={4500}
          className="-mx-6 gap-5 px-6 scroll-px-6 md:mx-0 md:px-0 md:scroll-px-0"
        >
          {TESTIMONIALS.map((t, i) => (
            <div
              key={t.id}
              className="w-[86%] flex-none sm:w-[58%] lg:w-[calc((100%-40px)/3)]"
              data-reveal
              style={delay((i % 3) * 90)}
            >
              <TestimonialCard t={t} />
            </div>
          ))}
        </Rail>
      </Section>

      {/* ================= COMPARISON ================= */}
      <Section tone="soft" labelledBy="home-compare">
        <SectionHeader
          id="home-compare"
          align="center"
          eyebrow="Honestly compared"
          title="Us, a drip bar, and a hospital"
          lede="Every row is something you can check for yourself elsewhere on this site."
        />
        <div className="mx-auto max-w-[1000px]">
          <ComparisonTable columns={COMPARISON.columns} rows={COMPARISON.rows} />
        </div>
      </Section>

      {/* ================= NOT FOR EVERYONE ================= */}
      <Section labelledBy="home-contra">
        <div
          className="grid overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-surface)] lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]"
          data-reveal
        >
          <div className="flex flex-col justify-center p-8 sm:p-10 md:p-14">
            <span className="t-eyebrow">{copy["home.contra.heading"]}</span>
            <h2 id="home-contra" className="t-section mt-4 max-w-[15ch]">
              We turn people away, <span className="tone-2">and that is the point.</span>
            </h2>
            <p className="t-lead mt-5 max-w-[52ch]">{copy["home.contra.body"]}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/safety" size="lg">
                Read the full contraindication list
              </ButtonLink>
              <QuizButton size="lg" variant="secondary">
                Take the quiz · 3 min
              </QuizButton>
            </div>
          </div>
          <Photo
            image={SITE_IMAGES.dripWindowLight}
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="order-first min-h-[260px] sm:min-h-[320px] lg:order-none lg:min-h-full"
          />
        </div>
      </Section>

      {/* ================= FAQ ================= */}
      <Section tone="mist" labelledBy="home-faq">
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-16">
          <div className="lg:sticky lg:top-[calc(var(--site-header-h)+40px)]">
            <SectionHeader
              id="home-faq"
              eyebrow="Before you book"
              title="Questions people actually ask"
              className="md:mb-10"
            />
            <div
              className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 md:p-7"
              data-reveal
              style={delay(200)}
            >
              <span className="w-10 h-10 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary-text)] inline-flex items-center justify-center">
                <IconMessage size={19} />
              </span>
              <h3 className="t-title mt-4 text-[20px]">Not answered here?</h3>
              <p className="t-body text-[var(--color-ink-2)] mt-2">
                Ask our clinical team. Tell us what you want to know and how to reach you, and someone will get back to
                you.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
                <ButtonLink href="/consult" variant="primary">
                  Ask a clinician
                </ButtonLink>
                <Link href="/faqs" className="t-body font-semibold inline-flex items-center gap-2 min-h-[44px]">
                  All FAQs <Arrow />
                </Link>
              </div>
            </div>
          </div>
          <div data-reveal style={delay(120)}>
            <FaqList items={FAQS.map((f) => ({ ...f, a: fillZoneCount(fillLatePolicy(f.a, latePolicy), zones) }))} />
          </div>
        </div>
      </Section>

      {/* ================= CLOSING ================= */}
      <CtaPanel
        eyebrow="Start here"
        title="Three minutes now, or another month of guessing."
        lede="A physician reads every submission. If IV therapy is not right for you, they will say so, and tell you what is."
        actions={
          <>
            <QuizButton size="lg">Take the health quiz</QuizButton>
            <ButtonLink href="/drips" size="lg" variant="secondary">
              Browse drips
            </ButtonLink>
          </>
        }
        note="No card needed to get a protocol reviewed."
        image={SITE_IMAGES.dripLineWindow}
      />
    </>
  );
}

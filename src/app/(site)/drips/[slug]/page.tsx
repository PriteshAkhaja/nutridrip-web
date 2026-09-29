import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDrip, listDrips } from "@/lib/data/drips";
import { formatInr } from "@/lib/inventory/units";
import { checkAvailability } from "@/lib/inventory/availability";
import { FillBar } from "@/components/ui/Fill";
import { Pill } from "@/components/ui/Pill";
import { Section, RatingStrip, TestimonialCard, ComparisonTable, FaqList } from "@/components/ui/Marketing";
import { TESTIMONIALS, AGGREGATE, COMPARISON, FAQS, TRANSFORMATION } from "@/lib/data/marketing";
import { Arrow } from "@/components/ui/Arrow";
import { QuizButton } from "@/components/layout/QuizButton";
import { getLatePolicy } from "@/lib/billing/settings";
import { fillLatePolicy } from "@/lib/billing/late-policy";
import { getZones } from "@/lib/zones-store";
import { fillZoneCount } from "@/lib/zones";
import { SITE_IMAGES, dripImage } from "@/lib/site-images";
import { Container, SectionHeader, delay } from "@/components/site/Layout";
import { Photo } from "@/components/site/Photo";
import { Rail } from "@/components/site/Rail";
import { DripCard } from "@/components/site/DripCard";
import { CtaPanel } from "@/components/site/CtaPanel";
import { MobileBookBar } from "@/components/site/MobileBookBar";
import { IconBox, IconCheck, IconDrop } from "@/components/site/Icons";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const drip = await getDrip(slug);
  return { title: drip?.name ?? "Drip", description: drip?.description };
}

const ROLE_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  FLUID: "Carrier",
  PREMED: "Pre-med",
  ADDITIVE: "Additive",
};

const KIT_CONTENTS = [
  "Sterile IV administration set",
  "22G cannula, single use",
  "Alcohol swabs ×3",
  "Nitrile gloves ×2 pairs",
  "Fixation tape",
  "Sharps disposal",
];

export default async function DripDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Everything that does not depend on the drip is read alongside it, so the
  // page waits on two rounds of queries rather than three. latePolicy: the
  // late-change rule, with today's fees (set on the Billing page).
  const [drip, latePolicy, zones, all] = await Promise.all([getDrip(slug), getLatePolicy(), getZones(), listDrips()]);
  if (!drip) notFound();

  const { results } = await checkAvailability([{ dripId: drip.id, quantity: 1 }], true);
  const available = results[0]?.wholeVialAvailability ?? 0;
  const bottleneck = results[0]?.bottleneck ?? null;

  const related = all.filter((d) => d.slug !== drip.slug).slice(0, 4);
  const forThisDrip = TESTIMONIALS.filter((t) => t.drip === drip.name);
  // Reviews of this drip when there are enough to show; otherwise reviews of
  // sessions in general, and the heading says so rather than implying these
  // are about this formula.
  const ownReviews = forThisDrip.length >= 2;
  const reviews = (ownReviews ? forThisDrip : TESTIMONIALS).slice(0, 6);
  const actives = drip.ingredients.filter((i) => i.role === "ACTIVE");
  const image = dripImage(drip.slug, drip.category);

  const facts: Array<[string, string]> = [
    ["Duration", drip.durationLabel],
    ...(drip.volumeMl ? ([["Volume", `${drip.volumeMl} ml`]] as Array<[string, string]>) : []),
    ["Components", String(drip.ingredientCount)],
    ["Session kit", "Included"],
  ];

  return (
    <>
      {/* ================= BREADCRUMB ================= */}
      <Container className="pt-[calc(var(--site-header-h)+24px)] md:pt-[calc(var(--site-header-h)+32px)]">
        <nav aria-label="Breadcrumb">
          <ol className="list-none m-0 p-0 flex flex-wrap items-center gap-2 t-small text-[var(--color-ink-3)]">
            <li>
              <Link href="/" className="text-[var(--color-ink-2)] hover:text-[var(--color-ink)]">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href="/drips" className="text-[var(--color-ink-2)] hover:text-[var(--color-ink)]">
                Drips
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-[var(--color-ink)]">
              {drip.name}
            </li>
          </ol>
        </nav>
      </Container>

      {/* ================= HERO ================= */}
      <section>
        <Container className="grid grid-cols-1 items-start gap-10 pt-6 pb-16 md:pb-24 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] lg:gap-16 lg:pt-8">
          {/* --- The picture and the formula at a glance. Holds still beside
                 the pitch on a wide screen. --- */}
          <div className="lg:sticky lg:top-[calc(var(--site-header-h)+24px)]">
            <div className="relative">
              <Photo
                image={image}
                sizes="(min-width: 1280px) 620px, (min-width: 1024px) 50vw, 100vw"
                preload
                reveal="settle"
                radius="var(--radius-2xl)"
                className="aspect-[4/4.3] rounded-[var(--radius-2xl)] bg-[var(--color-surface-2)] sm:aspect-[4/3.3] lg:aspect-[4/4.7]"
              >
                <span className="absolute left-5 top-5 inline-flex items-center gap-[6px] rounded-full bg-white px-3 py-[6px] text-[12.5px] font-semibold text-[var(--color-ink)]">
                  {drip.icon ? (
                    <span aria-hidden className="text-[13px] leading-none">
                      {drip.icon}
                    </span>
                  ) : null}
                  {drip.category}
                </span>
              </Photo>

              {actives.length > 0 ? (
                // On a phone the card overlaps only the photograph's lower edge,
                // so the picture is not hidden behind it; from 640px it floats
                // over the corner.
                <div
                  className="relative mx-4 -mt-16 rounded-[20px] border border-white/70 bg-white p-5 shadow-[var(--shadow-float)] sm:absolute sm:bottom-5 sm:left-5 sm:mx-0 sm:mt-0 sm:w-[320px]"
                  data-reveal="hero"
                  style={delay(300)}
                >
                  <span className="t-micro">The actives</span>
                  <ul className="list-none m-0 p-0 mt-2">
                    {actives.slice(0, 4).map((a) => (
                      <li
                        key={a.name + a.dose}
                        className="flex items-baseline justify-between gap-4 border-b border-[var(--color-line)] py-2 last:border-b-0"
                      >
                        <span className="t-body font-medium text-[var(--color-ink)] min-w-0 truncate">{a.name}</span>
                        <span className="t-data text-[13.5px] text-[var(--color-ink-2)] flex-none">
                          {a.dose.toLocaleString("en-IN")} {a.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <a href="#formula" className="mt-3 inline-flex items-center gap-2 t-small font-semibold">
                    Every ingredient, every dose <Arrow />
                  </a>
                </div>
              ) : null}
            </div>
          </div>

          {/* --- The pitch --- */}
          <div className="min-w-0">
            <span className="t-eyebrow" data-reveal="hero">
              {drip.category}
            </span>
            <h1 className="t-display-sm mt-4" data-reveal="hero" style={delay(60)}>
              {drip.name}
            </h1>
            {drip.tagline && (
              <p
                className="mt-3 text-[clamp(18px,1.6vw,21px)] font-medium leading-[1.4] text-[var(--color-primary-text)]"
                data-reveal="hero"
                style={delay(110)}
              >
                {drip.tagline}
              </p>
            )}
            <p className="t-lead mt-5 max-w-[56ch]" data-reveal="hero" style={delay(160)}>
              {drip.description}
            </p>
            <div className="mt-5" data-reveal="hero" style={delay(200)}>
              <RatingStrip rating={AGGREGATE.rating} count={AGGREGATE.count} />
            </div>

            {drip.benefits.length > 0 && (
              <div className="mt-10" data-reveal="hero" style={delay(240)}>
                <h2 className="t-micro">What it helps with</h2>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {drip.benefits.map((b) => (
                    <div key={b.title} className="rounded-[var(--radius-lg)] bg-[var(--color-mist)] p-5">
                      <span className="t-body font-semibold block text-[var(--color-ink)]">{b.title}</span>
                      {b.description && (
                        <span className="t-small text-[var(--color-ink-2)] block mt-1">{b.description}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {drip.bestFor.length > 0 && (
              <div className="mt-8" data-reveal>
                <h2 className="t-micro">Best for</h2>
                <ul className="list-none m-0 p-0 mt-3 flex flex-wrap gap-2">
                  {drip.bestFor.map((b) => (
                    <li
                      key={b}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line-2)] bg-[var(--color-surface)] px-3 py-[7px] t-small font-medium text-[var(--color-ink)]"
                    >
                      <span className="text-[var(--color-primary)]">
                        <IconCheck size={15} />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* --- Price and stock --- */}
            <div
              id="book-card"
              className="@container mt-10 rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 md:p-7"
              data-reveal
              style={delay(80)}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex flex-col">
                  <span className="t-micro">Per session, everything included</span>
                  <span className="t-data mt-2 text-[clamp(32px,3.2vw,40px)] leading-none text-[var(--color-ink)]">
                    {formatInr(drip.priceInr)}
                  </span>
                </div>
                {available === 0 ? (
                  <Pill tone="critical" dot>
                    Out of stock
                  </Pill>
                ) : available <= 3 ? (
                  <Pill tone="caution" dot>
                    Only {available} left today
                  </Pill>
                ) : (
                  <Pill tone="safe" dot>
                    In stock · {available} available
                  </Pill>
                )}
              </div>

              {/* Four across only once the card itself is wide enough (448px):
                  beside the photo at 1024 it is about 280px, and four columns
                  there ran "Components" into "Session kit". */}
              <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-[var(--color-line)] pt-5 @md:grid-cols-4">
                {facts.map(([k, v]) => (
                  <div key={k} className="flex flex-col gap-1 min-w-0">
                    <dt className="t-micro">{k}</dt>
                    <dd className="m-0 t-data text-[15px] text-[var(--color-ink)] whitespace-nowrap">{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-6">
                <QuizButton drip={drip.slug} size="lg" block>
                  Take the quiz to book this
                </QuizButton>
              </div>

              {bottleneck && available <= 3 && available > 0 && (
                <p className="t-small text-[var(--color-ink-2)] mt-3">
                  Limited by <span className="t-data text-[13px]">{bottleneck.ingredient}</span> — the pharmacy is
                  restocking.
                </p>
              )}

              <p className="t-small text-[var(--color-ink-3)] mt-4">
                A physician reviews your answers before anything is scheduled. If this drip is not right for you, they
                will say so — and you pay nothing.
              </p>
            </div>

            <ul className="list-none m-0 p-0 mt-5 flex flex-wrap gap-x-6 gap-y-2 t-small text-[var(--color-ink-2)]">
              {[
                "No card to get reviewed",
                `Free to move or cancel up to ${latePolicy.windowHours} ${latePolicy.windowHours === 1 ? "hour" : "hours"} before`,
                "GST invoice issued",
              ].map((a) => (
                <li key={a} className="inline-flex items-center gap-2">
                  <span className="text-[var(--color-primary)]">
                    <IconCheck size={15} />
                  </span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* ================= THE FORMULA ================= */}
      <Section tone="mist" id="formula" labelledBy="formula-title">
        <SectionHeader
          id="formula-title"
          eyebrow="Full disclosure"
          title={
            <>
              Every ingredient, <span className="tone-2">every dose.</span>
            </>
          }
          lede="Bars show each component's weight within this formula. Doses in different units are not directly comparable, so the scale is the formula's own maximum."
        />
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)]">
          <div
            className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 md:p-8 flex flex-col gap-5"
            data-reveal
          >
            {drip.ingredients.map((ing) => (
              <FillBar
                key={ing.name + ing.dose}
                label={
                  <span className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-medium text-[var(--color-ink)]">{ing.name}</span>
                    <span className="t-small text-[var(--color-ink-3)]">
                      {ROLE_LABEL[ing.role] ?? ing.role}
                      {ing.notes ? ` · ${ing.notes}` : ""}
                    </span>
                  </span>
                }
                value={`${ing.dose.toLocaleString("en-IN")} ${ing.unit}`}
                pct={ing.pct}
                color={ing.role === "ACTIVE" ? "var(--color-primary)" : "var(--color-line-2)"}
              />
            ))}
          </div>

          <div className="flex flex-col gap-4">
            <div
              className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 md:p-7"
              data-reveal
              style={delay(80)}
            >
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary-text)] inline-flex items-center justify-center">
                  <IconBox size={18} />
                </span>
                <h3 className="t-title text-[19px]">What&apos;s in the box</h3>
              </div>
              <ul className="flex flex-col gap-[10px] mt-5 list-none p-0 m-0">
                {KIT_CONTENTS.map((k) => (
                  <li key={k} className="flex gap-3 items-start">
                    <span className="w-[5px] h-[5px] rounded-full bg-[var(--color-primary)] flex-none mt-[9px]" />
                    <span className="t-body text-[var(--color-ink-2)]">{k}</span>
                  </li>
                ))}
              </ul>
              <p className="t-small text-[var(--color-ink-3)] mt-5 pt-4 border-t border-[var(--color-line)]">
                Sealed. Your nurse confirms the seal is intact in front of you before opening anything.
              </p>
            </div>

            {drip.infusionNotes && (
              <div
                className="on-dark rounded-[var(--radius-xl)] bg-[var(--color-deep)] p-6 md:p-7 text-white"
                data-reveal
                style={delay(140)}
              >
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-white/10 text-[var(--color-primary-on-dark)] inline-flex items-center justify-center">
                    <IconDrop size={18} />
                  </span>
                  <span className="t-eyebrow">How it is given</span>
                </div>
                <p className="t-body-lg mt-4 text-white/90" style={{ textWrap: "pretty" }}>
                  {drip.infusionNotes}
                </p>
              </div>
            )}

            {drip.goodToKnow.length > 0 && (
              <div
                className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 md:p-7"
                data-reveal
                style={delay(200)}
              >
                <span className="t-micro">Good to know</span>
                <ul className="flex flex-col gap-2 mt-3 list-none p-0 m-0">
                  {drip.goodToKnow.map((g) => (
                    <li key={g} className="t-body text-[var(--color-ink-2)]">
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ================= HOW A SESSION RUNS ================= */}
      <Section labelledBy="session-title">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-20">
          <Photo
            image={SITE_IMAGES.vitalsHome}
            sizes="(min-width: 1024px) 44vw, 100vw"
            reveal
            radius="var(--radius-2xl)"
            className="aspect-[4/3.3] rounded-[var(--radius-2xl)] lg:aspect-[4/4.4]"
          />
          <div>
            <SectionHeader
              id="session-title"
              eyebrow="The session"
              title={
                <>
                  What the hour <span className="tone-2">actually looks like.</span>
                </>
              }
              className="md:mb-10"
            />
            <ol className="list-none m-0 p-0 flex flex-col">
              {TRANSFORMATION.map((t, i) => (
                <li
                  key={t.step}
                  className="relative grid grid-cols-[44px_1fr] gap-5 pb-8 last:pb-0"
                  data-reveal
                  style={delay(i * 90)}
                >
                  {/* The line between the numbers: a hairline, not a colour. */}
                  {i < TRANSFORMATION.length - 1 ? (
                    <span aria-hidden className="absolute left-[22px] top-12 bottom-0 w-px bg-[var(--color-line-2)]" />
                  ) : null}
                  <span
                    className={`t-data relative inline-flex h-11 w-11 items-center justify-center rounded-full border text-[14px] ${
                      i === 1
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                        : "border-[var(--color-line-2)] bg-[var(--color-surface)] text-[var(--color-ink)]"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="pt-1">
                    <span className="t-micro">{t.step}</span>
                    <h3 className="t-title mt-2 text-[21px]">{t.title}</h3>
                    <p className="t-body text-[var(--color-ink-2)] mt-2 max-w-[52ch]">{t.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-10" data-reveal>
              <QuizButton drip={drip.slug} size="lg">
                Start with the quiz · 3 min
              </QuizButton>
            </div>
          </div>
        </div>
      </Section>

      {/* ================= REVIEWS ================= */}
      <Section tone="soft" labelledBy="reviews-title">
        <SectionHeader
          id="reviews-title"
          eyebrow="Verified sessions"
          title={ownReviews ? `What people say about ${drip.name}` : "What people say after a session"}
          action={<RatingStrip rating={AGGREGATE.rating} count={AGGREGATE.count} />}
        />
        <Rail
          label="Reviews from verified sessions"
          autoplay={5500}
          className="-mx-6 gap-5 px-6 scroll-px-6 md:mx-0 md:px-0 md:scroll-px-0"
        >
          {reviews.map((t, i) => (
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
      <Section labelledBy="compare-title">
        <SectionHeader
          id="compare-title"
          align="center"
          eyebrow="Compared honestly"
          title="Us, a drip bar, and a hospital"
          lede="Every row is something you can verify for yourself elsewhere on this site."
        />
        <div className="mx-auto max-w-[1000px]">
          <ComparisonTable columns={COMPARISON.columns} rows={COMPARISON.rows} />
        </div>
      </Section>

      {/* ================= FAQ ================= */}
      <Section tone="mist" labelledBy="faq-title">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <SectionHeader
            id="faq-title"
            eyebrow="Before you book"
            title="Questions people actually ask"
            lede={
              <>
                More in the <Link href="/faqs">FAQs</Link>, or <Link href="/consult">ask a clinician</Link>.
              </>
            }
          />
          <div data-reveal style={delay(120)}>
            <FaqList items={FAQS.map((f) => ({ ...f, a: fillZoneCount(fillLatePolicy(f.a, latePolicy), zones) }))} />
          </div>
        </div>
      </Section>

      {/* ================= CLOSING ================= */}
      <CtaPanel
        id="drip-cta"
        eyebrow={drip.name}
        title="You already know how the next month feels without it."
        lede={`Three minutes of questions, read by a registered physician. If ${drip.name} is wrong for you, they will tell you what is right instead.`}
        actions={
          <QuizButton drip={drip.slug} size="lg">
            Take the health quiz
          </QuizButton>
        }
        image={SITE_IMAGES.nursePrep}
      />

      {/* ================= RELATED ================= */}
      {related.length > 0 && (
        <Section labelledBy="related-title" className="!pt-0">
          <SectionHeader
            id="related-title"
            eyebrow="Also considered"
            title="Other protocols"
            action={
              <Link href="/drips" className="t-body font-semibold inline-flex items-center gap-2">
                All drips <Arrow />
              </Link>
            }
          />
          <Rail
            label="Other protocols"
            className="-mx-6 gap-5 px-6 scroll-px-6 md:-mx-10 md:px-10 md:scroll-px-10 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0"
          >
            {related.map((d, i) => (
              <div key={d.slug} className="w-[78%] flex-none sm:w-[44%] lg:w-auto" data-reveal style={delay(i * 90)}>
                <DripCard drip={d} />
              </div>
            ))}
          </Rail>
        </Section>
      )}

      {/* ================= PHONE BOOKING BAR ================= */}
      <MobileBookBar targetId="book-card" hideWhenId="drip-cta">
        <div className="flex min-w-0 flex-col">
          <span className="t-small text-[var(--color-ink-3)] truncate">{drip.name}</span>
          <span className="t-data text-[18px] leading-tight text-[var(--color-ink)]">{formatInr(drip.priceInr)}</span>
        </div>
        <div className="ml-auto flex-none">
          <QuizButton drip={drip.slug}>Take the quiz</QuizButton>
        </div>
      </MobileBookBar>
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDrip, listDrips } from "@/lib/data/drips";
import { formatInr } from "@/lib/inventory/units";
import { checkAvailability } from "@/lib/inventory/availability";
import { FillBar } from "@/components/ui/Fill";
import { ButtonLink } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import {
  Section,
  SectionHeading,
  Stars,
  RatingStrip,
  TestimonialCard,
  ComparisonTable,
  FaqList,
} from "@/components/ui/Marketing";
import { TESTIMONIALS, AGGREGATE, COMPARISON, FAQS, TRANSFORMATION } from "@/lib/data/marketing";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
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
  const drip = await getDrip(slug);
  if (!drip) notFound();

  const [{ results }, all] = await Promise.all([
    checkAvailability([{ dripId: drip.id, quantity: 1 }], true),
    listDrips(),
  ]);
  const available = results[0]?.wholeVialAvailability ?? 0;
  const bottleneck = results[0]?.bottleneck ?? null;

  const related = all.filter((d) => d.slug !== drip.slug).slice(0, 4);
  const forThisDrip = TESTIMONIALS.filter((t) => t.drip === drip.name);
  const reviews = (forThisDrip.length >= 2 ? forThisDrip : TESTIMONIALS).slice(0, 3);
  const actives = drip.ingredients.filter((i) => i.role === "ACTIVE");

  return (
    <>
      {/* ================= BREADCRUMB ================= */}
      <div className="border-b border-[var(--color-line)]">
        <nav
          aria-label="Breadcrumb"
          className="mx-auto max-w-[1240px] px-6 md:px-10 py-3 flex items-center gap-2 t-small"
        >
          <Link href="/" className="text-[var(--color-ink-2)]">Home</Link>
          <span className="text-[var(--color-ink-3)]">/</span>
          <Link href="/drips" className="text-[var(--color-ink-2)]">Drips</Link>
          <span className="text-[var(--color-ink-3)]">/</span>
          <span className="text-[var(--color-ink)]">{drip.name}</span>
        </nav>
      </div>

      {/* ================= HERO ================= */}
      <section className="bg-[var(--color-paper)]">
        <div className="mx-auto max-w-[1240px] px-6 md:px-10 py-10 md:py-14">
          <div className="grid gap-10 lg:gap-14 lg:grid-cols-[1fr_1fr] items-start">
            {/* --- The object --- */}
            <div className="lg:sticky lg:top-24">
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-2)] aspect-square flex items-center justify-center relative overflow-hidden">
                <BagArt />
                <span
                  className="absolute top-5 left-5 t-micro px-3 py-[6px] rounded-full"
                  style={{ background: "#fff", border: "1px solid var(--color-line)" }}
                >
                  {drip.category}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-3 mt-3">
                {actives.slice(0, 4).map((ing, i) => (
                  <div
                    key={ing.name}
                    className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] aspect-square flex flex-col items-center justify-center gap-1 p-2"
                  >
                    <AmpouleArt index={i} />
                    <span className="t-small text-[var(--color-ink-3)] text-center leading-tight truncate w-full">
                      {ing.name.split(" ")[0]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* --- The pitch --- */}
            <div>
              <div className="flex items-center gap-3 flex-wrap mb-4">
                <Stars rating={5} size={15} />
                <span className="t-small text-[var(--color-ink-2)]">
                  {reviews.length} reviews for this drip
                </span>
              </div>

              <h1
                className="mb-3"
                style={{
                  font: "700 clamp(32px,4.4vw,48px)/1.04 var(--font-display)",
                  letterSpacing: "-0.035em",
                  textWrap: "balance",
                }}
              >
                {drip.name}
              </h1>

              {drip.tagline && (
                <p
                  className="mb-4"
                  style={{ font: "500 18px/1.5 var(--font-sans)", color: "var(--color-primary)" }}
                >
                  {drip.tagline}
                </p>
              )}

              <p className="t-body-lg text-[var(--color-ink-2)] max-w-[54ch] mb-6" style={{ textWrap: "pretty" }}>
                {drip.description}
              </p>

              {drip.benefits.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 mt-6">
                  {drip.benefits.map((b) => (
                    <div
                      key={b.title}
                      className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-4"
                    >
                      <span className="t-body font-semibold block">{b.title}</span>
                      {b.description && (
                        <span className="t-small text-[var(--color-ink-2)] block mt-1">{b.description}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {drip.bestFor.length > 0 && (
                <ul className="flex flex-col gap-[10px] mb-7 list-none p-0 m-0">
                  {drip.bestFor.map((b) => (
                    <li key={b} className="flex gap-3 items-start">
                      <span
                        className="inline-flex items-center justify-center rounded-full flex-none mt-[3px]"
                        style={{
                          width: 18,
                          height: 18,
                          background: "var(--color-primary)",
                          color: "#fff",
                          font: "600 10px/1 var(--font-sans)",
                        }}
                        aria-hidden
                      >
                        ✓
                      </span>
                      <span className="t-body">{b}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* --- Price and stock --- */}
              <div className="rounded-[var(--radius-lg)] border-2 border-[var(--color-ink)] p-6">
                <div className="flex items-end justify-between gap-4 flex-wrap mb-5">
                  <div className="flex flex-col">
                    <span className="t-micro">Per session, everything included</span>
                    <span className="t-data" style={{ fontSize: 34, lineHeight: 1.1 }}>
                      {formatInr(drip.priceInr)}
                    </span>
                  </div>
                  {available === 0 ? (
                    <Pill tone="critical" dot>Out of stock</Pill>
                  ) : available <= 3 ? (
                    <Pill tone="caution" dot>Only {available} left today</Pill>
                  ) : (
                    <Pill tone="safe" dot>In stock · {available} available</Pill>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4 py-4 border-y border-[var(--color-line)] mb-5">
                  {[
                    ["Duration", drip.durationLabel],
                    ...(drip.volumeMl ? ([["Volume", `${drip.volumeMl} ml`]] as const) : []),
                    ["Components", String(drip.ingredientCount)],
                    ["Session kit", "Included"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex flex-col">
                      <span className="t-micro">{k}</span>
                      <span className="t-data text-[15px]">{v}</span>
                    </div>
                  ))}
                </div>

                <ButtonLink href={`/quiz?drip=${drip.slug}`} size="lg" block>
                  Take the quiz to book this
                </ButtonLink>

                {bottleneck && available <= 3 && available > 0 && (
                  <p className="t-small text-[var(--color-ink-2)] mt-3">
                    Limited by <span className="t-data text-[13px]">{bottleneck.ingredient}</span> — the pharmacy is
                    restocking.
                  </p>
                )}

                <p className="t-small text-[var(--color-ink-3)] mt-4">
                  A physician reviews your answers before anything is scheduled. If this drip is not right for you,
                  they will say so — and you pay nothing.
                </p>
              </div>

              <div className="flex gap-6 flex-wrap mt-5 t-small text-[var(--color-ink-2)]">
                <span>✓ No card to get reviewed</span>
                <span>✓ Free cancellation up to 4 hrs</span>
                <span>✓ GST invoice issued</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= THE FORMULA ================= */}
      <Section tone="soft">
        <SectionHeading
          eyebrow="Full disclosure"
          title="Every ingredient, every dose"
          sub="Bars show each component's weight within this formula. Doses in different units are not directly comparable, so the scale is the formula's own maximum."
        />
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] items-start">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-7 flex flex-col gap-[18px]">
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
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6">
              <span className="t-micro">What&apos;s in the box</span>
              <ul className="flex flex-col gap-[10px] mt-4 list-none p-0 m-0">
                {KIT_CONTENTS.map((k) => (
                  <li key={k} className="flex gap-3 items-start">
                    <span className="w-[5px] h-[5px] rounded-full bg-[var(--color-primary)] flex-none mt-[8px]" />
                    <span className="t-body text-[var(--color-ink-2)]">{k}</span>
                  </li>
                ))}
              </ul>
              <p className="t-small text-[var(--color-ink-3)] mt-4 pt-4 border-t border-[var(--color-line)]">
                Sealed. Your nurse confirms the seal is intact in front of you before opening anything.
              </p>
            </div>

            {drip.infusionNotes && (
              <div className="rounded-[var(--radius-lg)] border-2 border-[var(--color-ink)] p-6">
                <span className="t-micro" style={{ color: "var(--color-primary)" }}>
                  How it is given
                </span>
                <p className="t-body-lg mt-2" style={{ textWrap: "pretty" }}>
                  {drip.infusionNotes}
                </p>
              </div>
            )}

            {drip.goodToKnow.length > 0 && (
              <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-2)] border border-[var(--color-line)] p-6">
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
      <Section>
        <SectionHeading center eyebrow="The session" title="What the hour actually looks like" />
        <div className="grid gap-4 md:grid-cols-3">
          {TRANSFORMATION.map((t, i) => (
            <div
              key={t.step}
              className="rounded-[var(--radius-lg)] border p-7 flex flex-col gap-3"
              style={{
                borderColor: i === 1 ? "var(--color-primary)" : "var(--color-line)",
                background: "var(--color-surface)",
              }}
            >
              <span className="t-data text-[13px]" style={{ color: "var(--color-primary)" }}>
                0{i + 1}
              </span>
              <h3 style={{ font: "600 20px/1.25 var(--font-display)", letterSpacing: "-0.02em" }}>{t.title}</h3>
              <p className="t-body text-[var(--color-ink-2)]">{t.body}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-center mt-10">
          <ButtonLink href={`/quiz?drip=${drip.slug}`} size="lg">
            Start with the quiz · 3 min
          </ButtonLink>
        </div>
      </Section>

      {/* ================= REVIEWS ================= */}
      <Section tone="soft">
        <SectionHeading center eyebrow="Verified sessions" title={`What people say about ${drip.name}`} />
        <div className="flex justify-center mb-10">
          <RatingStrip rating={AGGREGATE.rating} count={AGGREGATE.count} />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {reviews.map((t) => (
            <TestimonialCard key={t.id} t={t} />
          ))}
        </div>
      </Section>

      {/* ================= COMPARISON ================= */}
      <Section>
        <SectionHeading
          center
          eyebrow="Compared honestly"
          title="Us, a drip bar, and a hospital"
          sub="Every row is something you can verify for yourself elsewhere on this site."
        />
        <ComparisonTable columns={COMPARISON.columns} rows={COMPARISON.rows} />
      </Section>

      {/* ================= FAQ ================= */}
      <Section tone="soft">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] items-start">
          <SectionHeading eyebrow="Before you book" title="Questions people actually ask" />
          <FaqList items={FAQS} />
        </div>
      </Section>

      {/* ================= EMOTIVE CTA ================= */}
      <Section tone="ink">
        <div className="flex flex-col items-center text-center gap-6">
          <h2
            className="max-w-[20ch]"
            style={{
              font: "700 clamp(28px,4vw,46px)/1.06 var(--font-display)",
              letterSpacing: "-0.03em",
              color: "#fff",
              textWrap: "balance",
            }}
          >
            You already know how the next month feels without it.
          </h2>
          <p className="t-body-lg max-w-[50ch]" style={{ color: "rgba(255,255,255,.72)" }}>
            Three minutes of questions, read by a registered physician. If {drip.name} is wrong for you, they will
            tell you what is right instead.
          </p>
          <div className="mt-2">
            <ButtonLink href={`/quiz?drip=${drip.slug}`} size="lg">
              Take the health quiz
            </ButtonLink>
          </div>
        </div>
      </Section>

      {/* ================= RELATED ================= */}
      <Section>
        <div className="flex items-end justify-between gap-6 flex-wrap mb-10">
          <SectionHeading eyebrow="Also considered" title="Other protocols" />
          <Link href="/drips" className="t-body font-semibold mb-10">
            All drips →
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {related.map((d) => (
            <Link
              key={d.slug}
              href={`/drips/${d.slug}`}
              className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] overflow-hidden no-underline hover:no-underline flex flex-col transition-colors duration-150 hover:border-[var(--color-ink)]"
            >
              <div className="aspect-[4/3] bg-[var(--color-surface-2)] flex items-center justify-center">
                <BagArt small />
              </div>
              <div className="p-5 flex flex-col gap-2 flex-1">
                <span className="t-micro">{d.category}</span>
                <h3 style={{ font: "600 18px/1.25 var(--font-display)", letterSpacing: "-0.02em" }}>{d.name}</h3>
                <Stars rating={5} size={12} />
                <div className="flex items-baseline justify-between gap-3 pt-3 mt-auto border-t border-[var(--color-line)]">
                  <span className="t-data text-[16px]">{formatInr(d.priceInr)}</span>
                  <span className="t-small text-[var(--color-ink-3)]">{d.durationLabel}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}

/** The bag, drawn rather than photographed — line art, one accent, no gloss. */
function BagArt({ small = false }: { small?: boolean }) {
  const w = small ? 92 : 168;
  const h = small ? 128 : 234;
  return (
    <svg width={w} height={h} viewBox="0 0 168 234" fill="none" aria-hidden>
      <defs>
        <clipPath id="ndDetailBag">
          <path d="M34 18h100a10 10 0 0 1 10 10v122a44 44 0 0 1-44 44H68a44 44 0 0 1-44-44V28a10 10 0 0 1 10-10Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#ndDetailBag)">
        <rect x="0" y="0" width="168" height="234" fill="#fff" />
        <rect x="0" y="92" width="168" height="142" fill="var(--color-primary)" opacity="0.85" />
      </g>
      <path
        d="M34 18h100a10 10 0 0 1 10 10v122a44 44 0 0 1-44 44H68a44 44 0 0 1-44-44V28a10 10 0 0 1 10-10Z"
        stroke="var(--color-ink)"
        strokeWidth="3"
      />
      <path d="M70 8h28" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" />
      {[60, 86, 112, 138].map((y) => (
        <path key={y} d={`M118 ${y}h16`} stroke="var(--color-ink)" strokeWidth="2" opacity="0.3" />
      ))}
      <path d="M84 194v18" stroke="var(--color-ink)" strokeWidth="3" />
      <rect x="72" y="212" width="24" height="18" rx="5" stroke="var(--color-ink)" strokeWidth="3" fill="#fff" />
    </svg>
  );
}

/** The vial bands from the packaging, in the four label colours. */
function AmpouleArt({ index }: { index: number }) {
  const bands = ["var(--color-primary)", "var(--color-ink)", "var(--color-primary)", "var(--color-ink-3)"];
  return (
    <svg width="26" height="54" viewBox="0 0 26 54" fill="none" aria-hidden>
      <rect x="8" y="1" width="10" height="6" rx="2" fill="var(--color-ink)" />
      <path
        d="M6 7h14a4 4 0 0 1 4 4v34a6 6 0 0 1-6 6H8a6 6 0 0 1-6-6V11a4 4 0 0 1 4-4Z"
        fill="#fff"
        stroke="var(--color-ink)"
        strokeWidth="1.8"
      />
      <path d="M2 24h22M2 30h22" stroke={bands[index % bands.length]} strokeWidth="4" opacity="0.75" />
    </svg>
  );
}

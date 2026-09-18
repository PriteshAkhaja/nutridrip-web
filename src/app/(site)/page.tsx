import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { listDrips } from "@/lib/data/drips";
import { ImageSlot } from "@/components/ui/ImageSlot";
import { formatInr } from "@/lib/inventory/units";
import { getContent } from "@/lib/content";
import {
  Section,
  SectionHeading,
  RatingStrip,
  TestimonialCard,
  ComparisonTable,
  FaqList,
  TrustStrip,
  Stars,
} from "@/components/ui/Marketing";
import {
  TESTIMONIALS,
  AGGREGATE,
  TRANSFORMATION,
  COMPARISON,
  BRAND_BENEFITS,
  FAQS,
  CATEGORIES,
} from "@/lib/data/marketing";
import { Arrow } from "@/components/ui/Arrow";

export const dynamic = "force-dynamic";

const HERO_BULLETS = [
  "A registered physician reviews you before anything is booked",
  "A council-registered nurse comes to your home",
  "Every dose and batch number lands in your account",
];

export default async function HomePage() {
  const [drips, copy] = await Promise.all([listDrips(), getContent()]);

  const bestSellers = ["myers-revive", "immune-shield", "glow-protocol", "hydrate-plus"]
    .map((slug) => drips.find((d) => d.slug === slug))
    .filter(Boolean) as typeof drips;

  return (
    <>
      {/* ================= HERO ================= */}
      <section className="bg-[var(--color-paper)]">
        <div className="mx-auto max-w-[1240px] px-6 md:px-10 pt-10 pb-14 md:pt-16 md:pb-20">
          <div className="grid grid-cols-1 gap-10 lg:gap-16 lg:grid-cols-[1.02fr_0.98fr] items-center">
            <div>
              <div className="flex items-center gap-3 flex-wrap mb-6">
                <Stars rating={AGGREGATE.rating} size={15} />
                <span className="t-data text-[13px]">{AGGREGATE.rating}</span>
                <span className="t-small text-[var(--color-ink-2)]">
                  {AGGREGATE.count.toLocaleString("en-IN")} verified sessions
                </span>
              </div>

              <h1
                className="max-w-[17ch] mb-5"
                style={{
                  font: "700 clamp(36px,5.6vw,60px)/1.02 var(--font-display)",
                  letterSpacing: "-0.04em",
                  textWrap: "balance",
                }}
              >
                {copy["home.headline"]}
              </h1>

              <p
                className="max-w-[52ch] mb-7"
                style={{ font: "400 18px/1.6 var(--font-sans)", color: "var(--color-ink-2)", textWrap: "pretty" }}
              >
                {copy["home.sub"]}
              </p>

              <ul className="flex flex-col gap-[10px] mb-8 list-none p-0 m-0">
                {HERO_BULLETS.map((b) => (
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
                    <span className="t-body text-[var(--color-ink)]">{b}</span>
                  </li>
                ))}
              </ul>

              <div className="flex gap-3 flex-wrap">
                <ButtonLink href="/quiz" size="lg">
                  {copy["home.cta"]}
                </ButtonLink>
                <ButtonLink href="/drips" size="lg" variant="secondary">
                  Browse all {drips.length} drips
                </ButtonLink>
              </div>

              <div className="flex gap-8 md:gap-10 flex-wrap mt-9 pt-7 border-t border-[var(--color-line)]">
                {[
                  [copy["home.stat1.value"], copy["home.stat1.label"]],
                  [copy["home.stat2.value"], copy["home.stat2.label"]],
                  [copy["home.stat3.value"], copy["home.stat3.label"]],
                ].map(([value, label]) => (
                  <div key={label} className="flex flex-col gap-1">
                    <span className="t-data" style={{ fontSize: 28, lineHeight: 1.1 }}>
                      {value}
                    </span>
                    <span className="t-small text-[var(--color-ink-3)]">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <ImageSlot
              src="/images/home-hero.png"
              alt="A nurse adjusting an IV line for an older man seated in his own armchair, a blood pressure monitor on the side table"
              caption="A session at home. The nurse brings the stand, the sealed kit and the batch you were prescribed."
              width={1402}
              height={1122}
              priority
            />
          </div>
        </div>
      </section>

      <TrustStrip items={["Karnataka Medical Council", "KA/CEA/2024/11872", "DPDP compliant", "GST invoiced"]} />

      {/* ================= THE TRANSFORMATION ================= */}
      <Section tone="soft">
        <SectionHeading
          center
          eyebrow="The transformation"
          title="From guessing to a record"
          sub="What actually changes between the week before your first session and the week after."
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {TRANSFORMATION.map((t, i) => (
            <div
              key={t.step}
              className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-line)] p-7 flex flex-col gap-3"
              style={i === 1 ? { borderColor: "var(--color-primary)" } : undefined}
            >
              <span
                className="t-micro"
                style={{ color: i === 1 ? "var(--color-primary)" : "var(--color-ink-3)" }}
              >
                {t.step}
              </span>
              <h3 style={{ font: "600 21px/1.25 var(--font-display)", letterSpacing: "-0.02em" }}>
                {t.title}
              </h3>
              <p className="t-body text-[var(--color-ink-2)]">{t.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ================= BEST SELLERS ================= */}
      <Section>
        <div className="flex items-end justify-between gap-6 flex-wrap mb-10">
          <SectionHeading
            eyebrow="Most booked"
            title="Where most people start"
            sub="Availability below is live — it counts only in-date stock that is not already promised to another session."
          />
          <Link href="/drips" className="t-body font-semibold mb-10">
            All {drips.length} drips&nbsp;<Arrow />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {bestSellers.map((d) => (
            <Link
              key={d.slug}
              href={`/drips/${d.slug}`}
              className="group rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] overflow-hidden no-underline hover:no-underline flex flex-col transition-colors duration-150 hover:border-[var(--color-ink)]"
            >
              <div className="aspect-[4/3] bg-[var(--color-surface-2)] relative flex items-center justify-center">
                <Vial />
                <span
                  className="absolute top-3 left-3 t-micro px-[10px] py-1 rounded-full"
                  style={{ background: "#fff", border: "1px solid var(--color-line)" }}
                >
                  {d.category}
                </span>
              </div>
              <div className="p-5 flex flex-col gap-2 flex-1">
                <h3 style={{ font: "600 19px/1.25 var(--font-display)", letterSpacing: "-0.02em" }}>
                  {d.name}
                </h3>
                <Stars rating={5} size={12} />
                <p className="t-small text-[var(--color-ink-2)] flex-1">{d.tagline ?? d.description}</p>
                <div className="flex items-baseline justify-between gap-3 pt-3 mt-1 border-t border-[var(--color-line)]">
                  <span className="t-data text-[17px]">{formatInr(d.priceInr)}</span>
                  <span className="t-small text-[var(--color-ink-3)]">{d.durationMin} min</span>
                </div>
                <span
                  className="mt-2 inline-flex items-center justify-center rounded-[var(--radius-sm)] min-h-[40px] px-4 font-semibold text-[13px] transition-colors duration-150"
                  style={{ background: "var(--color-ink)", color: "#fff" }}
                >
                  See the formula
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {/* ================= CATEGORIES ================= */}
      <Section tone="soft">
        <SectionHeading eyebrow="By goal" title="What are you trying to fix?" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => (
            <Link
              key={c.name}
              href={`/drips?goal=${encodeURIComponent(c.slug)}`}
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-5 no-underline hover:no-underline flex items-center justify-between gap-4 transition-colors duration-150 hover:border-[var(--color-ink)]"
            >
              <span className="flex flex-col">
                <span style={{ font: "600 17px/1.3 var(--font-display)", color: "var(--color-ink)" }}>
                  {c.name}
                </span>
                <span className="t-small text-[var(--color-ink-2)]">{c.blurb}</span>
              </span>
              <span className="t-data text-[16px] flex-none" style={{ color: "var(--color-primary)" }}>
                <Arrow />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      {/* ================= SOCIAL PROOF ================= */}
      <Section>
        <SectionHeading
          center
          eyebrow="What people say"
          title="The reviews that mention being told no"
          sub="Those are the ones worth reading. Anyone can be pleased when they get what they asked for."
        />
        <div className="flex justify-center mb-10">
          <RatingStrip rating={AGGREGATE.rating} count={AGGREGATE.count} />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.slice(0, 6).map((t) => (
            <TestimonialCard key={t.id} t={t} />
          ))}
        </div>
      </Section>

      {/* ================= BRAND BENEFITS ================= */}
      <Section tone="ink">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[0.9fr_1.1fr] items-start">
          <SectionHeading
            onInk
            eyebrow="Why us"
            title={copy["home.safety.heading"]}
            sub={copy["home.safety.body"]}
          />
          <div className="grid gap-px" style={{ background: "rgba(255,255,255,.14)" }}>
            {BRAND_BENEFITS.map((b) => (
              <div key={b.title} className="bg-[var(--color-ink)] py-6 first:pt-0 last:pb-0">
                <h3
                  className="mb-2"
                  style={{ font: "600 19px/1.3 var(--font-display)", color: "#fff", letterSpacing: "-0.02em" }}
                >
                  {b.title}
                </h3>
                <p style={{ font: "400 15px/1.6 var(--font-sans)", color: "rgba(255,255,255,.7)" }}>
                  {b.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ================= COMPARISON ================= */}
      <Section tone="soft">
        <SectionHeading
          center
          eyebrow="Honestly compared"
          title="Us, a drip bar, and a hospital"
          sub="Every row is something you can check for yourself elsewhere on this site."
        />
        <ComparisonTable columns={COMPARISON.columns} rows={COMPARISON.rows} />
      </Section>

      {/* ================= NOT FOR EVERYONE ================= */}
      <Section>
        <div className="rounded-[var(--radius-lg)] border-2 border-[var(--color-ink)] p-8 md:p-12 grid gap-8 lg:grid-cols-[1.3fr_1fr] items-center">
          <div>
            <span className="t-micro" style={{ color: "var(--color-primary)" }}>
              {copy["home.contra.heading"]}
            </span>
            <h2
              className="mt-3 mb-4 max-w-[20ch]"
              style={{ font: "700 clamp(26px,3.2vw,36px)/1.1 var(--font-display)", letterSpacing: "-0.03em" }}
            >
              We turn people away, and that is the point.
            </h2>
            <p className="t-body-lg text-[var(--color-ink-2)] max-w-[54ch]" style={{ textWrap: "pretty" }}>
              {copy["home.contra.body"]}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <ButtonLink href="/safety" size="lg" block>
              Read the full contraindication list
            </ButtonLink>
            <ButtonLink href="/quiz" size="lg" variant="secondary" block>
              Take the quiz · 3 min
            </ButtonLink>
          </div>
        </div>
      </Section>

      {/* ================= FAQ ================= */}
      <Section tone="soft">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.8fr_1.2fr] items-start">
          <SectionHeading eyebrow="Before you book" title="Questions people actually ask" />
          <FaqList items={FAQS} />
        </div>
      </Section>

      {/* ================= CLOSING CTA ================= */}
      <Section tone="ink">
        <div className="flex flex-col items-center text-center gap-6">
          <h2
            className="max-w-[18ch]"
            style={{
              font: "700 clamp(30px,4.4vw,50px)/1.05 var(--font-display)",
              letterSpacing: "-0.03em",
              color: "#fff",
              textWrap: "balance",
            }}
          >
            Three minutes now, or another month of guessing.
          </h2>
          <p className="t-body-lg max-w-[52ch]" style={{ color: "rgba(255,255,255,.72)" }}>
            A physician reads every submission. If IV therapy is not right for you, they will say so — and tell you
            what is.
          </p>
          <div className="flex gap-3 flex-wrap justify-center mt-2">
            <ButtonLink href="/quiz" size="lg">
              Take the health quiz
            </ButtonLink>
            <Link
              href="/drips"
              className="inline-flex items-center justify-center min-h-[52px] px-6 rounded-[var(--radius-sm)] border font-semibold text-[14.5px] no-underline hover:no-underline"
              style={{ borderColor: "rgba(255,255,255,.3)", color: "#fff" }}
            >
              Browse drips
            </Link>
          </div>
          <span className="t-small mt-2" style={{ color: "rgba(255,255,255,.5)" }}>
            No card needed to get a protocol reviewed.
          </span>
        </div>
      </Section>
    </>
  );
}

/** A vial in line art — the product's own object, standing in for photography. */
function Vial() {
  return (
    <svg width="86" height="132" viewBox="0 0 86 132" fill="none" aria-hidden>
      <rect x="30" y="4" width="26" height="12" rx="3" fill="var(--color-ink)" />
      <path
        d="M28 16h30a6 6 0 0 1 6 6v92a10 10 0 0 1-10 10H32a10 10 0 0 1-10-10V22a6 6 0 0 1 6-6Z"
        fill="#fff"
        stroke="var(--color-ink)"
        strokeWidth="2.5"
      />
      <path d="M22 74h42" stroke="var(--color-primary)" strokeWidth="10" opacity="0.18" />
      <path d="M22 86h42" stroke="var(--color-primary)" strokeWidth="10" opacity="0.32" />
      <path d="M22 98h42" stroke="var(--color-primary)" strokeWidth="10" opacity="0.5" />
      <path d="M64 34h8M64 46h8M64 58h8" stroke="var(--color-ink)" strokeWidth="1.5" opacity=".3" />
    </svg>
  );
}

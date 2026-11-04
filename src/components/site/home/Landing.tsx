/* eslint-disable @next/next/no-img-element -- the hero's planes, the plates
   and the glass are sized and moved by the site's own stylesheet; next/image's
   wrapper and inline sizing would fight it. Every image has fixed dimensions. */
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { CatalogueDrip } from "@/lib/data/assembly";
import type { ContentKey } from "@/lib/content";
import type { LatePolicy } from "@/lib/billing/late-policy";
import { CHECKLIST_STEPS, VITAL_RANGES } from "@/lib/clinical/checklist";
import { APPROVAL_VALID_DAYS } from "@/lib/clinical/validity";
import { CATEGORIES } from "@/lib/data/marketing";
import { Cta, QuizLink } from "@/components/site/v3/Cta";
import { InfinityMark, LiquidFill } from "@/components/site/v3/LiquidFill";
import { Fcard } from "@/components/site/v3/Fcard";
import type { SiteImage } from "@/lib/site-images";
import { HomeMotion } from "./HomeMotion";
import type { BuildDrip } from "./motion";
import { HOME_QUESTIONS, type PageQuestion } from "@/components/site/v3/questions";
import { altDose, dose, duration, hours, inr, lateFees, num, word } from "./format";

/**
 * The public landing page, in the client's design (approved prototype:
 * scrollcraft/builds/home-v3). Ten questions a visitor asks, in order, each a
 * section marked data-q, which the header's question button reads. Every
 * drip, dose, price, zone and figure comes from the database or the clinical
 * constants; the copy from content.ts.
 */

const A = "/site/v3";
/** A section's question: its id and words, shared with the header's question button. */
const ask = (q: PageQuestion) => ({ id: q.id, "data-q": q.text });
const vars = (o: Record<string, string | number>) => o as CSSProperties;

/** The build act: 3.2 screens plus 0.3 per ingredient in the bag, 4 to 6. */
const buildSpan = (d: CatalogueDrip) => Math.min(6, Math.max(4, 3.2 + 0.3 * d.items.filter((i) => !i.separate).length));

const VITALS: Array<[string, string]> = [
  [
    "Blood pressure",
    `${VITAL_RANGES.systolic.min}–${VITAL_RANGES.systolic.max} / ${VITAL_RANGES.diastolic.min}–${VITAL_RANGES.diastolic.max} mmHg`,
  ],
  ["Heart rate", `${VITAL_RANGES.heartRate.min}–${VITAL_RANGES.heartRate.max} bpm`],
  ["SpO₂", `${VITAL_RANGES.spo2.min}–${VITAL_RANGES.spo2.max}%`],
  ["Temperature", `${VITAL_RANGES.temperatureF.min.toFixed(1)}–${VITAL_RANGES.temperatureF.max.toFixed(1)} °F`],
];

export function Landing({
  drips,
  chosen,
  copy,
  zoneCount,
  late,
  faqs,
  photos,
}: {
  drips: CatalogueDrip[];
  chosen: CatalogueDrip;
  copy: Record<ContentKey, string>;
  zoneCount: number;
  late: LatePolicy;
  faqs: Array<{ q: string; a: string }>;
  /** Each drip's uploaded photo (Admin → Site images), shown on its card in the bag's place. */
  photos: Record<string, SiteImage | null>;
}) {
  const span = buildSpan(chosen);
  const prices = drips.map((d) => d.priceInr);
  const durMin = Math.min(...drips.map((d) => d.durationMin));
  const durMax = Math.max(...drips.map((d) => d.durationToMin ?? d.durationMin));
  // One drip per goal: the "Most popular" one in that category, else the cheapest.
  const goalDrip = (cat: string) => {
    const inCat = drips.filter((d) => d.category === cat);
    return inCat.find((d) => d.isPopular) ?? inCat[0] ?? null;
  };
  // Real "only where needed" checks, read off the drips' own notes.
  const conditional = drips.flatMap((d) =>
    d.goodToKnow.filter((g) => /lab|screen|g6pd|test/i.test(g)).map((g) => [d.name, g] as const)
  );
  // Separately given components across the catalogue, for the rail's note.
  const sepNotes = [
    ...new Map(
      drips.flatMap((d) => d.items.filter((i) => i.separate && i.notes).map((i) => [i.name, i.notes ?? ""] as const))
    ).entries(),
  ];
  const buildData: BuildDrip[] = drips.map((d) => ({
    slug: d.slug,
    name: d.name,
    tint: d.tint,
    price: d.priceInr,
    duration: duration(d),
    volume: d.volumeMl,
    carrier: d.carrier?.name ?? null,
    inBag: d.items
      .filter((i) => !i.separate)
      .map((i) => ({ name: i.name, dose: dose(i), alt: altDose(i), molecule: i.molecule, form: i.form })),
    separate: d.items.filter((i) => i.separate).map((i) => ({ name: i.name, dose: dose(i), notes: i.notes })),
  }));

  return (
    <HomeMotion drips={buildData} fallback={chosen.slug}>
      {/* 1 · WHAT IS THIS? Planes; the headline recedes behind the bag. */}
      <section
        className="hero act-res"
        {...ask(HOME_QUESTIONS.what)}
        data-hero=""
        data-sc-act="pin"
        data-sc-span="2.1"
        style={vars({ "--span": 2.1, "--span-m": 1.8 })}
      >
        <div data-sc-stage="" className="hero__stage" data-sc-verify-state="0">
          <div className="hero__plane hero__room" data-depth="0.2">
            <picture>
              <source media="(max-width: 860px)" srcSet={`${A}/room-p.webp`} />
              <img src={`${A}/room.webp`} width={2400} height={1357} alt="" fetchPriority="high" />
            </picture>
          </div>
          <img
            className="hero__plane hero__back hero__back--1"
            src={`${A}/hero-back-1.webp`}
            width={379}
            height={740}
            alt=""
          />
          <img
            className="hero__plane hero__back hero__back--2"
            src={`${A}/hero-back-2.webp`}
            width={379}
            height={740}
            alt=""
          />
          <div className="hero__plane hero__head">
            <h1 className="hero__h1">{copy["home.headline"]}</h1>
          </div>
          <div className="hero__plane hero__bag">
            <img
              src={`${A}/bag-hero-clean.webp`}
              width={611}
              height={1400}
              alt={`A NutriDrip ${num(chosen.volumeMl)} mL IV nutrient bag hanging in a sunlit infusion room`}
              fetchPriority="high"
            />
          </div>
          {/* The bag's print: a plane of its own that moves with the bag. The
              photo plane is rasterised once and moved as a bitmap
              (will-change), which blurred live text; this one is redrawn at
              each size, sharp. */}
          <div className="hero__plane hero__bag hero__bagprint" aria-hidden="true">
            <div className="hb-label">
              <span className="hb-word">
                NutriDrip<sup>™</sup>
              </span>
              <span className="hb-sub">IV NUTRIENT THERAPY</span>
              <span className="hb-foot">
                <InfinityMark />
                <i />
                <b>{num(chosen.volumeMl)} mL</b>
              </span>
            </div>
          </div>
          <img className="hero__plane hero__front" src={`${A}/hero-front.webp`} width={379} height={740} alt="" />
          <div className="hero__plane hero__light" aria-hidden="true" />
          <div className="hero__copy">
            <p className="hero__sub">{copy["home.sub"]}</p>
            <Cta label={copy["home.cta"]} note="No card needed to get a protocol reviewed" />
          </div>
          <p className="hero__second" aria-hidden="true">
            Reviewed by a physician. Given by a nurse at home. Every dose on your report.
          </p>
        </div>
      </section>
      <p className="visually-hidden">Reviewed by a physician. Given by a nurse at home. Every dose on your report.</p>

      {/* 2 · IS IT SAFE? WHO IS BEHIND IT? Real figures only. */}
      <div {...ask(HOME_QUESTIONS.safe)}>
        <section className="sc-section trust">
          <div className="nd-wrap trust__grid">
            <div className="sc-stack" data-sc-in="" data-sc-stagger="70">
              <h2 className="nd-q">Is it safe? Who is behind it?</h2>
              <p className="nd-lede">{copy["about.intro"]}</p>
              <p>
                <Link className="nd-link" href="/about" prefetch={false}>
                  About NutriDrip
                </Link>
              </p>
            </div>
            <dl className="trust__stats">
              <Stat n={CHECKLIST_STEPS.length} label="steps in every session checklist, none skippable" />
              <Stat n={APPROVAL_VALID_DAYS} label="days a physician's approval lasts" />
              <Stat n={zoneCount} label="zones served in Bengaluru" />
              <Stat n={drips.length} label="drips, every dose published" />
            </dl>
          </div>
        </section>

        <section
          className="path act-res"
          data-sc-act="pin"
          data-sc-span="2.8"
          style={vars({ "--span": 2.8, "--span-m": 2.4 })}
          aria-labelledby="path-h"
        >
          <div data-sc-stage="" className="path__stage" data-sc-verify-state="0">
            <div className="nd-wrap path__grid">
              <div className="path__intro">
                <h3 id="path-h" className="nd-q nd-q--sm">
                  Every session follows the same six steps.
                </h3>
                <p className="nd-body">No step is skipped. If any step says no, there is no drip.</p>
              </div>
              <ol className="path__steps">
                <PathStep n={1} title="Health quiz">
                  About three minutes: your symptoms, medication, allergies and history.
                </PathStep>
                <PathStep n={2} title="Physician review">
                  A registered doctor approves a protocol, changes the doses, asks you for more, or declines.
                </PathStep>
                <PathStep n={3} title="Booking">
                  A slot in your zone. Free to move up to {hours(late.windowHours)} before.
                </PathStep>
                <PathStep n={4} title="A sealed kit">
                  Your nurse checks the seal and every vial&apos;s expiry in front of you.
                </PathStep>
                <PathStep n={5} title="The infusion, at home">
                  Baseline vitals first, then a {CHECKLIST_STEPS.length}-step checklist that cannot be skipped.
                </PathStep>
                <PathStep n={6} title="Your report">
                  Vitals, every dose, every batch number and the physician&apos;s name, the same day.
                </PathStep>
              </ol>
            </div>
          </div>
        </section>

        <section className="sc-section nd-section--tight tests" aria-labelledby="tests-h">
          <div className="nd-wrap">
            <div className="tests__panel" data-sc-reveal="right" data-sc-reveal-at="0.04 0.42">
              <div className="tests__head">
                <h3 id="tests-h" className="nd-q nd-q--sm">
                  Checked before anything is infused.
                </h3>
                <p className="nd-body">
                  The nurse records baseline vitals at every session. A reading outside its range stops the infusion
                  until the physician clears it.
                </p>
              </div>
              <div className="tests__cols">
                <div>
                  <p className="nd-tag">Every session</p>
                  <ul className="tests__list">
                    {VITALS.map(([k, v]) => (
                      <li key={k}>
                        <b>{k}</b>
                        <span>{v}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="nd-tag">Only where needed</p>
                  <ul className="tests__list tests__list--cond">
                    {conditional.map(([n, g]) => (
                      <li key={`${n}-${g}`}>
                        <b>{n}</b>
                        <span>{g}</span>
                      </li>
                    ))}
                    <li>
                      <b>Every quiz</b>
                      <span>{copy["home.contra.body"]}</span>
                    </li>
                  </ul>
                </div>
              </div>
              <p className="tests__chair">
                <b>At every session:</b> the nurse confirms the anaphylaxis kit is present and in date before the sealed
                kit is opened.{" "}
                <Link className="nd-link" href="/safety" prefetch={false}>
                  {copy["home.safety.heading"]}
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* 3 · WHY IV AND NOT TABLETS? The client's wording, editable. */}
      <section className="sc-section teaser" {...ask(HOME_QUESTIONS.why)}>
        <div className="nd-wrap teaser__grid">
          <div className="teaser__pics" aria-hidden="true">
            <img
              className="teaser__pic teaser__pic--a"
              data-sc-parallax="-0.6"
              src={`${A}/tablets.webp`}
              width={1800}
              height={1018}
              alt=""
              loading="lazy"
            />
            <img
              className="teaser__pic teaser__pic--b"
              data-sc-parallax="0.6"
              src={`${A}/ivline.webp`}
              width={1800}
              height={1018}
              alt=""
              loading="lazy"
            />
          </div>
          <div className="sc-stack" data-sc-in="" data-sc-stagger="70">
            <h2 className="nd-q">{copy["home.why.heading"]}</h2>
            <p className="nd-lede">{copy["home.why.lede"]}</p>
            <p className="nd-body">{copy["home.why.body"]}</p>
            <p>
              <Link className="nd-btn nd-btn--ghost" href="/iv-vs-tablets" prefetch={false}>
                IV vs Tablets
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* 4 · WHICH ONE IS FOR ME? Goal picker, the drop, then the build. */}
      <div {...ask(HOME_QUESTIONS.which)}>
        <section className="sc-section picker" aria-labelledby="pick-h">
          <div className="nd-wrap">
            <div className="picker__head">
              <h2 id="pick-h" className="nd-q">
                Which one is for me?
              </h2>
              <p className="nd-lede">
                Start with what you are trying to fix. Then keep scrolling and watch that drip being built.
              </p>
            </div>
            <div className="picker__grid" role="group" aria-label="What are you trying to fix?">
              {CATEGORIES.map((c) => {
                const d = goalDrip(c.name);
                if (!d) return null;
                return (
                  <button
                    key={c.name}
                    type="button"
                    className="feel"
                    aria-pressed={d.slug === chosen.slug}
                    data-feel={d.slug}
                    style={vars({ "--t": d.tint })}
                  >
                    <i aria-hidden="true" />
                    {c.blurb}
                    <small>
                      {c.name} · {d.name} · {inr(d.priceInr)}
                    </small>
                  </button>
                );
              })}
            </div>
            <p className="picker__note nd-small" role="status" data-pick-status="">
              Not sure? A physician confirms it after the quiz. Showing <b data-chosen-name="">{chosen.name}</b> for
              now.
            </p>
          </div>
        </section>

        <section
          className="drop act-res"
          data-sc-act="scrub"
          data-sc-span="2.2"
          data-sc-dwell="0.3"
          style={vars({ "--span": 2.2, "--span-m": 2.2 })}
          aria-label="A drop forming in the drip chamber"
        >
          <div data-sc-stage="" className="drop__stage">
            <picture>
              <source media="(max-width: 860px)" srcSet={`${A}/chamber-poster-m.webp`} />
              <img
                className="sc-stage__poster"
                src={`${A}/chamber-poster.webp`}
                width={1914}
                height={1080}
                alt=""
                loading="lazy"
              />
            </picture>
            <video
              data-sc-scrub=""
              data-sc-src={`${A}/chamber.mp4`}
              data-sc-src-mobile={`${A}/chamber-m.mp4`}
              muted
              playsInline
              preload="none"
            />
            <div className="drop__scrim" aria-hidden="true" />
            <div className="sc-copy drop__copy" data-sc-cue="0.12 0.9">
              <h2 className="drop__h">It starts with one drop.</h2>
              <p className="drop__p">
                <span data-chosen-name="">{chosen.name}</span> runs over{" "}
                <span data-chosen-duration="">{duration(chosen)}</span>. What goes into the bag is decided before the
                first drop falls.
              </p>
            </div>
          </div>
        </section>

        <section
          id="build"
          className="build act-res"
          data-sc-act="pin"
          data-sc-span={span.toFixed(2)}
          style={vars({ "--span": span.toFixed(2), "--span-m": (span * 0.9).toFixed(2) })}
          aria-labelledby="build-h"
        >
          <div data-sc-stage="" className="build__stage" data-sc-verify-state="0">
            <picture className="build__plate">
              <source media="(max-width: 860px)" srcSet={`${A}/prep-p.webp`} />
              <img src={`${A}/prep.webp`} width={2400} height={1357} alt="" loading="lazy" />
            </picture>
            <div className="build__flood" aria-hidden="true" />
            <div className="build__copy">
              <h2 id="build-h" className="build__h">
                Your <span data-chosen-name="">{chosen.name}</span>, built to protocol.
              </h2>
              <ol className="build__steps">
                <li data-bstep="0">
                  <span>
                    The bag is the carrier: <span data-chosen-carrier="">{chosen.carrier?.name ?? "the carrier"}</span>,{" "}
                    <span data-chosen-volume="">{num(chosen.volumeMl)}</span> mL.
                  </span>
                </li>
                <li data-bstep="1">
                  <span>Each ingredient goes in from its own ampoule or vial, at the dose on the protocol.</span>
                </li>
                <li data-bstep="2">
                  <span>Anything that must not sit in the bag is given beside it.</span>
                </li>
                <li data-bstep="3">
                  <span>A physician approves it for you before a nurse brings it home.</span>
                </li>
              </ol>
              <p className="build__mstep" data-build-mstep="" aria-hidden="true" />
            </div>
            <div className="build__rig">
              <div className="build__vials" data-vials="" aria-hidden="true" />
              <div className="nd-bag build__bag" data-build-bag="" style={vars({ "--fill": 0 })}>
                {/* The liquid: the motion eases the level to where the scroll
                    puts it; the surface rolls, and drops fall while it rises. */}
                <LiquidFill drops={5} rings={3} />
                <img
                  className="nd-bag__img"
                  src={`${A}/bag-empty.webp`}
                  width={577}
                  height={1200}
                  alt=""
                  loading="lazy"
                />
                {/* The hero bag's label design (wordmark, tagline, ∞ | volume),
                    with the drip's name and its doses printed between. */}
                <div className="build__label" data-build-label="">
                  <div className="bl-head">
                    <p className="bl-word">
                      NutriDrip<sup>™</sup>
                    </p>
                    <p className="bl-sub">IV NUTRIENT THERAPY</p>
                  </div>
                  <p className="build__lname bl-band" data-chosen-name="">
                    {chosen.name}
                  </p>
                  <ul className="build__lines" data-build-lines="" />
                  <div className="bl-end">
                    <i className="bl-rule" />
                    <p className="bl-foot">
                      <InfinityMark />
                      <i />
                      <b>
                        <span data-chosen-volume="">{num(chosen.volumeMl)}</span> mL
                      </b>
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="build__sep" data-build-sep="" />
            <div className="build__end" data-build-end="">
              <p className="build__endk">
                <span data-chosen-name="">{chosen.name}</span> ·{" "}
                <span data-chosen-price="">{inr(chosen.priceInr)}</span> per session
              </p>
              <Cta label="Take the quiz to book this" note="A physician approves it first" drip={chosen.slug} />
              <Link className="nd-link build__more" data-drip-page="" href={`/drips/${chosen.slug}`} prefetch={false}>
                Every dose, in full
              </Link>
            </div>
          </div>
        </section>
        <div className="visually-hidden" data-build-sr="" aria-live="polite" />
      </div>

      {/* 5 · WHAT EXACTLY IS IN IT? Every public drip. */}
      <section
        className="formulary act-res"
        {...ask(HOME_QUESTIONS.inside)}
        data-sc-act="pan"
        data-sc-span="5"
        style={vars({ "--span": 5, "--span-m": 0 })}
      >
        <div data-sc-stage="" className="formulary__stage">
          <div className="formulary__rail" data-sc-pan="0.04">
            <div className="formulary__lead">
              <h2 className="nd-q">What exactly is in it?</h2>
              <p className="nd-lede">
                All {word(drips.length)} drips, with every dose. Prices are per session, everything included.
              </p>
              {sepNotes.length ? (
                <p className="nd-small">
                  Some components are given beside the bag, never in it:{" "}
                  {sepNotes.map(([n, note]) => `${n} (${note.toLowerCase()})`).join(", ")}.
                </p>
              ) : null}
            </div>
            {drips.map((d, k) => (
              <Fcard key={d.slug} d={d} k={k} photo={photos[d.slug] ?? null} />
            ))}
            <div className="formulary__end">
              <p className="nd-q nd-q--sm">Not sure which?</p>
              <p className="nd-body">Your answers point to one. The physician decides.</p>
              <Cta />
            </div>
          </div>
        </div>
      </section>

      {/* 6 · WHAT HAPPENS ON THE DAY? */}
      <section
        className="day act-res"
        {...ask(HOME_QUESTIONS.day)}
        data-sc-act="pin"
        data-sc-span="2.6"
        style={vars({ "--span": 2.6, "--span-m": 2.4 })}
      >
        <div data-sc-stage="" className="day__stage" data-sc-verify-state="0">
          <div className="nd-wrap">
            <h2 className="nd-q">What happens on the day?</h2>
            <p className="nd-lede day__lede">From the door to the report. Most of it you spend sitting back.</p>
            <div className="day__track">
              <div className="day__line" aria-hidden="true">
                <span />
              </div>
              <ol className="day__steps">
                <DayStep title="The nurse arrives">
                  With a sealed kit, and checks your identity and the protocol on file.
                </DayStep>
                <DayStep title="Baseline vitals">
                  A reading outside its range stops the session until the physician clears it.
                </DayStep>
                <DayStep title="Consent, then a cannula">One small cannula in a vein in your arm.</DayStep>
                <DayStep title={`${durMin} to ${durMax} minutes`}>
                  Depending on the drip. Observed every 10 minutes.
                </DayStep>
                <DayStep title="Ten minutes after">
                  Closing vitals and a short observation before the nurse leaves.
                </DayStep>
                <DayStep title="Your report">Every dose and batch number in your account, the same day.</DayStep>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* 7 · WHAT DOES IT COST? Live prices. */}
      <section className="sc-section cost" {...ask(HOME_QUESTIONS.cost)}>
        <div className="nd-wrap">
          <div className="cost__offer" data-sc-in="">
            <p className="cost__offer-k">Before you pay</p>
            <p className="cost__offer-t">No card needed to get a protocol reviewed.</p>
          </div>
          <div className="cost__grid">
            <div className="sc-stack" data-sc-in="" data-sc-stagger="60">
              <h2 className="nd-q">What does it cost?</h2>
              <p className="nd-lede">
                From {inr(Math.min(...prices))} to {inr(Math.max(...prices))} per session, depending on what goes into
                the bag. The kit, the nurse and the report are included.
              </p>
              <div className="cost__course">
                <p className="cost__course-n nd-num">{late.windowHours}</p>
                <p>
                  <b>Free to move or cancel up to {hours(late.windowHours)} before your slot.</b> {lateFees(late)}
                </p>
              </div>
              <Cta />
            </div>
            <table className="nd-table cost__table" data-sc-in="">
              <caption className="visually-hidden">Price per session for each drip</caption>
              <thead>
                <tr>
                  <th scope="col">Drip</th>
                  <th scope="col">Time</th>
                  <th scope="col">Per session</th>
                </tr>
              </thead>
              <tbody>
                {drips.map((d) => (
                  <tr key={d.slug}>
                    <td>
                      <span className="dot" style={{ background: d.tint }} />
                      <Link href={`/drips/${d.slug}`} prefetch={false}>
                        {d.name}
                      </Link>
                    </td>
                    <td>{duration(d)}</td>
                    <td>{inr(d.priceInr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 8 · WHAT IF IT'S NOT RIGHT FOR ME? */}
      <section className="sc-section notright" {...ask(HOME_QUESTIONS.notright)}>
        <div className="nd-wrap notright__grid" data-sc-in="" data-sc-stagger="70">
          <h2 className="nd-q nd-q--sm">What if it&apos;s not right for me?</h2>
          <p className="notright__big">We turn people away, and that is the point.</p>
          <p className="nd-body">{copy["home.contra.body"]} A session that does not run is refunded in full.</p>
        </div>
      </section>

      {/* 9 · FAQ */}
      <section className="sc-section faq" {...ask(HOME_QUESTIONS.faq)}>
        <div className="nd-wrap nd-grid2">
          <div className="sc-stack faq__side">
            <h2 className="nd-q nd-q--sm">What else should I know?</h2>
            <p className="nd-body">The questions people ask us most. Anything else, ask our clinical team.</p>
            <p>
              <Link className="nd-btn nd-btn--ghost" href="/consult" prefetch={false}>
                Ask a clinician
              </Link>
            </p>
          </div>
          <div className="nd-faq">
            {faqs.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <div>
                  <p>{f.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 10 · READY TO BOOK? The quiz, with the chosen drip on the slip. */}
      <section className="sc-section nd-book" {...ask(HOME_QUESTIONS.book)}>
        <div className="nd-wrap nd-grid2">
          <div className="nd-book__intro">
            <h2 className="nd-q">Ready to book?</h2>
            <p className="nd-lede">
              Three minutes of questions, read by a registered physician. If a drip is not right for you, they will say
              so, and tell you what is.
            </p>
            <ul className="nd-book__facts">
              <li>
                <b>A physician reviews you first</b>, before anything is booked.
              </li>
              <li>
                <b>A nurse comes to your home</b> in {zoneCount} zones across Bengaluru.
              </li>
              <li>
                <b>Free to move or cancel</b> up to {hours(late.windowHours)} before your slot.
              </li>
            </ul>
          </div>
          <div className="nd-slip">
            <div className="nd-slip__head">
              <div>
                <p className="nd-tag">Your drip</p>
                <p className="nd-slip__drip" data-chosen-name="">
                  {chosen.name}
                </p>
                <p className="nd-slip__free">
                  <span data-chosen-duration="">{duration(chosen)}</span> · at your home
                </p>
              </div>
              <p className="nd-slip__price">
                per session<b data-chosen-price="">{inr(chosen.priceInr)}</b>
              </p>
            </div>
            <p className="nd-body nd-slip__body">
              The quiz asks what a physician needs to know before they will put their name to a protocol. Not sure about
              this drip? Answer anyway: the physician chooses with you.
            </p>
            <Cta
              label="Take the quiz to book this"
              note="No card needed to get a protocol reviewed"
              drip={chosen.slug}
            />
          </div>
        </div>
      </section>

      {/* The phone's bottom bar, shown between the hero and the slip. */}
      <div className="nd-sticky" aria-label="Booking">
        <QuizLink label="Take the health quiz" drip={chosen.slug} />
        <span className="nd-sticky__free">A physician reads every answer</span>
      </div>
    </HomeMotion>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className="nd-num">
        <span data-sc-count={`0 ${n}`}>{n}</span>
      </dd>
    </div>
  );
}

function PathStep({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li>
      <span className="path__n">{n}</span>
      <div>
        <b>{title}</b>
        <p>{children}</p>
      </div>
    </li>
  );
}

function DayStep({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li>
      <span className="day__dot" />
      <b>{title}</b>
      <p>{children}</p>
    </li>
  );
}

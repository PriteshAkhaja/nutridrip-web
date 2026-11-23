/* eslint-disable @next/next/no-img-element -- the bag photograph is sized by
   the site's own stylesheet, with fixed dimensions. */
import Link from "next/link";
import type { AssemblyDrip, AssemblyItem } from "@/lib/data/assembly";
import type { DripDetail } from "@/lib/data/drips";
import type { LatePolicy } from "@/lib/billing/late-policy";
import type { SiteImage } from "@/lib/site-images";
import type { FeelImage } from "@/lib/feel";
import { Photo } from "@/components/site/Photo";
import { Cta, QuizLink } from "@/components/site/v3/Cta";
import { InfinityMark, LiquidFill } from "@/components/site/v3/LiquidFill";
import { bandColours, glassHTML, type GlassItem } from "@/components/site/v3/glass";
import { altDose, dose, duration, hours, inr, lateFees, num } from "@/components/site/home/format";
import { DripMotion } from "./DripMotion";
import { StandStage } from "./StandStage";
import { Crumbs } from "@/components/site/v3/Crumbs";

/**
 * A drip's page, in the client's design (approved prototype:
 * scrollcraft/builds/drip-v3), with the client's three steps (2026-11-20,
 * scrollcraft/builds/drip-v4). Beside the reading column the bag stays, with
 * the drip's bottles floating on its left: as each ingredient in the list is
 * read, its bottle goes into the bag by its port, the liquid rises and the label prints its
 * line (./motion.ts). After the list the bag goes onto the stand in the
 * evening room, then the morning after (StandStage). Every
 * ingredient, dose, price and check comes from the Drip document, its stock
 * and the late-change rule; nothing about a drip is written here.
 */

type Row = {
  kind: "carrier" | "bag" | "sep";
  k?: number;
  name: string;
  dose: string;
  where: string;
  note: string | null;
};

const glassOf = (i: AssemblyItem): GlassItem => ({
  name: i.name,
  dose: dose(i),
  alt: altDose(i),
  molecule: i.molecule,
  form: i.form,
});
const minutes = (d: { durationMin: number; durationToMin: number | null }) =>
  d.durationToMin && d.durationToMin > d.durationMin
    ? `${d.durationMin} to ${d.durationToMin} minutes`
    : `${d.durationMin} minutes`;
// The drip's own notes that name a check go under "For this drip"; the rest
// are notes under the price.
const CHECK = /lab|screen|g6pd|test/i;

export function DripPage({
  drip,
  assembly,
  also,
  faqs,
  zoneCount,
  late,
  stock,
  photo,
  evening,
  call,
  feel,
  times,
}: {
  drip: DripDetail;
  assembly: AssemblyDrip;
  /** Other drips to read next, and how the line introduces them. */
  also: { label: string; drips: Array<{ slug: string; name: string }> };
  faqs: Array<{ q: string; a: string }>;
  zoneCount: number;
  late: LatePolicy;
  /** Sessions the stock can make up now (whole vials); null when unknown. */
  stock: number | null;
  /** The admin's upload for this drip (uploadedDripPhotos), shown in the hero; null: none. */
  photo: SiteImage | null;
  /** The last bookable time today ("7:00 PM"), for the evening room; null when none is open. */
  evening: string | null;
  /** The physician's call as the site words it ("15 min phone call with your physician"). */
  call: string;
  /** The picture for the morning after (lib/feel). */
  feel: FeelImage;
  /** The clock while the drip runs, from the evening slot to its end; empty without a slot. */
  times: string[];
}) {
  const vol = num(assembly.volumeMl);
  const inBag = assembly.items.filter((i) => !i.separate);
  const sep = assembly.items.filter((i) => i.separate);
  const colours = bandColours(inBag.map(glassOf));
  const sepColours = bandColours(sep.map(glassOf));
  // The rows, in reading order: the carrier, what goes in the bag, what is given beside it.
  const rows: Row[] = [
    ...(assembly.carrier
      ? [
          {
            kind: "carrier" as const,
            name: assembly.carrier.name,
            dose: dose(assembly.carrier),
            where: "The bag itself",
            note: "The carrier every other ingredient goes into.",
          },
        ]
      : []),
    ...inBag.map((i, k) => ({
      kind: "bag" as const,
      k,
      name: i.name,
      dose: dose(i),
      where: `In the ${vol} mL bag`,
      note: i.molecule && !i.name.toLowerCase().includes(i.molecule.toLowerCase()) ? i.molecule : null,
    })),
    ...sep.map((i, k) => ({
      kind: "sep" as const,
      k,
      name: i.name,
      dose: dose(i),
      where: `Given separately${i.notes ? `: ${i.notes.toLowerCase()}` : ""}`,
      note: "Never mixed into the bag.",
    })),
  ];
  const checks = drip.goodToKnow.filter((g) => CHECK.test(g));
  const notes = drip.goodToKnow.filter((g) => !CHECK.test(g));
  const quizNote = "A physician reads every answer";
  // The shelf: a loose cluster of small bottles in two staggered columns.
  const shelf = inBag.length + sep.length;
  const shelfCols = shelf >= 2 ? 2 : 1;

  return (
    <DripMotion tint={assembly.tint}>
      <div className="dp dp--build nd-wrap">
        {/* The companion bag, with the drip's bottles floating beside it. As
            each ingredient below is read, its bottle goes in by the port, its
            colour blooms in the liquid, the level rises and the label prints its line. */}
        <div className="dp__bagcol" aria-hidden="true">
          <div className="dp__bagstick">
            <div
              className="dp__rig"
              style={
                {
                  "--rk-cols": shelfCols,
                  // Rows, plus the half bottle the second column sits lower.
                  "--rk-rows": Math.ceil(shelf / shelfCols) + (shelfCols > 1 ? 0.55 : 0),
                  // On a phone the shelf is rows of four above the bag.
                  "--rk-prows": Math.max(1, Math.ceil(shelf / 4)),
                } as React.CSSProperties
              }
            >
              <div className="dp__rack" data-rack="">
                {inBag.map((i, k) => (
                  <div
                    key={k}
                    className="dp__rb"
                    data-rb={k}
                    style={{ "--i": k } as React.CSSProperties}
                    dangerouslySetInnerHTML={{ __html: glassHTML(glassOf(i), colours[k]) }}
                  />
                ))}
                {/* What is given separately stays on the shelf: its row in the
                    list says why, so it carries no caption of its own. */}
                {sep.map((i, k) => (
                  <div
                    key={`s${k}`}
                    className="dp__rb dp__rb--sep"
                    data-rs={k}
                    style={{ "--i": inBag.length + k } as React.CSSProperties}
                    dangerouslySetInnerHTML={{ __html: glassHTML(glassOf(i), sepColours[k]) }}
                  />
                ))}
              </div>
              {/* Closes around the bag's medication port as a bottle goes in. */}
              <i className="dp__port" data-port="" aria-hidden="true" />
              <div className="nd-bag dp__bag" data-dp-bag="">
                {/* What goes in enters by the port at the foot, so nothing falls
                    from the top: each ingredient blooms up from the port. */}
                <LiquidFill drops={0} rings={0} blooms={6} />
                {/* The page's largest picture on the first screen (its LCP). */}
                <img
                  className="nd-bag__img"
                  src="/site/v3/bag-empty.webp"
                  width={577}
                  height={1200}
                  alt=""
                  fetchPriority="high"
                />
                {/* The client's compact label, with a ruled row for each
                    ingredient, printed as its bottle lands. */}
                <div className="dpl">
                  <p className="bl-word">
                    NutriDrip<sup>™</sup>
                  </p>
                  <p className="bl-sub">IV NUTRIENT THERAPY</p>
                  <p className="bl-band">{drip.name}</p>
                  <ul className="dpl__lines">
                    {assembly.carrier ? (
                      <li data-line="c">
                        <span>{assembly.carrier.name}</span>
                        <b>{vol} mL</b>
                      </li>
                    ) : null}
                    {inBag.map((i, k) => (
                      <li key={k} data-line={k}>
                        <span>{i.name}</span>
                        <b>{dose(i)}</b>
                      </li>
                    ))}
                    {sep.length ? (
                      <li className="dpl__lsep" data-line="s">
                        <span>Given separately: {sep.map((i) => i.name).join(", ")}</span>
                      </li>
                    ) : null}
                  </ul>
                  <p className="bl-foot">
                    <InfinityMark />
                    <i />
                    <b>{vol} mL</b>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="dp__main">
          {/* Sticks once its last card reaches the foot of the screen (motion
              sets its top), so the last bottles go in with the list in view.
              The room under it is what it sticks through. */}
          <div className="dp__hold" data-hold="">
            <header className="dp__hero">
              <Crumbs
                trail={[
                  { name: "Drips", href: "/drips" },
                  // Its goal opens the list filtered to it.
                  ...(drip.category
                    ? [{ name: drip.category, href: `/drips?goal=${encodeURIComponent(drip.category)}` }]
                    : []),
                  { name: drip.name },
                ]}
              />
              <h1 className="nd-q">{drip.name}</h1>
              {drip.description ? <p className="nd-lede">{drip.description}</p> : null}
              {/* An admin's upload, under the description (the user's choice,
                2026-11-03); the bag beside the list stays. */}
              {photo ? (
                <Photo
                  image={photo}
                  className="dp__photo"
                  radius="18px"
                  sizes="(min-width: 861px) 640px, 66vw"
                  preload
                  decorative={!photo.alt}
                />
              ) : null}
              <p className="dp__meta">
                {duration(drip)} · one {vol} mL bag{drip.tagline ? ` · ${drip.tagline}` : ""}
              </p>
              <div className="dp__buy">
                <p className="dp__price">
                  <b>{inr(drip.priceInr)}</b> per session
                </p>
                <Cta label="Take the quiz to book this" note={quizNote} drip={drip.slug} />
              </div>
              {/* Stock, only when it is low or out: the inventory's whole-vial count. */}
              {stock !== null && stock <= 3 ? (
                <p className={stock === 0 ? "dp__stock dp__stock--out" : "dp__stock"}>
                  {stock === 0 ? "Out of stock" : `Only ${stock} left today`}
                </p>
              ) : null}
              {drip.bestFor.length ? (
                <p className="dp__for">
                  <span>Best for</span>{" "}
                  {drip.bestFor.map((b) => (
                    <i key={b}>{b}</i>
                  ))}
                </p>
              ) : null}
            </header>

            <section className="dp__sec" aria-labelledby="in-h">
              <h2 id="in-h" className="nd-q nd-q--sm">
                What&apos;s inside
              </h2>
              <p className="nd-body">
                Every ingredient, at the dose the protocol starts from. The physician who reads your quiz can change any
                of them for you.
              </p>
              <ol className="ings" data-ings="">
                {rows.map((r, i) => (
                  <li key={i} className={`ing ing--${r.kind}`} data-ing="" data-kind={r.kind} data-k={r.k}>
                    <span className="ing__dot" aria-hidden="true" />
                    <div>
                      <h3>
                        {r.name} <span className="ing__dose">{r.dose}</span>
                      </h3>
                      <p className="ing__where">{r.where}</p>
                      {r.note ? <p>{r.note}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>
          <div className="dp__room" data-room="" aria-hidden="true" />
        </div>
      </div>

      <StandStage
        drip={drip}
        assembly={assembly}
        evening={evening}
        call={call}
        zoneCount={zoneCount}
        feel={feel}
        times={times}
        running={`${minutes(drip)} at home, observed every 10 minutes.`}
        cta={<Cta label="Take the quiz to book this" note={quizNote} drip={drip.slug} />}
      />

      <div className="dp__after nd-wrap">
        <div className="dp__col">
          <section className="dp__sec" aria-labelledby="t-h">
            <h2 id="t-h" className="nd-q nd-q--sm">
              Before your drip
            </h2>
            <div className="dp__tests">
              <div>
                <p className="nd-tag">For everyone</p>
                <ul className="dp__tlist">
                  <li>
                    <b>A health quiz</b>
                    <span>About three minutes, read by a registered physician before anything is booked.</span>
                  </li>
                  <li>
                    <b>Baseline vitals</b>
                    <span>
                      Blood pressure, heart rate, SpO₂ and temperature at every session. A reading outside its range
                      stops the infusion until the physician clears it.
                    </span>
                  </li>
                  <li>
                    <b>A sealed kit</b>
                    <span>Your nurse checks the seal and every vial&apos;s expiry in front of you.</span>
                  </li>
                </ul>
              </div>
              <div>
                <p className="nd-tag">For this drip</p>
                <ul className="dp__tlist">
                  {checks.length ? (
                    checks.map((c) => (
                      <li key={c}>
                        <b>{c}</b>
                      </li>
                    ))
                  ) : (
                    <li>
                      <b>Nothing extra</b>
                      <span>The quiz and the checks for everyone are enough for {drip.name}.</span>
                    </li>
                  )}
                </ul>
              </div>
            </div>
            <p className="nd-small" style={{ marginTop: "1rem" }}>
              <Link className="nd-link" href="/safety" prefetch={false}>
                Where the safety actually sits
              </Link>
            </p>
          </section>

          <section className="dp__sec" aria-labelledby="s-h">
            <h2 id="s-h" className="nd-q nd-q--sm">
              The session
            </h2>
            <ul className="dp__session">
              <li>
                <b>A small cannula</b>
                <span>One small cannula in a vein in your arm.</span>
              </li>
              <li>
                <b>{minutes(drip)}</b>
                <span>At home, observed every 10 minutes.</span>
              </li>
              {sep.length ? (
                <li>
                  <b>{sep.map((s) => s.name).join(" and ")} separately</b>
                  <span>{drip.infusionNotes || "Never mixed into the bag."}</span>
                </li>
              ) : (
                <li>
                  <b>Everything in one bag</b>
                  <span>{vol} mL, all of it in one bag.</span>
                </li>
              )}
              <li>
                <b>Your report</b>
                <span>Every dose and batch number in your account, the same day.</span>
              </li>
            </ul>
          </section>

          <section className="dp__sec dp__cost" aria-labelledby="c-h">
            <h2 id="c-h" className="nd-q nd-q--sm">
              Price
            </h2>
            <div className="dp__costgrid">
              <p>
                <b className="nd-num">{inr(drip.priceInr)}</b>
                <span>per session: the kit, the nurse and the report included</span>
              </p>
              <p>
                <b className="nd-num">{late.windowHours} h</b>
                <span>free to move or cancel before your slot. {lateFees(late)}</span>
              </p>
            </div>
            {notes.length ? (
              <ul className="dp__notes">
                {notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            ) : null}
            <p className="dp__offer">No card needed to get a protocol reviewed.</p>
            <Cta
              label="Take the quiz to book this"
              note="The physician decides how many sessions suit you"
              drip={drip.slug}
            />
          </section>

          <section className="dp__sec" aria-labelledby="f-h">
            <h2 id="f-h" className="nd-q nd-q--sm">
              Questions people ask
            </h2>
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
            {also.drips.length ? (
              <p className="nd-small" style={{ marginTop: "1.2rem" }}>
                {also.label}{" "}
                {also.drips.map((x, i) => (
                  <span key={x.slug}>
                    {i ? " · " : ""}
                    <Link className="nd-link" href={`/drips/${x.slug}`} prefetch={false}>
                      {x.name}
                    </Link>
                  </span>
                ))}
              </p>
            ) : null}
          </section>
        </div>
      </div>

      <section className="sc-section nd-book" id="book">
        <div className="nd-wrap nd-grid2">
          <div className="nd-book__intro">
            <h2 className="nd-q">Ready to book?</h2>
            <p className="nd-lede">
              Three minutes of questions, read by a registered physician. If {drip.name} is not right for you, they will
              say so, and tell you what is.
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
                <p className="nd-slip__drip">{drip.name}</p>
                <p className="nd-slip__free">{duration(drip)} · at your home</p>
              </div>
              <p className="nd-slip__price">
                per session<b>{inr(drip.priceInr)}</b>
              </p>
            </div>
            <p className="nd-body nd-slip__body">
              The quiz asks what a physician needs to know before they will put their name to a protocol. Answer it, and
              the physician confirms {drip.name} or suggests what fits you better.
            </p>
            <Cta label="Take the quiz to book this" note="No card needed to get a protocol reviewed" drip={drip.slug} />
          </div>
        </div>
      </section>

      {/* The phone's bottom bar, shown past the hero and away from the slip. */}
      <div className="nd-sticky" aria-label="Booking">
        <QuizLink label="Take the health quiz" drip={drip.slug} />
        <span className="nd-sticky__free">{quizNote}</span>
      </div>
    </DripMotion>
  );
}

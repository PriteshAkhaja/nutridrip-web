/* eslint-disable @next/next/no-img-element -- the room and the morning are
   full-bleed backdrops sized by the site's own stylesheet. */
import type { CSSProperties, ReactNode } from "react";
import type { AssemblyDrip } from "@/lib/data/assembly";
import type { DripDetail } from "@/lib/data/drips";
import { CARE, type FeelImage } from "@/lib/feel";
import { InfinityMark, LiquidFill } from "@/components/site/v3/LiquidFill";
import { dose, num } from "@/components/site/home/format";

/**
 * Steps 2 and 3 of the client's brief (2026-11-20), after "What's inside":
 * the finished bag comes down onto the stand in the evening room, then the
 * morning after reads what the drip is for. One pinned screen, moved by
 * ./stand.ts. With reduced motion, on a screen too short to pin, and until the
 * script runs, it is the two pictures with their words, one after the other.
 *
 * The bag is the drip's own, full, its label printed from the Drip document;
 * the time is the last bookable slot and the line the real zone count.
 */
export function StandStage({
  drip,
  assembly,
  evening,
  call,
  zoneCount,
  feel,
  cta,
  times,
  running,
}: {
  drip: DripDetail;
  assembly: AssemblyDrip;
  /** The last bookable time today ("7:00 PM"), or null when none is open. */
  evening: string | null;
  /** The physician's call, as the site words it ("15 min phone call with your physician"). */
  call: string;
  zoneCount: number;
  feel: FeelImage;
  /** The quiz button, drawn by the page. */
  cta: ReactNode;
  /** The clock while the drip runs, from the evening slot to its end, in the site's clock format; empty without a slot. */
  times: string[];
  /** The line while it runs ("30 to 40 minutes at home, observed every 10 minutes."). */
  running: string;
}) {
  const vol = num(assembly.volumeMl);
  const inBag = assembly.items.filter((i) => !i.separate);
  const sep = assembly.items.filter((i) => i.separate);
  const benefits = drip.benefits;
  // The last step needs something real to say: the drip's own benefits.
  const act3 = benefits.length > 0;

  return (
    <>
      <section
        className="st"
        data-st=""
        data-act3={act3 ? "1" : "0"}
        aria-label="At your home"
        suppressHydrationWarning
        style={{ "--st-u": act3 ? 7 : 4.2 } as CSSProperties}
      >
        <div className="st__pin">
          {/* Step 2: at home with the nurse. The bag comes from beside the list onto
              this stand; then the tube to the arm, and the clock while it runs. */}
          <div className="st__act st__act--care">
            <div className="st__care" data-st-care="" aria-hidden="true">
              <img
                src={CARE.src}
                alt=""
                width={CARE.w}
                height={CARE.h}
                loading="lazy"
                decoding="async"
                style={{ objectPosition: "70% 50%" }}
              />
              <span className="st__dim st__dim--care" />
            </div>
            <div className="st__bag" data-st-bag="" aria-hidden="true">
              <div className="nd-bag dp__bag st__bagin" data-st-bagin="">
                {/* The front of the hook's wire, through the hanging hole, once it is hung
                    (bag-picture units, 577 x 1200; the hole is at 288, 56). */}
                <svg
                  className="st__wire"
                  data-st-wire=""
                  viewBox="0 0 577 1200"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path d="M342 -6 C334 18 306 36 290 66" />
                </svg>
                {/* The page's bag carried on: no drops from the top (they go in by the port). */}
                <LiquidFill drops={0} rings={0} />
                <img
                  className="nd-bag__img"
                  src="/site/v3/bag-empty.webp"
                  width={577}
                  height={1200}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <div className="dpl">
                  <p className="bl-word">
                    NutriDrip<sup>™</sup>
                  </p>
                  <p className="bl-sub">IV NUTRIENT THERAPY</p>
                  <p className="bl-band">{drip.name}</p>
                  <ul className="dpl__lines">
                    {assembly.carrier ? (
                      <li className="is-on">
                        <span>{assembly.carrier.name}</span>
                        <b>{vol} mL</b>
                      </li>
                    ) : null}
                    {inBag.map((i, k) => (
                      <li key={k} className="is-on">
                        <span>{i.name}</span>
                        <b>{dose(i)}</b>
                      </li>
                    ))}
                    {sep.length ? (
                      <li className="dpl__lsep is-on">
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
            <svg className="st__tube" data-st-tube="" aria-hidden="true">
              <path data-st-line="" />
              <circle data-st-drop="" r="3" />
            </svg>
            {/* One block: the time stays and starts to run; only the tag and the
                line under it change, from the arrival to the drip running. */}
            <div className="st__words st__a2" data-st-a2="">
              <p className="nd-tag st__swap">
                <span data-st-was="">At your home</span>
                <span data-st-now="" aria-hidden="true">
                  While it runs
                </span>
              </p>
              {times.length ? (
                <p className="st__time st__time--run" data-st-clock="" data-times={JSON.stringify(times)}>
                  {times[0]}
                </p>
              ) : evening ? (
                <p className="st__time">{evening}</p>
              ) : null}
              <div className="st__swap st__swap--line">
                <p className="st__line" data-st-was="">
                  A nurse at your door, in any of {zoneCount} zones across Bengaluru, after a {call}.
                </p>
                <p className="st__line" data-st-now="" aria-hidden="true">
                  {running}
                </p>
              </div>
            </div>
          </div>

          {/* Step 3: the morning after, in the drip's own words. */}
          {act3 ? (
            <div className="st__act st__act--feel">
              <div className="st__feel" data-st-feel="" aria-hidden="true">
                <img
                  src={feel.src}
                  alt=""
                  width={feel.width}
                  height={feel.height}
                  loading="lazy"
                  decoding="async"
                  style={{ objectPosition: feel.position }}
                />
                <span className="st__dim" />
              </div>
              <div className="st__words st__a3" data-st-a3="">
                <p className="nd-tag">What it&apos;s for</p>
                <h2 className="nd-q st__head">{benefits[0].title}</h2>
                {benefits[0].description ? <p className="nd-lede st__lede">{benefits[0].description}</p> : null}
                {benefits.length > 1 ? (
                  <ul className="st__more">
                    {benefits.slice(1).map((b) => (
                      <li key={b.title}>
                        <b>{b.title}</b>
                        {b.description ? <span>{b.description}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="st__cta">{cta}</div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
      {/* Runs as the HTML is read, before the first paint: where the scene will
        pin it is drawn pinned (and as tall) from the start, so a reload part
        way down the page does not jump. ./stand.ts adds the same class. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var s=document.currentScript&&document.currentScript.previousElementSibling;if(s&&window.matchMedia&&matchMedia("(min-height: 501px) and (prefers-reduced-motion: no-preference)").matches)s.classList.add("is-pinned")})()`,
        }}
      />
    </>
  );
}

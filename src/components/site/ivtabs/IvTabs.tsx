/* eslint-disable @next/next/no-img-element -- the two photographs are sized
   by the site's own stylesheet, with fixed dimensions. */
import Link from "next/link";
import type { CSSProperties } from "react";
import type { ContentKey } from "@/lib/content";
import { Cta } from "@/components/site/v3/Cta";
import { BookSection, type BookFacts } from "@/components/site/v3/BookSection";
import { IvTabsMotion } from "./IvTabsMotion";
import { Crumbs } from "@/components/site/v3/Crumbs";

/**
 * IV vs Tablets, in the client's design (approved prototype:
 * scrollcraft/builds/iv-vs-tablets): one dose followed down each route,
 * then how tablets are absorbed, how IV differs, when each fits, and the
 * limits. Copy from content.ts (ivtabs.*); the IV's running time and the slip
 * from the drips.
 */

type Copy = Record<ContentKey, string>;
const vars = (o: Record<string, string | number>) => o as CSSProperties;

export function IvTabs({ copy, facts }: { copy: Copy; facts: BookFacts }) {
  const { range } = facts;
  const fill = (s: string) =>
    s.replace("{duration}", range ? `${range.durMin} to ${range.durMax} minutes` : "the time your protocol sets");

  /** A stop on a route: the long name, the short one a phone's row shows, and the stage's words. */
  const stop = (key: string, at: string, word?: string) => {
    const title = copy[`${key}.title` as ContentKey];
    const short = copy[`${key}.short` as ContentKey] as string | undefined;
    return (
      <li key={key} data-at={at} data-word={word}>
        <b>
          {short ? (
            <>
              <span className="lg">{title}</span>
              <span className="sm">{short}</span>
            </>
          ) : (
            title
          )}
        </b>
        <p>{fill(copy[`${key}.body` as ContentKey])}</p>
      </li>
    );
  };

  return (
    <IvTabsMotion drips={facts.drips}>
      <section className="nd-pagehead">
        <div className="nd-wrap">
          <Crumbs trail={[{ name: "IV vs Tablets" }]} />
          <h1 className="nd-q">{copy["ivtabs.heading"]}</h1>
          <p className="nd-lede">{copy["ivtabs.lede"]}</p>
        </div>
      </section>

      <section
        className="routes act-res"
        data-sc-act="pin"
        data-sc-span="4.2"
        style={vars({ "--span": 4.2, "--span-m": 4.6 })}
        aria-label="One dose by tablet and one by IV, stage by stage"
      >
        <div data-sc-stage="" className="routes__stage" data-sc-verify-state="0">
          <div className="routes__grid">
            <div className="route route--tab" data-route="tab">
              <div className="route__head">
                <p className="route__k">{copy["ivtabs.tab.label"]}</p>
                <p className="route__lv" data-lv="">
                  {copy["ivtabs.level.full"]}
                </p>
              </div>
              <ol className="route__path">
                {stop("ivtabs.tab.1", "0.00", copy["ivtabs.level.full"])}
                {stop("ivtabs.tab.2", "0.22", copy["ivtabs.level.less"])}
                {stop("ivtabs.tab.3", "0.46", copy["ivtabs.level.lessAgain"])}
                {stop("ivtabs.tab.4", "0.70", copy["ivtabs.level.part"])}
                {stop("ivtabs.tab.5", "0.92")}
              </ol>
              <span className="route__dose" aria-hidden="true" />
            </div>
            <div className="route route--iv" data-route="iv">
              <div className="route__head">
                <p className="route__k">{copy["ivtabs.iv.label"]}</p>
                <p className="route__lv" data-lv="">
                  {copy["ivtabs.level.full"]}
                </p>
              </div>
              <ol className="route__path">
                {stop("ivtabs.iv.1", "0.00")}
                {stop("ivtabs.iv.2", "0.40")}
              </ol>
              <span className="route__dose" aria-hidden="true" />
            </div>
          </div>
          <div className="routes__end">
            <p className="routes__sum">{copy["ivtabs.summary"]}</p>
            <p className="nd-small">{copy["ivtabs.note"]}</p>
            <Cta />
          </div>
        </div>
      </section>

      <section className="sc-section" aria-labelledby="a-h">
        <div className="nd-wrap ivt__grid">
          <img
            className="ivt__pic"
            src="/site/v3/tablets.webp"
            width={1800}
            height={1018}
            alt="White tablets and capsules on a white surface in window light"
            loading="lazy"
          />
          <div className="sc-stack">
            <h2 id="a-h" className="nd-q nd-q--sm">
              {copy["ivtabs.absorbed.heading"]}
            </h2>
            <p className="nd-body">{copy["ivtabs.absorbed.body"]}</p>
          </div>
        </div>
      </section>

      <section className="sc-section" style={{ background: "#fff" }} aria-labelledby="b-h">
        <div className="nd-wrap ivt__grid ivt__grid--flip">
          <img
            className="ivt__pic"
            src="/site/v3/ivline.webp"
            width={1800}
            height={1018}
            alt="A clear IV line with a roller clamp on a white surface in window light"
            loading="lazy"
          />
          <div className="sc-stack">
            <h2 id="b-h" className="nd-q nd-q--sm">
              {copy["ivtabs.different.heading"]}
            </h2>
            <p className="nd-body">{copy["ivtabs.different.body"]}</p>
          </div>
        </div>
      </section>

      <section className="sc-section" aria-labelledby="c-h">
        <div className="nd-wrap nd-grid2 ivt__cards">
          <div className="ivt__card">
            <h2 id="c-h" className="nd-q nd-q--sm">
              {copy["ivtabs.enough.heading"]}
            </h2>
            <p className="nd-body">{copy["ivtabs.enough.body"]}</p>
          </div>
          <div className="ivt__card">
            <h2 className="nd-q nd-q--sm">{copy["ivtabs.choose.heading"]}</h2>
            <ul className="ivt__list">
              <li>{copy["ivtabs.choose.1"]}</li>
              <li>{copy["ivtabs.choose.2"]}</li>
              <li>{copy["ivtabs.choose.3"]}</li>
              <li>{copy["ivtabs.choose.4"]}</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="sc-section nd-dark" aria-labelledby="d-h">
        <div className="nd-wrap nd-grid2">
          <div className="sc-stack">
            <h2 id="d-h" className="nd-q nd-q--sm">
              {copy["ivtabs.limits.heading"]}
            </h2>
            <p className="nd-body">{copy["ivtabs.limits.body"]}</p>
          </div>
          <div className="sc-stack">
            <p className="nd-body">{copy["ivtabs.limits.body2"]}</p>
            <p>
              <Link className="nd-link ivt__dlink" href="/drips" prefetch={false}>
                {copy["ivtabs.limits.link"]}
              </Link>
            </p>
            <Cta />
          </div>
        </div>
      </section>

      <BookSection facts={facts} />
    </IvTabsMotion>
  );
}

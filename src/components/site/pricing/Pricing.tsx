import Link from "next/link";
import type { CatalogueDrip } from "@/lib/data/assembly";
import type { LatePolicy } from "@/lib/billing/late-policy";
import type { Faq } from "@/lib/data/faqs";
import { Cta } from "@/components/site/v3/Cta";
import { BookSection, type BookFacts } from "@/components/site/v3/BookSection";
import { duration, hours, inr, lateFees } from "@/components/site/home/format";
import { PricingMotion } from "./PricingMotion";
import { Crumbs } from "@/components/site/v3/Crumbs";

/**
 * Pricing, in the client's tokens (no client page): a Light page. Every drip's
 * price per session from the database, what that price covers, the change and
 * refund rules from the Billing page, and the booking questions from the
 * FAQ (lib/data/faqs.ts, where every answer has code behind it). The old
 * page's courses (10% off four, 20% off eight, a six-month price lock) are
 * not sold by the app, so they are not here.
 */

export function Pricing({
  drips,
  late,
  faqs,
  facts,
}: {
  drips: CatalogueDrip[];
  late: LatePolicy;
  faqs: Faq[];
  facts: BookFacts;
}) {
  const prices = drips.map((d) => d.priceInr);
  const range = prices.length ? { lo: Math.min(...prices), hi: Math.max(...prices) } : null;

  const COVERS: Array<[string, string]> = [
    ["The physician", "Reading your quiz, the call, and the decision. No separate consultation fee."],
    ["The nurse visit", "At your home, office or a hotel. No travel charge inside the zones we serve."],
    ["The sealed kit", "Made up for your protocol, checked at your door."],
    ["The drip itself", "Every dose, published on its page, and the report after."],
  ];

  return (
    <PricingMotion drips={facts.drips}>
      <section className="nd-pagehead pr-head">
        <div className="nd-wrap pr-head__grid">
          <div>
            <Crumbs trail={[{ name: "Pricing" }]} />
            <h1 className="nd-q">One price per session. Everything included.</h1>
            <p className="nd-lede">
              The price of a session covers the physician, the nurse visit, the sealed kit and the drip itself, and it
              depends only on what goes into the bag.
            </p>
          </div>
          <div className="pr-head__side">
            {range ? (
              <p className="pr-head__range">
                <span>Per session</span>
                <b className="nd-num">
                  {inr(range.lo)}
                  {range.hi > range.lo ? <> to {inr(range.hi)}</> : null}
                </b>
              </p>
            ) : null}
            <Cta />
          </div>
        </div>
      </section>

      <section className="sc-section nd-section--tight pr-list" aria-labelledby="list-h">
        <div className="nd-wrap">
          <h2 id="list-h" className="nd-q nd-q--sm" data-sc-in="">
            Every drip, every price.
          </h2>
          {drips.length ? (
            <table className="nd-table pr-table" data-sc-in="">
              <caption className="visually-hidden">Price per session for each drip</caption>
              <thead>
                <tr>
                  <th scope="col">Drip</th>
                  <th scope="col" className="pr-table__goal">
                    For
                  </th>
                  <th scope="col">Time</th>
                  <th scope="col" className="pr-table__price">
                    Per session
                  </th>
                </tr>
              </thead>
              <tbody>
                {drips.map((d) => (
                  <tr key={d.slug}>
                    <td>
                      <span className="pr-table__name">
                        <span className="pr-table__dot" style={{ background: d.tint }} aria-hidden="true" />
                        <Link href={`/drips/${d.slug}`} prefetch={false}>
                          {d.name}
                        </Link>
                      </span>
                    </td>
                    <td className="pr-table__goal">{d.category ?? "—"}</td>
                    <td>{duration(d)}</td>
                    <td className="pr-table__price nd-num">{inr(d.priceInr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="nd-body pr-list__none">
              The panel is being updated. The quiz still works: the physician chooses with you.
            </p>
          )}
          <p className="nd-small pr-list__note">
            Each drip&apos;s page lists every ingredient and dose.{" "}
            <Link className="nd-link" href="/drips" prefetch={false}>
              Compare the drips
            </Link>
          </p>
        </div>
      </section>

      <section className="sc-section nd-section--tight pr-covers" aria-labelledby="covers-h">
        <div className="nd-wrap">
          <h2 id="covers-h" className="nd-q nd-q--sm" data-sc-in="">
            What the price already covers.
          </h2>
          <ul className="pr-covers__list" data-sc-in="" data-sc-stagger="70">
            {COVERS.map(([t, b]) => (
              <li key={t}>
                <b>{t}</b>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="sc-section nd-section--tight pr-change" aria-labelledby="change-h">
        <div className="nd-wrap nd-grid2">
          <div className="pr-change__free" data-sc-in="">
            <p className="pr-change__n nd-num">{late.windowHours}</p>
            <div>
              <h2 id="change-h" className="nd-q nd-q--sm">
                Free to move or cancel up to {hours(late.windowHours)} before your slot.
              </h2>
              <p className="nd-body">{lateFees(late)}</p>
            </div>
          </div>
          <ul className="nd-rule-list pr-change__list" data-sc-in="" data-sc-stagger="60">
            <li>
              <b>The physician declines</b>
              <span>Everything you paid is refunded.</span>
            </li>
            <li>
              <b>A vital stops the session</b>
              <span>If the physician calls it off, everything you paid is refunded.</span>
            </li>
            <li>
              <b>A held slot is not approved in time</b>
              <span>The slot is released and everything you paid is refunded.</span>
            </li>
            <li>
              <b>You cancel late</b>
              <span>Inside the {hours(late.windowHours)}, the late fee above is kept and the rest is refunded.</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="sc-section nd-section--tight pr-faq" aria-labelledby="pfaq-h">
        <div className="nd-wrap nd-grid2">
          <div className="sc-stack" data-sc-in="">
            <h2 id="pfaq-h" className="nd-q nd-q--sm">
              Before you pay
            </h2>
            <p>
              <Link className="nd-link" href="/faqs" prefetch={false}>
                Every question, on the FAQs page
              </Link>
            </p>
          </div>
          <div className="nd-faq" data-sc-in="">
            {faqs.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <div>{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <BookSection facts={facts} />
    </PricingMotion>
  );
}

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { CHECKLIST_STEPS } from "@/lib/clinical/checklist";
import { Photo } from "@/components/site/Photo";
import type { SiteImage } from "@/lib/site-images";
import { ClinicEnquiryForm } from "./EnquiryForm";
import { ClinicsMotion } from "./ClinicsMotion";
import { Crumbs } from "@/components/site/v3/Crumbs";

/**
 * For clinics, in the client's design (`clinics.html`: the dark head, the
 * numbered offer, the rules that travel with the product, the trade form)
 * with our offer in it: what the app does for a clinic, nothing it does not.
 * The old page's economics (a ₹8,400 split, 38%), "24 hr" and the 4 PM
 * cut-off had no source and are gone (PAGES.md 4b). The peak is one example
 * order taken through the app as cards that stack: ordered, confirmed (the
 * exact vials, soonest expiry first), dispatched (the ledger), a recall.
 * Drip and ingredient names are the panel's own; batch codes are examples,
 * and say so.
 */

export type DeckLine = { drip: string; qty: number; items: string[] };

const vars = (o: Record<string, string | number>) => o as CSSProperties;

const OFFER: Array<[string, string]> = [
  [
    "You do not run a pharmacy",
    "Order the drips you expect to run this week. Confirmation reserves the exact vials against your order, so a confirmed order is one you can staff against.",
  ],
  [
    "Physician review is ours",
    "Every protocol is read and signed by a registered doctor before it reaches your room. Their name and registration are on the session report.",
  ],
  [
    "Our nurses, or your own",
    `Use our registered nurses, or put your own on the platform. Either way they work the same ${CHECKLIST_STEPS.length}-step checklist, and the same record comes out.`,
  ],
  [
    "Recall traceability, included",
    "Every dispatch writes a ledger row: which batch went to which order. When a maker recalls a batch, you answer it from a screen.",
  ],
  [
    "Your rooms, your console",
    "Your orders, your sessions and your invoices in one place, and nothing of any other clinic's.",
  ],
  [
    "Pay per order, or on account",
    "Pay for each order before it is confirmed or, once agreed, order on account and settle invoices within 30 days.",
  ],
];

const ONBOARDING: Array<[string, string, string]> = [
  ["Week 1", "Site visit", "We look at the room, where stock will be kept, and your existing staff."],
  ["Week 2", "Agreement", "The split, a volume target and liability, in writing before anything is ordered."],
  ["Week 3", "Training", "Your nurses take the checklist end to end on the platform, on real formulas."],
  ["Week 4", "First order", "Stock arrives with its batch numbers already on your account."],
];

const FAQ: Array<[string, string]> = [
  [
    "What do we need in the room?",
    "A reclining chair, a hand-wash point and secure storage for the stock you hold. We look at it with you on the site visit before anything is agreed.",
  ],
  [
    "Who carries the clinical liability?",
    "The reviewing physician carries the prescribing decision. The partnership agreement sets out the rest in plain terms before you sign anything.",
  ],
  [
    "Is the stock we see real?",
    "Yes. Availability is counted from stock on hand by batch and expiry, and shown twice: pooled, and in whole vials, because a vial does not divide evenly. Expired and quarantined lots never count.",
  ],
  [
    "Can we use our own formulas?",
    "Talk to us. A formula goes on the panel only once a physician has signed it off, and it is built like every other: the same unit checks and the same availability.",
  ],
];

export function Clinics({ hero, protocols, lines }: { hero: SiteImage; protocols: number; lines: DeckLine[] }) {
  // The deck's example batch codes: one per ingredient shown, and marked as examples.
  const code = (i: number) => `EX-${1040 + i * 7}`;
  const EXPIRY = ["Mar 2027", "Jun 2027", "Aug 2027", "Nov 2027"];
  const first = lines[0];
  const lots = lines.flatMap((l, li) =>
    l.items.map((name, ii) => ({ line: l, name, code: code(li * 2 + ii), exp: EXPIRY[(li * 2 + ii) % EXPIRY.length] }))
  );

  const card = (n: number, title: string, body: ReactNode, mock: ReactNode, status: string, tone = "") => (
    <article className="cl-card" style={vars({ "--i": n - 1 })} key={title}>
      <div className="cl-card__copy">
        <p className="cl-card__n">
          {n} <span>of 4</span>
        </p>
        <h3 className="cl-card__h">{title}</h3>
        <p className="cl-card__b">{body}</p>
      </div>
      <div className="cl-order" aria-hidden="true">
        <p className="cl-order__k">
          Order <span>Example</span>
          <b className={`cl-order__status${tone ? ` cl-order__status--${tone}` : ""}`}>{status}</b>
        </p>
        {mock}
      </div>
    </article>
  );

  const orderLines = (
    <ul className="cl-order__lines">
      {lines.map((l) => (
        <li key={l.drip}>
          <span>{l.drip}</span>
          <b className="nd-num">× {l.qty}</b>
        </li>
      ))}
    </ul>
  );

  return (
    <ClinicsMotion>
      <section className="nd-pagehead nd-dark cl-head">
        <div className="nd-wrap cl-head__grid">
          <div>
            <Crumbs trail={[{ name: "For clinics" }]} />
            <h1 className="nd-q">Run IV therapy without running a pharmacy.</h1>
            <p className="nd-lede">
              You have the room and the patients. What stops most clinics is the rest of it: stock that expires, batches
              nobody can trace, and a prescribing decision somebody has to own. We do that part.
            </p>
            <div className="cl-head__go">
              <a className="nd-btn" href="#enquire">
                Talk to us
              </a>
              <Link className="nd-btn nd-btn--ghost" href="/safety" prefetch={false}>
                Read the clinical model
              </Link>
            </div>
            <p className="cl-head__fig">
              <span className="nd-num">{protocols}</span> protocols on the panel today
            </p>
          </div>
          {/* Admin → Site images, For clinics: First screen. */}
          <Photo
            image={hero}
            className="cl-head__pic"
            radius="20px"
            sizes="(min-width: 861px) 44vw, 92vw"
            preload
            decorative={!hero.alt}
          />
        </div>
      </section>

      <section className="sc-section cl-offer" aria-labelledby="offer-h">
        <div className="nd-wrap">
          <h2 id="offer-h" className="nd-q nd-q--sm" data-sc-in="">
            What the partnership covers
          </h2>
          <ol className="cl-offer__list" data-sc-in="" data-sc-stagger="60">
            {OFFER.map(([t, b], i) => (
              <li key={t}>
                <span className="cl-offer__n nd-num">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{t}</h3>
                  <p>{b}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* One order through the app: four cards that stack as you read. */}
      <section className="sc-section cl-deck" aria-labelledby="deck-h">
        <div className="nd-wrap">
          <div className="cl-deck__head" data-sc-in="">
            <p className="nd-tag">One order, start to finish</p>
            <h2 id="deck-h" className="nd-q">
              What happens to a clinic&apos;s order.
            </h2>
            <p className="nd-body">
              As the app runs it, with drips from today&apos;s panel. The order and its batch codes are an example.
            </p>
          </div>
          {first ? (
            <div className="cl-deck__cards">
              {card(
                1,
                "You order the week ahead",
                "Pick the drips and how many. The availability you see is real stock, counted twice: pooled, and in whole vials, because a vial does not divide evenly. The gap between them is wastage.",
                orderLines,
                "To confirm"
              )}
              {card(
                2,
                "Confirming reserves the exact vials",
                "Each line takes its vials from stock, soonest expiry first, in one step: two confirmations at once cannot both take the last vial. Expired and quarantined lots never count.",
                <ul className="cl-order__lots">
                  {lots.map((l) => (
                    <li key={l.code}>
                      <span>
                        {l.name}
                        <small>{l.line.drip}</small>
                      </span>
                      <b className="nd-num">{l.code}</b>
                      <small className="cl-order__exp">exp {l.exp}</small>
                    </li>
                  ))}
                </ul>,
                "Confirmed"
              )}
              {card(
                3,
                "Dispatch writes the ledger",
                "Every vial leaves against your order, and the ledger takes the drug and the batch from the stock record itself, never from a recalculated plan, so no row is anonymous.",
                <ul className="cl-order__ledger">
                  {lots.map((l) => (
                    <li key={l.code}>
                      <b className="nd-num">{l.code}</b>
                      <span>→ this order</span>
                      <em>Recorded</em>
                    </li>
                  ))}
                </ul>,
                "Dispatched"
              )}
              {card(
                4,
                "A recall is answered from a screen",
                "If a maker recalls a batch, the ledger names every order it went into, so you know which stock to pull, the same day.",
                <div className="cl-order__recall">
                  <p className="cl-order__alert">
                    <b>Recall</b> Batch <span className="nd-num">{lots[0]?.code}</span>, {lots[0]?.name}
                  </p>
                  <p className="cl-order__found">Found in</p>
                  <ul className="cl-order__lines">
                    <li>
                      <span>This order: {first.drip}</span>
                      <b className="nd-num">× {first.qty}</b>
                    </li>
                    <li>
                      <span>Every other order it went into</span>
                      <b>Listed</b>
                    </li>
                  </ul>
                </div>,
                "Traced",
                "recall"
              )}
            </div>
          ) : null}
        </div>
      </section>

      <section className="sc-section nd-section--tight cl-onboard" aria-labelledby="onboard-h">
        <div className="nd-wrap">
          <h2 id="onboard-h" className="nd-q nd-q--sm" data-sc-in="">
            From first call to first session.
          </h2>
          <ol className="cl-onboard__list" data-sc-in="" data-sc-stagger="80">
            {ONBOARDING.map(([when, t, b], i) => (
              <li key={when}>
                <span className="cl-onboard__n nd-num">{i + 1}</span>
                <p className="nd-tag">{when}</p>
                <h3>{t}</h3>
                <p>{b}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="sc-section nd-section--tight cl-faq" aria-labelledby="cfaq-h">
        <div className="nd-wrap nd-grid2">
          <h2 id="cfaq-h" className="nd-q nd-q--sm" data-sc-in="">
            What clinics ask first
          </h2>
          <div className="nd-faq" data-sc-in="">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <div>{a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="sc-section cl-trade" id="enquire" aria-labelledby="enquire-h">
        <div className="nd-wrap nd-grid2">
          <div className="sc-stack" data-sc-in="">
            <h2 id="enquire-h" className="nd-q nd-q--sm">
              Tell us about your rooms.
            </h2>
            <p className="nd-body">
              We will come and look before either of us commits to anything: a nurse and an operations lead, in your
              clinic, for about an hour.
            </p>
            <p className="nd-body">
              Or write to{" "}
              <a className="nd-link" href="mailto:partners@nutridrip.com">
                partners@nutridrip.com
              </a>
              .
            </p>
          </div>
          <ClinicEnquiryForm />
        </div>
      </section>
    </ClinicsMotion>
  );
}

import Link from "next/link";
import { ZONE_STATUS_LABEL } from "@/lib/zones";
import { BookSection, type BookFacts } from "@/components/site/v3/BookSection";
import { PincodeCheck, type ShownZone } from "./PincodeCheck";
import { zoneAnchor } from "./anchor";
import { ZonesMotion } from "./ZonesMotion";
import { Crumbs } from "@/components/site/v3/Crumbs";

/**
 * Zones, in the client's tokens (no client page): a Light page for someone
 * checking whether a nurse can come. The pincode check uses the booking
 * guard's own rule; every zone, its pincodes and its hours come from Service
 * zones (super admin). The old page's "45 min typical nurse travel" was the
 * gap a nurse is given between sessions, not a travel time, so it is gone.
 */

export function Zones({ zones, facts }: { zones: ShownZone[]; facts: BookFacts }) {
  const open = zones.filter((z) => z.status === "open").length;
  const limited = zones.length - open;
  return (
    <ZonesMotion drips={facts.drips}>
      <section className="nd-pagehead zn-head">
        <div className="nd-wrap zn-head__grid">
          <div>
            <Crumbs trail={[{ name: "Zones" }]} />
            <h1 className="nd-q">Where a nurse can come.</h1>
            <p className="nd-lede">
              {zones.length} {zones.length === 1 ? "zone" : "zones"} across Bengaluru. A zone we cannot staff for the
              whole day is marked limited here, not quietly dropped.
            </p>
          </div>
          <PincodeCheck zones={zones} />
        </div>
      </section>

      <section className="sc-section nd-section--tight zn-list" aria-labelledby="zlist-h">
        <div className="nd-wrap">
          <div className="zn-list__head" data-sc-in="">
            <h2 id="zlist-h" className="nd-q nd-q--sm">
              Every zone, its pincodes, and when we come.
            </h2>
            <p className="zn-key">
              <span className="zn-status zn-status--open">{ZONE_STATUS_LABEL.open}</span> {open}
              {limited ? (
                <>
                  <span className="zn-status zn-status--limited">{ZONE_STATUS_LABEL.limited}</span> {limited}
                </>
              ) : null}
            </p>
          </div>
          <div className="zn-grid" data-sc-in="" data-sc-stagger="40">
            {zones.map((z) => (
              <article key={z.id ?? z.name} id={zoneAnchor(z)} className="zn-card">
                <div className="zn-card__head">
                  <h3>{z.name}</h3>
                  <span className={`zn-status zn-status--${z.status}`}>{ZONE_STATUS_LABEL[z.status]}</span>
                </div>
                <dl>
                  <div>
                    <dt>Hours</dt>
                    <dd>
                      {z.hours}, a slot {z.step}
                    </dd>
                  </div>
                  <div>
                    <dt>Pincodes</dt>
                    <dd className="nd-num">{z.pincodes.join(", ")}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="sc-section nd-section--tight zn-not" aria-labelledby="not-h">
        <div className="nd-wrap zn-not__in" data-sc-in="">
          <div>
            <h2 id="not-h" className="nd-q nd-q--sm">
              Not on the list?
            </h2>
            <p className="nd-body">
              Ask a clinician about your area, or take the quiz anyway: the physician&apos;s review does not depend on
              where you live.
            </p>
          </div>
          <Link className="nd-btn nd-btn--ghost" href="/consult" prefetch={false}>
            Ask about your area
          </Link>
        </div>
      </section>

      <BookSection facts={facts} />
    </ZonesMotion>
  );
}

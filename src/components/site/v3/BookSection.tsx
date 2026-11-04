import { listAssemblyDrips } from "@/lib/data/assembly";
import { getZones } from "@/lib/zones-store";
import { servedZones } from "@/lib/zones";
import { getLatePolicy } from "@/lib/billing/settings";
import { duration } from "@/components/site/home/format";
import { Cta, QuizLink } from "./Cta";
import type { SlipDrip } from "./book";

/** What the slip states: every figure from the drips, the zones and the Billing page. */
export type BookFacts = {
  drips: SlipDrip[];
  /** Across every public drip; null when there is none. */
  range: { durMin: number; durMax: number; priceFrom: number } | null;
  zoneCount: number;
  windowHours: number;
};

export async function getBookFacts(): Promise<BookFacts> {
  const [drips, zones, late] = await Promise.all([listAssemblyDrips(), getZones(), getLatePolicy()]);
  return {
    drips: drips.map((d) => ({ slug: d.slug, name: d.name, tint: d.tint, price: d.priceInr, duration: duration(d) })),
    range: drips.length
      ? {
          durMin: Math.min(...drips.map((d) => d.durationMin)),
          durMax: Math.max(...drips.map((d) => d.durationToMin ?? d.durationMin)),
          priceFrom: Math.min(...drips.map((d) => d.priceInr)),
        }
      : null,
    zoneCount: servedZones(zones).length,
    windowHours: late.windowHours,
  };
}

/**
 * Ready to book? The landing's closing section, as every redesigned page
 * ends, with the phone's sticky quiz bar. The page's motion runs mountBook
 * (v3/book.ts), which fills in the drip picked on the landing.
 */
export function BookSection({ facts }: { facts: BookFacts }) {
  const { range, zoneCount, windowHours } = facts;
  const hours = `${windowHours} hour${windowHours === 1 ? "" : "s"}`;
  return (
    <>
      <section className="sc-section nd-book" id="book" aria-labelledby="book-h">
        <div className="nd-wrap nd-grid2">
          <div className="nd-book__intro">
            <h2 id="book-h" className="nd-q">
              Ready to book?
            </h2>
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
                <b>Free to move or cancel</b> up to {hours} before your slot.
              </li>
            </ul>
          </div>
          <div className="nd-slip">
            <div className="nd-slip__head">
              <div>
                <p className="nd-tag">Your drip</p>
                <p className="nd-slip__drip" data-chosen-name="">
                  Drip to be suggested
                </p>
                <p className="nd-slip__free">
                  <span data-chosen-duration="">{range ? `${range.durMin}–${range.durMax} min` : "—"}</span> · at your
                  home
                </p>
              </div>
              <p className="nd-slip__price">
                per session
                <b data-chosen-price="">{range ? `From ₹${range.priceFrom.toLocaleString("en-IN")}` : "—"}</b>
              </p>
            </div>
            <p className="nd-body nd-slip__body">
              The quiz asks what a physician needs to know before they will put their name to a protocol.{" "}
              <span data-slip-which="">Not sure which drip?</span> Answer anyway: the physician chooses with you.
            </p>
            <Cta label="Take the quiz to book this" note="No card needed to get a protocol reviewed" />
          </div>
        </div>
      </section>

      <div className="nd-sticky" aria-label="Booking">
        <QuizLink label="Take the health quiz" />
        <span className="nd-sticky__free">A physician reads every answer</span>
      </div>
    </>
  );
}

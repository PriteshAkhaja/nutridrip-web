import Link from "next/link";
import type { ContentKey } from "@/lib/content";
import type { Zone } from "@/lib/zones";
import { Cta } from "@/components/site/v3/Cta";
import { ConsultForm } from "./ConsultForm";
import { ConsultMotion } from "./ConsultMotion";
import { Crumbs } from "@/components/site/v3/Crumbs";

/**
 * Ask a clinician, in the client's tokens (no client page; laid out as the
 * client's trade form: the words beside the form). A Light page: entry
 * reveals only. What happens next is editable copy (consult.response), and
 * the emergency line is the footer's (footer.emergency).
 */
export function Consult({ copy, zones }: { copy: Record<ContentKey, string>; zones: Zone[] }) {
  return (
    <ConsultMotion>
      <section className="nd-pagehead cs-head">
        <div className="nd-wrap cs-grid">
          <div className="cs-words">
            <Crumbs trail={[{ name: "Ask a clinician" }]} />
            <h1 className="nd-q">Not sure yet? Ask first.</h1>
            <p className="nd-lede">
              Leave a question and how to reach you, and our clinical team will get back to you. It is the place for
              what a quiz cannot ask: a medicine you already take, a condition you are unsure about, whether a protocol
              suits what you are after.
            </p>
            <ul className="cs-notes" data-sc-in="" data-sc-stagger="70">
              <li>
                <b>What this is</b>
                <p>
                  A request for somebody to contact you. Nothing is booked, no payment is taken, and it does not replace
                  the health quiz: a physician still reviews you before any session.
                </p>
              </li>
              <li>
                <b>What it is not</b>
                <p>
                  It is not watched in real time, so it is not for anything urgent.{" "}
                  <strong>{copy["footer.emergency"]}</strong> If you have had a session and feel unwell, contact your
                  nurse or physician directly.
                </p>
              </li>
              <li>
                <b>Prefer to read first?</b>
                <p>
                  The{" "}
                  <Link className="nd-link" href="/faqs" prefetch={false}>
                    FAQs
                  </Link>{" "}
                  answer the usual questions with the real numbers, and{" "}
                  <Link className="nd-link" href="/how-it-works" prefetch={false}>
                    How it works
                  </Link>{" "}
                  follows a session from the quiz to the report.
                </p>
              </li>
              <li>
                <b>Ready to start?</b>
                <p>The quiz takes about three minutes, and a physician reads it before anything is booked.</p>
                <Cta />
              </li>
            </ul>
          </div>
          <div className="cs-side">
            <ConsultForm response={copy["consult.response"]} zones={zones} />
          </div>
        </div>
      </section>
    </ConsultMotion>
  );
}

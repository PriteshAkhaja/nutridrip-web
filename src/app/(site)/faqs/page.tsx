import type { Metadata } from "next";
import Link from "next/link";
import { faqCategories } from "@/lib/data/faqs";
import { getLatePolicy } from "@/lib/billing/settings";
import { getZones } from "@/lib/zones-store";
import { getContent } from "@/lib/content";
import { QuizLink } from "@/components/site/v3/Cta";
import { FaqBrowser } from "@/components/site/faqs/FaqBrowser";
// The page's own styles, scoped to .sc-site (scripts/scope-site-css.mjs).
import "@/components/site/v3/styles/scoped/faqs.css";
import { Crumbs } from "@/components/site/v3/Crumbs";

export const metadata: Metadata = {
  title: "FAQs",
  description:
    "Who reads your quiz, how long an approval lasts, the cancellation line, why your nurse asks for a code, and who can see your record.",
};

// The late-change and zones answers carry today's fees and zones.
export const dynamic = "force-dynamic";

/**
 * FAQs, in the client's tokens (no client page). No motion: somebody here is
 * reading or searching (AGENTS.md, "None"). Every answer is lib/data/faqs.ts,
 * where nothing is claimed that has no code behind it.
 */
export default async function FaqsPage() {
  const [policy, zones, copy] = await Promise.all([getLatePolicy(), getZones(), getContent()]);
  const categories = faqCategories(policy, zones);
  return (
    <div className="nd-faqs">
      <section className="nd-pagehead fq-head">
        <div className="nd-wrap">
          <Crumbs trail={[{ name: "FAQs" }]} />
          <h1 className="nd-q">Questions people actually ask.</h1>
          <p className="nd-lede">
            Every answer describes something the service does today, with the real numbers. To see the safeguards rather
            than read about them, the{" "}
            <Link className="nd-link" href="/safety" prefetch={false}>
              Safety page
            </Link>{" "}
            lists the whole checklist.
          </p>
        </div>
      </section>

      <section className="fq-body">
        <div className="nd-wrap">
          <FaqBrowser categories={categories} />
        </div>
      </section>

      <section className="sc-section nd-section--tight fq-ask" aria-labelledby="ask-h">
        <div className="nd-wrap fq-ask__in">
          <div>
            <h2 id="ask-h" className="nd-q nd-q--sm">
              Not here? Ask our clinical team.
            </h2>
            <p className="nd-body">
              Tell us what you want to know and how to reach you, and someone will get back to you.{" "}
              {copy["footer.emergency"]}
            </p>
          </div>
          <div className="fq-ask__go">
            <Link className="nd-btn" href="/consult" prefetch={false}>
              Ask a clinician
            </Link>
            <QuizLink label="Take the health quiz" />
          </div>
        </div>
      </section>
    </div>
  );
}

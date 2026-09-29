import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { faqCategories } from "@/lib/data/faqs";
import { FaqBrowser } from "./FaqBrowser";
import { QuizButton } from "@/components/layout/QuizButton";
import { getLatePolicy } from "@/lib/billing/settings";
import { getZones } from "@/lib/zones-store";
import { SITE_IMAGES } from "@/lib/site-images";
import { PageHero } from "@/components/site/PageHero";
import { Container } from "@/components/site/Layout";
import { CtaPanel } from "@/components/site/CtaPanel";

export const metadata: Metadata = {
  title: "FAQs",
  description:
    "Who reads your quiz, how long an approval lasts, the cancellation line, why your nurse asks for a code, and who can see your record.",
};

export default async function FaqsPage() {
  // The late-change answer carries today's fees.
  const [policy, zones] = await Promise.all([getLatePolicy(), getZones()]);
  const categories = faqCategories(policy, zones);
  return (
    <>
      <PageHero
        eyebrow="FAQs"
        title={
          <>
            Questions people <span className="tone-2">actually ask.</span>
          </>
        }
        lede={
          <>
            Every answer here describes something the service does today, with the real numbers. If you would rather see
            the safeguards than read about them, the <Link href="/safety">Safety page</Link> lists the whole checklist.
          </>
        }
      />

      <section className="pb-[var(--section-y)]">
        <Container>
          <FaqBrowser categories={categories} />
        </Container>
      </section>

      <CtaPanel
        eyebrow="Not here?"
        title="Ask our clinical team."
        lede="Tell us what you want to know and how to reach you, and someone will get back to you. If it is an emergency, call 108 — do not wait for us."
        actions={
          <>
            <ButtonLink href="/consult" size="lg">
              Ask a clinician
            </ButtonLink>
            <QuizButton size="lg" variant="secondary">
              Take the health quiz
            </QuizButton>
          </>
        }
        image={SITE_IMAGES.physicianPhone}
      />
    </>
  );
}

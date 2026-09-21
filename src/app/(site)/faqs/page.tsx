import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FAQ_CATEGORIES } from "@/lib/data/faqs";
import { FaqBrowser } from "./FaqBrowser";

export const metadata: Metadata = {
  title: "FAQs",
  description:
    "Who reads your quiz, how long an approval lasts, the cancellation line, why your nurse asks for a code, and who can see your record.",
};

export default function FaqsPage() {
  return (
    <div className="mx-auto max-w-[1280px] px-6 md:px-10 py-12">
      <div className="max-w-[66ch] mb-10">
        <span className="t-micro">FAQs</span>
        <h1 className="t-h1 mt-2 mb-4">Questions people actually ask.</h1>
        <p className="t-body-lg text-[var(--color-ink-2)]" style={{ textWrap: "pretty" }}>
          Every answer here describes something the service does today, with the real numbers. If you would rather
          see the safeguards than read about them, the{" "}
          <Link href="/safety">Safety page</Link> lists the whole checklist.
        </p>
      </div>

      <FaqBrowser categories={FAQ_CATEGORIES} />

      <div className="mt-16">
        <Card tone="muted" padding="p-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr] items-center">
            <div>
              <h2 className="t-h2 mb-3">Not here?</h2>
              <p className="t-body-lg text-[var(--color-ink-2)] max-w-[58ch]" style={{ textWrap: "pretty" }}>
                Ask our clinical team. Tell us what you want to know and how to reach you, and someone will get back
                to you. If it is an emergency, call{" "}
                <span className="t-data text-[16px] text-[var(--color-ink)]">108</span> — do not wait for us.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <ButtonLink href="/consult" size="lg" block>
                Ask a clinician
              </ButtonLink>
              <ButtonLink href="/quiz" variant="secondary" block>
                Take the health quiz
              </ButtonLink>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

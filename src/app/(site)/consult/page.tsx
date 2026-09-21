import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { getContent } from "@/lib/content";
import { ConsultForm } from "./ConsultForm";

export const metadata: Metadata = {
  title: "Ask a clinician",
  description:
    "Not sure whether IV therapy is right for you? Leave a question and our clinical team will get back to you. Nothing is booked and nothing is charged.",
};

// The wording of what happens next is editable site copy.
export const dynamic = "force-dynamic";

export default async function ConsultPage() {
  const copy = await getContent();

  return (
    <div className="mx-auto max-w-[1280px] px-6 md:px-10 py-12">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_minmax(0,520px)] items-start">
        <div className="max-w-[60ch]">
          <span className="t-micro">Ask a clinician</span>
          <h1 className="t-h1 mt-2 mb-4">Not sure yet? Ask first.</h1>
          <p className="t-body-lg text-[var(--color-ink-2)] mb-8" style={{ textWrap: "pretty" }}>
            Leave a question and how to reach you, and our clinical team will get back to you. It is the right place
            for the things a quiz cannot ask — a medicine you already take, a condition you are unsure about, whether a
            protocol suits what you are after.
          </p>

          <div className="flex flex-col gap-4">
            <Card padding="p-5">
              <h2 className="t-h3 mb-2">What this is</h2>
              <p className="t-body text-[var(--color-ink-2)]">
                A request for somebody to contact you. Nothing is booked, no payment is taken, and it does not replace
                the health quiz — a physician still reviews you before any session.
              </p>
            </Card>
            <Card padding="p-5">
              <h2 className="t-h3 mb-2">What it is not</h2>
              <p className="t-body text-[var(--color-ink-2)]">
                It is not monitored in real time, so it is not for anything urgent.{" "}
                <span className="font-medium text-[var(--color-ink)]">{copy["footer.emergency"]}</span> If you have had
                a session and feel unwell, contact your nurse or physician directly.
              </p>
            </Card>
            <Card padding="p-5">
              <h2 className="t-h3 mb-2">Prefer to read first?</h2>
              <p className="t-body text-[var(--color-ink-2)]">
                The <Link href="/faqs">FAQs</Link> answer the usual questions with the real numbers, and{" "}
                <Link href="/how-it-works">How it works</Link> walks through a session from quiz to report.
              </p>
            </Card>
          </div>
        </div>

        <ConsultForm response={copy["consult.response"]} />
      </div>
    </div>
  );
}

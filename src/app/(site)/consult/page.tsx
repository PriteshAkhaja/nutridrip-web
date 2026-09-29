import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { getContent } from "@/lib/content";
import { ConsultForm } from "./ConsultForm";
import { getZones } from "@/lib/zones-store";
import { servedZones } from "@/lib/zones";
import { PageHero } from "@/components/site/PageHero";
import { delay } from "@/components/site/Layout";
import { IconAlert, IconMessage, IconReport } from "@/components/site/Icons";

export const metadata: Metadata = {
  title: "Ask a clinician",
  description:
    "Not sure whether IV therapy is right for you? Leave a question and our clinical team will get back to you. Nothing is booked and nothing is charged.",
};

// The wording of what happens next is editable site copy.
export const dynamic = "force-dynamic";

export default async function ConsultPage() {
  const copy = await getContent();
  const zones = servedZones(await getZones());

  const notes: Array<{ icon: ReactNode; title: string; body: ReactNode }> = [
    {
      icon: <IconMessage size={18} />,
      title: "What this is",
      body: "A request for somebody to contact you. Nothing is booked, no payment is taken, and it does not replace the health quiz — a physician still reviews you before any session.",
    },
    {
      icon: <IconAlert size={18} />,
      title: "What it is not",
      body: (
        <>
          It is not monitored in real time, so it is not for anything urgent.{" "}
          <span className="font-medium text-[var(--color-ink)]">{copy["footer.emergency"]}</span> If you have had a
          session and feel unwell, contact your nurse or physician directly.
        </>
      ),
    },
    {
      icon: <IconReport size={18} />,
      title: "Prefer to read first?",
      body: (
        <>
          The <Link href="/faqs">FAQs</Link> answer the usual questions with the real numbers, and{" "}
          <Link href="/how-it-works">How it works</Link> walks through a session from quiz to report.
        </>
      ),
    },
  ];

  return (
    <PageHero
      eyebrow="Ask a clinician"
      title={
        <>
          Not sure yet? <span className="tone-2">Ask first.</span>
        </>
      }
      lede="Leave a question and how to reach you, and our clinical team will get back to you. It is the right place for the things a quiz cannot ask — a medicine you already take, a condition you are unsure about, whether a protocol suits what you are after."
      alignTop
      below={
        <ul className="list-none m-0 p-0 flex flex-col">
          {notes.map((n) => (
            <li
              key={n.title}
              className="grid grid-cols-[40px_1fr] gap-4 border-t border-[var(--color-line)] py-6 last:pb-0"
            >
              <span className="w-10 h-10 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary-text)] inline-flex items-center justify-center">
                {n.icon}
              </span>
              <div>
                <h2 className="t-title text-[19px]">{n.title}</h2>
                <p className="t-body text-[var(--color-ink-2)] mt-2 max-w-[56ch]">{n.body}</p>
              </div>
            </li>
          ))}
        </ul>
      }
      aside={
        <div className="lg:sticky lg:top-[calc(var(--site-header-h)+32px)]" data-reveal="hero" style={delay(140)}>
          <ConsultForm response={copy["consult.response"]} zones={zones} />
        </div>
      }
    />
  );
}

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-static";

/**
 * The operational facts behind each policy — what we actually do, written
 * plainly. The binding agreement is issued at booking and is the document that
 * governs; this page exists so nobody has to read that to know the basics.
 */
const DOCS = {
  terms: {
    title: "Terms of service",
    lede: "The commitments that hold in both directions. The full agreement is issued with your booking confirmation and is the document that governs; this is the short version of what it says.",
    sections: [
      {
        heading: "What we are",
        body: [
          "NutriDrip Health Pvt. Ltd. operates an elective IV nutrient therapy service under clinical establishment registration KA/CEA/2024/11872. We are not an emergency service and not a substitute for your regular doctor.",
          "Every protocol is reviewed and signed by a physician registered with the Karnataka Medical Council. Their name and registration number appear on your session report.",
        ],
      },
      {
        heading: "What we will not do",
        body: [
          "We will not administer a protocol a physician has declined, whatever you are willing to pay. We will not start an infusion when your baseline vitals fall outside the reference range without the reviewing physician clearing it.",
          "We do not sell drips as a subscription that runs without review. A course is priced in advance, but each session is still checked against your record on the day.",
        ],
      },
      {
        heading: "Cancellation",
        body: [
          "Cancel or reschedule freely up to 4 hours before your slot. Inside 4 hours a ₹500 fee applies, because the nurse is already dispatched with your batch drawn and those vials cannot go back on the shelf.",
          "If we cancel — a nurse falls ill, stock fails a check, a physician withdraws approval — you are charged nothing and we say which of those it was.",
        ],
      },
      {
        heading: "Payment",
        body: [
          "Sessions are charged on completion, not on booking. A session that does not run because your vitals blocked it is not charged.",
          "A GST invoice with HSN codes is issued for every completed session. Wellness infusions are not usually reimbursable by insurance; therapeutic protocols sometimes are.",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy",
    lede: "What we hold, who can see it, and how to get rid of it. This describes the system as actually built, not an intention.",
    sections: [
      {
        heading: "Who can see your record",
        body: [
          "You, the physician reviewing your protocol, and the nurse attending your session. Nobody else — not our support team by default, not a partner clinic beyond its own bookings, not another patient.",
          "Every access attempt against a clinical record is written to an audit log with the actor, the action and the time. Attempting to open a record you are not entitled to is logged as a refusal, not silently ignored.",
        ],
      },
      {
        heading: "What we hold",
        body: [
          "Your contact details, the answers you gave in the health quiz, any lab reports you upload, and the record of each session: vitals, doses, batch numbers, observations and aftercare notes.",
          "Batch numbers are held against your session specifically so a manufacturer recall can be traced to the patients affected. That link is the point of the record and cannot be separated from it.",
        ],
      },
      {
        heading: "Pharmacy records are pseudonymous",
        body: [
          "Preparation orders sent to the pharmacy carry a clinic reference rather than your name wherever a reference is available. The pharmacy needs to know what to prepare and which batch it came from — not who you are.",
        ],
      },
      {
        heading: "Getting it back, or deleted",
        body: [
          "Ask from your profile and we will export everything we hold on you in a readable format.",
          "Deletion removes your account, contact details, quiz answers and uploads. Clinical records of sessions that actually happened are retained for the statutory period, because a batch trace must survive a deleted account — that is a legal obligation, not a preference.",
        ],
      },
    ],
  },
  grievance: {
    title: "Grievance officer",
    lede: "If something went wrong and the ordinary route has not fixed it, this is the person whose job it is to resolve it.",
    sections: [
      {
        heading: "Who to contact",
        body: [
          "Grievance Officer, NutriDrip Health Pvt. Ltd., 24 5th Main, Indiranagar, Bengaluru 560038.",
          "grievance@nutridrip.com — acknowledged within 48 hours, resolved or given a written timeline within 15 days, as required under the Consumer Protection (E-Commerce) Rules.",
        ],
      },
      {
        heading: "What to send",
        body: [
          "Your booking number, the date, and what happened. If it concerns a session, the session report already contains the vitals, doses, batch numbers and the names of the physician and nurse involved — you do not need to gather any of that yourself.",
        ],
      },
      {
        heading: "Clinical concerns come first",
        body: [
          "If your complaint is that something went wrong clinically, say so in the first line. Those are routed to the medical lead immediately rather than through the ordinary queue.",
          "If you are unwell right now, do not use this address. Call 108.",
        ],
      },
    ],
  },
} as const;

type DocKey = keyof typeof DOCS;

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ doc: string }>;
}): Promise<Metadata> {
  const { doc } = await params;
  const entry = DOCS[doc as DocKey];
  return entry ? { title: entry.title, description: entry.lede } : {};
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const entry = DOCS[doc as DocKey];
  if (!entry) notFound();

  return (
    <div className="mx-auto max-w-[1280px] px-6 md:px-10 py-12">
      <div className="max-w-[68ch]">
        <span className="t-micro">Legal</span>
        <h1 className="t-h1 mt-2 mb-4">{entry.title}</h1>
        <p className="t-body-lg text-[var(--color-ink-2)] mb-10" style={{ textWrap: "pretty" }}>
          {entry.lede}
        </p>

        <div className="flex flex-col gap-4">
          {entry.sections.map((s) => (
            <Card key={s.heading} padding="p-6">
              <h2 className="t-h3 mb-3">{s.heading}</h2>
              <div className="flex flex-col gap-3">
                {s.body.map((p, i) => (
                  <p key={i} className="t-body text-[var(--color-ink-2)]" style={{ textWrap: "pretty" }}>
                    {p}
                  </p>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <p className="t-small text-[var(--color-ink-3)] mt-8">
          Last reviewed 1 September 2026. NutriDrip Health Pvt. Ltd., clinical establishment registration{" "}
          <span className="t-data text-[13px]">KA/CEA/2024/11872</span>.
        </p>
      </div>
    </div>
  );
}

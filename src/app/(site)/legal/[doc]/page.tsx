import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLatePolicy } from "@/lib/billing/settings";
import { LATE_POLICY_TOKEN, fillLatePolicy } from "@/lib/billing/late-policy";
import { PageHero } from "@/components/site/PageHero";
import { Container, delay } from "@/components/site/Layout";

/**
 * Drawn on each visit, like the rest of the site. It was built once, at build
 * time, which froze the late-change fees into the terms (they are set on the
 * Billing page and can change) and showed a signed-in patient "Sign in" in the
 * header, because a page built in advance cannot know who is looking.
 */
export const dynamic = "force-dynamic";

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
          // Filled in when the page is drawn, from the fees set on the Billing page.
          LATE_POLICY_TOKEN,
          "If we cancel — a nurse falls ill, stock fails a check, a physician withdraws approval — everything you paid is refunded in full and we say which of those it was.",
        ],
      },
      {
        heading: "Payment",
        body: [
          "You pay for a session when you book it (or hold a slot), securely through Razorpay — UPI, cards, net banking or wallets. If the session does not go ahead — a physician does not approve, we cancel, or your vitals mean the infusion cannot start — the full amount is refunded automatically to the account you paid from.",
          "Refunds are started at once and usually reach your account within 5–7 working days, depending on your bank. Cancelling inside the late window refunds everything except the late fee.",
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

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  const entry = DOCS[doc as DocKey];
  return entry ? { title: entry.title, description: entry.lede } : {};
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  // The late-change rule, with today's fees (set on the Billing page).
  const latePolicy = await getLatePolicy();
  const { doc } = await params;
  const entry = DOCS[doc as DocKey];
  if (!entry) notFound();

  const slug = (heading: string) =>
    heading
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  const tabs: Array<[DocKey, string]> = [
    ["terms", "Terms"],
    ["privacy", "Privacy"],
    ["grievance", "Grievance officer"],
  ];

  return (
    <>
      <PageHero
        eyebrow="Legal"
        title={entry.title}
        lede={entry.lede}
        below={
          <nav aria-label="Legal documents">
            <ul className="flex flex-wrap gap-2 list-none m-0 p-0">
              {tabs.map(([key, label]) => {
                const active = key === doc;
                return (
                  <li key={key}>
                    <Link
                      href={"/legal/" + key}
                      aria-current={active ? "page" : undefined}
                      className={
                        "inline-flex min-h-[40px] items-center rounded-full border px-4 text-[13.5px] font-medium no-underline hover:no-underline transition-colors duration-200 " +
                        (active
                          ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-white"
                          : "border-[var(--color-line-2)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-[var(--color-ink)]")
                      }
                    >
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        }
      />

      <section className="pb-[var(--section-y)]">
        <Container className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
          {/* The contents, held beside the text on a wide screen. */}
          <nav aria-label="On this page" className="hidden lg:block lg:sticky lg:top-[calc(var(--site-header-h)+32px)]">
            <span className="t-micro">On this page</span>
            <ol className="list-none m-0 p-0 mt-4 flex flex-col border-l border-[var(--color-line)]">
              {entry.sections.map((s) => (
                <li key={s.heading}>
                  <a
                    href={"#" + slug(s.heading)}
                    className="-ml-px block border-l border-transparent py-2 pl-4 t-small text-[var(--color-ink-2)] no-underline hover:no-underline hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
                  >
                    {s.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <article className="max-w-[74ch] flex flex-col gap-4">
            {entry.sections.map((s, i) => (
              <section
                key={s.heading}
                id={slug(s.heading)}
                aria-labelledby={slug(s.heading) + "-title"}
                className="scroll-mt-28 rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-7 md:p-9"
                data-reveal
                style={delay(Math.min(i, 3) * 70)}
              >
                <span className="t-data text-[12.5px] text-[var(--color-primary-text)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2 id={slug(s.heading) + "-title"} className="t-title mt-2">
                  {s.heading}
                </h2>
                <div className="flex flex-col gap-3 mt-4">
                  {s.body.map((p, j) => (
                    <p key={j} className="t-body-lg text-[var(--color-ink-2)]" style={{ textWrap: "pretty" }}>
                      {fillLatePolicy(p, latePolicy)}
                    </p>
                  ))}
                </div>
              </section>
            ))}

            <p className="t-small text-[var(--color-ink-3)] mt-6">
              Last reviewed 1 September 2026. NutriDrip Health Pvt. Ltd., clinical establishment registration{" "}
              <span className="t-data text-[13px]">KA/CEA/2024/11872</span>.
            </p>
          </article>
        </Container>
      </section>
    </>
  );
}

import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { formatInr } from "@/lib/inventory/units";
import { listDrips } from "@/lib/data/drips";
import { QuizButton } from "@/components/layout/QuizButton";
import { getLatePolicy } from "@/lib/billing/settings";
import { LATE_POLICY_TOKEN, fillLatePolicy } from "@/lib/billing/late-policy";
import { getZones } from "@/lib/zones-store";
import { ZONE_COUNT_TOKEN, fillZoneCount } from "@/lib/zones";

export const metadata: Metadata = { title: "Pricing" };

const PLANS = [
  {
    name: "Single",
    sessions: 1,
    discount: 0,
    blurb: "No commitment. Pay per session.",
    tag: null as string | null,
  },
  {
    name: "Course of 4",
    sessions: 4,
    discount: 0.1,
    blurb: "Save 10%. Price locked for 6 months.",
    tag: "Most chosen",
  },
  {
    name: "Course of 8",
    sessions: 8,
    discount: 0.2,
    blurb: "Save 20%. Includes two follow-up reviews.",
    tag: null,
  },
];

const FAQ = [
  {
    q: "Does a real doctor look at my quiz?",
    a: "Yes. A registered physician reads every submission and either approves the protocol, changes the doses, or declines. Their name and council registration number appear on your session report.",
  },
  {
    q: "What if the nurse finds something wrong?",
    a: "The 29-step checklist gates the session. If your vitals fall outside the reference range, the infusion does not start — the nurse escalates to the reviewing physician, and you are not charged for a session that does not run.",
  },
  {
    q: "Can I cancel or reschedule?",
    // Filled in when the page is drawn, from the fees set on the Billing page.
    a: LATE_POLICY_TOKEN,
  },
  {
    q: "Do you serve my pincode?",
    a: `We currently cover ${ZONE_COUNT_TOKEN} zones across Bengaluru. Enter your pincode at booking and you will get a straight yes or no, not a waitlist.`,
  },
  {
    q: "Is this covered by insurance?",
    a: "Wellness infusions are not usually reimbursable. Therapeutic protocols — iron for confirmed deficiency, for example — sometimes are. We issue a GST invoice with the HSN codes either way.",
  },
  {
    q: "What happens to my health data?",
    a: "Your record is visible to you, the reviewing physician and the attending nurse. Nobody else. Access attempts are logged, and you can export or delete your record from your profile at any time.",
  },
];

export default async function PricingPage() {
  // The late-change rule, with today's fees (set on the Billing page).
  const [latePolicy, zones] = await Promise.all([getLatePolicy(), getZones()]);
  const drips = await listDrips();
  const base = drips.find((d) => d.slug === "myers-revive")?.priceInr ?? 8400;

  return (
    <div className="mx-auto max-w-[1280px] px-6 md:px-10 py-12">
      <div className="max-w-[66ch] mb-10">
        <span className="t-micro">Pricing</span>
        <h1 className="t-h1 mt-2 mb-3">One price, everything included.</h1>
        <p className="t-body-lg text-[var(--color-ink-2)]" style={{ textWrap: "pretty" }}>
          The session price covers the physician review, the nurse visit, the sealed kit and the drip itself. There is
          no separate consultation fee and no travel charge inside our service zones. Prices below use{" "}
          <span className="t-data text-[15px]">Myers&apos; Revive</span> as the base.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-14">
        {PLANS.map((p) => {
          const per = Math.round(base * (1 - p.discount));
          const featured = p.tag !== null;
          return (
            <Card key={p.name} tone={featured ? "primary" : "surface"} padding="p-6" className="flex flex-col">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="t-h3">{p.name}</h2>
                {p.tag && (
                  <span className="t-micro text-[var(--color-primary-dark)]">{p.tag}</span>
                )}
              </div>

              <div className="flex items-baseline gap-2">
                <span className="t-data text-[30px] leading-[1.15]">{formatInr(per)}</span>
                <span className="t-small text-[var(--color-ink-3)]">per session</span>
              </div>

              <div className="flex flex-col gap-2 mt-5 pt-5 border-t border-[var(--color-line)]">
                <div className="flex justify-between gap-4 items-baseline">
                  <span className="t-body text-[var(--color-ink-2)]">Total</span>
                  <span className="t-data text-[14.5px]">{formatInr(per * p.sessions)}</span>
                </div>
                <div className="flex justify-between gap-4 items-baseline">
                  <span className="t-body text-[var(--color-ink-2)]">You save</span>
                  <span className="t-data text-[14.5px]">{Math.round(p.discount * 100)}%</span>
                </div>
              </div>

              <p className="t-small text-[var(--color-ink-2)] mt-4 mb-6">{p.blurb}</p>

              <div className="mt-auto">
                <QuizButton variant={featured ? "primary" : "secondary"} block>
                  {featured ? "Start with the quiz" : "Choose this"}
                </QuizButton>
              </div>
            </Card>
          );
        })}
      </div>

      {/* ---------------- FAQ ---------------- */}
      <div className="max-w-[76ch]">
        <h2 className="t-h2 mb-6">Questions people actually ask</h2>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] overflow-hidden">
          {FAQ.map((f, i) => (
            <details
              key={f.q}
              open={i === 0}
              className="border-b border-[var(--color-line)] last:border-b-0 group"
            >
              <summary className="flex items-start justify-between gap-4 px-5 py-[18px] cursor-pointer list-none min-h-[44px]">
                <span
                  className="text-[var(--color-ink)] group-open:font-semibold"
                  style={{ font: "500 14.5px/1.55 var(--font-sans)" }}
                >
                  {f.q}
                </span>
                <span className="t-data text-[18px] text-[var(--color-ink-3)] flex-none leading-none mt-[2px]">
                  <span className="group-open:hidden">+</span>
                  <span className="hidden group-open:inline">−</span>
                </span>
              </summary>
              <p className="t-body text-[var(--color-ink-2)] px-5 pb-5 -mt-1 max-w-[66ch]">{fillZoneCount(fillLatePolicy(f.a, latePolicy), zones)}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}

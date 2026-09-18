import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FillBar } from "@/components/ui/Fill";
import { formatInr } from "@/lib/inventory/units";
import { ClinicEnquiryForm } from "./EnquiryForm";
import { listDrips } from "@/lib/data/drips";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "For clinics",
  description:
    "Run IV therapy out of your rooms without running a pharmacy. Physician review, nurse dispatch, FEFO stock and recall traceability, on our licence.",
};

const WHAT_YOU_GET = [
  {
    n: "01",
    title: "You do not run a pharmacy",
    body: "Order the drips you expect to run this week. Confirmation reserves the exact vials against your order, so a confirmed order is a promise you can staff against — not a hope.",
  },
  {
    n: "02",
    title: "Physician review is ours",
    body: "Every protocol is read and signed by a registered doctor before it reaches your room. Their council number is on the session report, not yours.",
  },
  {
    n: "03",
    title: "Nurses, or your own",
    body: "Use our council-registered nurses, or put your own on the platform. Either way they work the same 29-step checklist and the same record comes out.",
  },
  {
    n: "04",
    title: "Recall traceability, included",
    body: "Every dispatch writes an immutable ledger row: which batch fed which order. When a manufacturer issues a recall you answer it in minutes, from a screen.",
  },
];

const ECONOMICS = [
  { label: "Typical session price", value: 8400, pct: 100, note: "Myers' Revive, the usual first drip" },
  { label: "Your margin per session", value: 3200, pct: 38, note: "38% — room, staff time and aftercare" },
  { label: "Consumables and drug cost", value: 2900, pct: 35, note: "Billed at cost on your order" },
  { label: "Platform and physician review", value: 2300, pct: 27, note: "Our share — no monthly fee" },
];

const FAQ = [
  {
    q: "What do we need in the room?",
    a: "A reclining chair, a hand-wash point, and somewhere lockable at 2–8 °C for the batches you hold. That is genuinely it — the drip stand, sets and cannulae come in the session kit.",
  },
  {
    q: "Who carries the clinical liability?",
    a: "The reviewing physician carries the prescribing decision and we carry the platform. You carry what you always carry: the premises, and the conduct of any staff who are yours. The partnership agreement sets this out in plain terms before you sign anything.",
  },
  {
    q: "Is there a monthly fee?",
    a: "No. We take a share of each completed session, so a quiet month costs you nothing. There is no minimum volume, though we do agree a target so we can plan stock.",
  },
  {
    q: "How fast is delivery?",
    a: "Orders confirmed before 4 PM are dispatched next working day inside Bengaluru. The availability figure you see when ordering is real stock, already checked against expiry — not a catalogue.",
  },
  {
    q: "Can we use our own formulas?",
    a: "Yes, once a physician on our panel has signed off on the recipe. It then appears in the builder like any other, with the same unit-slip checks and the same availability maths.",
  },
];

export default async function ForClinicsPage() {
  const total = ECONOMICS[0].value;
  const protocols = (await listDrips()).length;

  return (
    <div className="mx-auto max-w-[1280px] px-6 md:px-10 py-12">
      {/* ---------------- Hero ---------------- */}
      <section className="grid grid-cols-1 gap-10 lg:grid-cols-[1.1fr_0.9fr] items-center mb-16">
        <div>
          <span className="t-micro">For clinics</span>
          <h1
            className="mt-2 mb-4 max-w-[20ch]"
            style={{
              font: "700 clamp(32px, 4.5vw, 46px)/1.08 var(--font-display)",
              letterSpacing: "-0.03em",
              textWrap: "pretty",
            }}
          >
            Run IV therapy without running a pharmacy.
          </h1>
          <p className="t-body-lg text-[var(--color-ink-2)] max-w-[54ch] mb-7" style={{ textWrap: "pretty" }}>
            You have the room and the patients. What stops most clinics is the rest of it — stock that expires,
            batches nobody can trace, and a prescribing decision somebody has to own. We do that part.
          </p>
          <div className="flex gap-3 flex-wrap">
            <ButtonLink href="#enquire" size="lg">
              Talk to us
            </ButtonLink>
            <ButtonLink href="/safety" size="lg" variant="secondary">
              Read the clinical model
            </ButtonLink>
          </div>

          <div className="flex gap-10 flex-wrap mt-9 pt-6 border-t border-[var(--color-line)]">
            {[
              [String(protocols), "protocols on the panel"],
              ["24 hr", "order to delivery"],
              ["0", "monthly platform fee"],
            ].map(([v, l]) => (
              <div key={l} className="flex flex-col gap-1">
                <span className="t-data text-[26px] leading-[1.2]">{v}</span>
                <span className="t-small text-[var(--color-ink-3)]">{l}</span>
              </div>
            ))}
          </div>
        </div>

        <Card padding="p-6">
          <span className="t-micro">Where a session&apos;s {formatInr(total)} goes</span>
          <div className="flex flex-col gap-[18px] mt-5">
            {ECONOMICS.slice(1).map((e) => (
              <FillBar
                key={e.label}
                label={
                  <span className="flex flex-col">
                    {e.label}
                    <span className="t-small text-[var(--color-ink-3)]">{e.note}</span>
                  </span>
                }
                value={formatInr(e.value)}
                pct={e.pct}
                color={
                  e.label.includes("margin")
                    ? "var(--color-primary)"
                    : e.label.includes("Consumables")
                      ? "var(--color-primary-line)"
                      : "var(--color-line-2)"
                }
              />
            ))}
          </div>
          <p className="t-small text-[var(--color-ink-3)] mt-5">
            Indicative, on the current list price. Your agreement fixes the split for twelve months.
          </p>
        </Card>
      </section>

      {/* ---------------- What you get ---------------- */}
      <section className="mb-16">
        <h2 className="t-h2 mb-6">What the partnership actually covers</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {WHAT_YOU_GET.map((w) => (
            <Card key={w.n} padding="p-6">
              <span className="t-data text-[13px] text-[var(--color-ink-3)]">{w.n}</span>
              <h3 className="t-h3 mt-2 mb-2">{w.title}</h3>
              <p className="t-body text-[var(--color-ink-2)]">{w.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------------- How onboarding runs ---------------- */}
      <section className="mb-16">
        <h2 className="t-h2 mb-6">From first call to first session</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Week 1", "Site visit", "We look at the room, the cold chain and your existing staff."],
            ["Week 2", "Agreement", "Split, volume target and liability, in writing before anything is ordered."],
            ["Week 3", "Training", "Your nurses take the checklist end to end on the platform, on real formulas."],
            ["Week 4", "First order", "Stock arrives with batch numbers already on your account."],
          ].map(([when, title, body]) => (
            <Card key={when} padding="p-5" tone="muted">
              <span className="t-micro">{when}</span>
              <h3 className="t-h3 text-[18px] mt-2 mb-2">{title}</h3>
              <p className="t-body text-[var(--color-ink-2)]">{body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section className="mb-16 max-w-[76ch]">
        <h2 className="t-h2 mb-6">What clinics ask first</h2>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] overflow-hidden">
          {FAQ.map((f, i) => (
            <details key={f.q} open={i === 0} className="border-b border-[var(--color-line)] last:border-b-0 group">
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
              <p className="t-body text-[var(--color-ink-2)] px-5 pb-5 -mt-1 max-w-[66ch]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ---------------- Enquiry ---------------- */}
      <section id="enquire" className="scroll-mt-24">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1fr] items-start">
          <div>
            <h2 className="t-h2 mb-3">Tell us about your rooms</h2>
            <p className="t-body-lg text-[var(--color-ink-2)] max-w-[52ch]" style={{ textWrap: "pretty" }}>
              We will come and look before either of us commits to anything. No deck, no pricing call — a nurse and
              an operations lead, in your clinic, for about an hour.
            </p>
            <p className="t-body text-[var(--color-ink-2)] mt-5">
              Or write directly to{" "}
              <a href="mailto:partners@nutridrip.com">partners@nutridrip.com</a>.
            </p>
          </div>
          <ClinicEnquiryForm />
        </div>
      </section>
    </div>
  );
}

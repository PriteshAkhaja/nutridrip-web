import type { Metadata } from "next";
import { Pill } from "@/components/ui/Pill";
import { servedZones } from "@/lib/zones";
import { stepLabel } from "@/lib/clinical/slots";
import { getZones } from "@/lib/zones-store";
import { QuizButton } from "@/components/layout/QuizButton";
import { getClockFormat } from "@/lib/settings/clock";
import { clockText } from "@/lib/time";
import { Section } from "@/components/ui/Marketing";
import { SITE_IMAGES } from "@/lib/site-images";
import { PageHero } from "@/components/site/PageHero";
import { SectionHeader, delay } from "@/components/site/Layout";
import { CountUp } from "@/components/site/CountUp";
import { CtaPanel } from "@/components/site/CtaPanel";
import { IconClock, IconMapPin } from "@/components/site/Icons";
import { ButtonLink } from "@/components/ui/Button";

// The zones are edited by the super admin (Service zones), so this is read per request.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const n = servedZones(await getZones()).length;
  return {
    title: "Where we come",
    description: `The ${n} Bengaluru ${n === 1 ? "zone" : "zones"} NutriDrip nurses serve, and the arrival windows for each.`,
  };
}

export default async function ZonesPage() {
  const clockFmt = await getClockFormat();
  // Paused zones are not offered, so they are not listed either.
  const zones = servedZones(await getZones());
  const open = zones.filter((z) => z.status === "open").length;

  const figures = [
    { value: String(zones.length), label: "zones served" },
    { value: String(open), label: "with full-day cover" },
    { value: "45 min", label: "typical nurse travel" },
  ];

  return (
    <>
      <PageHero
        eyebrow="Coverage"
        title={
          <>
            Where a nurse <span className="tone-2">can actually come.</span>
          </>
        }
        lede={`${zones.length} ${zones.length === 1 ? "zone" : "zones"} across Bengaluru. Enter your pincode when you book and you get a straight yes or no, not a waitlist — a zone we cannot staff reliably is marked limited here rather than quietly dropped from your options.`}
        image={SITE_IMAGES.bengaluruDusk}
        below={
          <dl className="grid max-w-[520px] grid-cols-3 gap-5 border-t border-[var(--color-line)] pt-7">
            {figures.map((f) => (
              <div key={f.label} className="flex flex-col-reverse justify-end gap-1">
                <dt className="t-small text-[var(--color-ink-3)]">{f.label}</dt>
                <dd className="m-0 t-data text-[clamp(22px,2.4vw,30px)] leading-[1.1] text-[var(--color-ink)]">
                  <CountUp value={f.value} />
                </dd>
              </div>
            ))}
          </dl>
        }
      />

      <Section labelledBy="zones-list">
        <SectionHeader
          id="zones-list"
          eyebrow="The zones"
          title={
            <>
              Every pincode, <span className="tone-2">and when we come.</span>
            </>
          }
          action={
            <span className="inline-flex items-center gap-4 t-small text-[var(--color-ink-2)]">
              <Pill tone="safe" dot>
                Full cover
              </Pill>
              <Pill tone="caution" dot>
                Limited
              </Pill>
            </span>
          }
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {zones.map((z, i) => (
            <article
              key={z.name}
              className="flex flex-col rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 transition-colors duration-200 hover:border-[var(--color-line-2)]"
              data-reveal
              style={delay((i % 3) * 70)}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="t-title text-[19px] min-w-0">{z.name}</h3>
                {z.status === "open" ? (
                  <Pill tone="safe" dot>
                    Full cover
                  </Pill>
                ) : (
                  <Pill tone="caution" dot>
                    Limited
                  </Pill>
                )}
              </div>
              <dl className="mt-5 flex flex-col gap-3 border-t border-[var(--color-line)] pt-4">
                <div className="flex items-start gap-3">
                  <dt className="flex-none text-[var(--color-ink-3)] mt-[2px]">
                    <IconMapPin size={16} />
                    <span className="sr-only">Pincodes</span>
                  </dt>
                  <dd className="m-0 t-data text-[13px] text-[var(--color-ink-2)]">{z.pincodes.join(", ")}</dd>
                </div>
                <div className="flex items-start gap-3">
                  <dt className="flex-none text-[var(--color-ink-3)] mt-[2px]">
                    <IconClock size={16} />
                    <span className="sr-only">Hours</span>
                  </dt>
                  <dd className="m-0 t-data text-[13px] text-[var(--color-ink-2)]">
                    {clockText(z.window, clockFmt)} · {stepLabel(z.slotMinutes)}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </Section>

      <CtaPanel
        eyebrow="Not on the list?"
        title="Take the quiz anyway."
        lede="We add a zone when there are enough nurses living near it to staff it properly, not when there is enough demand. If a physician approves you, we will tell you honestly when we expect to reach you."
        actions={
          <>
            <QuizButton size="lg">Take the health quiz</QuizButton>
            <ButtonLink href="/consult" size="lg" variant="secondary">
              Ask about your area
            </ButtonLink>
          </>
        }
        image={SITE_IMAGES.cityStreet}
      />
    </>
  );
}

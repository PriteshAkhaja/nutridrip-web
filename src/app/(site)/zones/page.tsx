import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";

export const metadata: Metadata = {
  title: "Where we come",
  description: "The 14 Bengaluru zones NutriDrip nurses serve, and the arrival windows for each.",
};

import { ZONES } from "@/lib/zones";

export default function ZonesPage() {
  const open = ZONES.filter((z) => z.status === "open").length;

  return (
    <div className="mx-auto max-w-[1280px] px-6 md:px-10 py-12">
      <div className="max-w-[64ch] mb-10">
        <span className="t-micro">Coverage</span>
        <h1 className="t-h1 mt-2 mb-4">Where a nurse can actually come.</h1>
        <p className="t-body-lg text-[var(--color-ink-2)]" style={{ textWrap: "pretty" }}>
          Fourteen zones across Bengaluru. Enter your pincode when you book and you get a straight yes or no, not a
          waitlist — a zone we cannot staff reliably is marked limited here rather than quietly dropped from your
          options.
        </p>
      </div>

      <div className="flex gap-10 flex-wrap mb-10 pb-6 border-b border-[var(--color-line)]">
        {[
          [String(ZONES.length), "zones served"],
          [String(open), "with full-day cover"],
          ["45 min", "typical nurse travel"],
        ].map(([v, l]) => (
          <div key={l} className="flex flex-col gap-1">
            <span className="t-data text-[26px] leading-[1.2]">{v}</span>
            <span className="t-small text-[var(--color-ink-3)]">{l}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-12">
        {ZONES.map((z) => (
          <Card key={z.name} padding="p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h2 className="t-h3 text-[18px]">{z.name}</h2>
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
            <div className="flex flex-col gap-2">
              <div className="flex justify-between gap-3 items-baseline">
                <span className="t-small text-[var(--color-ink-3)]">Pincodes</span>
                <span className="t-data text-[13px]">{z.pincodes.join(", ")}</span>
              </div>
              <div className="flex justify-between gap-3 items-baseline">
                <span className="t-small text-[var(--color-ink-3)]">Slots</span>
                <span className="t-data text-[13px]">{z.window}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card tone="muted" padding="p-8">
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] items-center">
          <div>
            <h2 className="t-h2 mb-3">Not on the list?</h2>
            <p className="t-body-lg text-[var(--color-ink-2)] max-w-[54ch]" style={{ textWrap: "pretty" }}>
              We add a zone when there are enough nurses living near it to staff it properly, not when there is
              enough demand. Take the quiz anyway — if a physician approves you, we will tell you honestly when we
              expect to reach you.
            </p>
          </div>
          <ButtonLink href="/quiz" size="lg" block>
            Take the health quiz
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}

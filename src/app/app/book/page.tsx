import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { MobileShell } from "@/components/layout/MobileShell";
import { listBookableDrips } from "@/lib/data/drips";
import { checkAvailability } from "@/lib/inventory/availability";
import { connectDB } from "@/lib/db/mongoose";
import { HealthQuiz, User } from "@/lib/models";
import { EmptyState } from "@/components/ui/States";
import { BookingFlow } from "./BookingFlow";
import { PATIENT_TABS } from "../tabs";
import { approvalState } from "@/lib/clinical/validity";
import { getLatePolicy } from "@/lib/billing/settings";
import { getZones } from "@/lib/zones-store";
import { servedZones } from "@/lib/zones";
import { CallStep } from "./CallStep";
import { bookableDoctors, callGate, expireStaleHolds } from "@/lib/data/calls";
import { heldDripOf } from "@/lib/data/own-sessions";
import { callWhen } from "@/lib/clinical/calls";
import { getClockFormat } from "@/lib/settings/clock";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Book a session" };
export const dynamic = "force-dynamic";

export default async function BookPage({ searchParams }: { searchParams: Promise<{ drip?: string }> }) {
  const session = await requireRole("patient", "superadmin");
  const { drip: preferred } = await searchParams;

  await connectDB();
  const quiz = await HealthQuiz.findOne({ patientId: session.sub }).sort({ completedAt: -1 }).lean<{
    _id: unknown;
    reviewStatus: string;
    reviewedAt?: Date;
    completedAt: Date;
    suggestedDripIds?: unknown[];
    recommendedDripIds?: unknown[];
  } | null>();

  if (!quiz) {
    return (
      <MobileShell title="Book a session" tabs={PATIENT_TABS} activeHref="/app">
        <EmptyState
          kind="first-run"
          title="Take the quiz first"
          body="A physician needs your answers before anything can be scheduled. It takes about three minutes."
          actionLabel="Take the health quiz"
          actionHref="/quiz"
        />
      </MobileShell>
    );
  }

  if (quiz.reviewStatus === "rejected") {
    return (
      <MobileShell title="Book a session" tabs={PATIENT_TABS} activeHref="/app">
        <EmptyState
          kind="not-permitted"
          title="A physician declined this protocol"
          body="IV therapy is not right for you at the moment. Check your notifications for the reason — it usually points to a different route rather than no route."
        />
      </MobileShell>
    );
  }

  // The same rule the booking itself is checked against, so the form is never
  // offered to someone it would refuse at the last step.
  const approval = approvalState(quiz);
  if (!approval.canBook && !approval.canHold) {
    return (
      <MobileShell title="Book a session" tabs={PATIENT_TABS} activeHref="/app">
        <EmptyState
          kind="not-permitted"
          title="Your approval has lapsed"
          body={approval.message}
          actionLabel="Retake the health quiz"
          actionHref="/quiz?retake=1"
        />
      </MobileShell>
    );
  }

  // A held drip whose time passed without an approval is released first.
  await expireStaleHolds(session.sub);

  // Waiting for an approval: the physician's call comes first (step 1), and
  // the drip is held from two hours after it (step 2).
  const needsCall = !approval.canBook;
  const gate = needsCall ? await callGate(session.sub, quiz.completedAt) : null;
  const doctors = needsCall && gate && !gate.ok ? await bookableDoctors() : [];
  // Already holding a drip for this decision: it is shown, not a second one offered.
  const held = needsCall ? await heldDripOf(session.sub) : null;
  const clockFmt = await getClockFormat();

  const [drips, user, clinics] = await Promise.all([
    // The public catalogue, plus anything kept off the website that their physician recommended.
    listBookableDrips((quiz.recommendedDripIds ?? []).map(String)),
    User.findById(session.sub).lean<{
      phone?: string;
      patient?: { address?: string; pincode?: string };
    } | null>(),
    User.find({ role: "clinic", status: "active" })
      .sort({ name: 1 })
      .lean<Array<{ _id: unknown; name: string; clinic?: { city?: string } }>>(),
  ]);

  /**
   * What the physician recommends, falling back to the quiz's own suggestion.
   *
   * The booking screen used to ignore both: it listed all nine drips in
   * catalogue order and preselected whichever happened to be first in stock.
   * A patient who had just read "your physician recommends Immune Shield" was
   * then shown Hydrate Plus ticked, for no reason they could see.
   */
  const recommendedIds = (
    (quiz.recommendedDripIds ?? []).length > 0 ? quiz.recommendedDripIds! : (quiz.suggestedDripIds ?? [])
  ).map(String);

  const { results } = await checkAvailability(
    drips.map((d) => ({ dripId: d.id, quantity: 1 })),
    true
  );
  const availableById = new Map(results.map((r) => [r.dripId, r.wholeVialAvailability]));

  return (
    <MobileShell
      title="Book a session"
      subtitle={
        approval.status === "info_needed"
          ? "Your physician asked you a question"
          : approval.canHold
            ? "Your quiz is still with the physician"
            : "Approved — pick a slot"
      }
      tabs={PATIENT_TABS}
      activeHref="/app"
      width="wide"
    >
      {needsCall && gate && (
        <CallStep
          doctors={doctors}
          booked={
            gate.ok && gate.call
              ? {
                  callNo: gate.call.callNo,
                  doctorName: gate.call.doctorName,
                  startAt: gate.call.startAt,
                  minutes: gate.call.minutes,
                  phone: gate.call.phone,
                }
              : null
          }
          spoken={gate.ok && !gate.call}
          hasPhone={Boolean(user?.phone)}
        />
      )}

      {held ? (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
          <span className="t-micro block">Step 2 · Your drip</span>
          <p className="t-body mt-2">
            <span className="font-semibold">{held.dripName ?? "Your drip"}</span> is held for{" "}
            <span className="t-data text-[14px]">{callWhen(held.scheduledAt, clockFmt)}</span> ({held.bookingNo}).
          </p>
          <p className="t-small text-[var(--color-ink-2)] mt-2">
            {gate?.ok
              ? "It is confirmed when your physician approves after the call. To change the time or cancel it, use Move or Cancel on Home."
              : "It waits for your call. Book one above that ends at least 2 hours before it, or move the drip on Home first."}
          </p>
          <div className="mt-4">
            <ButtonLink href="/app" variant="secondary">
              Go to Home
            </ButtonLink>
          </div>
        </section>
      ) : needsCall && gate && !gate.ok ? (
        <section className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line-2)] p-5">
          <span className="t-micro block">Step 2 · Your drip</span>
          <p className="t-body text-[var(--color-ink-2)] mt-1">
            Book the call first. Then choose your drip and a time at least two hours after the call.
          </p>
        </section>
      ) : (
        <BookingFlow
          drips={drips.map((d) => ({
            id: d.id,
            slug: d.slug,
            name: d.name,
            description: d.description,
            priceInr: d.priceInr,
            durationMin: d.durationMin,
            available: availableById.get(d.id) ?? 0,
            category: d.category,
            keywords: [...d.headline, ...d.tags],
          }))}
          clinics={clinics.map((c) => ({ id: String(c._id), name: c.name, city: c.clinic?.city ?? "" }))}
          recommendedIds={recommendedIds}
          preferredSlug={preferred ?? null}
          defaultAddress={user?.patient?.address ?? ""}
          defaultPincode={user?.patient?.pincode ?? ""}
          zones={servedZones(await getZones())}
          pendingReview={approval.canHold}
          latePolicy={await getLatePolicy()}
        />
      )}
    </MobileShell>
  );
}

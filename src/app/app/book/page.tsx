import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { MobileShell } from "@/components/layout/MobileShell";
import { listDrips } from "@/lib/data/drips";
import { checkAvailability } from "@/lib/inventory/availability";
import { connectDB } from "@/lib/db/mongoose";
import { HealthQuiz, User } from "@/lib/models";
import { EmptyState } from "@/components/ui/States";
import { BookingFlow } from "./BookingFlow";
import { releasedDays } from "@/lib/clinical/slots";
import { PATIENT_TABS } from "../tabs";

export const metadata: Metadata = { title: "Book a session" };
export const dynamic = "force-dynamic";

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ drip?: string }>;
}) {
  const session = await requireRole("patient", "superadmin");
  const { drip: preferred } = await searchParams;

  await connectDB();
  const quiz = await HealthQuiz.findOne({ patientId: session.sub })
    .sort({ completedAt: -1 })
    .lean<{
      reviewStatus: string;
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

  const [drips, user, clinics] = await Promise.all([
    listDrips(),
    User.findById(session.sub).lean<{
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
  const recommendedIds = ((quiz.recommendedDripIds ?? []).length > 0
    ? quiz.recommendedDripIds!
    : (quiz.suggestedDripIds ?? [])
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
        quiz.reviewStatus === "pending"
          ? "Your quiz is still with the physician"
          : "Approved — pick a slot"
      }
      tabs={PATIENT_TABS}
      activeHref="/app"
    >
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
        releasedDays={releasedDays()}
        recommendedIds={recommendedIds}
        preferredSlug={preferred ?? null}
        defaultAddress={user?.patient?.address ?? ""}
        defaultPincode={user?.patient?.pincode ?? ""}
        pendingReview={quiz.reviewStatus === "pending"}
      />
    </MobileShell>
  );
}

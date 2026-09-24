import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models";
import { onboardingOf, PLACEHOLDER_NAME } from "@/lib/auth/onboarding";
import { geocodingConfigured } from "@/lib/geo/geocode";
import { LogoMark } from "@/components/layout/Logo";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { AddressForm } from "./AddressForm";
import { getZones } from "@/lib/zones-store";
import { servedZones } from "@/lib/zones";

export const metadata: Metadata = { title: "Where should we come?" };
export const dynamic = "force-dynamic";

/**
 * Onboarding lives outside /app on purpose: the patient app's layout redirects
 * here when the record is incomplete, so a screen inside it would redirect to
 * itself forever.
 */
export default async function WelcomePage() {
  const session = await requireRole("patient", "superadmin");
  // Staff have no onboarding to do; send them to the app they asked for.
  if (session.role !== "patient") redirect("/app");

  await connectDB();
  const me = await User.findById(session.sub).select("name phone patient").lean<{
    name?: string;
    phone?: string;
    patient?: {
      address?: string;
      city?: string;
      pincode?: string;
      latitude?: number;
      longitude?: number;
    };
  } | null>();

  // Already done — nothing to ask, and no way to get stuck on this screen.
  if (onboardingOf(me).complete) redirect("/app");

  return (
    <div className="min-h-dvh bg-[var(--color-paper)] flex flex-col">
      <header className="border-b border-[var(--color-line)]">
        <div className="mx-auto w-full max-w-[560px] px-5 py-3 flex items-center gap-3">
          <LogoMark size={22} />
          <span style={{ font: "600 14.5px/1 var(--font-display)" }}>NutriDrip</span>
          <div className="ml-auto">
            <SignOutButton form="compact" />
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[560px] px-5 py-8">
        <span className="t-micro">Step 1 of 1</span>
        <h1
          className="mt-2 mb-2"
          style={{ font: "600 26px/1.25 var(--font-display)", letterSpacing: "-0.02em", textWrap: "pretty" }}
        >
          Where should we come?
        </h1>
        <p className="t-body text-[var(--color-ink-2)] mb-7">
          A nurse administers every session at your door, so we need an address before anything else. It takes about
          thirty seconds, and you only do this once.
          {me?.phone ? (
            <>
              {" "}
              Signed in as <span className="t-data text-[13px]">{me.phone}</span>.
            </>
          ) : null}
        </p>

        <AddressForm
          initial={{
            name: me?.name && me.name !== PLACEHOLDER_NAME ? me.name : "",
            address: me?.patient?.address ?? "",
            city: me?.patient?.city ?? "Bengaluru",
            pincode: me?.patient?.pincode ?? "",
            latitude: me?.patient?.latitude ?? null,
            longitude: me?.patient?.longitude ?? null,
          }}
          mapsKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? null}
          searchEnabled={geocodingConfigured()}
          zones={servedZones(await getZones())}
        />
      </main>
    </div>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models";
import { onboardingOf, PLACEHOLDER_NAME } from "@/lib/auth/onboarding";
import { geocodingConfigured } from "@/lib/geo/geocode";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { AccountFrame } from "@/components/site/account/AccountFrame";
import { SITE_ICONS } from "@/components/site/site-icons";
import { AddressForm } from "./AddressForm";
import { getZones } from "@/lib/zones-store";
import { servedZones } from "@/lib/zones";

export const metadata: Metadata = { title: "Where should we come?", icons: SITE_ICONS };
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

  // In the client's design, like sign-in, the step it follows (AccountFrame).
  return (
    <AccountFrame layout="wide" end={<SignOutButton form="compact" />}>
      <section className="acc-card" aria-labelledby="welcome-h">
        <p className="nd-tag">Your account · last step</p>
        <h1 id="welcome-h" className="acc-h">
          Where should we come?
        </h1>
        <p className="acc-lede">
          A nurse administers every session at your door, so we need an address before anything else. It takes about
          thirty seconds, and you only do this once.
          {me?.phone ? (
            <>
              {" "}
              Signed in as <b className="font-semibold text-[var(--color-ink)]">{me.phone}</b>.
            </>
          ) : null}
        </p>

        <div className="acc-form">
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
        </div>
      </section>
    </AccountFrame>
  );
}

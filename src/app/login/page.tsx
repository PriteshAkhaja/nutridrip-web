import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountFrame } from "@/components/site/account/AccountFrame";
import { SITE_ICONS } from "@/components/site/site-icons";
import { getSession } from "@/lib/auth/session";
import { HOME_FOR_ROLE } from "@/lib/auth/rbac";
import { safeNextPath } from "@/lib/auth/next-path";
import { LoginForm } from "./LoginForm";
import { DemoAccounts } from "./DemoAccounts";
import { LoginStateProvider, type DemoAccount } from "./LoginState";

export const metadata: Metadata = { title: "Sign in", icons: SITE_ICONS };

const DEMO: readonly DemoAccount[] = [
  ["Super admin", "admin@nutridrip.com", "admin123"],
  ["Admin", "ops@nutridrip.com", "admin123"],
  ["Doctor", "dr.sarah@nutridrip.com", "doctor123"],
  ["Nurse", "nurse.emma@nutridrip.com", "nurse123"],
  ["Clinic", "clinic@healthfirst.com", "clinic123"],
  ["Patient", "patient@example.com", "patient123"],
];

/**
 * Sign-in for every role, and sign-up for patients: a phone number nobody has
 * used yet becomes a patient account when its first code is verified, and the
 * app then asks for an address (/welcome). In the client's design
 * (AccountFrame); the form's rules are unchanged.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string; next?: string }> }) {
  const session = await getSession();
  if (session) redirect(HOME_FOR_ROLE[session.role]);

  const { e, next } = await searchParams;
  // The seeded accounts are for walking the demo; a live deployment must not
  // print passwords on its sign-in page.
  const showDemo = process.env.NODE_ENV !== "production";

  return (
    // Carries a click on a demo row across to the form in the other column.
    <LoginStateProvider>
      <AccountFrame layout={showDemo ? "demo" : "narrow"}>
        {/* The card starts at the top of its column, so switching between the
            phone and email forms (a field apart) or opening the code boxes
            only grows it downward; centred, the whole form jumped. */}
        <section id="sign-in" className="acc-card scroll-mt-6" aria-labelledby="sign-in-h">
          <p className="nd-tag">Patients, staff and clinics</p>
          <h1 id="sign-in-h" className="acc-h">
            Sign in
          </h1>
          <p className="acc-lede">
            Patients use their mobile number. New to NutriDrip? The first code we send creates your account. Staff and
            partner clinics use the email address their account was created with.
          </p>

          <div className="acc-form">
            {e === "forbidden" && (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3 mb-6">
                <span className="t-body text-[var(--color-ink-2)]">
                  That area is limited to another role. Your access attempt is logged.
                </span>
              </div>
            )}

            {/* Only a path on this site: `next` is in the address, so anyone can write it. */}
            <LoginForm next={safeNextPath(next)} />
          </div>
        </section>

        {/* Under the card on a phone or tablet, beside it from 1024 px. */}
        {showDemo && (
          <aside className="acc-demo" aria-labelledby="demo-h">
            <p className="nd-tag">Demo accounts</p>
            <h2 id="demo-h">Six roles, one platform</h2>
            <p className="acc-demo__p">
              The seeded dataset carries one account per role, so every screen in the pack can be walked without setting
              up data first. Pick one to fill the form.
            </p>
            <div className="acc-demo__list">
              <DemoAccounts accounts={DEMO} />
            </div>
            <p className="acc-demo__note">
              Patient sign-in sends a six-digit code. Outside production the code is shown on screen, since no SMS
              gateway is connected yet.
            </p>
          </aside>
        )}
      </AccountFrame>
    </LoginStateProvider>
  );
}

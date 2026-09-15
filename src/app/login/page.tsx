import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/layout/Logo";
import { getSession } from "@/lib/auth/session";
import { HOME_FOR_ROLE } from "@/lib/auth/rbac";
import { LoginForm } from "./LoginForm";
import { DemoAccounts } from "./DemoAccounts";
import { LoginStateProvider, type DemoAccount } from "./LoginState";

export const metadata: Metadata = { title: "Sign in" };

const DEMO: readonly DemoAccount[] = [
  ["Super admin", "admin@nutridrip.com", "admin123"],
  ["Admin", "ops@nutridrip.com", "admin123"],
  ["Doctor", "dr.sarah@nutridrip.com", "doctor123"],
  ["Nurse", "nurse.emma@nutridrip.com", "nurse123"],
  ["Clinic", "clinic@healthfirst.com", "clinic123"],
  ["Patient", "patient@example.com", "patient123"],
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; next?: string }>;
}) {
  const session = await getSession();
  if (session) redirect(HOME_FOR_ROLE[session.role]);

  const { e, next } = await searchParams;
  // The seeded accounts are for walking the demo; a live deployment must not
  // print passwords on its sign-in page.
  const showDemo = process.env.NODE_ENV !== "production";

  return (
    // Carries a click on a demo row across to the form in the other column.
    <LoginStateProvider>
      <div className={`min-h-screen grid ${showDemo ? "lg:grid-cols-[1fr_1fr]" : ""}`}>
        {/* ---------------- Form ---------------- */}
        <div className="flex flex-col justify-center px-6 md:px-12 lg:px-16 py-12">
          <div className="w-full max-w-[420px] mx-auto">
            <Logo size={26} />

            <h1 className="t-h1 mt-9 mb-3 text-[34px]">Sign in</h1>
            <p className="t-body text-[var(--color-ink-2)] mb-8">
              Patients sign in with their phone number. Staff and partner clinics use the email address their account
              was created with.
            </p>

            {e === "forbidden" && (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3 mb-6">
                <span className="t-body text-[var(--color-ink-2)]">
                  That area is limited to another role. Your access attempt is logged.
                </span>
              </div>
            )}

            <LoginForm next={next ?? null} />
          </div>
        </div>

        {/* ---------------- Demo accounts ---------------- */}
        {showDemo && (
        <div className="hidden lg:flex flex-col justify-center bg-[var(--color-surface)] border-l border-[var(--color-line)] px-16 py-12">
          <div className="w-full max-w-[440px]">
            <span className="t-micro">Demo accounts</span>
            <h2 className="t-h3 mt-2 mb-4">Six roles, one platform</h2>
            <p className="t-body text-[var(--color-ink-2)] mb-6 max-w-[52ch]">
              The seeded dataset carries one account per role, so every screen in the pack can be walked without setting
              up data first. Pick one to fill the form.
            </p>

            <DemoAccounts accounts={DEMO} />

            <p className="t-small text-[var(--color-ink-3)] mt-4">
              Patient sign-in sends a six-digit code. Outside production the code is shown on screen, since no SMS
              gateway is connected yet.
            </p>
          </div>
        </div>
        )}
      </div>
    </LoginStateProvider>
  );
}

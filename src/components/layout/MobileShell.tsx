import type { ReactNode } from "react";
import { getSession } from "@/lib/auth/session";
import { AppFrame } from "./AppFrame";

export type Tab = { label: string; href: string; badge?: number };

const ROLE_LABEL: Record<string, string> = {
  patient: "Patient",
  nurse: "Nurse",
  superadmin: "Super admin",
};

/**
 * The patient and nurse apps' frame. Designed against a 390 × 844 phone, and
 * at every other width laid out by AppFrame: bottom tabs on a phone, a drawer
 * on a tablet, a sidebar on a desktop.
 *
 * `width`: "narrow" keeps a reading column on a wide screen, for a page that
 * is one list or one form; "wide" gives the page the full width, for a page
 * laid out in columns of its own.
 */
export async function MobileShell({
  title,
  subtitle,
  back,
  tabs,
  activeHref,
  action,
  width = "narrow",
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  tabs?: Tab[];
  activeHref?: string;
  action?: ReactNode;
  width?: "narrow" | "wide";
  children: ReactNode;
}) {
  // The sidebar says who is signed in, as the consoles do. The layout has
  // already refused anyone without a session.
  const session = await getSession();
  return (
    <AppFrame
      title={title}
      subtitle={subtitle}
      back={back}
      tabs={tabs}
      activeHref={activeHref}
      action={action}
      width={width}
      user={session ? { name: session.name, roleLabel: ROLE_LABEL[session.role] ?? session.role } : null}
    >
      {children}
    </AppFrame>
  );
}

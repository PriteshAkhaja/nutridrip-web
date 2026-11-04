import type { Metadata } from "next";
import { SiteShell } from "@/components/site/SiteShell";
import { SITE_ICONS } from "@/components/site/site-icons";

// The client's tab icon, not the consoles' brand mark.
export const metadata: Metadata = { icons: SITE_ICONS };

/** Every public page, in the site's chrome (SiteShell, which the 404 shares). */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}

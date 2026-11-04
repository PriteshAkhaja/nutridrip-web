import type { Metadata } from "next";
import { SiteShell } from "@/components/site/SiteShell";
import { NotFound } from "@/components/site/NotFound";
import { SITE_ICONS } from "@/components/site/site-icons";

export const metadata: Metadata = { title: "Page not found", icons: SITE_ICONS };

/**
 * Every 404: an address that matches no page, and notFound() from any page
 * (there is no nearer not-found). It renders outside every layout but the
 * root one, so it brings the site's chrome itself, without the intro.
 */
export default function RootNotFound() {
  return (
    <SiteShell deadEnd>
      <NotFound />
    </SiteShell>
  );
}

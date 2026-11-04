import { NotFound } from "@/components/site/NotFound";

/**
 * notFound() from a public page (a dead drip or legal link). The site's layout
 * stays around it here, so this is the 404 alone; without it Next would use
 * the root one, which brings its own header and footer, and show both.
 */
export default function SiteNotFound() {
  return <NotFound />;
}

import { preload } from "react-dom";
// The client's design, scoped to .sc-site (scripts/scope-site-css.mjs): the
// engine's base, the site's shared sheet (the wordmark, tags, fonts), and
// account.css, which re-points the app's tokens for the forms.
import "@/components/site/v3/styles/scoped/engine.css";
import "@/components/site/v3/styles/scoped/site.css";
import "@/components/site/v3/styles/scoped/account.css";

/**
 * The client's look around a page built from the app's own components:
 * inside it the app's tokens point at the site's palette, type and corners
 * (account.css), so Button, Input and the rest follow without being
 * rewritten. Sign-in and /welcome use it through AccountFrame; the quiz uses
 * it directly, with its own bar. `className` adds the page's own hook.
 */
export function ClientTheme({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  // Outfit and Geist, as on every public page: the headings are set in them.
  preload("/fonts/v3/outfit-latin-wght-normal.woff2", { as: "font", type: "font/woff2", crossOrigin: "" });
  preload("/fonts/v3/geist-latin-wght-normal.woff2", { as: "font", type: "font/woff2", crossOrigin: "" });
  return (
    <div className="sc-site">
      <div className={`nd-account ${className}`.trim()}>{children}</div>
    </div>
  );
}

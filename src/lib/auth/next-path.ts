/**
 * Where to go after signing in, from the sign-in page's `?next=`: a path on
 * this site, or null.
 *
 * Anyone can write the address bar, so a link to the real sign-in page could
 * carry `?next=https://look-alike.example`, and the form would send a person
 * who has just signed in there (router.push leaves the site for an absolute
 * URL). Only a same-site path is kept. Resolving it against a stand-in origin
 * catches the ways a browser reads a path as another site: "//host",
 * "/\host", and tabs or newlines it strips out ("/\t/host").
 */
export function safeNextPath(next: unknown): string | null {
  if (typeof next !== "string" || !next.startsWith("/")) return null;
  const base = "http://site.invalid";
  try {
    const url = new URL(next, base);
    return url.origin === base ? url.pathname + url.search + url.hash : null;
  } catch {
    return null;
  }
}

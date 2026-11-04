/**
 * The "Ready to book?" slip and the phone's sticky quiz bar, as every
 * redesigned page closes (BookSection): the client's slip shows the drip the
 * visitor picked on the landing (remembered in this browser), else "Drip to
 * be suggested" and the range across every drip. Run from a page's motion;
 * the returned cleanup removes what it added.
 */

export type SlipDrip = { slug: string; name: string; tint: string; price: number; duration: string };

export function mountBook(
  root: HTMLElement,
  drips: SlipDrip[],
  /** Acts that carry their own action: the sticky bar stays down while one holds the screen. */
  quiet: Element[] = []
): () => void {
  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s);
  const $$ = <T extends Element = HTMLElement>(s: string) => [...root.querySelectorAll<T>(s)];
  const site = root.closest<HTMLElement>(".sc-site") ?? root;

  // ---------------------------------------------------- the drip picked on the landing
  let slug: string | null = null;
  try {
    slug = localStorage.getItem("nd-drip");
  } catch {
    // Private mode: nothing was remembered.
  }
  const picked = drips.find((d) => d.slug === slug);
  if (picked) {
    site.style.setProperty("--tint", picked.tint);
    $$("[data-chosen-name]").forEach((el) => (el.textContent = picked.name));
    $$("[data-chosen-duration]").forEach((el) => (el.textContent = picked.duration));
    $$("[data-chosen-price]").forEach((el) => (el.textContent = `₹${Number(picked.price).toLocaleString("en-IN")}`));
    $$<HTMLAnchorElement>("a[data-quiz-link]").forEach((a) => {
      if ((a.getAttribute("href") ?? "").startsWith("/quiz"))
        a.setAttribute("href", `/quiz?drip=${encodeURIComponent(picked.slug)}`);
    });
    const sb = $("[data-slip-which]");
    if (sb) sb.textContent = `Not sure about ${picked.name}?`;
  }

  // ---------------------------------------------------- phone sticky bar
  // Up after the first screen, down at the slip (it carries the same button)
  // and while an act that ends in its own button holds the screen.
  const sticky = $(".nd-sticky");
  const slip = $("#book");
  let dead = false;
  function tick() {
    if (!sticky || !slip) return;
    const after = scrollY > innerHeight * 0.6;
    const sr = slip.getBoundingClientRect();
    const atSlip = sr.top < innerHeight * 0.8 && sr.bottom > 0;
    const inAct = quiet.some((a) => {
      const r = a.getBoundingClientRect();
      return r.top < innerHeight * 0.5 && r.bottom > innerHeight * 0.5;
    });
    sticky.classList.toggle("is-on", after && !atSlip && !inAct);
  }
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      if (!dead) tick();
    });
  };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  tick();

  return () => {
    dead = true;
    removeEventListener("scroll", onScroll);
    removeEventListener("resize", onScroll);
    if (picked) site.style.removeProperty("--tint");
  };
}

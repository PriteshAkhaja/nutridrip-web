/* For clinics: the price splits as you scroll (see BRIEF.md).
   One bar, the whole session price, sits at the top of the economics card. As
   the card comes up the screen, it divides into its three shares and each share
   slides down into its own row, landing exactly on that row's bar: a share is
   the same fraction of the price in both places, so it keeps its width.

   A GSAP timeline scrubbed by ScrollTrigger; positions are measured, and
   re-measured on refresh. Transforms only. */
(function () {
  "use strict";
  function mountSplit(card) {
    var whole = card.querySelector("[data-split-whole]");
    var rows = [].slice.call(card.querySelectorAll("[data-split-row]"));
    // The whole bar keeps its three shares: copies travel, the originals stay.
    var parts = [].slice.call(whole.children);
    if (!whole || !rows.length || !window.gsap || !window.ScrollTrigger) return function () {};
    gsap.registerPlugin(ScrollTrigger);

    // One moving piece per row, sized and placed on that row's bar (its end).
    var pieces = rows.map(function (row) {
      var p = document.createElement("i");
      p.className = "split__piece";
      p.setAttribute("aria-hidden", "true");
      p.style.background = row.getAttribute("data-color");
      card.appendChild(p);
      return p;
    });
    card.classList.add("split--live");

    var geo = [];
    function measure() {
      var c = card.getBoundingClientRect();
      var w = whole.getBoundingClientRect();
      var acc = 0;
      geo = rows.map(function (row, i) {
        var t = row.querySelector("[data-split-track]").getBoundingClientRect();
        var pct = +row.getAttribute("data-pct") / 100;
        var g = {
          left: t.left - c.left,
          top: t.top - c.top,
          width: t.width * pct,
          height: t.height,
          fromX: w.left - t.left + acc * w.width,
          fromY: w.top - t.top,
        };
        acc += pct;
        var p = pieces[i];
        p.style.left = g.left + "px";
        p.style.top = g.top + "px";
        p.style.width = g.width + "px";
        p.style.height = g.height + "px";
        return g;
      });
    }
    measure();

    var tl = gsap.timeline({
      defaults: { ease: "power2.inOut" },
      scrollTrigger: {
        trigger: card,
        start: "top 78%",
        end: "bottom 52%",
        scrub: 0.5,
        invalidateOnRefresh: true,
        onRefreshInit: measure,
      },
    });
    // Each share fades to a ghost while it crosses the rows above its own, so
    // it never reads as a line struck through their labels, and firms up as it lands.
    pieces.forEach(function (p, i) {
      var at = 0.25 + i * 0.14;
      tl.fromTo(
        p,
        {
          x: function () {
            return geo[i].fromX;
          },
          y: function () {
            return geo[i].fromY;
          },
        },
        { x: 0, y: 0, duration: 0.5 },
        at
      );
      tl.fromTo(p, { opacity: 1 }, { opacity: 0.22, duration: 0.12, ease: "power1.out" }, at + 0.04);
      tl.to(p, { opacity: 1, duration: 0.14, ease: "power1.in" }, at + 0.36);
      // Its part of the whole dims while it is on its way, and is whole again
      // once it has landed: the price is still all there at the end.
      if (parts[i]) {
        tl.fromTo(parts[i], { opacity: 1 }, { opacity: 0.3, duration: 0.08, ease: "none" }, at);
        tl.to(parts[i], { opacity: 1, duration: 0.1, ease: "none" }, at + 0.5);
      }
    });
    // Hold the whole bar still for the first stretch, so it is read first.
    tl.to({}, { duration: 0.25 }, 0);

    return function () {
      if (tl.scrollTrigger) tl.scrollTrigger.kill();
      tl.kill();
      pieces.forEach(function (p) {
        p.remove();
      });
      parts.forEach(function (x) {
        x.style.opacity = "";
      });
      card.classList.remove("split--live");
    };
  }
  window.mountSplit = mountSplit;
})();

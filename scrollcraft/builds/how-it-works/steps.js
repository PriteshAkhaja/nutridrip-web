/* How it works: a thread draws through the seven people as you read (see
   BRIEF.md). Ported as an opt-in mode of src/components/site/StickySteps.tsx;
   the home page keeps the plain mode.

   One value, a reading line at mid-screen within the step list, driven by
   GSAP ScrollTrigger with a short scrub. From it:
   - the thread down the left of the list grows (scaleY) from the first step's
     circle to the last; each circle fills as the thread reaches it;
   - the sticky picture cross-dissolves in step with the thread, over a short
     window around each boundary, and settles (scale 1.05 to 1) while its step
     is read; the bars under it follow the same step.
   Transforms and opacity only. */
(function () {
  "use strict";
  function mountSteps(root) {
    var list = root.querySelector("[data-st-list]");
    var items = [].slice.call(root.querySelectorAll("[data-st-item]"));
    var pics = [].slice.call(root.querySelectorAll("[data-st-pic]"));
    var bars = [].slice.call(root.querySelectorAll("[data-st-bar]"));
    var dots = items.map(function (li) {
      return li.querySelector("[data-st-dot]");
    });
    var thread = root.querySelector("[data-st-thread]");
    var ink = root.querySelector("[data-st-thread-ink]");
    if (!list || !items.length || !window.gsap || !window.ScrollTrigger) return function () {};
    gsap.registerPlugin(ScrollTrigger);
    root.classList.add("st--live");

    var box = [],
      dotY = [],
      c0 = 0,
      c1 = 1;
    function layout() {
      var lr = list.getBoundingClientRect();
      box = items.map(function (li) {
        var r = li.getBoundingClientRect();
        return { t: r.top - lr.top, h: r.height };
      });
      dotY = dots.map(function (d) {
        var r = d.getBoundingClientRect();
        return r.top + r.height / 2 - lr.top;
      });
      c0 = dotY[0];
      c1 = dotY[dotY.length - 1];
      var d0 = dots[0].getBoundingClientRect();
      thread.style.top = c0 + "px";
      thread.style.height = Math.max(c1 - c0, 1) + "px";
      thread.style.left = d0.left - lr.left + d0.width / 2 - 0.75 + "px";
    }

    var state = { p: 0 },
      lastKey = "";
    function render() {
      var y = state.p * list.offsetHeight;
      ink.style.transform = "scaleY(" + Math.min(1, Math.max(0, (y - c0) / (c1 - c0))).toFixed(4) + ")";
      // The step being read, and how far through it.
      var cur = 0,
        frac = 0;
      for (var i = 0; i < box.length; i++) {
        if (y >= box[i].t) {
          cur = i;
          frac = Math.min(1, (y - box[i].t) / box[i].h);
        }
      }
      var key = cur + ":" + frac.toFixed(3);
      if (key === lastKey) return;
      lastKey = key;
      items.forEach(function (li, k) {
        var s = k === cur ? "current" : y >= dotY[k] ? "done" : "ahead";
        if (li.getAttribute("data-state") !== s) li.setAttribute("data-state", s);
      });
      bars.forEach(function (b, k) {
        b.setAttribute("data-on", k <= cur ? "1" : "0");
      });
      // Cross-dissolve over the last 18% of a step into the next one.
      var X = 0.18,
        mix = cur < pics.length - 1 ? Math.max(0, (frac - (1 - X)) / X) : 0;
      mix = mix * mix * (3 - 2 * mix);
      pics.forEach(function (pic, k) {
        var o = k === cur ? 1 : k === cur + 1 ? mix : 0;
        var settle = k === cur ? frac : 0;
        pic.style.opacity = o.toFixed(3);
        pic.style.transform = "scale(" + (1.05 - 0.05 * settle).toFixed(4) + ")";
        pic.style.zIndex = k === cur + 1 ? "2" : k === cur ? "1" : "0";
        pic.setAttribute("aria-hidden", k === cur ? "false" : "true");
      });
    }

    layout();
    var tween = gsap.fromTo(
      state,
      { p: 0 },
      {
        p: 1,
        ease: "none",
        onUpdate: render,
        scrollTrigger: { trigger: list, start: "top 50%", end: "bottom 50%", scrub: 0.4, invalidateOnRefresh: true },
      }
    );
    var onRefresh = function () {
      layout();
      lastKey = "";
      render();
    };
    ScrollTrigger.addEventListener("refresh", onRefresh);
    render();
    if (document.fonts)
      document.fonts.ready.then(function () {
        ScrollTrigger.refresh();
      });
    return function () {
      ScrollTrigger.removeEventListener("refresh", onRefresh);
      if (tween.scrollTrigger) tween.scrollTrigger.kill();
      tween.kill();
      root.classList.remove("st--live");
    };
  }
  window.mountSteps = mountSteps;
})();

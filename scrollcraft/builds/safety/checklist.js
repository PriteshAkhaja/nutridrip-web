/* The checklist works itself through as you read it (see BRIEF.md).
   Page-local; ported as-is to src/components/site/scroll/checklist.ts.

   One value, the position of a reading line (45% down the screen) within the
   step list, driven by GSAP ScrollTrigger with a short scrub. From it:
   - each row's state: done (above the line), current (at it), ahead (below);
   - each step's segment in the sticky card: full, the fraction read, or empty;
   - each phase's "x / total", the card's "Step n of 29", and the phone strip.
   Bars move by transform (scaleX). Rows change colour through a data-state
   attribute, written only when it changes. */
(function () {
  "use strict";

  function mountChecklist(root) {
    var list = root.querySelector("[data-cl-list]");
    var rows = [].slice.call(root.querySelectorAll("[data-cl-step]"));
    if (!list || !rows.length || !window.gsap || !window.ScrollTrigger) return function () {};
    gsap.registerPlugin(ScrollTrigger);
    root.classList.add("cl--live");

    var fills = [].slice.call(root.querySelectorAll("[data-cl-fill]")); // one per step, in order
    var counts = [].slice.call(root.querySelectorAll("[data-cl-count]")); // one per phase
    var nowEl = root.querySelector("[data-cl-now]");
    var stripPhase = root.querySelector("[data-cl-strip-phase]");
    var stripNum = root.querySelector("[data-cl-strip-n]");
    var stripBar = root.querySelector("[data-cl-strip-bar]");
    var phases = [];
    rows.forEach(function (r) {
      var ph = r.getAttribute("data-cl-phase");
      if (phases.indexOf(ph) < 0) phases.push(ph);
    });
    var total = rows.length;

    var box = []; // each row's top and height within the list
    function layout() {
      var top = list.getBoundingClientRect().top;
      box = rows.map(function (r) {
        var b = r.getBoundingClientRect();
        return { t: b.top - top, h: b.height };
      });
    }

    var state = { p: 0 };
    var last = { cur: -2, frac: -1 };
    function render() {
      var y = state.p * list.offsetHeight; // the reading line, within the list
      var cur = -1,
        frac = 0,
        done = 0;
      for (var i = 0; i < box.length; i++) {
        if (y >= box[i].t + box[i].h) done = i + 1;
        else {
          if (y >= box[i].t) {
            cur = i;
            frac = (y - box[i].t) / box[i].h;
          }
          break;
        }
      }
      if (cur === last.cur && Math.abs(frac - last.frac) < 0.004) return;
      last = { cur: cur, frac: frac };

      for (var k = 0; k < rows.length; k++) {
        var s = k < done ? "done" : k === cur ? "current" : "ahead";
        if (rows[k].getAttribute("data-state") !== s) rows[k].setAttribute("data-state", s);
        var f = k < done ? 1 : k === cur ? frac : 0;
        fills[k].style.transform = "scaleX(" + f.toFixed(3) + ")";
      }
      var perPhase = phases.map(function () {
        return 0;
      });
      for (var d = 0; d < done; d++) perPhase[phases.indexOf(rows[d].getAttribute("data-cl-phase"))]++;
      counts.forEach(function (c, pi) {
        c.textContent = String(perPhase[pi]);
      });

      // "Step n": the step being read, or the last one closed between phases.
      var n = cur >= 0 ? cur + 1 : Math.max(done, 1);
      var at = rows[Math.min(n, total) - 1];
      if (nowEl) nowEl.textContent = String(n);
      if (stripNum) stripNum.textContent = String(n);
      if (stripPhase && at) stripPhase.textContent = at.getAttribute("data-cl-phase");
      if (stripBar) stripBar.style.transform = "scaleX(" + ((done + (cur >= 0 ? frac : 0)) / total).toFixed(4) + ")";
    }

    layout();
    var tween = gsap.fromTo(
      state,
      { p: 0 },
      {
        p: 1,
        ease: "none",
        onUpdate: render,
        scrollTrigger: { trigger: list, start: "top 45%", end: "bottom 45%", scrub: 0.35, invalidateOnRefresh: true },
      }
    );
    var onRefresh = function () {
      layout();
      last.cur = -2;
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
      root.classList.remove("cl--live");
      rows.forEach(function (r) {
        r.removeAttribute("data-state");
      });
      fills.forEach(function (f) {
        f.style.transform = "";
      });
    };
  }

  window.mountChecklist = mountChecklist;
})();

/* NutriDrip drip page prototype (BRIEF.md): the client's drip.js reading
   fill, with our bottles. Each ingredient row lights once its top passes 62%
   of the screen, as the client's did. When an ingredient that goes in the bag
   lights, its labelled bottle appears over the bag, holds a beat and drops
   in; as it lands the liquid rises by its share and the bag's label prints
   its line. What is given separately stands beside the bag. The count shows
   how many rows have been read. The engine is used for entry reveals only. */
(function () {
  "use strict";
  var doc = document,
    body = doc.body;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var small = matchMedia("(max-width: 860px)").matches;
  function $(s, c) {
    return (c || doc).querySelector(s);
  }
  function $$(s, c) {
    return Array.prototype.slice.call((c || doc).querySelectorAll(s));
  }
  function clamp(v, a, b) {
    return Math.min(b, Math.max(a, v));
  }

  var rows = $$("[data-ing]"),
    bag = $("[data-dp-bag]"),
    count = $("[data-dp-count]");
  var col = $(".dp__bagcol"),
    list = $("[data-ings]");
  var glasses = $$(".dp__glass"),
    sides = $$(".dp__side");
  var inBag = rows.filter(function (r) {
    return r.getAttribute("data-kind") === "bag";
  }).length;
  if (reduce) body.classList.add("is-static");

  // ---------------------------------------------------- the labels on the glass
  // Laid out at 196 px and scaled by the glass's exact width; each band's
  // lines at the largest size that fits 172 px.
  function scaleLabels() {
    $$(".vlabel").forEach(function (l) {
      var w = parseFloat(getComputedStyle(l.parentNode).width) || 196;
      l.style.setProperty("--k", (w / 196).toFixed(5));
    });
  }
  function fitBands() {
    $$(".vlabel__band").forEach(function (b) {
      var ls = $$("b", b),
        cap = ls.length === 1 ? 34 : ls.length === 2 ? 30 : 24;
      b.style.setProperty("--nfs", cap + "px");
      var w = ls.reduce(function (m, l) {
        return Math.max(m, l.offsetWidth);
      }, 0);
      if (w) b.style.setProperty("--nfs", Math.min(cap, (cap * 172) / w).toFixed(2) + "px");
    });
  }

  // ---------------------------------------------------- the liquid (as the home page's)
  var levelEl = $("[data-liq-level]"),
    waveEls = $$(".liq__wave", bag),
    dropEls = $$(".liq__drop", bag),
    ringEls = $$(".liq__ring", bag);
  var liq = { to: 0, lvl: 0, tilt: 0, tiltV: 0, amp: 0.22, t: 0, next: 0, drops: [], rings: [], raf: 0 };
  var bagH = 0;
  function surfaceY() {
    return bagH * (0.07 + (1 - liq.lvl) * 0.795);
  }
  function paint(now) {
    var y = surfaceY();
    levelEl.style.transform = "translate3d(0," + y.toFixed(2) + "px,0) rotate(" + liq.tilt.toFixed(3) + "deg)";
    waveEls.forEach(function (w) {
      w.style.transform = "scaleY(" + liq.amp.toFixed(3) + ")";
      w.style.opacity = String(Math.min(1, liq.lvl * 30));
    });
    liq.drops.forEach(function (d) {
      d.el.style.transform = "translate3d(" + d.x.toFixed(1) + "px," + d.y.toFixed(1) + "px,0)";
    });
    liq.rings.forEach(function (r) {
      var k = (now - r.born) / 480;
      r.el.style.transform =
        "translate3d(" + r.x.toFixed(1) + "px," + y.toFixed(1) + "px,0) scale(" + (0.35 + k * 1.1).toFixed(3) + ")";
      r.el.style.opacity = String(Math.max(0, 0.85 * (1 - k)));
    });
  }
  function tick(now) {
    liq.raf = 0;
    var f = liq.t ? Math.min(4, (now - liq.t) / 16.7) : 1;
    liq.t = now;
    liq.lvl += (liq.to - liq.lvl) * (1 - Math.pow(0.92, f));
    if (Math.abs(liq.to - liq.lvl) < 0.0004) liq.lvl = liq.to;
    var rising = liq.to - liq.lvl > 0.003;
    liq.tiltV += (-0.035 * liq.tilt - 0.09 * liq.tiltV) * f;
    liq.tilt = clamp(liq.tilt + liq.tiltV * f, -2.5, 2.5);
    liq.amp += ((rising ? 1 : 0.22) - liq.amp) * (1 - Math.pow(0.94, f));
    if (rising && now >= liq.next && liq.lvl < 0.98) {
      var free = dropEls.filter(function (el) {
        return !liq.drops.some(function (d) {
          return d.el === el;
        });
      })[0];
      if (free) {
        liq.drops.push({ el: free, x: (Math.random() - 0.5) * bagH * 0.014, y: bagH * 0.075, v: bagH * 0.002 });
        free.style.opacity = "0.95";
      }
      liq.next = now + 110;
    }
    var surf = surfaceY();
    liq.drops = liq.drops.filter(function (d) {
      d.v += bagH * 0.0012 * f;
      d.y += d.v * f;
      if (d.y < surf - bagH * 0.01) return true;
      d.el.style.opacity = "0";
      var ring = ringEls.filter(function (el) {
        return !liq.rings.some(function (r) {
          return r.el === el;
        });
      })[0];
      if (ring) liq.rings.push({ el: ring, x: d.x, born: now });
      liq.tiltV += (Math.random() < 0.5 ? -1 : 1) * 0.06;
      return false;
    });
    liq.rings = liq.rings.filter(function (r) {
      if (now - r.born < 480) return true;
      r.el.style.opacity = "0";
      return false;
    });
    paint(now);
    var busy =
      rising ||
      liq.lvl !== liq.to ||
      liq.drops.length ||
      liq.rings.length ||
      Math.abs(liq.tilt) > 0.004 ||
      Math.abs(liq.tiltV) > 0.0004 ||
      Math.abs(liq.amp - 0.22) > 0.002;
    if (busy) liq.raf = requestAnimationFrame(tick);
    else liq.t = 0;
  }
  function kick() {
    if (reduce) {
      liq.lvl = liq.to;
      paint(0);
      return;
    }
    if (!liq.raf) liq.raf = requestAnimationFrame(tick);
  }

  // ---------------------------------------------------- reading
  var state = rows.map(function () {
    return { lit: false, landed: false, timer: 0 };
  });
  function printLine(key, on) {
    var el = $('[data-line="' + key + '"]');
    if (el) el.classList.toggle("is-on", on);
  }
  function level() {
    var landed = 0;
    state.forEach(function (s, i) {
      if (s.landed && rows[i].getAttribute("data-kind") === "bag") landed++;
    });
    liq.to = inBag ? landed / inBag : 0;
    kick();
  }
  function land(i) {
    var k = rows[i].getAttribute("data-k");
    state[i].landed = true;
    printLine(k, true);
    level();
  }
  // The bottles drop one at a time, in reading order: a fast scroll lights
  // several rows at once, and dropped together their bottles stacked over the
  // bag while the liquid waited for all of them (the user's report). So the
  // drops wait for the reader to pause (140 ms without a new row). Then
  // everything read in that burst goes into the bag at once, the liquid easing
  // up to it, and only the latest bottle makes the visible fall. Read slowly,
  // one row at a time, and every bottle falls.
  var queue = [],
    running = -1,
    timers = [],
    settle = 0;
  function pumpSoon() {
    clearTimeout(settle);
    settle = setTimeout(pump, reduce ? 0 : 140);
  }
  function pump() {
    if (running >= 0 || !queue.length) return;
    while (queue.length > 1) land(queue.shift());
    var i = queue.shift(),
      g = glasses[+rows[i].getAttribute("data-k")];
    if (reduce || !g) {
      land(i);
      return;
    }
    running = i;
    glasses.forEach(function (x) {
      x.classList.remove("is-in");
    });
    void g.offsetWidth;
    g.classList.add("is-in");
    timers = [
      setTimeout(function () {
        land(i);
      }, 900), // as the bottle reaches the bag
      setTimeout(function () {
        running = -1;
        pump();
      }, 1000),
    ];
  }
  function changed(i, on) {
    var r = rows[i],
      kind = r.getAttribute("data-kind"),
      k = +r.getAttribute("data-k");
    if (kind === "carrier") printLine("c", on);
    if (kind === "sep") {
      if (sides[k]) sides[k].classList.toggle("is-on", on);
      printLine(
        "s",
        rows.some(function (x, j) {
          return x.getAttribute("data-kind") === "sep" && state[j].lit;
        })
      );
    }
    if (kind !== "bag") return;
    if (on) {
      if (!state[i].landed && queue.indexOf(i) < 0 && running !== i) queue.push(i);
      pumpSoon();
      return;
    }
    // Read back up past it: out of the queue, its bottle gone, its share drained.
    queue = queue.filter(function (q) {
      return q !== i;
    });
    if (running === i) {
      timers.forEach(clearTimeout);
      running = -1;
    }
    if (glasses[k]) glasses[k].classList.remove("is-in");
    state[i].landed = false;
    printLine(String(k), false);
    level();
    pumpSoon();
  }
  function render() {
    var line = innerHeight * 0.62,
      n = 0;
    rows.forEach(function (r, i) {
      var on = reduce || r.getBoundingClientRect().top < line;
      if (on !== state[i].lit) {
        state[i].lit = on;
        r.classList.toggle("is-lit", on);
        changed(i, on);
      }
      if (on) n++;
    });
    count.textContent = String(n);
    // On a phone the bag column runs only as far as the list (the client's rule).
    if (col && list && small)
      col.style.setProperty(
        "--bagcol-h",
        list.getBoundingClientRect().bottom - col.parentNode.getBoundingClientRect().top + 40 + "px"
      );
  }

  // ---------------------------------------------------- phone sticky bar, menu
  var sticky = $(".nd-sticky"),
    slip = $("#book");
  function stickyTick() {
    if (!sticky) return;
    var sr = slip && slip.getBoundingClientRect();
    sticky.classList.toggle(
      "is-on",
      scrollY > innerHeight * 0.6 && !(sr && sr.top < innerHeight * 0.8 && sr.bottom > 0)
    );
  }
  var menu = $("[data-menu-btn]"),
    ledger = $("#nd-ledger");
  if (menu && ledger)
    menu.addEventListener("click", function () {
      var on = !ledger.classList.contains("is-open");
      ledger.classList.toggle("is-open", on);
      menu.setAttribute("aria-expanded", on ? "true" : "false");
    });

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      render();
      stickyTick();
    });
  }
  function measure() {
    bagH = bag.offsetHeight;
    scaleLabels();
    paint(performance.now());
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", function () {
    measure();
    onScroll();
  });
  if (doc.fonts) {
    doc.fonts.ready.then(function () {
      fitBands();
      measure();
    });
    doc.fonts.addEventListener("loadingdone", fitBands);
  }
  addEventListener("load", measure);

  window.ND_SC = ScrollCraft.mount(doc.getElementById("sc-root"));
  measure();
  fitBands();
  render();
  stickyTick();
  body.classList.add("nd-js");
})();

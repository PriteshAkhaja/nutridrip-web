/* NutriDrip v3 prototype: page-local behaviour, adapted from the client's
   home.js and site.js. The engine stays untouched. Data comes from
   window.ND_DRIPS (the Drip documents, written by tools/render.mjs).
   Differences from the artifact are marked "v3:". */
(function () {
  "use strict";
  var DRIPS = window.ND_DRIPS || [],
    doc = document,
    body = doc.body;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var small = matchMedia("(max-width: 860px)").matches;
  var fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  function $(s, c) {
    return (c || doc).querySelector(s);
  }
  function $$(s, c) {
    return Array.prototype.slice.call((c || doc).querySelectorAll(s));
  }
  function clamp(v, a, b) {
    return Math.min(b, Math.max(a, v));
  }
  function seg(p, a, b) {
    return clamp((p - a) / (b - a), 0, 1);
  }
  function ease(t) {
    return 1 - Math.pow(1 - t, 3);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function inr(n) {
    return "₹" + Number(n).toLocaleString("en-IN");
  }
  var bySlug = {};
  DRIPS.forEach(function (d) {
    bySlug[d.slug] = d;
  });
  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      localStorage.setItem(k, v);
    } catch (e) {
      return null;
    }
  }

  // v3d: the client's own NutriDrip products, matched by the ingredient's
  // name. Methylcobalamin is not cyanocobalamin, so the B12 photo only stands
  // in for a drip that really uses methylcobalamin.
  var PRODUCTS = [
    // [match, photo, width, height, the BANDS colour its own label carries]
    [/ascorbic|vitamin c/i, "assets/vial-vitc.webp", 349, 900, -1],
    [/b[- ]?complex/i, "assets/vial-bcomplex.webp", 195, 900, 0],
    [/magnesium/i, "assets/vial-magnesium.webp", 196, 900, 1],
    [/calcium/i, "assets/vial-calcium.webp", 338, 900, 3],
    [/methylcobalamin/i, "assets/vial-b12.webp", 202, 900, 2],
  ];
  // Every other ingredient: the client's amber ampoule with its print lifted
  // off (tools/blank-ampoule.mjs) and this ingredient's label set in their
  // design. Band colours are label colours, never the clinical hues.
  var BANDS = ["#CDBFEF", "#BBD4EE", "#F0C4D6", "#B6E2DD", "#DCC8EF", "#C5CDF2"];
  function band(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return h % BANDS.length;
  }
  function photoOf(it) {
    for (var k = 0; k < PRODUCTS.length; k++) if (PRODUCTS[k][0].test(it.name)) return PRODUCTS[k];
    return null;
  }
  // v3e: one colour per glass in a drip. Each ingredient keeps its own colour
  // (from its name) unless another glass in this drip already shows it, the
  // client's photographed labels included; then it takes the next free one.
  function bandColours(items) {
    var used = {};
    items.forEach(function (it) {
      var pr = photoOf(it);
      if (pr && pr[4] >= 0) used[pr[4]] = true;
    });
    return items.map(function (it) {
      if (photoOf(it)) return null;
      var c = band(it.name);
      for (var j = 0; j < BANDS.length && used[c]; j++) c = (c + 1) % BANDS.length;
      used[c] = true;
      return BANDS[c];
    });
  }
  // v3e: the band reads like the client's ("MAGNESIUM / SULFATE 50%",
  // "METHYLCOBALAMIN / (B12)"): the name in up to two balanced lines, then the
  // vitamin it is, when the master records one the name does not say.
  function bandLines(it) {
    var words = it.name.toUpperCase().split(/\s+/),
      lines = words;
    if (words.length > 1) {
      var cut = 1,
        best = 1e9;
      for (var i = 1; i < words.length; i++) {
        var d = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
        if (d < best) {
          best = d;
          cut = i;
        }
      }
      lines = [words.slice(0, cut).join(" "), words.slice(cut).join(" ")];
    }
    var vit = it.molecule && /^vitamin\s+(.+)$/i.exec(it.molecule);
    if (vit && it.name.toLowerCase().indexOf(it.molecule.toLowerCase()) < 0)
      lines = lines.concat("(" + vit[1].toUpperCase() + ")");
    return lines;
  }
  function vialHTML(it, b) {
    var pr = photoOf(it);
    if (pr)
      return (
        '<div class="vial__glass" style="aspect-ratio:' +
        pr[2] +
        "/" +
        pr[3] +
        '"><img src="' +
        pr[1] +
        '" alt=""></div>'
      );
    return (
      '<div class="vial__glass" style="aspect-ratio:196/900;--band:' +
      b +
      '"><img src="assets/ampoule-blank.webp" alt="">' +
      // The coloured ring on the neck, as on every client ampoule.
      '<i class="vring"></i>' +
      // <p>, not <span>: the client's ".vial span" rule styles the caption
      // under each vial and would catch every span in the label.
      '<div class="vlabel">' +
      '<p class="vlabel__word">NutriDrip<sup>™</sup></p><p class="vlabel__sub">IV NUTRIENT THERAPY</p>' +
      '<p class="vlabel__band">' +
      bandLines(it)
        .map(function (l) {
          return "<b>" + esc(l) + "</b>";
        })
        .join("") +
      "</p>" +
      '<div class="vlabel__low"><p class="vlabel__dose">' +
      esc(it.dose) +
      (it.alt ? "<small>" + esc(it.alt) + "</small>" : "") +
      "</p>" +
      '<i class="vlabel__rule"></i>' +
      '<svg class="vlabel__inf" viewBox="0 0 100 50" aria-hidden="true"><path d="M50 25C40 11 33 7 25 7 15 7 7 15 7 25s8 18 18 18c8 0 15-4 25-18s17-18 25-18c10 0 18 8 18 18s-8 18-18 18c-8 0-15-4-25-18Z" fill="none" stroke="currentColor" stroke-width="5"/></svg>' +
      '<p class="vlabel__foot">For IV Use Only</p></div></div></div>'
    );
  }
  // Each band's lines share one size, the largest that keeps the widest line
  // inside the label's printable width (172 of its 196 px), as the client's
  // bands fill theirs; a one-word band may set larger, in the same two-line
  // height. Measured after the fonts load.
  function fitBands() {
    $$(".vlabel__band", vialBox).forEach(function (b) {
      var ls = $$("b", b),
        cap = ls.length === 1 ? 34 : ls.length === 2 ? 30 : 24;
      b.style.setProperty("--nfs", cap + "px");
      var w = ls.reduce(function (m, l) {
        return Math.max(m, l.offsetWidth);
      }, 0);
      if (w) b.style.setProperty("--nfs", Math.min(cap, (cap * 172) / w).toFixed(2) + "px");
    });
  }

  // ---------------------------------------------------- clip codec fallback
  // As the client's home.js: webm where h264 will not play.
  var tv = doc.createElement("video");
  if (!tv.canPlayType('video/mp4; codecs="avc1.42E01E"') && tv.canPlayType('video/webm; codecs="vp9"')) {
    $$("video[data-sc-src]").forEach(function (v) {
      v.setAttribute("data-sc-src", v.getAttribute("data-sc-src").replace(/\.mp4$/, ".webm"));
      v.setAttribute("data-sc-src-mobile", v.getAttribute("data-sc-src-mobile").replace(/\.mp4$/, ".webm"));
    });
  }

  // ---------------------------------------------------- prepare the acts
  var hero = $("#q-what"),
    path = $(".path"),
    build = $("#build"),
    day = $("#q-day"),
    form = $("#q-inside"),
    drop = $(".drop");
  if (small) {
    // v3: the phone spans come from the markup (--span-m), the same numbers the
    // CSS reserves from first paint, so mounting moves nothing.
    [hero, path, build, day, drop].forEach(function (a) {
      a.setAttribute("data-sc-span", getComputedStyle(a).getPropertyValue("--span-m").trim());
    });
    form.setAttribute("data-sc-act", "flow");
    form.removeAttribute("data-sc-span");
  }
  if (reduce) {
    [hero, path, build, day, drop, form].forEach(function (a) {
      a.setAttribute("data-sc-act", "flow");
      a.removeAttribute("data-sc-span");
      var st = a.querySelector("[data-sc-stage]");
      if (st) st.classList.add("sc-stage", "nd-still");
    });
    body.classList.add("is-static");
  }

  // ---------------------------------------------------- the chosen drip
  function chosen() {
    var q = new URLSearchParams(location.search).get("drip");
    if (q && bySlug[q]) return q;
    var s = store("nd-drip");
    return s && bySlug[s] ? s : window.ND_DEFAULT;
  }
  var status = $("[data-pick-status]");
  function setChosen(slug, why) {
    var d = bySlug[slug];
    if (!d) return;
    if (why) store("nd-drip", slug);
    body.style.setProperty("--tint", d.tint);
    $$("[data-chosen-name]").forEach(function (el) {
      el.textContent = d.name;
    });
    $$("[data-chosen-price]").forEach(function (el) {
      el.textContent = inr(d.price);
    });
    $$("[data-chosen-duration]").forEach(function (el) {
      el.textContent = d.duration;
    });
    $$("[data-chosen-volume]").forEach(function (el) {
      el.textContent = Number(d.volume).toLocaleString("en-IN");
    });
    $$("[data-chosen-carrier]").forEach(function (el) {
      el.textContent = d.carrier || "the carrier";
    });
    // The chosen drip travels with every quiz link, as QuizButton's drip prop does.
    $$("a[data-quiz-link]").forEach(function (a) {
      a.setAttribute("href", "/quiz?drip=" + encodeURIComponent(d.slug));
    });
    var more = $("[data-drip-page]");
    if (more) more.href = "/drips/" + d.slug;
    $$(".feel").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-feel") === slug ? "true" : "false");
    });
    if (why === "picker" && status)
      status.innerHTML =
        "Keep scrolling to watch <b>" + esc(d.name) + "</b> being built. A physician confirms it after the quiz.";
    loadBuild(d);
  }
  $$(".feel").forEach(function (b) {
    b.addEventListener("click", function () {
      setChosen(b.getAttribute("data-feel"), "picker");
    });
  });

  // ---------------------------------------------------- the build
  var current = null,
    vialEls = [],
    lines = [];
  var vialBox = $("[data-vials]"),
    linesEl = $("[data-build-lines]"),
    sepEl = $("[data-build-sep]"),
    bag = $("[data-build-bag]");
  var stage = $(".build__stage"),
    mstep = $("[data-build-mstep]"),
    endEl = $("[data-build-end]"),
    sr = $("[data-build-sr]");

  function loadBuild(d) {
    current = d;
    stage.style.setProperty("--tint", d.tint);
    var colours = bandColours(d.inBag);
    vialBox.innerHTML = d.inBag
      .map(function (it, i) {
        return '<div class="vial">' + vialHTML(it, colours[i]) + "<span>" + esc(it.name) + "</span></div>";
      })
      .join("");
    vialEls = $$(".vial", vialBox);
    scaleLabels();
    fitBands();
    // v3e: two columns, name and dose, as the client's B-complex label.
    var rows = (d.carrier ? [[d.carrier, Number(d.volume).toLocaleString("en-IN") + " mL"]] : []).concat(
      d.inBag.map(function (i) {
        return [i.name, i.dose];
      })
    );
    var items = rows.map(function (r) {
      return r[0] + " " + r[1];
    });
    linesEl.innerHTML =
      rows
        .map(function (r) {
          return "<li><span>" + esc(r[0]) + "</span><b>" + esc(r[1]) + "</b></li>";
        })
        .join("") +
      (d.separate.length
        ? '<li class="build__lsep">Given separately: ' +
          d.separate
            .map(function (s) {
              return esc(s.name);
            })
            .join(", ") +
          "</li>"
        : "");
    lines = $$("li", linesEl);
    sepEl.innerHTML = d.separate.length
      ? d.separate
          .map(function (s) {
            return (
              '<div class="sep__item"><b>' +
              esc(s.name) +
              " is given separately</b>Never mixed into the bag" +
              (s.notes ? ": " + esc(s.notes.toLowerCase()) : "") +
              ".</div>"
            );
          })
          .join("") +
        '<div class="sep__compact"><b>Given separately</b>' +
        d.separate
          .map(function (s) {
            return esc(s.name) + (s.notes ? " (" + esc(s.notes.toLowerCase()) + ")" : "");
          })
          .join(" · ") +
        "</div>"
      : '<div class="sep__item"><b>Everything goes in the bag</b>All of it runs in one ' +
        d.volume +
        " mL bag, over " +
        esc(d.duration) +
        '.</div><div class="sep__compact"><b>All in one bag</b>' +
        d.volume +
        " mL, over " +
        esc(d.duration) +
        ".</div>";
    if (sr)
      sr.textContent =
        d.name +
        ": " +
        items.join(", ") +
        (d.separate.length
          ? ". Given separately: " +
            d.separate
              .map(function (s) {
                return s.name;
              })
              .join(", ")
          : "") +
        ".";
    measure();
    last = {};
    if (reduce) renderBuild(1);
  }

  // Each generated label is laid out at 196 px and scaled to its glass.
  function scaleLabels() {
    $$(".vlabel", vialBox).forEach(function (l) {
      l.style.setProperty("--k", (l.parentNode.offsetWidth / 196).toFixed(4));
    });
  }
  var target = { x: 0, y: 0 },
    starts = [],
    bagH = 0,
    tight = false;
  function measure() {
    if (bag) bagH = bag.offsetHeight;
    // v3e: on a short screen (1024 x 768) the closing card lands on the last
    // steps. Opacity does not move layout, so the two can be measured as laid
    // out; where they would meet, the steps leave before the card arrives.
    var sl = $(".build__steps"),
      sr2 = sl && sl.getBoundingClientRect(),
      er = endEl.getBoundingClientRect();
    tight = !!sr2 && sr2.height > 0 && sr2.bottom + 12 > er.top;
    if (!bag || !vialEls.length) return;
    var saved = vialEls.map(function (v) {
      var t = v.style.transform;
      v.style.transform = "none";
      return t;
    });
    var br = bag.getBoundingClientRect();
    target = { x: br.left + br.width / 2, y: br.top + br.height * 0.07 };
    starts = vialEls.map(function (v) {
      var r = v.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.bottom, h: r.height };
    });
    vialEls.forEach(function (v, i) {
      v.style.transform = saved[i];
    });
  }

  function renderBuild(p) {
    if (!current) return;
    var n = vialEls.length;
    // v3d: each ingredient owns an equal slice of the drop phase. It falls
    // over the first 72% of its slice, so the bag fills ingredient by
    // ingredient at one steady pace whatever the count (the act's span grows
    // with the count).
    // v3e: its share of the level pours in from the moment it enters, over
    // 90% of a slice, eased in and out, so one pour runs into the next with
    // no flat steps between. The frame loop then eases the shown level to it.
    var drop0 = 0.05,
      drop1 = 0.6,
      w = (drop1 - drop0) / Math.max(1, n);
    var risen = 0;
    vialEls.forEach(function (v, i) {
      var a = drop0 + i * w;
      var t = seg(p, a, a + 0.72 * w),
        s = starts[i];
      risen += smooth(seg(p, a + 0.6 * w, a + 1.5 * w));
      if (!s) return;
      var dx = target.x - s.x,
        dy = target.y - s.y + s.h * 0.15;
      v.style.transform = "translate3d(" + dx * ease(t) + "px," + dy * t * t + "px,0) scale(" + (1 - t * 0.45) + ")";
      v.style.opacity = String(t < 0.82 ? 1 : 1 - (t - 0.82) / 0.18);
      v.style.setProperty("--lab", String(1 - Math.min(1, t * 4)));
    });
    var fill = n ? risen / n : smooth(seg(p, drop0, drop1));
    liq.to = fill;
    if (reduce) {
      liq.lvl = fill;
      paintLiquid(0);
    }
    var labO = seg(p, 0.58, 0.64);
    bag.style.setProperty("--lab-o", labO.toFixed(3));
    var shown = Math.round(seg(p, 0.62, 0.78) * lines.length);
    lines.forEach(function (li, i) {
      li.classList.toggle("is-on", i < shown);
    });
    stage.style.setProperty("--sep-o", seg(p, 0.72, 0.8).toFixed(3));
    var flood = seg(p, 0.82, 0.9);
    stage.style.setProperty("--flood", flood.toFixed(3));
    stage.classList.toggle("is-flooded", flood > 0.5);
    body.classList.toggle("nd-tinted", p > 0.84);
    var endO = seg(p, 0.88, 0.96);
    stage.style.setProperty("--end-o", endO.toFixed(3));
    endEl.classList.toggle("is-on", endO > 0.02);
    // v3e: on a phone the closing card covers the label, so the label has
    // left (by 0.88) before the card arrives, and the two never cross-fade.
    if (small) bag.style.setProperty("--lab-o", (labO * (1 - seg(p, 0.84, 0.88))).toFixed(3));
    if (small) stage.style.setProperty("--sep-o", (seg(p, 0.72, 0.78) * (1 - seg(p, 0.84, 0.88))).toFixed(3));
    stage.style.setProperty("--steps-o", tight ? (1 - seg(p, 0.84, 0.88)).toFixed(3) : "1");
    var idx = p < 0.6 ? 0 : p < 0.72 ? 1 : p < 0.82 ? 2 : 3,
      steps = $$(".build__steps li");
    steps.forEach(function (li, i) {
      li.classList.toggle("is-on", i <= idx);
    });
    if (mstep) mstep.textContent = steps[idx].textContent;
    stage.setAttribute("data-sc-verify-state", [fill.toFixed(2), shown, flood.toFixed(2), endO.toFixed(2)].join("/"));
  }

  // ---------------------------------------------------- v3e: the liquid
  // The scroll says where the level is going (liq.to); each frame the level
  // eases a tenth of the way there, so a jerky wheel still pours smoothly.
  // While it rises, drops fall from the top of the bag; each one that lands
  // rings the surface and rocks it, a damped swing that settles by itself.
  function smooth(t) {
    return t * t * (3 - 2 * t);
  }
  var levelEl = $("[data-liq-level]"),
    waveEls = $$(".liq__wave"),
    dropEls = $$(".liq__drop"),
    ringEls = $$(".liq__ring");
  var liq = { to: 0, lvl: 0, tilt: 0, tiltV: 0, amp: 0.22, t: 0, next: 0, drops: [], rings: [], still: false };
  function surfaceY() {
    return bagH * (0.07 + (1 - liq.lvl) * 0.795);
  } // px from the bag's top: the liquid spans 7% to 86.5%
  function paintLiquid(now) {
    var y = surfaceY();
    levelEl.style.transform = "translate3d(0," + y.toFixed(2) + "px,0) rotate(" + liq.tilt.toFixed(3) + "deg)";
    waveEls.forEach(function (w) {
      w.style.transform = "scaleY(" + liq.amp.toFixed(3) + ")";
      w.style.opacity = String(Math.min(1, liq.lvl * 30));
    });
    liq.drops.forEach(function (d) {
      d.el.style.transform =
        "translate3d(" +
        d.x.toFixed(1) +
        "px," +
        d.y.toFixed(1) +
        "px,0) scaleY(" +
        (1 + Math.min(0.5, (d.v / bagH) * 30)).toFixed(3) +
        ")";
    });
    liq.rings.forEach(function (r) {
      var k = (now - r.born) / 480;
      r.el.style.transform =
        "translate3d(" + r.x.toFixed(1) + "px," + y.toFixed(1) + "px,0) scale(" + (0.35 + k * 1.1).toFixed(3) + ")";
      r.el.style.opacity = String(Math.max(0, 0.85 * (1 - k)));
    });
  }
  function liquidTick(now) {
    if (!bagH) return;
    var f = liq.t ? Math.min(4, (now - liq.t) / 16.7) : 1;
    liq.t = now;
    liq.lvl += (liq.to - liq.lvl) * (1 - Math.pow(0.9, f));
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
      liq.next = now + 105;
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
    var still =
      !rising &&
      !liq.drops.length &&
      !liq.rings.length &&
      Math.abs(liq.tilt) < 0.004 &&
      Math.abs(liq.tiltV) < 0.0004 &&
      Math.abs(liq.amp - 0.22) < 0.002 &&
      liq.lvl === liq.to;
    if (still && liq.still) return; // nothing moved since the last paint
    liq.still = still;
    paintLiquid(now);
  }

  // ---------------------------------------------------- progress helper
  function prog(el) {
    var r = el.getBoundingClientRect(),
      vh = innerHeight,
      travel = r.height - vh;
    if (travel < 2) return clamp((vh - r.top) / (r.height + vh), 0, 1);
    return clamp(-r.top / travel, 0, 1);
  }

  // ---------------------------------------------------- hero
  var hStage = $(".hero__stage"),
    room = $(".hero__room"),
    back1 = $(".hero__back--1"),
    back2 = $(".hero__back--2"),
    head = $(".hero__head"),
    hbag = $(".hero__bag"),
    hprint = $(".hero__bagprint"),
    front = $(".hero__front"),
    light = $(".hero__light"),
    second = $(".hero__second"),
    hcopy = $(".hero__copy");
  var mx = 0,
    my = 0,
    tmx = 0,
    tmy = 0;
  if (fine && !reduce)
    addEventListener(
      "pointermove",
      function (e) {
        tmx = e.clientX / innerWidth - 0.5;
        tmy = e.clientY / innerHeight - 0.5;
      },
      { passive: true }
    );
  function snap(v) {
    var r = devicePixelRatio || 1;
    return Math.round(v * r) / r;
  }
  function renderHero(p) {
    mx += (tmx - mx) * 0.08;
    my += (tmy - my) * 0.08;
    var vh = innerHeight;
    room.style.transform =
      "translate3d(" + -mx * 10 + "px," + (-p * vh * 0.04 - my * 6) + "px,0) scale(" + (1.02 + p * 0.03) + ")";
    back1.style.transform = "translate3d(" + -mx * 16 + "px," + (-p * vh * 0.07 - my * 8) + "px,0)";
    back2.style.transform = "translate3d(" + -mx * 14 + "px," + (-p * vh * 0.06 - my * 7) + "px,0)";
    var r = ease(seg(p, 0.05, 0.6));
    var dx = small ? r * 18 : r * (innerWidth * 0.16);
    head.style.transform =
      "translate3d(" +
      (dx - mx * 22) +
      "px," +
      (r * (small ? vh * 0.05 : vh * 0.08) - my * 10) +
      "px,0) scale(" +
      (1 - r * 0.12) +
      ")";
    head.style.opacity = String(1 - r * 0.18);
    // v3e: the print plane (.hero__bagprint) takes the bag's exact transform.
    // It has no will-change, so the browser redraws its text at each scale
    // instead of stretching a bitmap; offsets are whole device pixels so the
    // text is never resampled between pixels either.
    var bt =
      "translate(" +
      snap(-mx * 30 - r * (small ? 0 : innerWidth * 0.015)) +
      "px," +
      snap(-p * vh * 0.12 - my * 14) +
      "px) scale(" +
      (1 + r * 0.05).toFixed(4) +
      ")";
    hbag.style.transform = bt;
    hprint.style.transform = bt;
    front.style.transform = "translate3d(" + -mx * 60 + "px," + (-p * vh * 0.42 - my * 24) + "px,0)";
    light.style.transform = "translate3d(" + (p * 80 + mx * 20) + "px,0,0)";
    var s = small ? ease(seg(p, 0.42, 0.62)) : ease(seg(p, 0.42, 0.72));
    second.style.opacity = String(s);
    second.style.transform = "translateY(" + (1 - s) * 14 + "px)";
    hcopy.style.opacity = String(1 - seg(p, 0.3, 0.45) * (small ? 1 : 0));
    hcopy.style.visibility = small && p > 0.45 ? "hidden" : "visible";
    hStage.setAttribute("data-sc-verify-state", r.toFixed(2) + "/" + s.toFixed(2));
  }

  // ---------------------------------------------------- pathway
  var pSteps = $$(".path__steps li"),
    pList = $(".path__steps"),
    pStage = $(".path__stage");
  // v3c: the line runs between circle centres, measured, not a fraction of
  // the list: steps wrap to different heights, so a fraction misses.
  var pCentres = [];
  function measurePath() {
    pCentres = $$(".path__n", pList).map(function (c) {
      return c.offsetTop + c.offsetHeight / 2;
    }); // the list is the offsetParent
    if (!pCentres.length) return;
    pList.style.setProperty("--l0", pCentres[0] + "px");
    pList.style.setProperty("--lh", pCentres[pCentres.length - 1] - pCentres[0] + "px");
  }
  function renderPath(p) {
    var n = Math.floor(seg(p, 0.02, 0.8) * 6 + 0.25);
    if (p > 0.02) n = Math.max(1, n);
    pSteps.forEach(function (li, i) {
      li.classList.toggle("is-on", i < n);
    });
    if (pCentres.length) pList.style.setProperty("--lp", (n > 0 ? pCentres[n - 1] - pCentres[0] : 0) + "px");
    pStage.setAttribute("data-sc-verify-state", String(n));
  }

  // ---------------------------------------------------- day timeline
  var dSteps = $$(".day__steps li"),
    dTrack = $(".day__track"),
    dayStage = $(".day__stage");
  function renderDay(p) {
    var t = seg(p, 0.05, 0.85);
    dTrack.style.setProperty("--day", t.toFixed(3));
    dSteps.forEach(function (li, i) {
      li.classList.toggle("is-on", t >= i / 5 - 0.001);
    });
    dayStage.setAttribute("data-sc-verify-state", t.toFixed(2));
  }

  // ---------------------------------------------------- the question ledger
  var ledger = $("#nd-ledger"),
    lbtn = $("[data-ledger-btn]"),
    qs = $$("[data-q]"),
    done = {};
  if (ledger && lbtn) {
    $("ol", ledger).innerHTML = qs
      .map(function (s, i) {
        return (
          '<li><a href="#' +
          s.id +
          '" data-qi="' +
          i +
          '"><span class="tick" aria-hidden="true"></span><span>' +
          esc(s.getAttribute("data-q")) +
          "</span></a></li>"
        );
      })
      .join("");
    var toggle = function (open) {
      var on = open === undefined ? !ledger.classList.contains("is-open") : open;
      ledger.classList.toggle("is-open", on);
      lbtn.setAttribute("aria-expanded", on ? "true" : "false");
      if (on) {
        var f = $("a", ledger);
        if (f) f.focus({ preventScroll: true });
      }
    };
    lbtn.addEventListener("click", function (e) {
      e.stopPropagation();
      toggle();
    });
    ledger.addEventListener("click", function (e) {
      if (e.target.closest("a")) toggle(false);
    });
    doc.addEventListener("click", function (e) {
      if (!ledger.contains(e.target)) toggle(false);
    });
    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && ledger.classList.contains("is-open")) {
        toggle(false);
        lbtn.focus();
      }
    });
  }
  function ledgerTick() {
    if (!qs.length || !lbtn) return;
    var vh = innerHeight,
      now = 0;
    qs.forEach(function (s, i) {
      var r = s.getBoundingClientRect();
      if (r.top < vh * 0.45) now = i;
      if (r.bottom < vh * 0.55) done[i] = true;
    });
    $(".nd-ledger-btn__count", lbtn).textContent = Object.keys(done).length + "/" + qs.length;
    $(".nd-ledger-btn__q", lbtn).textContent = qs[now].getAttribute("data-q");
    lbtn.title = qs[now].getAttribute("data-q"); // in full, where the button shortens it
    $$("a[data-qi]").forEach(function (a) {
      var i = +a.getAttribute("data-qi");
      a.parentNode.classList.toggle("is-done", !!done[i]);
      a.classList.toggle("is-now", i === now);
      if (i === now) a.setAttribute("aria-current", "step");
      else a.removeAttribute("aria-current");
    });
  }

  // ---------------------------------------------------- phone sticky bar
  var sticky = $(".nd-sticky");
  function stickyTick() {
    if (!sticky) return;
    var after = hero.getBoundingClientRect().bottom < innerHeight * 0.35;
    var slip = $("#book"),
      atSlip = slip && slip.getBoundingClientRect().top < innerHeight * 0.8 && slip.getBoundingClientRect().bottom > 0;
    var br = build.getBoundingClientRect(),
      inBuild = br.top < innerHeight * 0.5 && br.bottom > innerHeight * 0.5;
    sticky.classList.toggle("is-on", after && !atSlip && !inBuild);
  }
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      ledgerTick();
      stickyTick();
    });
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);

  // ---------------------------------------------------- loop
  var last = {};
  function frame() {
    if (!reduce) {
      renderHero(prog(hero));
      var pp = prog(path);
      if (pp !== last.p) {
        renderPath(pp);
        last.p = pp;
      }
      var pb = prog(build);
      if (pb !== last.b) {
        renderBuild(pb);
        last.b = pb;
      }
      var brr = build.getBoundingClientRect(),
        live = brr.top < innerHeight && brr.bottom > 0;
      if (live !== last.live) {
        bag.classList.toggle("is-live", live);
        last.live = live;
      }
      if (live) liquidTick(performance.now());
      var pd = prog(day);
      if (pd !== last.d) {
        renderDay(pd);
        last.d = pd;
      }
    }
    requestAnimationFrame(frame);
  }
  addEventListener("resize", function () {
    scaleLabels();
    measure();
    measurePath();
    last = {};
  });

  // ---------------------------------------------------- v3: keyboard focus
  // The rail travels by transform, so the browser cannot bring a focused card
  // into view. Park the pan act where the card is centred, using the engine's
  // own mapping: translateX = -(overflow * (1 + extra)) * p.
  form.addEventListener("focusin", function (e) {
    if (reduce || form.getAttribute("data-sc-act") !== "pan") return;
    var rail = $("[data-sc-pan]", form),
      item = e.target.closest(".fcard, .formulary__lead, .formulary__end");
    if (!rail || !item) return;
    var over = rail.scrollWidth - innerWidth;
    if (over <= 0) return;
    var travel = over * (1 + (parseFloat(rail.getAttribute("data-sc-pan")) || 0));
    var want = clamp(item.offsetLeft + item.offsetWidth / 2 - innerWidth / 2, 0, travel);
    var top = form.getBoundingClientRect().top + scrollY;
    scrollTo({ top: top + (want / travel) * (form.offsetHeight - innerHeight), behavior: "instant" });
  });
  // The build's closing links only exist once the bag is sealed: a keyboard
  // user arriving on them lands on the sealed bag, not on links still at 0.
  endEl.addEventListener("focusin", function () {
    if (reduce) return;
    var top = build.getBoundingClientRect().top + scrollY;
    scrollTo({ top: top + 0.96 * (build.offsetHeight - innerHeight), behavior: "instant" });
  });

  // ---------------------------------------------------- go
  $$(".fcard").forEach(function (c, i) {
    c.style.setProperty("--i", String(i));
  });
  window.ND_SC = ScrollCraft.mount(doc.getElementById("sc-root"));
  setChosen(chosen());
  measurePath();
  onScroll();
  if (reduce) {
    renderBuild(1);
    renderPath(1);
    body.classList.add("nd-tinted");
  } else {
    if (doc.fonts && doc.fonts.ready)
      doc.fonts.ready.then(function () {
        fitBands();
        measure();
        measurePath();
        last = {};
      });
    // A face that finishes after "ready" (a slow first visit) refits too.
    if (doc.fonts && doc.fonts.addEventListener) doc.fonts.addEventListener("loadingdone", fitBands);
    addEventListener("load", function () {
      measure();
      measurePath();
      last = {};
    });
    requestAnimationFrame(frame);
  }
  body.classList.add("nd-js");
})();

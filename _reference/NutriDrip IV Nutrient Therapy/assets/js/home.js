/* NutriDrip v2 home: hero depth, pathway, feeling picker, the build, the
   day timeline. Engine stays untouched; everything bespoke lives here and
   reads each act's own progress. */
(function () {
  "use strict";
  var ND = window.ND, doc = document, body = doc.body;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var small = matchMedia("(max-width: 860px)").matches;
  var fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function seg(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  // ---------------------------------------------------- clip codec fallback
  var tv = doc.createElement("video");
  if (!tv.canPlayType('video/mp4; codecs="avc1.42E01E"') && tv.canPlayType('video/webm; codecs="vp9"')) {
    $$("video[data-sc-src]").forEach(function (v) { v.setAttribute("data-sc-src", v.getAttribute("data-sc-src").replace(/\.mp4$/, ".webm")); v.setAttribute("data-sc-src-mobile", v.getAttribute("data-sc-src-mobile").replace(/\.mp4$/, ".webm")); });
  }

  // ---------------------------------------------------- prepare the acts
  var hero = $("#q-what"), path = $(".path"), build = $("#build"), day = $("#q-day"), form = $("#q-inside"), drop = $(".drop");
  if (small) {
    form.setAttribute("data-sc-act", "flow"); form.removeAttribute("data-sc-span");
    hero.setAttribute("data-sc-span", "1.8");
    build.setAttribute("data-sc-span", "3.8");
    path.setAttribute("data-sc-span", "2.4");
  }
  if (reduce) {
    [hero, path, build, day, drop].forEach(function (a) { a.setAttribute("data-sc-act", "flow"); a.removeAttribute("data-sc-span"); var st = a.querySelector("[data-sc-stage]"); if (st) st.classList.add("sc-stage", "nd-still"); });
    body.classList.add("is-static");
  }

  // ---------------------------------------------------- tests lists
  $("[data-core-tests]").innerHTML = ND.CORE_TESTS.map(function (t) { return "<li><b>" + t[0] + "</b><span>" + t[3] + "</span></li>"; }).join("");
  var cond = ["g6pd", "b12", "vitd", "tsh", "glucose", "iron"];
  $("[data-cond-tests]").innerHTML = cond.map(function (k) { var t = ND.COND_TESTS[k]; return "<li><b>" + t[0] + "</b><span>" + t[1] + "</span></li>"; }).join("");

  // ---------------------------------------------------- feeling picker
  var grid = $("[data-feelings]");
  grid.innerHTML = ND.FEELINGS.map(function (f) {
    var d = ND.byId(f[1]);
    return '<button type="button" class="feel" aria-pressed="false" data-feel="' + d.id + '" style="--t:' + d.tint + '"><i aria-hidden="true"></i>' + f[0] + "<small>" + d.name + " · " + ND.rupees(d.price) + "</small></button>";
  }).join("");
  var status = $("[data-pick-status]");
  grid.addEventListener("click", function (e) {
    var b = e.target.closest("[data-feel]"); if (!b) return;
    ND.setChosen(b.getAttribute("data-feel"), "picker");
  });

  // ---------------------------------------------------- build data
  var current = null, items = [], vialEls = [], lines = [];
  var vialBox = $("[data-vials]"), linesEl = $("[data-build-lines]"), sepEl = $("[data-build-sep]"), bag = $("[data-build-bag]");
  var stage = $(".build__stage"), titleEl = $("[data-build-title]"), mstep = $("[data-build-mstep]"), endEl = $("[data-build-end]"), sr = $("[data-build-sr]");
  var RANGE_FOR = { "Vitamin C": "vitc", "Ascorbic acid 5 g": "vitc", "Vitamin C 1.5 g": "vitc", "B-complex": "bcomplex", "Magnesium": "magnesium", "Calcium": "calcium", "Vitamin B12": "b12" };
  function short(n) { return n.replace(/ \(.*\)$/, "").replace("Ascorbic acid 5 g", "Vitamin C 5 g"); }

  function loadDrip(id) {
    var d = ND.byId(id) || ND.byId("executive-energy");
    current = d;
    doc.documentElement.style.setProperty("--tint", d.tint);
    $$("[data-chosen-tint]").forEach(function (el) { el.style.setProperty("--tint", d.tint); });
    titleEl.textContent = "Your " + d.name + ", built to protocol.";
    $$("[data-chosen-name]", stage).forEach(function (el) { el.textContent = d.name; });
    $$("[data-chosen-price]", stage).forEach(function (el) { el.textContent = ND.rupees(d.price); });
    $("[data-drip-page]").href = "drip-" + d.id + ".html";
    // Everything that goes in the bag drops in: our own ampoules as photos,
    // anything else as a plain labelled ampoule.
    items = d.bag.concat(d.bag2 || []);
    vialBox.innerHTML = items.map(function (name) {
      var k = RANGE_FOR[name];
      if (k) return '<div class="vial"><img src="assets/img/' + ND.RANGE[k].img + '-s.webp" alt=""><span>' + short(name) + "</span></div>";
      return '<div class="vial vial--gen"><span>' + short(name) + "</span></div>";
    }).join("");
    vialEls = $$(".vial", vialBox);
    var lineItems = items.slice();
    if (d.bag2) lineItems = d.bag.concat(["Second bag: " + d.bag2.join(", ")]);
    linesEl.innerHTML = lineItems.map(function (n) { return "<li>" + short(n) + "</li>"; }).join("") +
      (d.sep.length ? "<li class=\"build__lsep\">Given separately: " + d.sep.map(function (s) { return short(s[0]); }).join(", ") + "</li>" : "");
    lines = $$("li", linesEl);
    sepEl.innerHTML = d.sep.length
      ? d.sep.map(function (s) { return '<div class="sep__item"><b>' + s[0] + " is given separately</b>" + (s[0].indexOf("Glutathione") === 0 ? "Never left in the bag. " + cap(s[1]) + "." : "As an " + s[1] + ".") + "</div>"; }).join("")
      : '<div class="sep__item"><b>Everything goes in the bag</b>All of it runs in one 500 mL bag, over 45 to 60 minutes.</div>';
    if (d.bag2) sepEl.innerHTML += '<div class="sep__item"><b>Given as two bags</b>' + d.bag2.join(", ") + " run in a second bag.</div>";
    sepEl.innerHTML += '<div class="sep__compact"><b>' + (d.sep.length ? "Given separately" : "All in one bag") + "</b>" +
      (d.sep.length ? d.sep.map(function (s) { return s[0].indexOf("Glutathione") === 0 ? short(s[0]) + " (slow IV push, or 100 mL saline over about 12 min)" : short(s[0]) + " (IM injection)"; }).join(" · ") : "Everything runs in one 500 mL bag over 45 to 60 minutes.") +
      (d.bag2 ? " · Second bag: " + d.bag2.join(", ") : "") + "</div>";
    $("[data-end-sep]").textContent = d.sep.length ? "Given separately: " + d.sep.map(function (s) { return short(s[0]) + (s[0].indexOf("Glutathione") === 0 ? " (slow IV push or 100 mL saline)" : " (IM)"); }).join(", ") + "." : "Everything runs in one 500 mL bag.";
    sr.textContent = d.name + ": " + lineItems.map(short).join(", ") + (d.sep.length ? ". Given separately: " + d.sep.map(function (s) { return s[0]; }).join(", ") : "") + ".";
    measure();
    if (reduce) renderBuild(1);
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  var target = { x: 0, y: 0 }, starts = [];
  function measure() {
    if (!bag || !vialEls.length) return;
    var saved = vialEls.map(function (v) { var t = v.style.transform; v.style.transform = "none"; return t; });
    var br = bag.getBoundingClientRect();
    target = { x: br.left + br.width / 2, y: br.top + br.height * 0.07 };
    starts = vialEls.map(function (v) { var r = v.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom, h: r.height }; });
    vialEls.forEach(function (v, i) { v.style.transform = saved[i]; });
  }

  ND.onChosen(function (id, why) {
    $$(".feel", grid).forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-feel") === id ? "true" : "false"); });
    var d = ND.byId(id);
    if (d && status) status.innerHTML = "Good choice to start from. Keep scrolling to watch your <b>" + d.name + "</b> being built. The doctor confirms it at your free consultation.";
    if (d) loadDrip(d.id);
  });

  // ---------------------------------------------------- progress helpers
  function prog(el) {
    var r = el.getBoundingClientRect(), vh = innerHeight, travel = r.height - vh;
    if (travel < 2) return clamp((vh - r.top) / (r.height + vh), 0, 1);
    return clamp(-r.top / travel, 0, 1);
  }

  // ---------------------------------------------------- hero
  var hStage = $(".hero__stage"), room = $(".hero__room"), back1 = $(".hero__back--1"), back2 = $(".hero__back--2"), head = $(".hero__head"), hbag = $(".hero__bag"), front = $(".hero__front"), light = $(".hero__light"), second = $(".hero__second"), hcopy = $(".hero__copy");
  var mx = 0, my = 0, tmx = 0, tmy = 0;
  if (fine && !reduce) addEventListener("pointermove", function (e) { tmx = e.clientX / innerWidth - 0.5; tmy = e.clientY / innerHeight - 0.5; }, { passive: true });
  function renderHero(p) {
    mx += (tmx - mx) * 0.08; my += (tmy - my) * 0.08;
    var vh = innerHeight;
    room.style.transform = "translate3d(" + (-mx * 10) + "px," + (-p * vh * 0.04 - my * 6) + "px,0) scale(" + (1.02 + p * 0.03) + ")";
    back1.style.transform = "translate3d(" + (-mx * 16) + "px," + (-p * vh * 0.07 - my * 8) + "px,0)";
    back2.style.transform = "translate3d(" + (-mx * 14) + "px," + (-p * vh * 0.06 - my * 7) + "px,0)";
    var r = ease(seg(p, 0.05, 0.6));
    var dx = small ? r * 18 : r * (innerWidth * 0.16);
    head.style.transform = "translate3d(" + (dx - mx * 22) + "px," + (r * (small ? vh * 0.05 : vh * 0.08) - my * 10) + "px,0) scale(" + (1 - r * 0.12) + ")";
    head.style.opacity = String(1 - r * 0.18);
    hbag.style.transform = "translate3d(" + (-mx * 30 - r * (small ? 0 : innerWidth * 0.015)) + "px," + (-p * vh * 0.12 - my * 14) + "px,0) scale(" + (1 + r * 0.05) + ")";
    front.style.transform = "translate3d(" + (-mx * 60) + "px," + (-p * vh * 0.42 - my * 24) + "px,0)";
    light.style.transform = "translate3d(" + (p * 80 + mx * 20) + "px,0,0)";
    var s = small ? ease(seg(p, 0.42, 0.62)) : ease(seg(p, 0.42, 0.72));
    second.style.opacity = String(s); second.style.transform = "translateY(" + ((1 - s) * 14) + "px)";
    hcopy.style.opacity = String(1 - seg(p, 0.3, 0.45) * (small ? 1 : 0));
    hcopy.style.visibility = small && p > 0.45 ? "hidden" : "visible";
    hStage.setAttribute("data-sc-verify-state", r.toFixed(2) + "/" + s.toFixed(2));
  }

  // ---------------------------------------------------- pathway
  var pSteps = $$(".path__steps li"), pList = $(".path__steps"), pStage = $(".path__stage");
  function renderPath(p) {
    var n = Math.floor(seg(p, 0.02, 0.8) * 6 + 0.25);
    if (p > 0.02) n = Math.max(1, n);
    pSteps.forEach(function (li, i) { li.classList.toggle("is-on", i < n); });
    pList.style.setProperty("--path", (Math.max(0, n - 1) / 5).toFixed(3));
    pStage.setAttribute("data-sc-verify-state", String(n));
  }

  // ---------------------------------------------------- the build
  function renderBuild(p) {
    if (!current) return;
    var n = vialEls.length;
    var drop0 = 0.06, drop1 = 0.5, w = (drop1 - drop0) / Math.max(1, n);
    var filled = 0;
    vialEls.forEach(function (v, i) {
      var t = seg(p, drop0 + i * w, drop0 + (i + 0.92) * w), s = starts[i];
      if (!s) return;
      var dx = target.x - s.x, dy = target.y - s.y + s.h * 0.15;
      var fall = t * t;
      v.style.transform = "translate3d(" + (dx * ease(t)) + "px," + (dy * fall) + "px,0) scale(" + (1 - t * 0.45) + ")";
      v.style.opacity = String(t < 0.82 ? 1 : 1 - (t - 0.82) / 0.18);
      v.style.setProperty("--lab", String(1 - Math.min(1, t * 4)));
      filled += t;
    });
    var fill = n ? filled / n : seg(p, drop0, drop1);
    bag.style.setProperty("--fill", fill.toFixed(3));
    var labO = seg(p, 0.46, 0.54);
    bag.style.setProperty("--lab-o", labO.toFixed(3));
    var ls = seg(p, 0.52, 0.74), shown = Math.round(ls * lines.length);
    lines.forEach(function (li, i) { li.classList.toggle("is-on", i < shown); });
    stage.style.setProperty("--sep-o", seg(p, 0.66, 0.74).toFixed(3));
    var flood = seg(p, 0.78, 0.9);
    stage.style.setProperty("--flood", flood.toFixed(3));
    stage.classList.toggle("is-flooded", flood > 0.5);
    body.classList.toggle("nd-tinted", p > 0.8);
    var endO = seg(p, 0.86, 0.95);
    stage.style.setProperty("--end-o", endO.toFixed(3));
    endEl.classList.toggle("is-on", endO > 0.02);
    if (small) bag.style.setProperty("--lab-o", (labO * (1 - endO)).toFixed(3));
    if (small) stage.style.setProperty("--sep-o", (seg(p, 0.66, 0.72) * (1 - seg(p, 0.8, 0.86))).toFixed(3));
    var stepIdx = p < 0.5 ? 0 : p < 0.66 ? 1 : p < 0.8 ? 2 : 3;
    $$(".build__steps li").forEach(function (li, i) { li.classList.toggle("is-on", i <= stepIdx); });
    if (mstep) mstep.textContent = $$(".build__steps li")[stepIdx].textContent;
    stage.setAttribute("data-sc-verify-state", [fill.toFixed(2), shown, flood.toFixed(2), endO.toFixed(2)].join("/"));
  }

  // ---------------------------------------------------- day timeline
  var dSteps = $$(".day__steps li"), dTrack = $(".day__track"), dStage = $(".day__stage");
  function renderDay(p) {
    var t = seg(p, 0.05, 0.85);
    dTrack.style.setProperty("--day", t.toFixed(3));
    dSteps.forEach(function (li, i) { li.classList.toggle("is-on", t >= i / 5 - 0.001); });
    dStage.setAttribute("data-sc-verify-state", t.toFixed(2));
  }

  // ---------------------------------------------------- formulary index for stagger
  $$(".fcard").forEach(function (c, i) { c.style.setProperty("--i", String(i)); });

  // ---------------------------------------------------- loop
  var last = {};
  function frame() {
    if (!reduce) {
      var ph = prog(hero); renderHero(ph);
      var pp = prog(path); if (pp !== last.p) { renderPath(pp); last.p = pp; }
      var pb = prog(build); if (pb !== last.b) { renderBuild(pb); last.b = pb; }
      var pd = prog(day); if (pd !== last.d) { renderDay(pd); last.d = pd; }
    }
    requestAnimationFrame(frame);
  }
  addEventListener("resize", function () { measure(); last = {}; });

  // ---------------------------------------------------- go
  ScrollCraft.mount(body);
  loadDrip(ND.chosen() || "executive-energy");
  var pre = ND.chosen(); if (pre) $$(".feel", grid).forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-feel") === pre ? "true" : "false"); });
  if (reduce) {
    renderBuild(1);
    body.classList.add("nd-tinted");
  } else {
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { measure(); last = {}; });
    addEventListener("load", function () { measure(); last = {}; });
    requestAnimationFrame(frame);
  }
})();

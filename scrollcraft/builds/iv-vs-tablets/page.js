/* NutriDrip v3 prototype, IV vs Tablets: page-local behaviour, adapted from
   the client's ivtabs.js and site.js. The engine stays untouched. One dose
   travels each route; the tablet's level drains stage by stage while the IV's
   stays full. Differences from the artifact are marked "v3:". */
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
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function store(k) {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }
  var LEVELS = ["Full dose", "A little less", "Less again", "Part of the dose"];
  try {
    LEVELS = JSON.parse(body.getAttribute("data-levels")) || LEVELS;
  } catch (e) {
    /* keep the defaults */
  }

  // ---------------------------------------------------- prepare the act
  var act = $(".routes"),
    stage = $(".routes__stage");
  if (reduce) {
    act.setAttribute("data-sc-act", "flow");
    act.removeAttribute("data-sc-span");
    stage.classList.add("sc-stage", "nd-still");
    body.classList.add("is-static");
  } else if (small) {
    // v3: the phone span comes from the markup (--span-m), the number the CSS
    // reserves from first paint, so mounting moves nothing.
    act.setAttribute("data-sc-span", getComputedStyle(act).getPropertyValue("--span-m").trim());
  }

  // ---------------------------------------------------- the drip picked on the landing
  // v3: the slip shows it, as on the landing; with none, the client's "Drip to
  // be suggested" and the range across every drip stay.
  var picked = null,
    slug = store("nd-drip");
  (window.ND_DRIPS || []).forEach(function (d) {
    if (d.slug === slug) picked = d;
  });
  if (picked) {
    body.style.setProperty("--tint", picked.tint);
    $$("[data-chosen-name]").forEach(function (el) {
      el.textContent = picked.name;
    });
    $$("[data-chosen-duration]").forEach(function (el) {
      el.textContent = picked.duration;
    });
    $$("[data-chosen-price]").forEach(function (el) {
      el.textContent = "₹" + Number(picked.price).toLocaleString("en-IN");
    });
    $$("a[data-quiz-link]").forEach(function (a) {
      a.setAttribute("href", "/quiz?drip=" + encodeURIComponent(picked.slug));
    });
    var sb = $("[data-slip-body]");
    if (sb) sb.innerHTML = sb.innerHTML.replace("Not sure which drip?", "Not sure about " + esc(picked.name) + "?");
  }

  // ---------------------------------------------------- menu (the client's page menu)
  var ledger = $("#nd-ledger"),
    mbtn = $("[data-menu-btn]");
  if (ledger && mbtn) {
    var toggle = function (open) {
      var on = open === undefined ? !ledger.classList.contains("is-open") : open;
      ledger.classList.toggle("is-open", on);
      mbtn.setAttribute("aria-expanded", on ? "true" : "false");
      if (on) {
        var f = $("a", ledger);
        if (f) f.focus({ preventScroll: true });
      }
    };
    mbtn.addEventListener("click", function (e) {
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
        mbtn.focus();
      }
    });
  }

  // ---------------------------------------------------- phone sticky bar
  // v3: hidden while the routes act holds the screen: its end carries the
  // same action, and the bar would cover the bottom of the stage.
  var sticky = $(".nd-sticky");
  function stickyTick() {
    if (!sticky) return;
    var after = scrollY > innerHeight * 0.6;
    var slip = $("#book"),
      sr = slip.getBoundingClientRect(),
      atSlip = sr.top < innerHeight * 0.8 && sr.bottom > 0;
    var ar = act.getBoundingClientRect(),
      inAct = ar.top < innerHeight * 0.5 && ar.bottom > innerHeight * 0.5;
    sticky.classList.toggle("is-on", after && !atSlip && !inAct);
  }
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      stickyTick();
    });
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);

  // ---------------------------------------------------- the routes
  window.ND_SC = ScrollCraft.mount(doc.getElementById("sc-root"));

  var routes = $$(".route").map(function (r) {
    var stops = $$(".route__path li", r).map(function (li) {
      return {
        el: li,
        at: +li.getAttribute("data-at"),
        drop: li.hasAttribute("data-drop") ? +li.getAttribute("data-drop") : null,
      };
    });
    return {
      el: r,
      stops: stops,
      dose: $(".route__dose", r),
      meter: $(".route__meter span", r),
      lv: $("[data-lv]", r),
      path: $(".route__path", r),
    };
  });
  var endEl = $(".routes__end");

  // v3: where each node's centre sits inside its <li>, read from the node's
  // own style (::before), not the client's per-layout constants.
  var node = { x: 0, y: 0 };
  function measureNode() {
    var li = $(".route__path li");
    if (!li) return;
    var cs = getComputedStyle(li, "::before"),
      tr = (cs.translate && cs.translate !== "none" ? cs.translate : "0 0").split(" ");
    node = {
      x: parseFloat(cs.left) + parseFloat(cs.width) / 2 + (parseFloat(tr[0]) || 0),
      y: parseFloat(cs.top) + parseFloat(cs.height) / 2 + (parseFloat(tr[1] || tr[0]) || 0),
    };
  }
  // A node's centre as drawn (its stop may be gliding), inside the route,
  // where the dose is positioned.
  function centre(R, s) {
    var r = s.el.getBoundingClientRect(),
      o = R.el.getBoundingClientRect();
    return [r.left - o.left + node.x, r.top - o.top + node.y];
  }
  // The line from the first node's centre to the last's, along whichever axis
  // the path runs (down on desktop, across on a phone).
  function measureLine(R) {
    var a = centre(R, R.stops[0]),
      b = centre(R, R.stops[R.stops.length - 1]);
    var pr = R.path.getBoundingClientRect(),
      rr = R.el.getBoundingClientRect();
    var across = Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]),
      o = [pr.left - rr.left, pr.top - rr.top];
    var l0 = across ? a[0] - o[0] : a[1] - o[1],
      lh = across ? b[0] - a[0] : b[1] - a[1],
      lc = across ? a[1] - o[1] : a[0] - o[0];
    var key = l0 + "/" + lh + "/" + lc;
    if (R.lineKey === key) return;
    R.lineKey = key;
    R.path.style.setProperty("--l0", l0 + "px");
    R.path.style.setProperty("--lh", lh + "px");
    R.path.style.setProperty("--lc", lc + "px");
  }
  function alignNotes() {
    $$(".route__path li").forEach(function (li) {
      var p = $("p", li);
      p.style.left = small && !reduce ? -li.offsetLeft + "px" : "";
    });
  }

  function place(R, t) {
    // t: 0..1 along this route's path. The dose sits between stop nodes.
    var stops = R.stops,
      a = stops[0],
      b = stops[stops.length - 1];
    for (var i = 0; i < stops.length - 1; i++)
      if (t >= stops[i].at && t <= stops[i + 1].at) {
        a = stops[i];
        b = stops[i + 1];
        break;
      }
    if (t > stops[stops.length - 1].at) a = b = stops[stops.length - 1];
    var level = 1,
      now = 0;
    stops.forEach(function (s, i) {
      if (t >= s.at - 0.001) {
        now = i;
        if (s.drop !== null) level = s.drop;
      }
    });
    var state = stops
      .map(function (s, i) {
        return i === now ? "N" : t >= s.at - 0.001 ? "o" : "-";
      })
      .join("");
    if (state !== R.state) {
      // v3: only the current stop shows its note, so every change of stop
      // reflows the path, and the client's nodes jumped (60 px at 1440, the
      // moment the dose arrived). Each stop now glides from where it was
      // drawn to where it lands (FLIP), and the dose and line follow the
      // drawn positions.
      var before = stops.map(function (s) {
        return s.el.getBoundingClientRect().top;
      });
      stops.forEach(function (s, i) {
        s.el.classList.toggle("is-on", state.charAt(i) !== "-");
        s.el.classList.toggle("is-now", i === now);
        s.el.style.transition = "none";
        s.el.style.transform = "";
      });
      var moved = false;
      stops.forEach(function (s, i) {
        var d = before[i] - s.el.getBoundingClientRect().top;
        if (R.state && Math.abs(d) > 0.5) {
          s.el.style.transform = "translateY(" + d + "px)";
          moved = true;
        }
      });
      if (moved) {
        void R.path.offsetWidth;
        stops.forEach(function (s) {
          s.el.style.transition = GLIDE;
          s.el.style.transform = "";
        });
        glideUntil = performance.now() + GLIDE_MS + 40;
      } else
        stops.forEach(function (s) {
          s.el.style.transition = "";
        });
      R.state = state;
    }
    measureLine(R);
    var k = a === b ? 0 : (t - a.at) / (b.at - a.at),
      ca = centre(R, a),
      cb = centre(R, b);
    // v3: the translate property, not transform: the dot shrinks with the
    // level through `scale`, which multiplies a transform's translate(), so
    // the client's dot drifted off its node as the dose drained (33 px by
    // Bloodstream). The translate property applies before the scale.
    R.dose.style.translate = ca[0] + (cb[0] - ca[0]) * k + "px " + (ca[1] + (cb[1] - ca[1]) * k) + "px";
    // v3: the meter drains along its own length, read from its shape. The
    // client chose by screen width alone, so the phone's still (reduced
    // motion) layout squashed its across meter into a sliver.
    var m = R.meter.parentNode;
    R.meter.style.transform = (m.offsetWidth > m.offsetHeight ? "scaleX(" : "scaleY(") + level + ")";
    R.dose.style.setProperty("--lvl", String(level));
    R.lv.textContent = level > 0.99 ? LEVELS[0] : level > 0.8 ? LEVELS[1] : level > 0.55 ? LEVELS[2] : LEVELS[3];
    return level;
  }
  var GLIDE_MS = 320,
    GLIDE = "transform " + GLIDE_MS + "ms cubic-bezier(.2, .7, .2, 1), color 240ms cubic-bezier(.2, .7, .2, 1)",
    glideUntil = 0;
  function render(p) {
    var t = clamp(p / 0.82, 0, 1);
    var tl = place(routes[0], t);
    var il = place(routes[1], clamp(t * 1.6, 0, 1));
    var e = clamp((p - 0.82) / 0.1, 0, 1);
    endEl.style.opacity = String(e);
    endEl.style.visibility = e > 0.01 ? "visible" : "hidden";
    stage.setAttribute("data-sc-verify-state", t.toFixed(2) + "/" + tl + "/" + il + "/" + e.toFixed(2));
  }
  function prog() {
    var r = act.getBoundingClientRect(),
      tr = r.height - innerHeight;
    return tr < 2 ? 1 : clamp(-r.top / tr, 0, 1);
  }

  // v3: the end's quiz link only exists once the end shows. A keyboard user
  // arriving on it lands on the finished act, not on a link still at 0.
  endEl.addEventListener("focusin", function () {
    if (reduce) return;
    var top = act.getBoundingClientRect().top + scrollY;
    scrollTo({ top: top + 0.96 * (act.offsetHeight - innerHeight), behavior: "instant" });
  });

  measureNode();
  alignNotes();
  var last = -1;
  function relayout() {
    measureNode();
    alignNotes();
    routes.forEach(function (R) {
      R.lineKey = null;
    });
    last = -1;
    if (reduce) render(1);
  }
  addEventListener("resize", relayout);
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(relayout);
  onScroll();
  if (reduce) {
    render(1);
  } else {
    // While a stop glides the dose and line keep following it, scroll or not.
    (function loop() {
      var p = prog();
      if (p !== last || performance.now() < glideUntil) {
        render(p);
        last = p;
      }
      requestAnimationFrame(loop);
    })();
  }
  body.classList.add("nd-js");
})();

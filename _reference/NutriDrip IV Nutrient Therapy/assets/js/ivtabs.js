/* IV vs Tablets: one dose travels each route; the tablet's level drains
   stage by stage while the IV's stays full. */
(function () {
  "use strict";
  var doc = document, reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var small = matchMedia("(max-width: 860px)").matches;
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  var act = $(".routes"), stage = $(".routes__stage");
  if (reduce) { act.setAttribute("data-sc-act", "flow"); act.removeAttribute("data-sc-span"); stage.classList.add("sc-stage", "nd-still"); doc.body.classList.add("is-static"); }
  if (small && !reduce) act.setAttribute("data-sc-span", "4.6");
  ScrollCraft.mount(doc.body);

  var routes = $$(".route").map(function (r) {
    var stops = $$(".route__path li", r).map(function (li) { return { el: li, at: +li.getAttribute("data-at"), drop: li.hasAttribute("data-drop") ? +li.getAttribute("data-drop") : null }; });
    return { el: r, tab: r.getAttribute("data-route") === "tab", stops: stops, dose: $(".route__dose", r), meter: $(".route__meter span", r), lv: $("[data-lv]", r), path: $(".route__path", r) };
  });
  var endEl = $(".routes__end");
  function alignNotes() {
    $$(".route__path li").forEach(function (li) { var p = $("p", li); p.style.left = small && !reduce ? (-li.offsetLeft) + "px" : ""; });
  }
  alignNotes(); addEventListener("resize", alignNotes);

  function place(R, t) {
    // t: 0..1 along this route's path. Position the dose between stop nodes.
    var stops = R.stops, a = stops[0], b = stops[stops.length - 1];
    for (var i = 0; i < stops.length - 1; i++) if (t >= stops[i].at && t <= stops[i + 1].at) { a = stops[i]; b = stops[i + 1]; break; }
    if (t > stops[stops.length - 1].at) a = b = stops[stops.length - 1];
    var k = a === b ? 0 : (t - a.at) / (b.at - a.at);
    var rr = R.el.getBoundingClientRect(), ra = a.el.getBoundingClientRect(), rb = b.el.getBoundingClientRect();
    var rem = parseFloat(getComputedStyle(doc.documentElement).fontSize);
    function c(r) { return small ? [r.left - rr.left + 9.5, r.top - rr.top - 2 * rem + 9.5] : [r.left - rr.left - 2.4 * rem + 11.5, r.top - rr.top + 14.5]; }
    var ca = c(ra), cb = c(rb);
    R.dose.style.transform = "translate(" + (ca[0] + (cb[0] - ca[0]) * k) + "px," + (ca[1] + (cb[1] - ca[1]) * k) + "px)";
    var level = 1, now = 0;
    stops.forEach(function (s, i) { var on = t >= s.at - 0.001; s.el.classList.toggle("is-on", on); if (on) { now = i; if (s.drop !== null) level = s.drop; } });
    stops.forEach(function (s, i) { s.el.classList.toggle("is-now", i === now); });
    R.meter.style.transform = (small ? "scaleX(" : "scaleY(") + level + ")";
    R.dose.style.setProperty("--lvl", String(level));
    R.lv.textContent = level > 0.99 ? "Full dose" : level > 0.8 ? "A little less" : level > 0.55 ? "Less again" : "Part of the dose";
    return level;
  }
  function render(p) {
    var t = clamp(p / 0.82, 0, 1);
    var tl = place(routes[0], t);
    var il = place(routes[1], clamp(t * 1.6, 0, 1));
    var e = clamp((p - 0.82) / 0.1, 0, 1);
    endEl.style.opacity = String(e); endEl.style.visibility = e > 0.01 ? "visible" : "hidden";
    stage.setAttribute("data-sc-verify-state", t.toFixed(2) + "/" + tl + "/" + il + "/" + e.toFixed(2));
  }
  function prog() { var r = act.getBoundingClientRect(), tr = r.height - innerHeight; return tr < 2 ? 1 : clamp(-r.top / tr, 0, 1); }
  if (reduce) { render(1); return; }
  var last = -1;
  (function loop() { var p = prog(); if (p !== last) { render(p); last = p; } requestAnimationFrame(loop); })();
  addEventListener("resize", function () { last = -1; });
})();

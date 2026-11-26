/* Section 3 option previews (not part of the build): one eased scroll loop for a pinned act, and the data it shows.
   The data is copied from ../app.js (Myers' Revive, the quiz's five parts, the four decisions); in the build it comes
   from the drip data, so any drip the visitor picked would show. */
window.OPT = (function () {
  "use strict";
  var clamp = function (v, a, b) {
    return Math.min(b, Math.max(a, v));
  };
  var ss = function (x) {
    x = clamp(x, 0, 1);
    return x * x * (3 - 2 * x);
  };
  var lerp = function (a, b, t) {
    return a + (b - a) * t;
  };
  var pins = [],
    raf = 0,
    last = 0;
  function measure() {
    var y = window.scrollY,
      vh = innerHeight;
    pins.forEach(function (p) {
      var r = p.el.getBoundingClientRect();
      p.top = r.top + y;
      p.len = Math.max(1, r.height - vh);
      if (p.resize) p.resize();
      p.dirty = true;
    });
  }
  function loop(now) {
    raf = 0;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    var y = window.scrollY,
      k = 1 - Math.exp(-dt * 9),
      busy = false;
    pins.forEach(function (p) {
      p.target = clamp((y - p.top) / p.len, 0, 1);
      var d = p.target - p.cur;
      p.cur = Math.abs(d) < 0.0003 ? p.target : p.cur + d * k;
      if (p.cur !== p.target || p.dirty) {
        p.fn(p.cur);
        p.dirty = false;
      }
      if (p.cur !== p.target) busy = true;
    });
    if (busy) raf = requestAnimationFrame(loop);
    else last = 0;
  }
  function kick() {
    if (!raf) raf = requestAnimationFrame(loop);
  }
  addEventListener("scroll", kick, { passive: true });
  addEventListener("resize", function () {
    measure();
    kick();
  });
  function pin(el, fn, resize) {
    var p = { el: el, fn: fn, resize: resize, cur: 0, target: 0, top: 0, len: 1, dirty: true };
    pins.push(p);
    measure();
    p.cur = p.target = clamp((window.scrollY - p.top) / p.len, 0, 1);
    fn(p.cur);
    kick();
    if (document.fonts && document.fonts.ready)
      document.fonts.ready.then(function () {
        measure();
        kick();
      });
    return p;
  }
  // item: [name, dose, form, separate?, note]
  var DRIP = {
    name: "Myers’ Revive",
    base: "Normal saline 0.9% 500 mL",
    time: "45–60 min",
    tint: "#7B5BD6",
    items: [
      ["Ascorbic acid", "7,500 mg", "vial"],
      ["Magnesium sulphate", "1,000 mg", "ampoule"],
      ["B-complex", "2 mL", "vial"],
      ["Cyanocobalamin (B12)", "1,000 mcg", "ampoule"],
      ["Calcium gluconate", "500 mg", "ampoule"],
      ["Pyridoxine", "100 mg", "ampoule"],
    ],
  };
  var QUIZ = [
    ["Sleep & energy", 3],
    ["Diet & hydration", 4],
    ["Lifestyle", 5],
    ["How you feel", 4],
    ["Screening: pregnancy, kidney and heart, allergies, medications, other conditions", 5],
  ];
  // [word, colour, line]: the physician's four possible answers, as the page says them
  var DECIDE = [
    ["Declines", "var(--stop)", "“A decline is not lost revenue to us, it is the product working.”"],
    ["Asks for more", "var(--warn)", "Or asks for more first."],
    ["Changes the doses", "var(--warn)", "Or changes the doses."],
    ["Approves", "var(--ok)", "Or approves the protocol. Then the bag."],
  ];
  var NOT =
    "<b>Not for everyone.</b> IV therapy is unsuitable during pregnancy, in renal or cardiac failure, and with certain drug interactions. The quiz screens for these and a physician can decline.";
  var IRON = "Iron Restore, for one, needs a ferritin result from the last 90 days before a physician can approve it.";
  var LEDE =
    "Every protocol is read and signed by a physician registered with the Karnataka Medical Council. Their name and number are on your report. Nothing is given on a quiz score alone.";
  return {
    clamp: clamp,
    ss: ss,
    lerp: lerp,
    pin: pin,
    measure: measure,
    kick: kick,
    DRIP: DRIP,
    QUIZ: QUIZ,
    DECIDE: DECIDE,
    NOT: NOT,
    IRON: IRON,
    LEDE: LEDE,
    quizTotal: QUIZ.reduce(function (s, q) {
      return s + q[1];
    }, 0),
  };
})();

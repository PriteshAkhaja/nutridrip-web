/* The drip assembles itself: the signature move for / and /drips/[slug].
   Page-local; the engine is untouched. One pinned act. Its progress p is the
   engine's own mapping for a pinned act, (scrollY - top) / (height - vh),
   computed here so the choreography is a pure function of p and the layout.
   Writes transforms, opacity and a few custom properties; nothing else.

   Score (p):
     0    .07  hero: the live headline over the drip's containers at depth
     .05  .20  spread: they settle into one row; names and doses arrive
     .20  .40  converge: one at a time, each on its own curve, to the centre
     .36  .48  collapse: each shrinks into the point; the ring closes; ink comes up
     .48  .58  emerge: the bag grows out of the point, label already printed
     .56  .68  fill: the carrier rises to the drip's volume, with its number
     .68  .78  turn: one slight swing, a light band across the plastic
     .76  .86  callouts: two cards from the lower corners
     .85  1    grounded: the room rises, the bag lands on the stand's hook,
               the evening time, the quiz                                    */
(function () {
  "use strict";
  var act = document.querySelector("[data-assembly]");
  if (!act) return;
  var data = JSON.parse(document.getElementById("page-data").textContent || "{}");
  var drip = data.drip,
    A = data.assets;
  if (!drip || !A) return;
  var stage = act.querySelector(".asm__stage");
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fineQ = matchMedia("(hover: hover) and (pointer: fine)");

  var $ = function (s, r) {
    return (r || stage).querySelector(s);
  };
  var clamp = function (v, a, b) {
    return v < a ? a : v > b ? b : v;
  };
  var lerp = function (a, b, t) {
    return a + (b - a) * t;
  };
  var span = function (p, a, b) {
    return clamp((p - a) / (b - a), 0, 1);
  };
  var easeOut = function (t) {
    return 1 - Math.pow(1 - t, 3);
  };
  var inOut = function (t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  var fmt = function (n) {
    return Number(n).toLocaleString("en-IN");
  };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];

  // ------------------------------------------------------------- the words
  var inBag = drip.items.filter(function (i) {
    return !i.separate;
  });
  var items = drip.items.slice(); // every container shown in the spread
  $("[data-count-title]").textContent =
    (WORDS[inBag.length] || inBag.length) + " ingredient" + (inBag.length === 1 ? "." : "s.");
  $("[data-drip-name]").textContent = drip.name.slice(-1) === "." ? drip.name : drip.name + ".";
  var mins = drip.durationToMin ? drip.durationMin + " to " + drip.durationToMin + " min" : drip.durationMin + " min";
  $("[data-card-a]").textContent = mins + ", given at home by a council-registered nurse.";
  $("[data-zone-count]").textContent = data.zones;
  $("[data-last-slot]").textContent = twelveHour(data.lastSlot);
  $("[data-formula]").innerHTML =
    inBag
      .map(function (i) {
        return "<li>" + esc(i.name) + ", " + fmt(i.dose) + " " + esc(i.unit) + "</li>";
      })
      .join("") +
    "<li>" +
    esc(drip.carrier.name) +
    ", " +
    fmt(drip.carrier.dose) +
    " " +
    esc(drip.carrier.unit) +
    "</li>";
  var caps = $("[data-captions]");
  caps.innerHTML = items
    .map(function (i) {
      return (
        "<li><b>" +
        esc(i.name) +
        "</b><span>" +
        fmt(i.dose) +
        " " +
        esc(i.unit) +
        "</span>" +
        (i.separate ? "<em>Given separately</em>" : "") +
        "</li>"
      );
    })
    .join("");
  var capEls = [].slice.call(caps.children);

  function twelveHour(t) {
    var h = +String(t).split(":")[0],
      m = String(t).split(":")[1] || "00";
    return (h % 12 || 12) + ":" + m + " " + (h < 12 ? "am" : "pm");
  }

  // --------------------------------------------------------- the objects
  function vars(el, m) {
    el.style.setProperty("--w", m.size.w);
    el.style.setProperty("--h", m.size.h);
  }
  function px(el, x, y, w, h) {
    el.classList.add("px");
    el.style.setProperty("--x", x);
    el.style.setProperty("--y", y);
    el.style.setProperty("--pw", w);
    el.style.setProperty("--ph", h);
    return el;
  }
  function img(src, cls) {
    var i = new Image();
    i.src = src;
    i.alt = "";
    i.decoding = "async";
    if (cls) i.className = cls;
    return i;
  }

  // One container in its form from the stock lots. Ampoule and Vial have
  // stills; any other form falls back to the vial rather than to nothing.
  function container(item) {
    var form = item.form === "Ampoule" ? "ampoule" : "vial";
    var m = A[form];
    var el = document.createElement("div");
    el.className = "obj ctr ctr--" + form;
    vars(el, m);
    if (m.shadow)
      el.append(px(img("assets/" + form + "-shadow.webp", "on-light"), m.shadow.x, m.shadow.y, m.shadow.w, m.shadow.h));
    el.append(img("assets/" + form + ".webp", "full on-light"), img("assets/" + form + "-dark.webp", "full on-dark"));
    var lab = px(
      document.createElement("div"),
      m.object.x0,
      m.label.y0,
      m.object.x1 - m.object.x0,
      m.label.y1 - m.label.y0
    );
    lab.className += " clabel";
    lab.style.setProperty("--fs", form === "ampoule" ? 25 : 44);
    lab.innerHTML = "<span>" + esc(item.name) + "</span>";
    el.append(lab, img("assets/" + form + "-sheen.webp", "full"));
    return { el: el, m: m, form: form, item: item };
  }

  // The bag: the empty and full plates for both grounds, the photograph's own
  // meniscus, the printed label and scale, the bag's sheen above them, and
  // the turn's light band.
  function bag() {
    var m = A.bag,
      f = m.fill;
    var el = document.createElement("div");
    el.className = "obj bag";
    vars(el, m);
    el.style.setProperty("--men", f.meniscus);
    ["", "-dark"].forEach(function (g) {
      var layer = document.createElement("div");
      layer.className = "layer " + (g ? "on-dark" : "on-light");
      var clip = document.createElement("div");
      clip.className = "clip";
      clip.append(img("assets/bag" + g + ".webp", "full"));
      var men = px(img("assets/bag" + g + "-meniscus.webp", "men"), f.strip.x, f.strip.y, f.strip.w, f.strip.h);
      layer.append(img("assets/bag" + g + "-empty.webp", "full"), clip, men);
      el.append(layer);
    });
    // The lamp-lit room's version: the full bag, rim light warmed to the lamp.
    var roomL = document.createElement("div");
    roomL.className = "layer room";
    roomL.append(img("assets/bag-room.webp", "full"));
    el.append(roomL);
    // The label: inside the welded seam, below the meniscus.
    var L = { x0: 146, x1: 626, y0: m.meniscus + 64, y1: 1030 };
    var label = px(document.createElement("div"), L.x0, L.y0, L.x1 - L.x0, L.y1 - L.y0);
    label.className += " label";
    label.innerHTML =
      '<div class="label__band"><span class="mark"></span><span class="word">NutriDrip</span></div>' +
      '<div class="label__field"><p class="label__name">' +
      esc(drip.name) +
      "</p>" +
      '<p class="label__carrier">In ' +
      esc(drip.carrier.name) +
      ", " +
      fmt(drip.carrier.dose) +
      " " +
      esc(drip.carrier.unit) +
      "</p>" +
      '<div class="label__rule"></div><p class="label__head">Composition</p><ul class="label__list">' +
      inBag
        .map(function (i) {
          return "<li><span>" + esc(i.name) + "</span><span>" + fmt(i.dose) + " " + esc(i.unit) + "</span></li>";
        })
        .join("") +
      '</ul><div class="label__foot"><span class="label__route">For intravenous use</span><span class="label__vol">' +
      fmt(drip.volumeMl) +
      " ml</span></div></div>";
    el.append(label);
    // The printed graduation scale: the full volume at the meniscus.
    var S = { x0: 632, x1: 700, y0: m.meniscus, y1: m.body.y1 };
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    px(svg, S.x0, S.y0 - 14, S.x1 - S.x0, S.y1 - S.y0 + 28);
    svg.setAttribute("viewBox", "0 -14 " + (S.x1 - S.x0) + " " + (S.y1 - S.y0 + 28));
    svg.classList.add("scale");
    var vol = drip.volumeMl,
      per = (S.y1 - S.y0) / vol,
      g = "";
    for (var v = vol; v >= 50; v -= 50) {
      var y = (vol - v) * per,
        major = v % 100 === 0;
      g +=
        '<line x1="' +
        (S.x1 - S.x0 - (major ? 30 : 18)) +
        '" x2="' +
        (S.x1 - S.x0) +
        '" y1="' +
        y +
        '" y2="' +
        y +
        '" stroke="currentColor" stroke-width="' +
        (major ? 3 : 2) +
        '"/>';
      if (major)
        g +=
          '<text x="' +
          (S.x1 - S.x0 - 36) +
          '" y="' +
          (y + 7) +
          '" text-anchor="end" font-family="Noto Sans Mono, monospace" font-weight="500" font-size="20" fill="currentColor">' +
          v +
          "</text>";
    }
    svg.innerHTML = g;
    el.append(svg, img("assets/bag-sheen.webp", "full"));
    var sw = px(document.createElement("div"), m.body.x0, m.body.y0, m.body.x1 - m.body.x0, m.body.y1 - m.body.y0);
    sw.className += " sweep";
    sw.innerHTML = "<i></i>";
    el.append(sw);
    return { el: el, m: m, band: sw.firstChild };
  }

  var glass = $(".asm__glass");
  var C = items.map(container);
  C.forEach(function (c) {
    glass.append(c.el);
  });
  var B = bag();
  $(".asm__bag").append(B.el);
  var ring = $(".asm__ring"),
    point = $(".asm__point"),
    ink = $(".asm__ink"),
    room = $(".asm__room");
  var roomImg = $(".asm__room-img");
  var hero = $(".asm__hero"),
    title = $("[data-count-title]"),
    one = $(".asm__one");
  var readout = $(".asm__readout"),
    num = $("[data-fill-num]");
  var cardA = $(".asm__card--a"),
    cardB = $(".asm__card--b"),
    grounded = $(".asm__grounded");

  // The room photograph (out/room-2.png, kie.ai) has a real IV stand. Its
  // measurements, in the photograph's own pixels: the pole, the bottom of the
  // left hook's curl (where the bag's hanging hole goes), and its scale (the
  // hook stands about 1.75 m above the floor, 1,174 px: 6.7 px per cm).
  var ROOM = { w: 2720, h: 1530, pole: 1828, hook: { x: 1737, y: 266 }, pxPerCm: 6.7 };
  // A 500 ml bag, tab to port caps, is about 27 cm.
  var BAG_CM = 27;

  // -------------------------------------------------------------- layout
  var G = null;
  function layout() {
    var W = stage.clientWidth,
      H = stage.clientHeight,
      phone = W <= 860;
    var hdr = phone ? 68 : 74,
      gut = phone ? 24 : 40;
    var g = { W: W, H: H, phone: phone, hdr: hdr, gut: gut };
    var vial = A.vial,
      objH = function (m) {
        return m.object.y1 - m.object.y0;
      };
    var n = items.length;
    // Containers share one scale: they were shot together, at true size.
    var Hv = phone ? clamp(H * 0.12, 80, 118) : clamp(H * 0.2, 120, 190);
    var slots = [];
    if (phone) {
      var rows = Math.ceil(n / 2),
        top = H * 0.29,
        bottom = H * 0.97,
        rowH = (bottom - top) / rows;
      Hv = Math.min(Hv, (rowH - 58) / 1.2);
      for (var i = 0; i < n; i++) {
        var r = Math.floor(i / 2),
          c = i % 2,
          last = i === n - 1 && n % 2;
        slots.push({ x: last ? W * 0.5 : W * (c ? 0.72 : 0.28), base: top + (r + 1) * rowH - 52 });
      }
    } else {
      var slotW = Math.min(200, (W - 2 * gut - 40) / n);
      for (var j = 0; j < n; j++) slots.push({ x: W / 2 + (j - (n - 1) / 2) * slotW, base: H * 0.74 });
    }
    g.k = Hv / objH(vial);
    // Hero poses: at three depths around the headline (right on a desk, below
    // it on a phone). [x, y, scale, rotate, opacity] in stage fractions.
    var HERO = phone
      ? [
          [0.2, 0.8, 0.95, -8, 1],
          [0.44, 0.73, 0.7, 10, 0.8],
          [0.66, 0.85, 1.05, 6, 1],
          [0.86, 0.74, 0.72, -12, 0.85],
          [0.1, 0.94, 0.6, 14, 0.6],
          [0.52, 0.96, 0.58, -6, 0.65],
          [0.92, 0.93, 0.6, 8, 0.6],
          [0.32, 0.97, 0.5, -10, 0.5],
          [0.76, 0.98, 0.5, 12, 0.5],
        ]
      : [
          [0.62, 0.42, 1.05, -6, 1],
          [0.79, 0.27, 0.72, 10, 0.78],
          [0.9, 0.63, 1.28, 8, 1],
          [0.71, 0.73, 0.86, -12, 0.92],
          [0.54, 0.8, 0.62, 14, 0.62],
          [0.94, 0.2, 0.55, -16, 0.55],
          [0.58, 0.17, 0.5, 20, 0.5],
          [0.84, 0.88, 0.66, -8, 0.7],
          [0.48, 0.52, 0.5, 6, 0.45],
        ];
    C.forEach(function (c, i) {
      var m = c.m;
      c.el.style.setProperty("--s", g.k);
      var ocx = ((m.object.x0 + m.object.x1) / 2) * g.k,
        ocy = ((m.object.y0 + m.object.y1) / 2) * g.k;
      c.el.style.transformOrigin = ocx + "px " + ocy + "px";
      c.o = { x: ocx, y: ocy };
      c.h = objH(m) * g.k;
      var s = slots[i];
      c.slot = { x: s.x, y: s.base - c.h / 2 };
      var hp = HERO[i % HERO.length];
      c.hero = { x: hp[0] * W, y: hp[1] * H, s: hp[2], r: hp[3], a: hp[4] };
      capEls[i].style.transform = "translate(" + s.x + "px," + (s.base + 14) + "px)";
    });
    // The order they leave in: outermost first, alternating sides.
    var mid = (n - 1) / 2;
    g.order = items
      .map(function (_, i) {
        return i;
      })
      .sort(function (a, b) {
        return Math.abs(b - mid) - Math.abs(a - mid) || a - b;
      });
    g.C = { x: W / 2, y: phone ? H * 0.55 : H * 0.53 };
    // The bag, sized by its body: at least half the screen on a phone.
    var bm = A.bag,
      bagObj = objH(bm);
    g.bagH = phone ? H * 0.54 : Math.min(H * 0.74, 780);
    g.kb = g.bagH / bagObj;
    B.el.style.setProperty("--s", g.kb);
    g.bo = { x: ((bm.object.x0 + bm.object.x1) / 2) * g.kb, y: ((bm.object.y0 + bm.object.y1) / 2) * g.kb };
    B.el.style.transformOrigin = g.bo.x + "px " + g.bo.y + "px";
    g.bagC = { x: phone ? W / 2 : W * 0.5, y: phone ? H * 0.56 : H * 0.55 };
    // The readout sits by the printed scale's top mark.
    g.read = phone
      ? { x: W - gut - 96, y: hdr + 26 }
      : {
          x: g.bagC.x + (bm.object.x1 - (bm.object.x0 + bm.object.x1) / 2) * g.kb + 28,
          y: g.bagC.y + (bm.meniscus - (bm.object.y0 + bm.object.y1) / 2) * g.kb - 14,
        };
    // The room: a cover crop placed so the stand stands at about two thirds
    // across (a little right of centre on a phone), never past the edge.
    var sc = Math.max(W / ROOM.w, H / ROOM.h);
    var want = (phone ? 0.64 : 0.7) * W;
    var offX = clamp(want - ROOM.pole * sc, W - ROOM.w * sc, 0),
      offY = (H - ROOM.h * sc) / 2;
    roomImg.style.objectPosition = offX.toFixed(1) + "px " + offY.toFixed(1) + "px";
    g.hook = { x: offX + ROOM.hook.x * sc, y: offY + ROOM.hook.y * sc };
    // The bag on the hook at its real size against the stand.
    g.roomBagH = BAG_CM * ROOM.pxPerCm * sc;
    g.roomS = g.roomBagH / g.bagH;
    var hole = bm.hole;
    // The hook wire sits in the top of the hanging hole.
    g.roomC = {
      x: g.hook.x + (g.bo.x - hole.x * g.kb) * g.roomS,
      y: g.hook.y + (g.bo.y - (hole.y - 22) * g.kb) * g.roomS,
    };
    // Cards: lower corners while they are read; top corners once the room is up.
    var cw = cardA.offsetWidth,
      ch = Math.max(cardA.offsetHeight, cardB.offsetHeight);
    g.cards = phone
      ? {
          a: { x: gut, y: H - ch - 24 },
          b: { x: W - gut - cardB.offsetWidth, y: H - ch - 24 },
          a2: { x: gut, y: hdr + 12 },
          b2: { x: W - gut - cardB.offsetWidth, y: hdr + 12 },
        }
      : {
          a: { x: gut, y: H - ch - 40 },
          b: { x: W - gut - cardB.offsetWidth, y: H - ch - 40 },
          a2: { x: gut, y: hdr + 20 },
          b2: { x: W - gut - cardB.offsetWidth, y: hdr + 20 },
        };
    void cw;
    g.groundedY = phone ? 0 : Math.max(hdr + 40, H * 0.52 - grounded.offsetHeight / 2);
    G = g;
  }

  // -------------------------------------------------------------- render
  var mx = 0,
    my = 0,
    tmx = 0,
    tmy = 0;
  function T(el, x, y, s, r, o) {
    el.style.transform =
      "translate3d(" +
      x.toFixed(2) +
      "px," +
      y.toFixed(2) +
      "px,0)" +
      (s != null ? " scale(" + s.toFixed(4) + ")" : "") +
      (r ? " rotate(" + r.toFixed(2) + "deg)" : "");
    if (o != null) el.style.opacity = o.toFixed(3);
  }
  function bez(a, c, b, u) {
    var v = 1 - u;
    return { x: v * v * a.x + 2 * v * u * c.x + u * u * b.x, y: v * v * a.y + 2 * v * u * c.y + u * u * b.y };
  }

  function render(p) {
    var g = G,
      W = g.W,
      H = g.H,
      n = items.length;
    // The ground: ink comes up as the containers collapse.
    var inkT = inOut(span(p, 0.32, 0.45));
    stage.style.setProperty("--ink-t", inkT.toFixed(3));
    ink.style.opacity = inkT.toFixed(3);

    // Hero copy lifts away.
    var hOut = easeOut(span(p, 0.02, 0.08));
    T(hero, 0, -36 * hOut, null, 0, 1 - hOut);
    hero.style.visibility = hOut >= 1 ? "hidden" : "visible";

    // Count title: in with the spread, out before the point.
    var tIn = easeOut(span(p, 0.09, 0.15)),
      tOut = span(p, 0.41, 0.46);
    T(title, 0, 24 * (1 - tIn), null, 0, tIn * (1 - tOut));

    // Containers.
    var settle = inOut(span(p, 0.05, 0.15));
    var conv0 = 0.24,
      convSpan = 0.13,
      travel = 0.08,
      shrink = 0.03;
    var par = fineQ.matches && !g.phone ? 1 - settle : 0;
    for (var k = 0; k < n; k++) {
      var i = g.order[k],
        c = C[i];
      var hp = c.hero,
        sl = c.slot;
      var x = lerp(hp.x + mx * 16 * hp.s * par, sl.x, settle);
      var y = lerp(hp.y + my * 10 * hp.s * par, sl.y, settle);
      var s = lerp(hp.s, 1, settle),
        r = lerp(hp.r, 0, settle),
        a = lerp(hp.a, 1, settle);
      var t0 = conv0 + (k * convSpan) / n;
      var tt = inOut(span(p, t0, t0 + travel));
      if (c.item.separate) {
        // Given separately: it parks beside where the bag will be, and stays.
        var side = { x: g.bagC.x + g.bagH * 0.46 + 70, y: g.bagC.y + g.bagH * 0.2 };
        x = lerp(x, side.x, tt);
        y = lerp(y, side.y, tt);
        s = lerp(s, 0.8, tt);
        var hideS = span(p, 0.86, 0.9);
        a = a * (1 - hideS);
      } else if (tt > 0) {
        var ctrl = { x: (sl.x + g.C.x) / 2, y: Math.min(sl.y, g.C.y) - H * 0.16 };
        var pt = bez({ x: sl.x, y: sl.y }, ctrl, g.C, tt);
        x = pt.x;
        y = pt.y;
        s = lerp(1, 0.42, tt);
        var sh = inOut(span(p, t0 + travel, t0 + travel + shrink));
        s = lerp(s, 0.04, sh);
        a = 1 - span(p, t0 + travel + shrink * 0.6, t0 + travel + shrink);
      }
      T(c.el, x - c.o.x, y - c.o.y, s, r, a);
      c.el.style.visibility = a <= 0.001 ? "hidden" : "visible";
      // Captions: in left to right with the spread, out as their glass leaves.
      var cIn = easeOut(span(p, 0.1 + (i / n) * 0.06, 0.14 + (i / n) * 0.06));
      var cOut = c.item.separate ? span(p, 0.86, 0.9) : span(p, t0 - 0.01, t0 + 0.03);
      var capX = c.item.separate ? lerp(sl.x, x, tt) : sl.x,
        capY = c.item.separate ? lerp(sl.y + c.h / 2 + 14, y + (c.h * s) / 2 + 12, tt) : sl.y + c.h / 2 + 14;
      capEls[i].style.transform = "translate(" + capX.toFixed(1) + "px," + capY.toFixed(1) + "px)";
      capEls[i].style.opacity = (cIn * (1 - cOut)).toFixed(3);
    }

    // The ring closes around the point, then frames the bag, then thins away.
    var rIn = span(p, 0.33, 0.38),
      rClose = inOut(span(p, 0.33, 0.47)),
      rOpen = inOut(span(p, 0.48, 0.58)),
      rOut = span(p, 0.58, 0.66);
    var R0 = 0.44 * Math.min(W, H),
      R1 = 28,
      R2 = g.bagH * 0.6;
    var R = rOpen > 0 ? lerp(R1, R2, rOpen) : lerp(R0, R1, rClose);
    T(ring, g.C.x, g.C.y, R / 100, 0, rIn * (1 - rOut) * 0.95);
    var ptA = span(p, 0.4, 0.44) * (1 - span(p, 0.49, 0.52));
    T(point, g.C.x, g.C.y, null, 0, ptA);

    // The bag grows out of the point.
    var em = inOut(span(p, 0.48, 0.58));
    var ground = inOut(span(p, 0.86, 0.95));
    var call = inOut(span(p, 0.76, 0.86));
    var bc = { x: lerp(g.C.x, g.bagC.x, em), y: lerp(g.C.y, g.bagC.y, em) };
    if (g.phone) bc.y -= H * 0.07 * call * (1 - ground);
    bc = { x: lerp(bc.x, g.roomC.x, ground), y: lerp(bc.y, g.roomC.y, ground) };
    var bs = lerp(0.04, 1, em) * lerp(1, g.roomS, ground);
    // The turn: 0, -18deg, +6deg, 0.
    var tu = span(p, 0.68, 0.78),
      ang = 0;
    if (tu > 0 && tu < 1)
      ang =
        tu < 0.45
          ? -18 * inOut(tu / 0.45)
          : tu < 0.8
            ? lerp(-18, 6, inOut((tu - 0.45) / 0.35))
            : lerp(6, 0, inOut((tu - 0.8) / 0.2));
    B.el.style.transform =
      "translate3d(" +
      (bc.x - g.bo.x).toFixed(2) +
      "px," +
      (bc.y - g.bo.y).toFixed(2) +
      "px,0) rotateY(" +
      ang.toFixed(2) +
      "deg) scale(" +
      bs.toFixed(4) +
      ")";
    B.el.style.opacity = em > 0 ? Math.min(1, em * 4).toFixed(3) : "0";
    B.el.style.visibility = em > 0 ? "visible" : "hidden";
    B.band.style.transform = "translateX(" + lerp(-110, 260, tu).toFixed(1) + "%)";
    B.band.style.opacity = tu > 0 && tu < 1 ? "1" : "0";
    // Light plates once the room is up.
    B.el.style.setProperty("--rm", ground.toFixed(3));

    // The fill: the carrier rises once, to the drip's own volume.
    var fl = inOut(span(p, 0.56, 0.68));
    var f = A.bag.fill,
      bottom = f.rows[f.rows.length - 1][0];
    var row = bottom + (f.meniscus - bottom) * fl;
    B.el.style.setProperty("--row", row.toFixed(2));
    var sp = rowSpan(row),
      m0 = f.rows[0];
    B.el.style.setProperty("--msx", ((sp[2] - sp[1]) / (m0[2] - m0[1])).toFixed(4));
    B.el.style.setProperty("--mdx", ((sp[1] + sp[2]) / 2 - (m0[1] + m0[2]) / 2).toFixed(2));
    num.textContent = fmt(Math.round(fl * drip.volumeMl));
    var rdA = span(p, 0.55, 0.58) * (1 - span(p, 0.84, 0.88));
    T(readout, g.read.x, g.read.y, null, 0, rdA);

    // "One drip." arrives faint behind the bag and firms.
    var oIn = span(p, 0.49, 0.6),
      oOut = span(p, 0.84, 0.88);
    one.style.opacity = (lerp(0.15, 1, oIn) * (oIn > 0 ? 1 : 0) * (1 - oOut)).toFixed(3);
    one.style.transform = "translate3d(0," + (16 * (1 - oIn)).toFixed(1) + "px,0)";

    // Callouts rise from the lower corners, then step up to the top ones.
    var cA = easeOut(span(p, 0.76, 0.82)),
      cB = easeOut(span(p, 0.79, 0.85));
    var up = inOut(span(p, 0.86, 0.92));
    T(
      cardA,
      lerp(g.cards.a.x, g.cards.a2.x, up),
      lerp(g.cards.a.y + 60 * (1 - cA), g.cards.a2.y, up),
      null,
      0,
      cA * (1 - span(p, g.phone ? 0.845 : 0.86, g.phone ? 0.87 : 0.9))
    );
    T(
      cardB,
      lerp(g.cards.b.x, g.cards.b2.x, up),
      lerp(g.cards.b.y + 60 * (1 - cB), g.cards.b2.y, up),
      null,
      0,
      cB * (1 - span(p, g.phone ? 0.845 : 0.86, g.phone ? 0.87 : 0.9))
    );

    // The room rises behind; the evening; the quiz.
    room.style.visibility = ground > 0 ? "visible" : "hidden";
    room.style.transform = "translate3d(0," + ((1 - ground) * 100).toFixed(2) + "%,0)";
    var gIn = easeOut(span(p, 0.92, 0.97)),
      gOut = 0;
    grounded.style.visibility = gIn > 0 ? "visible" : "hidden";
    T(grounded, 0, g.groundedY + 28 * (1 - gIn), null, 0, gIn * (1 - gOut));

    stage.setAttribute(
      "data-sc-verify-state",
      "p" +
        p.toFixed(3) +
        " ink" +
        inkT.toFixed(2) +
        " em" +
        em.toFixed(2) +
        " fill" +
        fl.toFixed(2) +
        " gr" +
        ground.toFixed(2)
    );
    if (p >= 0.97) stage.setAttribute("data-sc-verify-hold", "true");
    else stage.removeAttribute("data-sc-verify-hold");
  }
  function rowSpan(y) {
    var r = A.bag.fill.rows,
      k = 0;
    while (k < r.length && r[k][0] < y) k++;
    if (k === 0) return r[0];
    if (k >= r.length) return r[r.length - 1];
    var a = r[k - 1],
      b = r[k],
      t = (y - a[0]) / (b[0] - a[0]);
    return [y, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  // ---------------------------------------------------------------- run
  function progress() {
    var rect = act.getBoundingClientRect();
    return clamp(-rect.top / Math.max(rect.height - innerHeight, 1), 0, 1);
  }
  var state = { p: 0 },
    tween = null,
    raf = 0;
  function frame() {
    raf = 0;
    mx += (tmx - mx) * 0.08;
    my += (tmy - my) * 0.08;
    render(state.p);
    if (Math.abs(tmx - mx) > 0.002 || Math.abs(tmy - my) > 0.002) queue();
  }
  function queue() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  if (reduce) {
    still();
    return;
  }
  layout();
  state.p = progress();
  render(state.p);
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    // The act's own pinned mapping, (scrollY - top) / (height - vh), with a
    // 0.6 s catch-up: the scene glides to where the hand put it.
    tween = gsap.fromTo(
      state,
      { p: 0 },
      {
        p: 1,
        ease: "none",
        scrollTrigger: { trigger: act, start: "top top", end: "bottom bottom", scrub: 0.6, invalidateOnRefresh: true },
        onUpdate: queue,
      }
    );
    ScrollTrigger.addEventListener("refresh", function () {
      layout();
      queue();
    });
    addEventListener("load", function () {
      ScrollTrigger.refresh();
    });
    if (document.fonts)
      document.fonts.ready.then(function () {
        ScrollTrigger.refresh();
      });
  } else {
    // Without GSAP the act still works, unsmoothed.
    addEventListener(
      "scroll",
      function () {
        state.p = progress();
        queue();
      },
      { passive: true }
    );
    addEventListener("resize", function () {
      layout();
      state.p = progress();
      queue();
    });
  }
  addEventListener(
    "pointermove",
    function (e) {
      if (!fineQ.matches || state.p > 0.08) return;
      tmx = e.clientX / innerWidth - 0.5;
      tmy = e.clientY / innerHeight - 0.5;
      queue();
    },
    { passive: true }
  );
  // Focus inside the act parks it where that control is visible.
  act.addEventListener("focusin", function (e) {
    var target = e.target.closest(".asm__hero") ? 0 : e.target.closest(".asm__grounded") ? 0.985 : null;
    if (target == null) return;
    var rect = act.getBoundingClientRect(),
      top = scrollY + rect.top;
    scrollTo({ top: top + target * (rect.height - innerHeight), behavior: "instant" });
  });
  window.__assembly = {
    render: render,
    layout: layout,
    progress: progress,
    // For screenshots: jump to where the scrub is heading.
    settle: function () {
      if (tween) {
        ScrollTrigger.update();
        var st = tween.scrollTrigger,
          lag = st.getTween && st.getTween();
        if (lag) lag.progress(1);
        tween.progress(st.progress);
      }
      state.p = progress();
      render(state.p);
    },
  };

  // Reduced motion: three still frames, no pin, no travel. The hero, the bag at
  // step 5 with its full list beside it, and the room with the quiz.
  function still() {
    act.classList.add("asm--still");
    var frames = [0.0, 0.7, 1];
    var base = stage;
    var clones = [base, base.cloneNode(false), base.cloneNode(false)];
    // Clone 1: the bag with its list. Clone 2: the room. Move the right
    // children into each, so no text is duplicated.
    var s1 = clones[1],
      s2 = clones[2];
    [".asm__ink", ".asm__bagwrap", ".asm__one"].forEach(function (q) {
      s1.append($(q));
    });
    $(".asm__readout").remove();
    roomImg.loading = "eager";
    var list = document.createElement("ul");
    list.className = "asm__formula";
    list.innerHTML = $("[data-formula]").innerHTML;
    list.setAttribute("aria-label", drip.name + ", composition");
    s1.append(list);
    [".asm__room", ".asm__grounded", ".asm__card--a", ".asm__card--b"].forEach(function (q) {
      s2.append($(q));
    });
    act.append(s1, s2);
    clones.forEach(function (s) {
      s.style.position = "relative";
      s.style.height = "100svh";
      s.removeAttribute("data-sc-stage");
      s.classList.remove("sc-stage");
    });
    layout();
    // Each frame is the same choreography at a fixed p. render() writes every
    // layer, so each frame keeps only the styles of the layers it holds.
    var save = stage,
      keep = [];
    [
      [base, frames[0]],
      [s1, 0.675],
      [s2, frames[2]],
    ].forEach(function (fr) {
      stage = fr[0];
      render(fr[1]);
      keep.push(
        [fr[0]].concat([].slice.call(fr[0].querySelectorAll("*"))).map(function (el) {
          return [el, el.getAttribute("style")];
        })
      );
    });
    stage = save;
    keep.forEach(function (l) {
      l.forEach(function (e) {
        if (e[1] == null) e[0].removeAttribute("style");
        else e[0].setAttribute("style", e[1]);
      });
    });
    clones.forEach(function (s) {
      s.style.position = "relative";
      s.style.height = "100svh";
    });
    var g = G;
    list.style.left = g.phone ? g.gut + "px" : g.bagC.x + g.bagH * 0.42 + "px";
    list.style.top = g.phone ? g.H * 0.86 + "px" : g.H * 0.3 + "px";
    list.style.width = g.phone ? g.W - 2 * g.gut + "px" : "300px";
  }
})();

/* NutriDrip home, preview build v5. No libraries: one scroll loop, one IntersectionObserver.
   Every number, dose, price and word below comes from the data supplied for this page. */
(function () {
  "use strict";
  var QUIZ = "/quiz"; // the app's quiz route; the button works once this folder is served beside the app
  var $ = function (s, r) {
    return (r || document).querySelector(s);
  };
  var $$ = function (s, r) {
    return Array.prototype.slice.call((r || document).querySelectorAll(s));
  };
  var clamp = function (v, a, b) {
    return Math.min(b, Math.max(a, v));
  };
  var ss = function (x) {
    x = clamp(x, 0, 1);
    return x * x * (3 - 2 * x);
  };
  var root = document.documentElement;
  // one formatter for every price (a toLocaleString per call builds a new one each time)
  var INR = window.Intl ? new Intl.NumberFormat("en-IN") : null;
  var money = function (n) {
    return "₹" + (INR ? INR.format(n) : n.toLocaleString("en-IN"));
  };

  /* ------------------------------------------------------------------ data */
  // The app passes its own data (src/lib/data/home-v5.ts, as window.NUTRIDRIP_HOME): its drips, goals, zones, FAQ
  // and late-change policy. Standing alone, the preview uses the copy below.
  var D = window.NUTRIDRIP_HOME || {};
  var GOALS = D.goals || [
    ["Energy", "Fatigue that sleep has not fixed", "energy"],
    ["Immunity", "Before travel, after illness", "immunity"],
    ["Skin", "Glutathione protocols", "skin"],
    ["Hydration", "The fastest session we run", "hydration"],
    ["Athletic recovery", "After the effort, not before", "athletic"],
    ["Post-viral", "The flat weeks afterwards", "postviral"],
  ];
  var morningOf = function (goal) {
    return (GOALS.filter(function (g) {
      return g[0] === goal;
    })[0] || GOALS[0])[2];
  };

  // item: [name, dose, form, separate?, note]
  var DRIPS = D.drips || [
    {
      id: "hydrate",
      name: "Hydrate Plus",
      goal: "Hydration",
      price: 5400,
      time: "30–40 min",
      tint: "#16A6B6",
      tag: "Fast rehydration",
      base: "Ringer lactate 500 mL",
      pop: 1,
      desc: "Balanced electrolytes in Ringer lactate for dehydration, hangovers and heat exposure.",
      best: "Dehydration, heat exhaustion, after a long run",
      know: ["The shortest session on the menu"],
      items: [
        ["Electrolyte concentrate", "20 mL", "ampoule"],
        ["Pyridoxine", "100 mg", "ampoule"],
        ["Ondansetron", "4 mg", "ampoule", 1, "Given beside the bag"],
      ],
    },
    {
      id: "jetlag",
      name: "Jetlag Reset",
      goal: "Energy",
      price: 6800,
      time: "30–40 min",
      tint: "#4B96E6",
      tag: "Built around travel days",
      base: "Normal saline 0.9% 500 mL",
      desc: "Lower volume, faster run, built around travel days and time-zone shifts.",
      best: "Long-haul travel, shift changes",
      know: ["Book within 24 hours of landing for the clearest effect"],
      items: [
        ["Ascorbic acid", "5,000 mg", "vial"],
        ["Electrolyte concentrate", "20 mL", "ampoule"],
        ["Pyridoxine", "100 mg", "ampoule"],
      ],
    },
    {
      id: "myers",
      name: "Myers’ Revive",
      goal: "Energy",
      price: 8400,
      time: "45–60 min",
      tint: "#7B5BD6",
      tag: "The default first drip",
      base: "Normal saline 0.9% 500 mL",
      pop: 1,
      desc: "Magnesium-forward Myers’ cocktail. B-complex, magnesium and ascorbic acid in a saline carrier.",
      best: "Persistent fatigue, poor sleep, high-workload weeks",
      know: ["Most patients feel the lift within 24 hours", "Magnesium can cause a brief warm sensation"],
      items: [
        ["Ascorbic acid", "7,500 mg", "vial"],
        ["Magnesium sulphate", "1,000 mg", "ampoule"],
        ["B-complex", "2 mL", "vial"],
        ["Cyanocobalamin (B12)", "1,000 mcg", "ampoule"],
        ["Calcium gluconate", "500 mg", "ampoule"],
        ["Pyridoxine", "100 mg", "ampoule"],
      ],
    },
    {
      id: "immune",
      name: "Immune Shield",
      goal: "Immunity",
      price: 9200,
      time: "60–80 min",
      tint: "#C13E8D",
      tag: "High-dose vitamin C",
      base: "Normal saline 0.9% 500 mL",
      pop: 1,
      desc: "High-dose vitamin C with zinc and selenium.",
      best: "Recurrent infections, pre-travel, recovery weeks",
      know: ["G6PD screening required at high doses"],
      items: [
        ["Ascorbic acid", "15,000 mg", "vial"],
        ["Zinc sulphate", "10 mg", "ampoule"],
        ["Sodium selenite", "100 mcg", "ampoule"],
      ],
    },
    {
      id: "postviral",
      name: "Post-viral Rebuild",
      goal: "Post-viral",
      price: 9600,
      time: "60–80 min",
      tint: "#A47DDB",
      tag: "After the infection clears",
      base: "Normal saline 0.9% 500 mL",
      desc: "Antioxidant-forward protocol for the flat weeks that follow a viral illness.",
      best: "Post-viral fatigue, brain fog",
      know: ["Best started at least seven days after fever resolves"],
      items: [
        ["Ascorbic acid", "10,000 mg", "vial"],
        ["Alpha-lipoic acid", "300 mg", "ampoule"],
        ["B-complex", "2 mL", "vial"],
        ["Zinc sulphate", "10 mg", "ampoule"],
      ],
    },
    {
      id: "iron",
      name: "Iron Restore",
      goal: "Energy",
      price: 9800,
      time: "90–120 min",
      tint: "#8C3E8A",
      tag: "Requires recent labs",
      base: "Normal saline 0.9% 500 mL",
      desc: "Iron sucrose for confirmed deficiency. A ferritin result within 90 days is mandatory.",
      best: "Confirmed iron deficiency anaemia",
      know: ["Labs required before the physician can approve", "Observation period is longer"],
      items: [
        ["Iron sucrose", "200 mg", "ampoule"],
        ["Ascorbic acid", "1,000 mg", "vial"],
        ["Pheniramine maleate", "22.75 mg", "ampoule", 1, "Given beside the bag"],
      ],
    },
    {
      id: "athletic",
      name: "Athletic Recovery",
      goal: "Athletic recovery",
      price: 10200,
      time: "55–75 min",
      tint: "#4A4FB5",
      tag: "After the event, not before",
      base: "Ringer lactate 500 mL",
      desc: "Amino-acid forward recovery protocol for the 24 hours after a hard effort.",
      best: "Race recovery, heavy training blocks",
      know: ["Check your federation’s anti-doping list before booking"],
      items: [
        ["Taurine", "1,000 mg", "ampoule"],
        ["L-carnitine", "1,000 mg", "ampoule"],
        ["Magnesium sulphate", "1,000 mg", "ampoule"],
        ["Ascorbic acid", "5,000 mg", "vial"],
      ],
    },
    {
      id: "deep",
      name: "Deep Recharge",
      goal: "Energy",
      price: 10600,
      time: "60–80 min",
      tint: "#B65CC8",
      tag: "For sustained fatigue",
      base: "Normal saline 0.9% 500 mL",
      desc: "Adds L-carnitine and taurine for sustained fatigue that a single session has not shifted.",
      best: "Fatigue lasting over a month, athletic overtraining",
      know: ["Usually prescribed as a course of four"],
      items: [
        ["L-carnitine", "2,000 mg", "ampoule"],
        ["Taurine", "1,000 mg", "ampoule"],
        ["Cyanocobalamin (B12)", "1,000 mcg", "ampoule"],
        ["B-complex", "2 mL", "vial"],
      ],
    },
    {
      id: "glow",
      name: "Glow Protocol",
      goal: "Skin",
      price: 11000,
      time: "50–70 min",
      tint: "#DB5B93",
      tag: "Given as a slow push",
      base: "Normal saline 0.9% 500 mL",
      pop: 1,
      desc: "Glutathione with vitamin C, given as a slow push at the end of the carrier.",
      best: "Dull skin, pigmentation, pre-event",
      know: ["A course of six is the usual protocol"],
      items: [
        ["Glutathione", "600 mg", "vial", 1, "A slow push at the end"],
        ["Ascorbic acid", "5,000 mg", "vial"],
        ["Biotin", "5,000 mcg", "ampoule"],
      ],
    },
  ];
  var FIRST = D.first || "myers"; // the drip the page opens on
  var byId = function (id) {
    return (
      DRIPS.filter(function (d) {
        return d.id === id;
      })[0] ||
      DRIPS.filter(function (d) {
        return d.id === FIRST;
      })[0] ||
      DRIPS[0]
    );
  };

  var ZONES = D.zones || [
    ["Koramangala", ["560034", "560095"], "open", "7 AM – 8 PM"],
    ["HSR Layout", ["560102", "560103"], "open", "7 AM – 8 PM"],
    ["Indiranagar", ["560038", "560008"], "open", "7 AM – 8 PM"],
    ["Ejipura", ["560047"], "open", "8 AM – 7 PM"],
    ["Domlur", ["560071"], "open", "8 AM – 7 PM"],
    ["Jayanagar", ["560011", "560041"], "open", "8 AM – 7 PM"],
    ["JP Nagar", ["560078"], "open", "8 AM – 7 PM"],
    ["BTM Layout", ["560068", "560076"], "open", "8 AM – 7 PM"],
    ["Richmond Town", ["560025"], "open", "8 AM – 6 PM"],
    ["Frazer Town", ["560005"], "open", "8 AM – 6 PM"],
    ["Sadashivanagar", ["560080"], "open", "8 AM – 6 PM"],
    ["Whitefield", ["560066"], "limited", "9 AM – 6 PM"],
    ["Sarjapur Road", ["560035"], "limited", "9 AM – 6 PM"],
    ["Hebbal", ["560024"], "limited", "9 AM – 5 PM"],
  ];

  var LATE = D.late || { windowHours: 4, fee: 500 };
  var FAQ = D.faq || [
    [
      "Does a real doctor look at my quiz?",
      "Yes. A registered physician reads every submission and either approves the protocol, changes the doses, or declines it. Their name and council registration number appear on your session report.",
    ],
    [
      "Do I have to take the quiz every time I book?",
      "No. One approval covers all your bookings for 90 days. It lapses after that because a physician’s approval is a judgement about you on the day: weight, medication and kidney function all move.",
    ],
    [
      "What if the nurse finds something wrong?",
      "The 29-step checklist gates the session. If your vitals fall outside the reference range the drip does not start. The nurse escalates to the reviewing physician, and a session that does not run is refunded in full.",
    ],
    [
      "Can I cancel or reschedule?",
      "Move or cancel freely up to 4 hours before your slot. Inside that, moving or cancelling carries a ₹500 late fee, because the nurse is already dispatched with your batch drawn.",
    ],
    [
      "Do you serve my pincode?",
      "We cover " +
        ZONES.length +
        " zones across Bengaluru. Enter your pincode at booking and you get a straight yes or no, not a waitlist.",
    ],
    [
      "What happens to my health data?",
      "Your record is visible to you, the reviewing physician and the attending nurse. Nobody else. Access attempts are logged, and you can export or delete your record from your profile at any time.",
    ],
  ];

  // Every count the page writes comes from the data, never typed in: the admin can add or retire a drip or open a
  // zone, and the page must say so without an edit (as the app does, home/format.ts word()). [data-count] elements
  // in the markup are filled from these; data-form is "Word" (Nine), "word" (nine) or "num" (9).
  var WORDS = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
    "twenty",
  ];
  var word = function (n) {
    return WORDS[n] || String(n);
  };
  var upFirst = function (s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  var COUNTS = { drips: DRIPS.length, zones: ZONES.length, goals: GOALS.length };
  var prices = DRIPS.map(function (d) {
    return d.price;
  });
  var FILL = {
    priceRange:
      prices.length > 1 && Math.min.apply(null, prices) !== Math.max.apply(null, prices)
        ? money(Math.min.apply(null, prices)) + " to " + money(Math.max.apply(null, prices))
        : money(prices[0] || 0),
    lateHours: String(LATE.windowHours),
    lateFee: money(LATE.fee),
  };
  $$("[data-fill]").forEach(function (el) {
    if (FILL[el.dataset.fill] != null) el.textContent = FILL[el.dataset.fill];
  });
  $$("[data-count]").forEach(function (el) {
    var n = COUNTS[el.dataset.count],
      f = el.dataset.form;
    el.textContent = f === "num" ? String(n) : f === "Word" ? upFirst(word(n)) : word(n);
  });

  /* ------------------------------------------------------------------ glass and bag */
  // The labelled glass exactly as the app prints it (src/components/site/v3/glass.ts and styles/glass.css): the
  // client's amber ampoule or clear vial with their print lifted off, and our label laid out at the photograph's
  // own label width (196 px; lh is its height there) and scaled to the glass (styles: .vlabel).
  var AMP = { src: "images/ampoule-blank.webp", w: 196, lt: "49.6%", lh: 370, vial: false };
  var VIAL = { src: "images/vial-calcium-blank.webp", w: 338, lt: "35.8%", lh: 288, vial: true };
  var VITC = { src: "images/vial-vitc-blank.webp", w: 349, lt: "36.7%", lh: 279, vial: true };
  // Band colours are label colours, never the clinical hues: the products the client photographed keep theirs
  // (vitamin C's lemon, magnesium's blue, B-complex's lavender, calcium's teal, B12's pink); every other
  // ingredient takes one from the palette, and a vial's cap the deeper shade beside its band.
  var BANDS = ["#CDBFEF", "#BBD4EE", "#F0C4D6", "#B6E2DD", "#DCC8EF", "#C5CDF2"];
  var CAPS = ["#8C6FD8", "#4F8FD6", "#D9578E", null, "#A779D6", "#6E7FE0"];
  var LEMON = "#F5DC6A";
  var OWN = [
    [/b[- ]?complex/i, 0],
    [/magnesium/i, 1],
    [/cobalamin|vitamin b12/i, 2],
    [/calcium/i, 3],
  ];
  // the vitamin each one is, as the drug master records it (scripts/seed.ts), for the band's last line
  var VITAMIN = [
    [/ascorbic/i, "C"],
    [/cobalamin/i, "B12"],
    [/pyridoxine/i, "B6"],
  ];
  var isC = function (n) {
    return /ascorbic|vitamin c/i.test(n);
  };
  var ownBand = function (n) {
    for (var i = 0; i < OWN.length; i++) if (OWN[i][0].test(n)) return OWN[i][1];
    return null;
  };
  function hashBand(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return h % BANDS.length;
  }
  // one colour per glass in a drip: each keeps its own unless another glass here already shows it
  function bandsFor(items) {
    var used = {};
    items.forEach(function (it) {
      var o = ownBand(it[0]);
      if (o != null) used[o] = 1;
    });
    return items.map(function (it) {
      if (isC(it[0])) return { band: LEMON, cap: null };
      var c = ownBand(it[0]);
      if (c == null) {
        c = hashBand(it[0]);
        for (var j = 0; j < BANDS.length && used[c]; j++) c = (c + 1) % BANDS.length;
        used[c] = 1;
      }
      return { band: BANDS[c], cap: CAPS[c] };
    });
  }
  // the name in up to two balanced lines, then the vitamin it is when the name does not already say it
  function bandLines(name) {
    var w = name
        .replace(/\s*\([^)]*\)\s*$/, "")
        .toUpperCase()
        .split(/\s+/),
      lines = w;
    if (w.length > 1) {
      var cut = 1,
        best = 1e9;
      for (var i = 1; i < w.length; i++) {
        var d = Math.abs(w.slice(0, i).join(" ").length - w.slice(i).join(" ").length);
        if (d < best) {
          best = d;
          cut = i;
        }
      }
      lines = [w.slice(0, cut).join(" "), w.slice(cut).join(" ")];
    }
    for (var k = 0; k < VITAMIN.length; k++)
      if (VITAMIN[k][0].test(name)) {
        lines = lines.concat("(" + VITAMIN[k][1] + ")");
        break;
      }
    return lines;
  }
  // each character's advance in a band (Outfit 800 at 100 px), measured in the browser for the app; summed they come
  // within about 1% of the real line, so a band prints at its fitted size from the first paint
  var BAND_W = {
    " ": 17.3,
    A: 69.4,
    B: 63.8,
    C: 65.3,
    D: 74.9,
    E: 61.5,
    F: 59,
    G: 78.9,
    H: 72.7,
    I: 29.3,
    J: 50,
    K: 69.2,
    L: 55.5,
    M: 85.4,
    N: 73.6,
    O: 81,
    P: 62.2,
    Q: 80.7,
    R: 63.8,
    S: 56.7,
    T: 62,
    U: 69.6,
    V: 67.8,
    W: 97.3,
    X: 66.8,
    Y: 64.2,
    Z: 57.8,
    0: 65.9,
    1: 37.8,
    2: 56.4,
    3: 55.7,
    4: 59.7,
    5: 55.6,
    6: 56.7,
    7: 50.9,
    8: 55.7,
    9: 56.7,
    "(": 30.3,
    ")": 30.3,
    "-": 45.1,
    ".": 29.2,
    ",": 27.5,
    "/": 36.4,
    "+": 55.9,
    "%": 68.6,
    "&": 68.9,
    "'": 24.2,
    "’": 25.4,
    ":": 28.8,
  };
  var bandCap = function (n) {
    return n === 1 ? 34 : n === 2 ? 30 : 24;
  };
  // the largest size that keeps the widest line inside the label's printable 172 of its 196 px
  function bandSize(lines) {
    var cap = bandCap(lines.length);
    var w =
      Math.max.apply(
        null,
        [0].concat(
          lines.map(function (l) {
            return l.split("").reduce(function (s, c) {
              return s + (BAND_W[c] || 62);
            }, 0);
          })
        )
      ) *
      (cap / 100);
    return w ? Math.min(cap, (cap * 172) / w) : cap;
  }
  // the same amount one unit up ("1,000 mcg" is "1 mg"), the second line the client's labels print under a dose
  function altDose(dose) {
    var m = /^([\d,.]+)\s*(mcg|mg)$/i.exec(dose);
    if (!m) return null;
    var n = parseFloat(m[1].replace(/,/g, ""));
    if (!(n >= 1000)) return null;
    return "(" + (n / 1000).toLocaleString("en-IN") + (m[2].toLowerCase() === "mcg" ? " mg" : " g") + ")";
  }
  function glassEl(it, col, gh) {
    var g = it[2] === "ampoule" ? AMP : isC(it[0]) ? VITC : VIAL;
    var lines = bandLines(it[0]),
      alt = altDose(it[1]);
    return (
      '<div class="glass" style="--ar:' +
      g.w +
      "/900;--band:" +
      col.band +
      (gh ? ";--gh:" + gh : "") +
      '">' +
      '<img src="' +
      g.src +
      '" alt="">' +
      // an ampoule's coloured neck ring, or a vial's cap in the band's shade
      (g.vial ? (col.cap ? '<i class="gcap" style="--cap:' + col.cap + '"></i>' : "") : '<i class="vring"></i>') +
      '<div class="vlabel' +
      (g.vial ? " vlabel--vial" : "") +
      '" style="--lt:' +
      g.lt +
      ";--lh:" +
      g.lh +
      'px">' +
      '<p class="vlabel__word">NutriDrip<sup>™</sup></p><p class="vlabel__sub">IV NUTRIENT THERAPY</p>' +
      '<p class="vlabel__band" style="--nfs:' +
      bandSize(lines).toFixed(2) +
      'px">' +
      lines
        .map(function (l) {
          return "<b>" + l + "</b>";
        })
        .join("") +
      "</p>" +
      '<div class="vlabel__low"><p class="vlabel__dose">' +
      it[1] +
      (alt ? "<small>" + alt + "</small>" : "") +
      "</p>" +
      '<i class="vlabel__rule"></i>' +
      '<svg class="vlabel__inf" viewBox="0 0 100 50" aria-hidden="true"><path d="M50 25C40 11 33 7 25 7 15 7 7 15 7 25s8 18 18 18c8 0 15-4 25-18s17-18 25-18c10 0 18 8 18 18s-8 18-18 18c-8 0-15-4-25-18Z" fill="none" stroke="currentColor" stroke-width="5"/></svg>' +
      '<p class="vlabel__foot">For IV Use Only</p></div></div></div>'
    );
  }
  function ingHTML(it, col, i, sep) {
    return (
      '<div class="ing glassin' +
      (sep ? " sep" : "") +
      '" style="--i:' +
      i +
      '">' +
      glassEl(it, col) +
      '<div><span class="ing__name">' +
      it[0] +
      '</span><span class="ing__dose">' +
      it[1] +
      " · " +
      it[2] +
      "</span></div></div>"
    );
  }
  // The bag's label exactly as the app prints it (src/components/site/home/Landing.tsx, the build's bag; styles in
  // home.css .build__label and glass.css .bl-*): wordmark and tagline, the drip's name on its colour band, the
  // carrier and every dose that goes in the bag, anything given separately, then the rule and ∞ | the volume. All of
  // it from the drip's data (the carrier and volume from its base).
  var INF =
    '<svg viewBox="0 0 100 50" aria-hidden="true"><path d="M50 25C40 11 33 7 25 7 15 7 7 15 7 25s8 18 18 18c8 0 15-4 25-18s17-18 25-18c10 0 18 8 18 18s-8 18-18 18c-8 0-15-4-25-18Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/></svg>';
  function labelHTML(d) {
    var m = /^(.*?)\s+(\d[\d,.]*\s*mL)$/i.exec(d.base),
      carrier = m ? m[1] : d.base,
      vol = m ? m[2] : "";
    // a name prints as the app's drug master writes it, without the bracketed vitamin ("Cyanocobalamin")
    var rows = (vol ? [[carrier, vol]] : []).concat(
      d.items
        .filter(function (it) {
          return !it[3];
        })
        .map(function (it) {
          return [it[0].replace(/\s*\([^)]*\)\s*$/, ""), it[1]];
        })
    );
    var sep = d.items.filter(function (it) {
      return it[3];
    });
    return (
      '<div class="bag__label"><div class="bl-head"><p class="bl-word">NutriDrip<sup>™</sup></p><p class="bl-sub">IV NUTRIENT THERAPY</p></div>' +
      '<p class="bl-band">' +
      d.name +
      '</p><ul class="bl-lines">' +
      rows
        .map(function (r) {
          return "<li><span>" + r[0] + "</span><b>" + r[1] + "</b></li>";
        })
        .join("") +
      (sep.length
        ? '<li class="bl-lsep">Given separately: ' +
          sep
            .map(function (s) {
              return s[0];
            })
            .join(", ") +
          "</li>"
        : "") +
      "</ul>" +
      '<div class="bl-end"><i class="bl-rule"></i><p class="bl-foot">' +
      INF +
      "<i></i><b>" +
      (vol || "500 mL") +
      "</b></p></div></div>"
    );
  }
  function bagHTML(d, label, fill) {
    return (
      '<div class="bag" style="--tint:' +
      d.tint +
      ";--fill:" +
      fill +
      '"><div class="bag__fill"><div class="bag__level"></div></div><img class="bag__img" src="images/bag-empty.webp" alt="">' +
      (label ? labelHTML(d) + '<img class="bag__film" src="images/bag-empty.webp" alt="">' : "") +
      "</div>"
    );
  }

  // no picture on the page is picked up and dragged (the browser's ghost copy of an ingredient over the bag)
  root.addEventListener("dragstart", function (e) {
    if (e.target && e.target.tagName === "IMG") e.preventDefault();
  });

  /* ------------------------------------------------------------------ still mode: reduced motion, or a phone held sideways */
  var mqs = [matchMedia("(prefers-reduced-motion: reduce)"), matchMedia("(max-height: 500px)")];
  function setStill() {
    root.classList.toggle(
      "still",
      mqs.some(function (m) {
        return m.matches;
      })
    );
  }
  setStill();
  mqs.forEach(function (m) {
    m.addEventListener
      ? m.addEventListener("change", function () {
          setStill();
          kick();
        })
      : m.addListener(setStill);
  });
  var isStill = function () {
    return root.classList.contains("still");
  };

  $$(".js-quiz").forEach(function (a) {
    a.setAttribute("href", QUIZ);
  });

  /* ------------------------------------------------------------------ hero: every drip on a turning ring */
  // Each drip is its real bag in its own colour and label (bagHTML), hanging from a ring rail; the ring holds however
  // many drips the data has. a is the ring's angle, easing toward target; so is scroll's share (a quarter turn over
  // the pin) and open how far the camera has risen (the rail's ellipse opens). The bag in front names itself below.
  // A click on a bag, the arrows or the keyboard bring one to the front and choose it for the page; dragging spins
  // it and it settles on the nearest bag. Left alone it steps on by one drip every few seconds (never in the still
  // version, which turns only when asked).
  var hero = { el: $("#hero"), copy: $("#heroCopy") };
  hero.stage = $(".stage", hero.el);
  var TAU = Math.PI * 2;
  var ring = {
    el: $("#ring"),
    box: $("#ringItems"),
    back: $("#railBack"),
    front: $("#railFront"),
    n: DRIPS.length,
    a: 0,
    target: 0,
    so: 0,
    open: 0,
    vel: 0,
    last: 0,
    idx: -1,
    hover: false,
    drag: null,
    calm: 0,
    next: 0,
    pick: 0,
    noClick: 0,
    W: 0,
    H: 0,
    bw: 0,
    bh: 0,
    hook: 0,
    items: [],
  };
  ring.step = TAU / Math.max(1, ring.n);
  ring.box.innerHTML = DRIPS.map(function (d, i) {
    return (
      '<div class="ring__item"><i class="ring__hook"></i><div class="ring__bag">' +
      bagHTML(d, true, 0.94) +
      '</div><i class="ring__floor"></i>' +
      '<button type="button" class="ring__hit" data-i="' +
      i +
      '" aria-label="' +
      d.name +
      ", " +
      money(d.price) +
      ", " +
      d.time +
      '"></button></div>'
    );
  }).join("");
  ring.items = $$(".ring__item", ring.box);
  ring.hits = $$(".ring__hit", ring.box);
  // the bags show once their glass photograph is ready: without it their liquid reads as flat coloured shapes
  (function () {
    var img = new Image(),
      show = function () {
        ring.el.classList.add("has-glass");
      };
    img.onload = img.onerror = show;
    img.src = "images/bag-empty.webp";
    if (img.complete) show();
  })();
  var pad2 = function (n) {
    return (n < 10 ? "0" : "") + n;
  };
  var wrapI = function (i) {
    return ((i % ring.n) + ring.n) % ring.n;
  };
  function ringCaption(i) {
    var d = DRIPS[i];
    $("#ringCount").textContent = pad2(i + 1) + " / " + pad2(ring.n) + " · " + d.tag;
    $("#ringName").textContent = d.name;
    $("#ringMeta").innerHTML =
      "<span>" + d.base + "</span> · <span>" + d.time + "</span> · <span>" + money(d.price) + "</span>";
  }
  // The ring fits itself round the copy, measured as laid out (transforms ignored): on wide screens it takes the
  // space right of the headline and paragraph, on phones the space under the button; if the height is short it is
  // drawn smaller (k) rather than over the copy. The caption sits under the ring's centre.
  function ringMeasure() {
    ring.W = hero.stage.clientWidth;
    ring.H = hero.stage.clientHeight;
    var it = ring.items[0];
    if (!it) return;
    ring.bw = it.offsetWidth;
    ring.bh = $(".ring__bag", it).offsetHeight;
    ring.hook = $(".ring__hook", it).offsetHeight;
    var W = ring.W,
      H = ring.H,
      ph = W <= 800,
      sub = $(".hero__sub", hero.copy),
      act = $(".hero__act", hero.copy);
    var right = sub.offsetLeft + sub.offsetWidth;
    $$("#h1 .ln > span").forEach(function (s) {
      right = Math.max(right, s.offsetLeft + s.offsetWidth);
    });
    ring.foot = H * (ph ? 0.8 : 0.78); // where the front bag's foot is
    ring.ry0 = H * (ph ? 0.035 : 0.045);
    if (ph) {
      ring.cx = W / 2;
      ring.rx = W * 0.36;
    } else {
      var avail = W - right - 56;
      ring.rx = Math.max(W * 0.09, Math.min(W * 0.17, (avail - ring.bw * 0.74) / 2));
      ring.cx = Math.min(W * 0.75, right + 28 + avail / 2);
    }
    var top = ph
      ? act.offsetTop + act.offsetHeight + H * 0.03
      : (parseFloat(getComputedStyle(root).getPropertyValue("--hh")) || 60) + H * 0.05;
    var need = ring.ry0 * 2 * (ph ? 1.9 : 1) + ring.hook + ring.bh; // on phones, room for the ring opened by scroll
    ring.k = clamp((ring.foot - top) / need, 0.55, 1);
    // under the ring's centre, moved by translate (a transform: no layout shift when the fonts arrive)
    $(".ring__ui", hero.stage).style.translate = "calc(" + ring.cx.toFixed(1) + "px - 50%) 0";
    ring.drawn = "";
  }
  function ringGeo() {
    var k = ring.k || 1,
      ry = ring.ry0 * (1 + 0.9 * ring.open) * k;
    return { cx: ring.cx, rx: ring.rx, ry: ry, k: k, cy: ring.foot - ry - (ring.hook + ring.bh) * k };
  }
  var frontOf = function (t) {
    return wrapI(Math.round(-(t + ring.so) / ring.step));
  };
  function ringDraw() {
    if (!ring.bh) ringMeasure();
    if (!ring.bh) return;
    var g = ringGeo(),
      best = -2,
      idx = 0,
      sw = clamp(-ring.vel * 7, -8, 8);
    ring.items.forEach(function (el, i) {
      var th = ring.a + ring.so + i * ring.step,
        c = Math.cos(th),
        s = Math.sin(th),
        d = (1 + c) / 2;
      var sc = (0.46 + 0.54 * d) * g.k,
        x = g.cx + g.rx * s,
        y = g.cy + g.ry * c;
      // hung by its hook from the rail; turned a little toward its side of the ring; swinging as the ring turns
      el.style.transform =
        "translate3d(" +
        (x - ring.bw / 2).toFixed(1) +
        "px," +
        y.toFixed(1) +
        "px,0) scale(" +
        sc.toFixed(4) +
        ") perspective(1400px) rotateY(" +
        (s * -22).toFixed(2) +
        "deg) rotate(" +
        (sw * c).toFixed(2) +
        "deg)";
      el.style.opacity = (0.3 + 0.7 * Math.pow(d, 1.25)).toFixed(3);
      el.style.zIndex = String(2 + Math.round(d * 100));
      if (c > best) {
        best = c;
        idx = i;
      }
    });
    var L = (g.cx - g.rx).toFixed(1),
      R = (g.cx + g.rx).toFixed(1),
      cy = g.cy.toFixed(1),
      rr = g.rx.toFixed(1) + " " + g.ry.toFixed(1);
    var back = "M" + L + " " + cy + "A" + rr + " 0 0 1 " + R + " " + cy,
      frontArc = "M" + L + " " + cy + "A" + rr + " 0 0 0 " + R + " " + cy;
    // the cables it hangs from: at the back and at either side of the front
    var cab = [Math.PI, Math.PI / 3, -Math.PI / 3]
      .map(function (t) {
        var x = (g.cx + g.rx * Math.sin(t)).toFixed(1),
          y = (g.cy + g.ry * Math.cos(t)).toFixed(1);
        return "M" + x + " " + y + "L" + x + " -10";
      })
      .join("");
    $(".rc", ring.back).setAttribute("d", cab);
    $(".r1", ring.back).setAttribute("d", back);
    $(".r2", ring.back).setAttribute("d", back);
    $(".r1", ring.front).setAttribute("d", frontArc);
    $(".r2", ring.front).setAttribute("d", frontArc);
    // the cables are clear above, and show only over the last stretch down to the rail
    var fade = $("#cableFade");
    fade.setAttribute("y1", (g.cy * 0.45).toFixed(1));
    fade.setAttribute("y2", (g.cy - g.ry).toFixed(1));
    if (idx !== ring.idx) {
      ring.idx = idx;
      ringCaption(idx);
    }
  }
  function ringGo() {
    if (isStill()) {
      ring.a = ring.target;
      ring.vel = 0;
      ringDraw();
    } else kick();
  }
  // bring drip i to the front by the shorter way round; "choose" also makes it the page's drip, once it has settled
  function ringTo(i, choose) {
    var want = -ring.so - i * ring.step;
    ring.target = want + Math.round((ring.target - want) / TAU) * TAU;
    ring.calm = performance.now() + 8000;
    clearTimeout(ring.pick);
    if (choose)
      ring.pick = setTimeout(function () {
        if (state.id !== DRIPS[i].id) selectDrip(DRIPS[i].id, { ring: true });
      }, 450);
    ringGo();
  }
  // the page chose a drip (here, or later in the bench): it comes to the front
  function heroSet(d, o) {
    var i = DRIPS.indexOf(d);
    if (i < 0 || (o && o.ring)) return;
    var first = ring.idx < 0;
    ringTo(i, false);
    if (first) {
      ring.a = ring.target;
      ring.calm = 0;
    }
  }
  ring.box.addEventListener("click", function (e) {
    var b = e.target.closest(".ring__hit");
    if (!b || performance.now() < ring.noClick) return;
    ringTo(+b.dataset.i, true);
  });
  // tabbing to a bag brings it round to the front (without cancelling a choice already on its way)
  ring.box.addEventListener("focusin", function (e) {
    var b = e.target.closest(".ring__hit");
    if (!b || !b.matches(":focus-visible") || frontOf(ring.target) === +b.dataset.i) return;
    ringTo(+b.dataset.i, false);
  });
  ring.box.addEventListener("keydown", function (e) {
    var k = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!k) return;
    e.preventDefault();
    var i = wrapI(frontOf(ring.target) + k);
    ringTo(i, true);
    ring.hits[i].focus({ preventScroll: true });
  });
  $("#ringPrev").addEventListener("click", function () {
    ringTo(wrapI(frontOf(ring.target) - 1), true);
  });
  $("#ringNext").addEventListener("click", function () {
    ringTo(wrapI(frontOf(ring.target) + 1), true);
  });
  $("#ringGo").addEventListener("click", function (e) {
    e.preventDefault();
    clearTimeout(ring.pick);
    selectDrip(DRIPS[frontOf(ring.target)].id, { scroll: true, ring: true });
  });
  ring.el.addEventListener("pointerenter", function (e) {
    if (e.pointerType === "mouse") ring.hover = true;
  });
  ring.el.addEventListener("pointerleave", function () {
    ring.hover = false;
  });
  // drag or swipe to spin: the ring follows the pointer, then coasts and settles on the nearest bag
  ring.el.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return;
    var now = performance.now();
    ring.drag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      a0: ring.target,
      lx: e.clientX,
      lt: now,
      v: 0,
      on: false,
    };
  });
  window.addEventListener("pointermove", function (e) {
    var dg = ring.drag;
    if (!dg || e.pointerId !== dg.id) return;
    var dx = e.clientX - dg.x,
      dy = e.clientY - dg.y,
      now = performance.now();
    if (!dg.on) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        ring.drag = null;
        return;
      } // a scroll, not a spin
      if (Math.abs(dx) < 8) return;
      dg.on = true;
      ring.el.classList.add("is-drag");
      try {
        ring.el.setPointerCapture(dg.id);
      } catch (err) {
        /* already released */
      }
    }
    var rx = ringGeo().rx;
    ring.target = dg.a0 + dx / rx;
    dg.v = 0.7 * dg.v + 0.3 * ((e.clientX - dg.lx) / rx / Math.max(8, now - dg.lt)) * 1000;
    dg.lx = e.clientX;
    dg.lt = now;
    ring.calm = now + 8000;
    ringGo();
  });
  function ringRelease() {
    var dg = ring.drag;
    if (!dg) return;
    ring.drag = null;
    ring.el.classList.remove("is-drag");
    if (!dg.on) return;
    ring.noClick = performance.now() + 120;
    ringTo(frontOf(ring.target + clamp(dg.v, -7, 7) * 0.22), true);
  }
  window.addEventListener("pointerup", ringRelease);
  window.addEventListener("pointercancel", ringRelease);
  function heroFn(p) {
    if (!ring.bh) ringMeasure();
    var now = performance.now(),
      dt = ring.last ? Math.min(0.05, (now - ring.last) / 1000) : 0;
    ring.last = now;
    // left alone, it steps on by one drip every few seconds
    if (!ring.drag && !ring.hover && now > ring.calm) {
      if (!ring.next) ring.next = now + 3400;
      else if (now > ring.next) {
        ring.target -= ring.step;
        ring.next = now + 3400;
      }
    } else ring.next = 0;
    var prev = ring.a;
    ring.a += (ring.target - ring.a) * (1 - Math.exp(-dt * (ring.drag ? 16 : 4.5)));
    if (Math.abs(ring.target - ring.a) < 0.0004) ring.a = ring.target;
    ring.vel = dt ? 0.8 * ring.vel + 0.2 * ((ring.a - prev) / dt) : 0;
    if (Math.abs(ring.vel) < 0.002) ring.vel = 0;
    ring.so = (-p * Math.PI) / 2;
    ring.open = ss(p / 0.85);
    hero.copy.style.transform = "translate3d(0," + (-p * 0.05 * ring.H).toFixed(1) + "px,0)";
    // at rest between steps nothing is redrawn
    var key =
      ring.a.toFixed(4) +
      "|" +
      ring.so.toFixed(4) +
      "|" +
      ring.open.toFixed(3) +
      "|" +
      ring.vel.toFixed(3) +
      "|" +
      ring.W +
      "x" +
      ring.H;
    if (key !== ring.drawn) {
      ring.drawn = key;
      ringDraw();
    }
  }
  function ringStill() {
    ring.so = 0;
    ring.open = 0.35;
    ring.a = ring.target;
    ring.vel = 0;
    ringDraw();
  }

  /* ------------------------------------------------------------------ the statement: the sterile field */
  // The sentence lights up on the table and lifts away; a surgical drape drops in folded and opens in two folds over
  // the stage; then the session's things land on it one by one in checklist order, each a real step on the nurse's
  // checklist (pointing at one, focusing it or tapping it names the step); the chosen drip's own bag and vials are
  // among them; a printed card lands last.
  var staWords = [];
  (function () {
    var h = $("[data-words]");
    function split(node, hl) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (t) {
            if (!t) return;
            if (/^\s+$/.test(t)) {
              frag.appendChild(document.createTextNode(" "));
              return;
            }
            var s = document.createElement("span");
            s.className = "w" + (hl ? " hl" : "");
            s.textContent = t;
            frag.appendChild(s);
            staWords.push(s);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName === "EM") {
          split(n, true);
        }
      });
    }
    split(h, false);
  })();
  // The nurse's checklist, as the app defines it (src/lib/clinical/checklist.ts): [key, phase, step, detail]
  var CHECK = [
    ["ps-01", "Pre-session", "Confirm the booking and arrival window"],
    ["ps-02", "Pre-session", "Verify patient identity and booking ID"],
    ["ps-03", "Pre-session", "Confirm the physician-approved protocol on file"],
    [
      "ps-04",
      "Pre-session",
      "Re-check allergies and current medication",
      "Ask aloud; do not rely on the record alone.",
    ],
    [
      "ps-05",
      "Pre-session",
      "Screen for contraindications since approval",
      "Pregnancy, renal or cardiac change, new medication.",
    ],
    ["ps-06", "Pre-session", "Confirm last meal and fluid intake"],
    ["ps-07", "Pre-session", "Inspect the sealed kit and confirm the seal is intact"],
    ["ps-08", "Pre-session", "Confirm the anaphylaxis kit is present and in date"],
    ["ps-09", "Pre-session", "Set up a clean working surface"],
    ["ps-10", "Pre-session", "Hand hygiene and gloves"],
    [
      "ps-11",
      "Pre-session",
      "Inspect vial seals and expiry dates",
      "Every vial, against the batch numbers on the order.",
    ],
    [
      "pr-01",
      "Preparation",
      "Record baseline vitals",
      "BP, HR, SpO₂, temperature and weight before any cannulation. Out-of-range values block the next step.",
    ],
    ["pr-02", "Preparation", "Capture consent", "Read the risks aloud, then capture the signature or OTP."],
    ["pr-03", "Preparation", "Confirm each component against the prescription"],
    ["pr-04", "Preparation", "Draw up and label every additive"],
    ["pr-05", "Preparation", "Prime the line and check for air"],
    ["pr-06", "Preparation", "Select the cannulation site"],
    ["pr-07", "Preparation", "Cannulate and secure"],
    ["di-01", "During infusion", "Start the carrier and confirm it runs clear"],
    ["di-02", "During infusion", "Set the rate and record the start time"],
    ["di-03", "During infusion", "Introduce the additives in the prescribed order"],
    ["di-04", "During infusion", "Observe at 10-minute intervals", "Log anything the patient reports, however minor."],
    ["po-01", "Post-session", "Stop the infusion and flush the line"],
    ["po-02", "Post-session", "Remove the cannula and apply pressure"],
    ["po-03", "Post-session", "Record closing vitals"],
    ["po-04", "Post-session", "Observe for 10 minutes before leaving"],
    ["po-05", "Post-session", "Give aftercare instructions"],
    ["po-06", "Post-session", "Dispose of sharps and clinical waste"],
    ["po-07", "Post-session", "Submit the session report", "Vitals, doses, batch numbers and aftercare notes."],
  ];
  var stepOf = function (key) {
    for (var i = 0; i < CHECK.length; i++) if (CHECK[i][0] === key) return { n: i + 1, c: CHECK[i] };
    return null;
  };
  // The things on the field: [key, step, wide-screen [x%, y%, height% of the field, turn], phone [same], width/height, name].
  // x is a share of the field's width, y and the height of its height, so a wider screen only spreads them out.
  var SF = [
    ["pouch", "ps-07", [70, 62, 46, 4], [70, 45, 24, 4], 0.6511, "The sealed kit"],
    ["case", "ps-08", [65, 15, 16, 3], [48, 21, 8.5, 3], 1.5102, "The anaphylaxis kit"],
    ["gloves", "ps-10", [15, 16, 19, -8], [27, 8.5, 10, -8], 1.6027, "Gloves"],
    ["cuff", "pr-01", [32.5, 18, 21, 6], [71, 9, 11, 6], 0.968, "Blood pressure cuff"],
    ["monitor", "pr-01", [91, 16, 12, 8], [84, 83, 6.5, 8], 0.6667, "Vitals monitor"],
    ["syringe", "pr-04", [15, 40, 7, -2], [24, 83, 3.6, -2], 3.7423, "Syringe"],
    ["tourniquet", "pr-06", [47.5, 15, 18, -4], [15, 21, 9, -4], 0.9531, "Tourniquet"],
    ["tape", "pr-07", [35, 40, 9, 0], [66, 83, 5, 0], 1.033, "Tape"],
    ["bag", "di-01", [50, 62, 58, -3], [30, 46, 30, -3], 577 / 1200, ""],
    ["gauze", "po-02", [27.5, 40, 9, 4], [52, 83, 5, 4], 0.9903, "Gauze"],
    ["sharps", "po-06", [80, 15, 14, 0], [83, 21, 8, 0], 0.8689, "Sharps container"],
  ];
  var sta = { el: $("#why"), col: $("#staCol"), bg: $("#staBg"), W: 0, H: 0, pA: 0.895 };
  sta.stage = $(".stage", sta.el);
  var sf = {
    el: $("#sf"),
    drape: $("#sfDrape"),
    half: $("#sfHalf"),
    foldR: $("#sfFoldR"),
    foldL: $("#sfFoldL"),
    box: $("#sfItems"),
    tip: $("#sfTip"),
    lsh: $("#sfLsh"),
    wsh: $("#sfWsh"),
    its: [],
    fw: 0,
    fh: 0,
    d: null,
    on: null,
  };
  sf.faces = $$(".sf__f, .sf__b", sf.drape);
  // build the field's things for a drip (its bag and its vials are its own)
  function sfSet(d) {
    sf.d = d;
    sf.box.innerHTML = "";
    sf.its = [];
    var add = function (o) {
      var sh = document.createElement("i");
      sh.className = "sf__sh" + (o.img ? "" : " sf__sh--soft");
      if (o.img) sh.style.backgroundImage = "url(images/field-" + o.img + "-sh.webp)";
      var el = document.createElement(o.card ? "div" : "button");
      if (!o.card) {
        el.type = "button";
        el.setAttribute("aria-label", o.label);
      }
      el.className = "sf__it" + (o.cls ? " " + o.cls : "");
      el.innerHTML = o.html;
      el.dataset.i = sf.its.length;
      o.el = el;
      o.sh = sh;
      sf.its.push(o);
    };
    var label = function (s, name) {
      return (name ? name + ". " : "") + "Step " + s.n + " of " + CHECK.length + ": " + s.c[2];
    };
    var vials = d.items,
      cols = bandsFor(vials);
    var order = SF.map(function (a) {
      return { a: a, s: stepOf(a[1]) };
    });
    order.push({ vials: true, s: stepOf("ps-11") });
    order.sort(function (x, y) {
      return x.s.n - y.s.n;
    });
    order.forEach(function (o) {
      if (o.vials) {
        vials.forEach(function (it, k) {
          var g = it[2] === "ampoule" ? AMP : isC(it[0]) ? VITC : VIAL;
          add({
            k: "vial",
            vk: k,
            vn: vials.length,
            ar: g.w / 900,
            step: o.s,
            name: it[0] + " " + it[1],
            cls: "sf__vial",
            html: glassEl(it, cols[k]),
            label: label(o.s, it[0] + " " + it[1]),
          });
        });
        return;
      }
      var a = o.a,
        bag = a[0] === "bag";
      add({
        k: a[0],
        L: a[2],
        P: a[3],
        ar: a[4],
        step: o.s,
        name: bag ? d.name : a[5],
        img: bag ? null : a[0],
        cls: bag ? "sf__bag" : "",
        html: bag ? bagHTML(d, true, 0.94) : '<img src="images/field-' + a[0] + '.webp" alt="" draggable="false">',
        label: label(o.s, bag ? d.name : a[5]),
      });
    });
    add({
      k: "card",
      card: true,
      cls: "sf__card",
      html:
        "<b>IV nutrient therapy, run like a clinic.</b><p>A clinical service first and a wellness brand a long way second. Every drip starts with a quiz and a physician, and ends with a nurse at your door.</p>" +
        '<p class="sf__hint">Everything on this field is a step on the nurse’s ' +
        CHECK.length +
        "-step checklist. " +
        (matchMedia("(hover: hover)").matches ? "Point at one." : "Tap one.") +
        "</p>",
    });
    sf.its.forEach(function (o) {
      sf.box.appendChild(o.sh);
    });
    sf.its.forEach(function (o, i) {
      o.el.style.zIndex = 10 + i;
      sf.box.appendChild(o.el);
    });
    sf.fw = 0;
    if (typeof PINS !== "undefined") {
      sfMeasure();
      PINS[0].dirty = true;
      kick();
    }
  }
  // lay the field out for its size: the drape's photograph in each quarter, every thing's box in pixels
  function sfMeasure() {
    var fw = sf.el.clientWidth,
      fh = sf.el.clientHeight;
    if (!fw || !fh) return;
    sf.fw = fw;
    sf.fh = fh;
    var tall = fw / fh < 1.1,
      ar = 1.75;
    // on a wide screen the things are drawn a little larger, so the field does not read as empty
    var big = tall ? 1 : clamp(Math.sqrt(fw / fh / 1.6), 1, 1.18);
    var bw = fw / fh > ar ? fw : fh * ar,
      bh = bw / ar,
      bx = (fw - bw) / 2,
      by = (fh - bh) / 2;
    sf.faces.forEach(function (f) {
      var q = f.parentNode,
        right = /--tr|--br/.test(q.className),
        low = /--br|--bl/.test(q.className);
      f.style.backgroundSize = bw.toFixed(0) + "px " + bh.toFixed(0) + "px";
      // (+1: the face starts 1px outside its quarter, styles: .sf__f)
      f.style.backgroundPosition =
        (bx + 1 - (right ? fw / 2 : 0)).toFixed(2) + "px " + (by + 1 - (low ? fh / 2 : 0)).toFixed(2) + "px";
    });
    sf.its.forEach(function (o) {
      var cx,
        cy,
        w,
        h,
        r = 0;
      if (o.k === "card") {
        w = tall ? fw * 0.9 : Math.min(fh * 0.46, 480);
        o.el.style.width = w.toFixed(0) + "px";
        h = o.el.offsetHeight;
        cx = fw * (tall ? 0.5 : 0.17);
        cy = tall ? fh - h / 2 - fh * 0.03 : fh * 0.74;
        if (!tall) cx = Math.max(cx, w / 2 + fw * 0.03);
      } else if (o.k === "vial") {
        var len = fh * (tall ? 0.085 : 0.15 * big),
          sp = fh * (tall ? 0.062 : 0.092);
        w = len;
        h = len * o.ar;
        o.el.style.setProperty("--len", len.toFixed(1) + "px");
        if (tall) {
          cx = fw * (o.vk % 2 ? 0.7 : 0.3);
          cy = fh * 0.64 + Math.floor(o.vk / 2) * sp;
        } else {
          cx = fw * 0.885;
          cy = fh * 0.62 + (o.vk - (o.vn - 1) / 2) * sp;
        }
        r = o.vk % 2 ? 3 : -3;
      } else {
        var s = tall ? o.P : o.L;
        h = ((fh * s[2]) / 100) * (o.k === "bag" || o.k === "pouch" ? 1 : big);
        w = h * o.ar;
        cx = (fw * s[0]) / 100;
        cy = (fh * s[1]) / 100;
        r = s[3];
      }
      o.x = cx - w / 2;
      o.y = cy - h / 2;
      o.w = w;
      o.h = h;
      o.r = r;
      var st = o.el.style;
      st.left = o.x.toFixed(1) + "px";
      st.top = o.y.toFixed(1) + "px";
      st.width = w.toFixed(1) + "px";
      st.height = h.toFixed(1) + "px";
      var pad = o.img ? 0 : 0.1,
        ss2 = o.sh.style;
      ss2.left = (o.x - w * pad).toFixed(1) + "px";
      ss2.top = (o.y - h * pad).toFixed(1) + "px";
      ss2.width = (w * (1 + 2 * pad)).toFixed(1) + "px";
      ss2.height = (h * (1 + 2 * pad)).toFixed(1) + "px";
    });
    sfTipHide();
  }
  // Where the folded drape waits on the table while the words light up: beside them on a wide screen, below them
  // (turned to lie across) on a tall one, as large as the free space allows. Folded, it is the drape's top-left
  // quarter (fw/2 by fh/2); wait.T is the translate, in px, that puts that quarter there at wait.R and wait.S.
  function sfWait() {
    var fw = sf.fw,
      fh = sf.fh,
      wrap = sta.col.parentNode;
    var colL = wrap.offsetLeft + sta.col.offsetLeft - sf.el.offsetLeft,
      colR = colL + sta.col.offsetWidth;
    var colB = wrap.offsetTop + sta.col.offsetTop + sta.col.offsetHeight - sf.el.offsetTop;
    var tall = fw / fh < 1.1,
      qw = fw / 2,
      qh = fh / 2,
      x0,
      x1,
      y0,
      y1,
      R,
      S;
    if (tall) {
      x0 = fw * 0.06;
      x1 = fw * 0.94;
      y0 = colB + fh * 0.05;
      y1 = fh * 0.95;
      R = -87;
      S = Math.min((x1 - x0) / qh, (y1 - y0) / qw, 0.9);
    } else {
      x0 = colR + fw * 0.04;
      x1 = fw * 0.95;
      y0 = fh * 0.12;
      y1 = fh * 0.88;
      R = -3;
      S = Math.min((x1 - x0) / qw, (y1 - y0) / qh, 0.72);
    }
    S = Math.max(S, 0.3);
    var wx = (x0 + x1) / 2,
      wy = tall ? y0 + (y1 - y0) * 0.4 : fh * 0.5,
      a = (R * Math.PI) / 180,
      vx = (-fw / 4) * S,
      vy = (-fh / 4) * S;
    sf.wait = {
      T: [wx - fw / 2 - (vx * Math.cos(a) - vy * Math.sin(a)), wy - fh / 2 - (vx * Math.sin(a) + vy * Math.cos(a))],
      R: R,
      S: S,
    };
  }
  function staMeasure() {
    sta.W = sta.stage.clientWidth;
    sta.H = sta.stage.clientHeight;
    sfMeasure();
    if (sf.fw) sfWait();
    // the physician act is pulled up beneath this one (styles: .doc) and pins at fadeA; this act's pin ends at fadeB.
    // Between them is the handover. pA is where it starts in this act's progress; doc.pre is how much of the
    // physician act's progress it takes, which that act waits out unstamped.
    var sy = window.scrollY,
      top = sta.el.getBoundingClientRect().top + sy,
      len = Math.max(1, sta.el.offsetHeight - innerHeight);
    sta.fadeA = doc.el.getBoundingClientRect().top + sy;
    sta.fadeB = top + len;
    var on = !isStill() && sta.fadeB > sta.fadeA;
    sta.pA = on ? clamp((sta.fadeA - top) / len, 0.5, 0.99) : 1;
    // (the handover is done at 0.9 of its length; the first stamp comes down just after, while the heading is fresh)
    doc.pre = on ? clamp((0.93 * (sta.fadeB - sta.fadeA)) / Math.max(1, doc.el.offsetHeight - innerHeight), 0, 0.5) : 0;
  }
  function staFn(p) {
    if (!sf.fw) staMeasure();
    var n = staWords.length,
      still = isStill();
    // q runs the statement's own story up to the handover (at 0.895 of it: everything has landed by 0.805);
    // h runs the handover, and finishes a little before this act lets go of the screen
    var q = still ? p : Math.min(1, (p * 0.895) / sta.pA);
    var h = still ? 0 : clamp((p - sta.pA) / (1 - sta.pA) / 0.9, 0, 1);
    staWords.forEach(function (w, i) {
      var t = clamp((q - 0.02 - (i / n) * 0.11) / 0.035, 0, 1);
      w.style.opacity = (0.16 + 0.84 * t).toFixed(3);
    });
    // the words lift away before the drape is slid across where they were
    var lo = still ? 0 : ss((q - 0.145) / 0.035);
    sta.col.style.opacity = (1 - lo).toFixed(3);
    sta.col.style.transform = "translate3d(0," + (-48 * lo).toFixed(1) + "px,0)";
    // the drape: it waits folded in four on the table beside the words; as they lift away it is picked up and slid
    // into place (m), then opens across, then down. At the handover it folds back up where it lies, up then across
    // (the unfolding, reversed), so each fold uncovers half of what is left of the act beneath; then the folded
    // bundle is lifted and carried off the top. Its shadow (sf.lsh) goes with it: close while it lies folded, lifted
    // while it is carried.
    var m = still ? 1 : ss((q - 0.165) / 0.062),
      u1 = still ? 1 : ss((q - 0.23) / 0.08),
      u2 = still ? 1 : ss((q - 0.305) / 0.08);
    if (h > 0) {
      u2 *= 1 - ss((h - 0.42) / 0.2);
      u1 *= 1 - ss((h - 0.63) / 0.2);
    }
    var L = ss((h - 0.83) / 0.17),
      fw = sf.fw,
      fh = sf.fh,
      W = sf.wait || { T: [0, 0], R: 0, S: 1 },
      tx,
      ty,
      rz,
      sc;
    if (h > 0) {
      tx = -0.04 * L * fw;
      ty = -0.64 * L * fh;
      rz = 3 * L;
      sc = 1 + 0.05 * L;
    } else {
      tx = W.T[0] + (0.25 * fw * (1 - u1) - W.T[0]) * m;
      ty = W.T[1] + (0.25 * fh * (1 - u2) - W.T[1]) * m;
      rz = W.R * (1 - m);
      sc = W.S + (1 - W.S) * m;
    }
    var dt = function (x, y) {
      return (
        "translate3d(" +
        x.toFixed(1) +
        "px," +
        y.toFixed(1) +
        "px,0) rotate(" +
        rz.toFixed(2) +
        "deg) scale(" +
        sc.toFixed(4) +
        ")"
      );
    };
    sf.drape.style.transform = dt(tx, ty);
    sf.lsh.style.opacity = (Math.min(1, L * 5) * (1 - ss((L - 0.55) / 0.45))).toFixed(3);
    sf.lsh.style.transform =
      "translate3d(" + tx.toFixed(1) + "px," + (-0.46 * L * fh + 34 * Math.min(1, L * 4)).toFixed(1) + "px,0)";
    sf.wsh.style.opacity = h > 0 ? "0" : (1 - u1).toFixed(3);
    if (!h) sf.wsh.style.transform = dt(tx, ty + 4 + 24 * Math.sin(Math.PI * m));
    sf.half.style.transform =
      "translateZ(" + (2 * (1 - u1)).toFixed(2) + "px) rotateY(" + (-180 * (1 - u1)).toFixed(2) + "deg)";
    sf.half.style.setProperty("--sh", (0.35 * Math.sin(Math.PI * u1)).toFixed(3));
    var fx = "translateZ(" + (1 - u2).toFixed(2) + "px) rotateX(" + (180 * (1 - u2)).toFixed(2) + "deg)",
      fs = (0.35 * Math.sin(Math.PI * u2)).toFixed(3);
    sf.foldR.style.transform = sf.foldL.style.transform = fx;
    sf.foldR.style.setProperty("--sh", fs);
    sf.foldL.style.setProperty("--sh", fs);
    // the things land, one after another in checklist order, each settling onto its shadow. At the handover the
    // field is cleared by the same motion played backwards: the card first, then each thing in reverse order.
    var N = sf.its.length;
    sf.its.forEach(function (o, i) {
      var t0 = 0.385 + (i / Math.max(1, N - 1)) * 0.37,
        t = still ? 1 : ss((q - t0) / 0.05);
      if (h > 0) t *= 1 - ss((h - 0.02 - ((N - 1 - i) / Math.max(1, N - 1)) * 0.3) / 0.08);
      // the printed card leaves gently (it is words, and on a phone it is nearly the screen's width): a small lift as it fades
      var r = 1 - t,
        soft = h > 0 && o.k === "card",
        m = soft ? 0.25 : 1;
      o.el.style.opacity = (soft ? t : clamp(t * 2.5, 0, 1)).toFixed(3);
      o.el.style.visibility = t <= 0 ? "hidden" : "";
      o.el.style.transform =
        "translate3d(0," +
        (-0.07 * sf.fh * r * m).toFixed(1) +
        "px,0) rotate(" +
        (o.r + 9 * r * m).toFixed(2) +
        "deg) scale(" +
        (1 + 0.32 * r * m).toFixed(4) +
        ")";
      o.sh.style.opacity = (t * t).toFixed(3);
      o.sh.style.transform =
        "translate3d(" +
        (o.w * 0.025 * (1 + 3 * r)).toFixed(1) +
        "px," +
        (o.h * 0.04 * (1 + 3 * r)).toFixed(1) +
        "px,0) rotate(" +
        o.r.toFixed(2) +
        "deg) scale(" +
        (1 + 0.25 * r).toFixed(4) +
        ")";
    });
    // once the clearing starts the field takes no pointing; the statement's ground goes before the first fold
    // shows what is beneath, and when the handover is done the whole stage steps aside for the act below
    sf.box.style.pointerEvents = h > 0 ? "none" : "";
    if (h > 0 && sf.on) sfTipHide();
    sta.bg.style.opacity = h > 0 ? (1 - ss((h - 0.34) / 0.06)).toFixed(3) : "";
    sta.stage.style.visibility = h >= 1 ? "hidden" : "";
  }
  // pointing at, focusing or tapping a thing names its step beside it
  function sfTip(o) {
    if (!o || o.k === "card") return sfTipHide();
    sf.on && sf.on.sh.classList.remove("is-on");
    sf.on && sf.on.el.classList.remove("is-on");
    sf.on = o;
    o.el.classList.add("is-on");
    o.sh.classList.add("is-on");
    $("#sfTipK").textContent = (o.name ? o.name + " · " : "") + "Step " + o.step.n + " of " + CHECK.length;
    $("#sfTipH").textContent = o.step.c[2];
    $("#sfTipD").textContent = o.step.c[3] || "";
    var t = sf.tip;
    t.classList.add("on");
    var tw = t.offsetWidth,
      th = t.offsetHeight,
      cx = o.x + o.w / 2,
      top = o.y - th - 14;
    if (top < 8) top = o.y + o.h + 14;
    t.style.left = clamp(cx - tw / 2, 8, sf.fw - tw - 8).toFixed(1) + "px";
    t.style.top = clamp(top, 8, sf.fh - th - 8).toFixed(1) + "px";
  }
  function sfTipHide() {
    if (sf.on) {
      sf.on.el.classList.remove("is-on");
      sf.on.sh.classList.remove("is-on");
      sf.on = null;
    }
    sf.tip.classList.remove("on");
  }
  var sfOf = function (e) {
    var b = e.target.closest && e.target.closest(".sf__it");
    return b ? sf.its[+b.dataset.i] : null;
  };
  sf.box.addEventListener("pointerover", function (e) {
    if (e.pointerType === "mouse") sfTip(sfOf(e));
  });
  sf.box.addEventListener("pointerleave", function (e) {
    if (e.pointerType === "mouse") sfTipHide();
  });
  sf.box.addEventListener("focusin", function (e) {
    sfTip(sfOf(e));
  });
  sf.box.addEventListener("focusout", function (e) {
    if (!sf.box.contains(e.relatedTarget)) sfTipHide();
  });
  sf.box.addEventListener("click", function (e) {
    var o = sfOf(e);
    if (o && o !== sf.on) sfTip(o);
    else if (o) sfTipHide();
  });

  /* ------------------------------------------------------------------ the physician: one decision, four roads */
  // An ink drawing on chart paper. Your answers run down to the physician; then the scroll travels each road the
  // physician can send them down, in the order the page names the decisions, with a dot (your protocol) on it:
  // declines (it ends), asks for more (it loops back to you), changes the doses and approves (both go on to the bag).
  var DECIDE = [
    ["Declines", "var(--stop)", "“A decline is not lost revenue to us, it is the product working.”", "No drip."],
    ["Asks for more", "var(--warn)", "Or asks for more first.", "Back to you, first."],
    ["Changes the doses", "var(--warn)", "Or changes the doses.", "Amended, then the bag."],
    ["Approves", "var(--ok)", "Or approves the protocol. Then the bag.", "Then the bag."],
  ];
  // the quiz's five parts and how many questions each asks, as the page has listed them
  var QUIZ_PARTS = [
    ["Sleep & energy", 3],
    ["Diet & hydration", 4],
    ["Lifestyle", 5],
    ["How you feel", 4],
    ["Screening", 5],
  ];
  var quizQ = QUIZ_PARTS.reduce(function (n, q) {
    return n + q[1];
  }, 0);
  var labDrip = DRIPS.filter(function (d) {
    return /ferritin/i.test(d.desc);
  })[0];
  var NOT =
    "<b>Not for everyone.</b> IV therapy is unsuitable during pregnancy, in renal or cardiac failure, and with certain drug interactions. The quiz screens for these and a physician can decline.";
  // two drawings of the same map: wide (beside the words) and tall (under them on a phone).
  // roads: [path, end cap at, label x, y, anchor]
  var RD_WIDE = {
    vb: [940, 800],
    card: [310, 24, 320, 84],
    doc: [360, 252, 220, 64],
    sub: [596, 290, "start"],
    fs: 1.3,
    main: "M470,108 L470,252",
    roads: [
      ["M470,316 C470,430 170,420 170,556", [170, 556], 170, 600, "middle"],
      ["M470,316 C470,410 120,400 94,262 C74,160 166,66 306,66", null, 270, 196, "middle"],
      ["M470,316 L470,556 C470,660 770,640 770,716", null, 488, 552, "start"],
      ["M470,316 C470,420 770,420 770,556 L770,792", null, 788, 552, "start"],
    ],
  };
  var RD_TALL = {
    vb: [420, 480],
    card: [100, 8, 220, 66],
    doc: [140, 170, 140, 48],
    sub: null,
    fs: 0.82,
    main: "M210,74 L210,170",
    roads: [
      ["M210,218 C210,300 62,300 62,404", [62, 404], 62, 436, "middle"],
      ["M210,218 C210,276 40,286 30,196 C20,110 50,41 96,41", null, 120, 120, "middle"],
      ["M210,218 L210,404", null, 210, 436, "middle"],
      ["M210,218 C210,300 358,300 358,404", null, 358, 436, "middle"],
    ],
  };
  var NS = "http://www.w3.org/2000/svg";
  var doc = {
    el: $("#doctor"),
    map: $("#rdMap"),
    svg: $("#rdSvg"),
    swap: $("#rdSwap"),
    M: null,
    roads: [],
    labs: [],
    caps: [],
    len: [],
    said: 0,
    pre: 0,
  };
  var svgEl = function (tag, a, txt) {
    var e = document.createElementNS(NS, tag);
    for (var k in a) e.setAttribute(k, a[k]);
    if (txt != null) e.textContent = txt;
    return e;
  };
  (function () {
    var say = "";
    DECIDE.forEach(function (x, i) {
      var more =
        i === 0
          ? '<p class="not">' + NOT + "</p>"
          : i === 1 && labDrip
            ? "<p>" + labDrip.name + ", for one, needs a recent ferritin result before a physician can approve it.</p>"
            : "";
      say +=
        "<div" +
        (i === 0 ? ' class="still-on"' : "") +
        '><span class="rd__word" style="color:' +
        x[1] +
        '">' +
        x[0] +
        "</span><p>" +
        x[2] +
        "</p>" +
        more +
        "</div>";
    });
    doc.swap.insertAdjacentHTML("beforeend", say);
    doc.says = $$("div", doc.swap).filter(function (d) {
      return d.parentNode === doc.swap;
    });
  })();
  function docSay(k) {
    if (k === doc.said) return;
    doc.says[doc.said].classList.remove("on");
    doc.says[k].classList.add("on");
    doc.said = k;
  }
  function docBuild() {
    var M = innerWidth <= 800 ? RD_TALL : RD_WIDE,
      s = doc.svg,
      f = M.fs,
      c = M.card,
      dd = M.doc;
    if (doc.M === M) return;
    doc.M = M;
    doc.roads = [];
    doc.labs = [];
    doc.caps = [];
    var title = $("title", s);
    s.innerHTML = "";
    if (title) s.appendChild(title);
    s.setAttribute("viewBox", "0 0 " + M.vb[0] + " " + M.vb[1]);
    s.setAttribute("preserveAspectRatio", "xMidYMid meet");
    var card = svgEl("g", {});
    card.appendChild(
      svgEl("rect", { x: c[0] + 4, y: c[1] + 6, width: c[2], height: c[3], rx: 14, class: "rd-card-sh" })
    );
    card.appendChild(svgEl("rect", { x: c[0], y: c[1], width: c[2], height: c[3], rx: 14, class: "rd-card" }));
    card.appendChild(
      svgEl(
        "text",
        { x: c[0] + c[2] / 2, y: c[1] + c[3] * 0.46, "text-anchor": "middle", class: "rd-serif", "font-size": 30 * f },
        "Your answers"
      )
    );
    card.appendChild(
      svgEl(
        "text",
        { x: c[0] + c[2] / 2, y: c[1] + c[3] * 0.8, "text-anchor": "middle", class: "rd-mono", "font-size": 12.5 * f },
        quizQ + " questions · " + QUIZ_PARTS.length + " parts"
      )
    );
    M.roads.forEach(function (r) {
      var p = svgEl("path", { d: r[0], class: "road" });
      doc.roads.push(p);
      s.appendChild(p);
    });
    doc.main = svgEl("path", { d: M.main, class: "rd-main" });
    s.appendChild(doc.main);
    s.appendChild(card);
    doc.card = card;
    var g = svgEl("g", {});
    g.appendChild(svgEl("rect", { x: dd[0], y: dd[1], width: dd[2], height: dd[3], rx: dd[3] / 2, class: "rd-doc" }));
    g.appendChild(
      svgEl(
        "text",
        {
          x: dd[0] + dd[2] / 2,
          y: dd[1] + dd[3] * 0.63,
          "text-anchor": "middle",
          class: "rd-serif rd-white",
          "font-size": 27 * f,
        },
        "Physician"
      )
    );
    if (M.sub)
      g.appendChild(
        svgEl(
          "text",
          { x: M.sub[0], y: M.sub[1], "text-anchor": M.sub[2], class: "rd-mono", "font-size": 11.5 * f },
          "Registered with the KMC"
        )
      );
    s.appendChild(g);
    M.roads.forEach(function (r, i) {
      var x = DECIDE[i],
        l = svgEl("g", { class: "rd-lab" });
      if (r[1]) {
        doc.caps[i] = svgEl("line", {
          x1: r[1][0] - 18,
          y1: r[1][1],
          x2: r[1][0] + 18,
          y2: r[1][1],
          class: "rd-cap",
          stroke: x[1],
          opacity: 0,
        });
        s.appendChild(doc.caps[i]);
      }
      l.appendChild(
        svgEl("text", { x: r[2], y: r[3], "text-anchor": r[4], class: "w", fill: x[1], "font-size": 16 * f }, x[0])
      );
      // on a phone the line under each word is its first clause only
      l.appendChild(
        svgEl(
          "text",
          { x: r[2], y: r[3] + 24 * f, "text-anchor": r[4], class: "l", "font-size": 16 * f },
          M === RD_TALL ? x[3].split(",")[0].replace(/\.?$/, ".") : x[3]
        )
      );
      doc.labs.push(l);
      s.appendChild(l);
    });
    var end = M.roads[3][0].match(/(-?\d+),(-?\d+)\s*$/),
      ex = +end[1],
      ey = +end[2];
    doc.arrow = svgEl("path", {
      d: "M" + (ex - 9) + "," + (ey - 12) + " L" + ex + "," + ey + " L" + (ex + 9) + "," + (ey - 12),
      class: "road",
      opacity: 0,
    });
    s.appendChild(doc.arrow);
    doc.ring = svgEl("circle", { r: 15 * f, class: "rd-ring" });
    doc.dot = svgEl("circle", { r: 7 * f, class: "rd-dot" });
    s.appendChild(doc.ring);
    s.appendChild(doc.dot);
    doc.len = doc.roads.map(function (p) {
      var L = p.getTotalLength();
      p.style.strokeDasharray = L + " " + L;
      p.style.strokeDashoffset = L;
      return L;
    });
    doc.ml = doc.main.getTotalLength();
    doc.main.style.strokeDasharray = doc.ml + " " + doc.ml;
  }
  function docMeasure() {
    // on a phone the drawing takes what the words leave of the screen
    if (innerWidth <= 800 && !isStill())
      doc.map.style.height = Math.max(280, doc.map.parentNode.clientHeight - doc.map.offsetTop - 12) + "px";
    else doc.map.style.height = "";
    docBuild();
  }
  function docPut(p, at) {
    var pt = p.getPointAtLength(at);
    doc.dot.setAttribute("cx", pt.x);
    doc.dot.setAttribute("cy", pt.y);
    doc.ring.setAttribute("cx", pt.x);
    doc.ring.setAttribute("cy", pt.y);
  }
  function docFn(raw) {
    if (!doc.M) docBuild();
    // the act pins beneath the statement and waits there, undrawn, while the field is folded away over it (doc.pre)
    var pre = doc.pre || 0,
      p = clamp((raw - pre) / (1 - pre), 0, 1),
      R0 = 0.16,
      SPAN = 0.2,
      k = -1;
    var m = ss((p - 0.02) / 0.12),
      o = ss(p / 0.04).toFixed(3);
    doc.card.style.opacity = doc.dot.style.opacity = doc.ring.style.opacity = o;
    doc.main.style.strokeDashoffset = (doc.ml * (1 - m)).toFixed(1);
    if (p < R0) docPut(doc.main, doc.ml * m);
    doc.roads.forEach(function (r, i) {
      var u = (p - (R0 + i * SPAN)) / SPAN,
        dr = ss(u / 0.6),
        L = doc.len[i],
        cur = (u >= 0 && u < 1) || (i === 3 && u >= 1);
      r.style.strokeDashoffset = (L * (1 - dr)).toFixed(1);
      r.classList.toggle("on", cur);
      r.classList.toggle("dim", u >= 1 && i < 3);
      r.style.stroke = cur ? DECIDE[i][1] : "";
      doc.labs[i].classList.toggle("on", u >= 0.55);
      if (doc.caps[i]) doc.caps[i].setAttribute("opacity", u >= 0.58 ? (u >= 1 && i < 3 ? 0.5 : 1) : 0);
      if (u >= 0.55) k = i;
      if (u >= 0 && (u < 1 || i === 3)) docPut(r, L * dr);
    });
    doc.arrow.setAttribute("opacity", k === 3 ? 1 : 0);
    doc.arrow.style.stroke = k === 3 ? DECIDE[3][1] : "";
    docSay(k + 1);
  }
  // the still version: every road drawn, approves in its colour, every label shown; the words and the note beside it
  function docStill() {
    docBuild();
    docFn(1);
    doc.roads.forEach(function (r) {
      r.classList.remove("dim");
    });
    doc.caps.forEach(function (c) {
      if (c) c.setAttribute("opacity", 1);
    });
    docSay(0);
  }

  /* ------------------------------------------------------------------ the drips */
  var state = { id: byId(FIRST).id, goal: "All", cmp: false, picks: [] };
  var goalsEl = $("#goals"),
    rail = $("#rail"),
    bench = $("#bench"),
    cmp = $("#cmp"),
    cmpBtn = $("#cmpBtn"),
    goalLine = $("#goalLine");
  var chip = function (label, key) {
    var b = document.createElement("button");
    b.className = "chip";
    b.textContent = label;
    b.dataset.k = key;
    b.setAttribute("aria-pressed", key === "All" ? "true" : "false");
    return b;
  };
  var countLine = ""; // (the user, 2026-11-26: no count under the chips, and the first chip is just "All")
  goalsEl.appendChild(chip("All", "All"));
  GOALS.forEach(function (g) {
    goalsEl.appendChild(chip(g[0], g[0]));
  });
  goalsEl.addEventListener("click", function (e) {
    var b = e.target.closest(".chip");
    if (!b) return;
    state.goal = b.dataset.k;
    $$(".chip", goalsEl).forEach(function (c) {
      c.setAttribute("aria-pressed", c === b ? "true" : "false");
    });
    var g = GOALS.filter(function (x) {
      return x[0] === state.goal;
    })[0];
    goalLine.textContent = g ? g[0] + ": " + g[1] : countLine;
    var match = DRIPS.filter(function (d) {
      return state.goal === "All" || d.goal === state.goal;
    });
    $$(".dcard", rail).forEach(function (c) {
      c.classList.toggle("off", match.indexOf(byId(c.dataset.id)) < 0);
    });
    if (match.length && match.indexOf(byId(state.id)) < 0 && !state.cmp) selectDrip(match[0].id, {});
  });
  goalLine.textContent = countLine;

  DRIPS.forEach(function (d) {
    var b = document.createElement("button");
    b.className = "dcard";
    b.dataset.id = d.id;
    b.style.setProperty("--tint", d.tint);
    b.setAttribute("aria-pressed", "false");
    b.innerHTML =
      (d.pop ? '<span class="dcard__pop">Most popular</span>' : "") +
      '<i class="dcard__chk"></i><div class="mini">' +
      bagHTML(d, false, 0.92) +
      '</div><div><span class="dcard__n">' +
      d.name +
      '</span><span class="dcard__p">' +
      money(d.price) +
      "</span></div>";
    rail.appendChild(b);
  });
  rail.addEventListener("click", function (e) {
    var c = e.target.closest(".dcard");
    if (!c) return;
    if (state.cmp) {
      var i = state.picks.indexOf(c.dataset.id);
      if (i >= 0) state.picks.splice(i, 1);
      else {
        state.picks.push(c.dataset.id);
        if (state.picks.length > 3) state.picks.shift();
      }
      renderCmp();
      return;
    }
    selectDrip(c.dataset.id, {});
  });

  // the bench is built once; picking a drip re-tints the bag (a registered colour that transitions) and refills it
  bench.innerHTML =
    '<div class="bench__bag"><p class="bench__vol"><b>500 mL</b>every bag</p><div class="hook"></div><div id="bBag"></div></div>' +
    '<div class="bench__mid"><div><p class="bench__lbl">Base fluid</p><div class="bench__base"><i></i><span id="bBase"></span></div></div>' +
    '<div class="bench__split"><div class="bench__mixbox"><p class="bench__lbl">Goes in the bag</p><div class="bench__row" id="bMix"></div></div><div id="bSep"></div></div></div>' +
    '<div class="bench__info" id="bInfo"></div>';
  var bBag = $("#bBag"),
    bMix = $("#bMix"),
    bSep = $("#bSep"),
    bInfo = $("#bInfo"),
    bBase = $("#bBase");
  var benchBag = null;
  var benchSeen = false; // the bench is built the first time it is seen (bio, below), not before the first paint

  function renderBench(d, animate) {
    bench.style.setProperty("--tint", d.tint);
    if (!benchBag) {
      bBag.innerHTML = bagHTML(d, true, 1);
      benchBag = $(".bag", bBag);
    }
    benchBag.style.setProperty("--tint", d.tint);
    var lab = $(".bag__label", benchBag);
    if (lab) lab.outerHTML = labelHTML(d);
    bBase.textContent = d.base;
    var cols = bandsFor(d.items),
      mix = "",
      sep = "",
      mi = 0,
      si = 0;
    d.items.forEach(function (it, i) {
      if (it[3]) sep += ingHTML(it, cols[i], si++, true);
      else mix += ingHTML(it, cols[i], mi++, false);
    });
    bMix.innerHTML = mix;
    var seps = d.items.filter(function (it) {
      return it[3];
    });
    bSep.innerHTML = seps.length
      ? '<div class="bench__sep glassin" style="--i:' +
        mi +
        '"><p class="bench__lbl">Given beside the bag, never mixed in</p><div class="bench__row">' +
        sep +
        '</div><p class="sepnote">' +
        seps
          .map(function (s) {
            return s[0] + ": " + s[4].toLowerCase() + ".";
          })
          .join(" ") +
        "</p></div>"
      : "";
    $$(".bench__sep .ing", bSep).forEach(function (n) {
      n.classList.remove("glassin");
    });
    bInfo.innerHTML =
      "<h3>" +
      d.name +
      '</h3><p class="bench__tag">' +
      d.tag +
      "</p>" +
      '<div class="bench__price"><b>' +
      money(d.price) +
      "</b><span>" +
      d.time +
      " · " +
      d.goal +
      "</span></div>" +
      '<dl class="bench__dl"><div><dt>What it is</dt><dd>' +
      d.desc +
      "</dd></div><div><dt>Best for</dt><dd>" +
      d.best +
      "</dd></div>" +
      "<div><dt>Good to know</dt><dd><ul>" +
      d.know
        .map(function (k) {
          return "<li>" + k + "</li>";
        })
        .join("") +
      "</ul></dd></div></dl>" +
      '<a class="btn js-quiz" href="' +
      QUIZ +
      '">Take the health quiz · 3 min<i></i></a><p class="bench__approve">Needs a physician’s approval. The price is known before the nurse arrives.</p>';
    bInfo.classList.remove("swap");
    void bInfo.offsetWidth;
    bInfo.classList.add("swap");
    if (animate && !isStill()) {
      benchBag.style.transition = "none";
      benchBag.style.setProperty("--fill", 0.08);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          benchBag.style.transition = "--fill 1.4s cubic-bezier(.2,.7,.15,1)";
          benchBag.style.setProperty("--fill", 1);
        });
      });
    }
  }

  function selectDrip(id, o) {
    state.id = id;
    var d = byId(id);
    $$(".dcard", rail).forEach(function (c) {
      c.setAttribute("aria-pressed", String(c.dataset.id === id && !state.cmp));
    });
    heroSet(d, o);
    selectRest(d);
    if (o && o.scroll) {
      var y =
        bench.getBoundingClientRect().top +
        window.scrollY -
        (parseFloat(getComputedStyle(root).getPropertyValue("--hh")) || 60) -
        70;
      window.scrollTo({ top: y, behavior: isStill() ? "auto" : "smooth" });
    }
  }

  // everything below the first screen that shows the chosen drip: the bench, the dose act, the sterile field, the end
  function selectRest(d) {
    if (benchSeen) renderBench(d, true);
    doseBuild(d);
    sfSet(d);
    $("#endBag").innerHTML = bagHTML(d, true, 0.92);
  }

  function renderCmp() {
    $$(".dcard", rail).forEach(function (c) {
      c.classList.toggle("picked", state.picks.indexOf(c.dataset.id) >= 0);
      c.setAttribute("aria-pressed", String(state.picks.indexOf(c.dataset.id) >= 0));
    });
    var ds = state.picks.map(byId);
    if (!ds.length) {
      cmp.innerHTML = '<p class="cmp__empty">Choose up to three drips above to put them side by side.</p>';
      return;
    }
    var row = function (label, f) {
      return (
        '<tr><th scope="row">' +
        label +
        "</th>" +
        ds
          .map(function (d) {
            return "<td>" + f(d) + "</td>";
          })
          .join("") +
        "</tr>"
      );
    };
    cmp.innerHTML =
      "<table><thead><tr><td></td>" +
      ds
        .map(function (d) {
          return (
            '<th scope="col" style="--tint:' +
            d.tint +
            '"><div class="cmp__h">' +
            bagHTML(d, false, 0.9) +
            "<b>" +
            d.name +
            "</b></div></th>"
          );
        })
        .join("") +
      "</tr></thead><tbody>" +
      row("Price", function (d) {
        return '<span class="mono">' + money(d.price) + "</span>";
      }) +
      row("Session", function (d) {
        return d.time;
      }) +
      row("Goal", function (d) {
        return d.goal;
      }) +
      row("Base fluid", function (d) {
        return d.base;
      }) +
      row("Goes in the bag", function (d) {
        return (
          "<ul>" +
          d.items
            .filter(function (i) {
              return !i[3];
            })
            .map(function (i) {
              return "<li>" + i[0] + ' <span class="sep">' + i[1] + " · " + i[2] + "</span></li>";
            })
            .join("") +
          "</ul>"
        );
      }) +
      row("Given beside the bag", function (d) {
        var s = d.items.filter(function (i) {
          return i[3];
        });
        return s.length
          ? "<ul>" +
              s
                .map(function (i) {
                  return "<li>" + i[0] + ' <span class="sep">' + i[1] + "</span></li>";
                })
                .join("") +
              "</ul>"
          : '<span class="sep">None</span>';
      }) +
      row("Good to know", function (d) {
        return (
          "<ul>" +
          d.know
            .map(function (k) {
              return "<li>" + k + "</li>";
            })
            .join("") +
          "</ul>"
        );
      }) +
      "</tbody></table>";
  }
  cmpBtn.addEventListener("click", function () {
    state.cmp = !state.cmp;
    cmpBtn.setAttribute("aria-pressed", String(state.cmp));
    cmpBtn.textContent = state.cmp ? "Back to one drip" : "Compare drips";
    rail.parentNode.classList.toggle("cmp-on", state.cmp);
    bench.hidden = state.cmp;
    cmp.hidden = !state.cmp;
    if (state.cmp) {
      state.picks = [state.id];
      renderCmp();
    } else {
      selectDrip(state.id, {});
    }
  });

  /* ------------------------------------------------------------------ the peak: follow one dose */
  // The bag is HTML; after the surface, one WebGL canvas (dose-gl.js) draws the journey as a single camera move.
  // The ingredients' glass and names stay HTML above it, tilting in 3D. Everything here is a function of the
  // scroll position and a clock, so the liquid, the particles and the glass keep moving between scrolls.
  var ds = {
    el: $("#dose"),
    stage: $("#dsStage"),
    out: $("#dsOut"),
    bagHost: $("#dsBag"),
    sep: $("#dsSep"),
    canvas: $("#dsGL"),
    glass: $("#dsGlass"),
    merged: $("#dsMerged"),
    cap: $("#dose .ds-cap"),
    lines: $$("#dsLines > div"),
    railEl: $("#dsRail"),
    rail: $$("#dsRail li"),
    chip: $("#dsChip"),
    items: [],
    W: 0,
    H: 0,
    ph: false,
    idx: -2,
    p: 0,
    gl: null,
    tint: [0.48, 0.36, 0.84],
  };
  var WORD = ["No", "One", "Two", "Three", "Four", "Five", "Six"];
  var richOf = function (col) {
    return col.cap || (col.band === "#F5DC6A" ? "#E2B11F" : "#2FA39A");
  };
  var hex3 = function (h) {
    var n = parseInt(h.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  var PAPER = hex3("#F3F0E8");
  // The dose act's WebGL is set up after the page has loaded, with its photographs, and not before the first paint
  // (compiling its shaders took ~0.4 s): until then the act draws without it, far below the first screen.
  ds.gl = null;
  if (!window.WebGLRenderingContext && !isStill()) ds.el.classList.add("nogl");
  var dsStart = function () {
    ds.gl = window.DoseGL && !isStill() ? DoseGL.create(ds.canvas, { particles: innerWidth < 800 ? 150 : 240 }) : null;
    if (!ds.gl) {
      if (!isStill()) ds.el.classList.add("nogl");
      return;
    }
    if (ds.W) ds.gl.resize(ds.W, ds.H, Math.min(window.devicePixelRatio || 1, ds.ph ? 1.5 : 1.75));
    var sfx = innerWidth < 800 ? "-m" : "";
    ds.gl
      .load({
        liquid: "images/dose-liquid" + sfx + ".webp",
        drop: "images/dose-drop" + sfx + ".webp",
        arm: "images/dose-arm" + sfx + ".webp",
        vessel: "images/dose-vessel" + sfx + ".webp",
        inkA: "images/ink-a.webp",
        inkB: "images/ink-b.webp",
        cells: "images/dose-cells.webp",
      })
      .then(function () {
        PINS[2].dirty = true;
        kick();
      });
  };
  // set up after the page has loaded, and its textures uploaded a frame at a time, long before anyone scrolls this far
  if (document.readyState === "complete") setTimeout(dsStart, 250);
  else
    window.addEventListener("load", function () {
      setTimeout(dsStart, 250);
    });

  function doseBuild(d) {
    ds.tint = hex3(d.tint);
    ds.bagHost.innerHTML = bagHTML(d, true, 1);
    var cols = bandsFor(d.items),
      mixed = [],
      seps = [];
    d.items.forEach(function (it, i) {
      (it[3] ? seps : mixed).push({ it: it, col: cols[i] });
    });
    ds.sep.innerHTML = seps
      .map(function (o) {
        return glassEl(o.it, o.col) + "<p>" + o.it[0] + " " + o.it[1] + "<br>beside the bag, never mixed in</p>";
      })
      .join("");
    ds.chip.textContent = seps.length
      ? "Outside the bag: " +
        seps
          .map(function (o) {
            return o.it[0] + " " + o.it[1];
          })
          .join(", ") +
        ". Given beside it, never mixed in."
      : "";
    ds.glass.innerHTML = "";
    ds.items = mixed.map(function (o, k) {
      var g = document.createElement("div");
      g.className = "dsg";
      g.innerHTML =
        glassEl(o.it, o.col) +
        '<div class="dsg__tag"><b>' +
        o.it[0] +
        "</b><span>" +
        o.it[1] +
        " · " +
        o.it[2] +
        "</span></div>";
      ds.glass.appendChild(g);
      return {
        g: g,
        tag: $(".dsg__tag", g),
        gl: $(".glass", g),
        rgb: hex3(richOf(o.col)),
        tex: k % 2 ? "inkB" : "inkA",
      };
    });
    $$("[data-name]", ds.el).forEach(function (e) {
      e.textContent = d.name;
    });
    $$("[data-base]", ds.el).forEach(function (e) {
      e.textContent = d.base;
    });
    $$("[data-time]", ds.el).forEach(function (e) {
      e.textContent = d.time;
    });
    $("#dsMergedH").textContent =
      (WORD[mixed.length] || mixed.length) +
      (mixed.length === 1 ? " ingredient. " : " ingredients. ") +
      "One " +
      d.name +
      ".";
    $("#dsMergedS").textContent = "Mixed into " + d.base + ".";
    $("#dsStillList").innerHTML = d.items
      .map(function (it) {
        return "<li>" + it[0] + " · " + it[1] + (it[3] ? " · beside the bag" : "") + "</li>";
      })
      .join("");
    dsMeasure();
    if (!isStill()) dsFn(ds.p, clock);
  }
  function dsMeasure() {
    ds.W = ds.stage.clientWidth;
    ds.H = ds.stage.clientHeight;
    if (!ds.W) return;
    ds.hh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hh")) || 60;
    ds.ph = ds.W < 800;
    ds.glass.style.setProperty("--dgh", Math.round(ds.H * (ds.ph ? 0.14 : 0.24)) + "px");
    ds.ox = ds.bagHost.offsetLeft;
    ds.oy = ds.bagHost.offsetTop + ds.bagHost.offsetHeight * 0.835; // the liquid under the label (its foot is at 79%)
    ds.out.style.transformOrigin = ds.ox + "px " + ds.oy + "px";
    ds.items.forEach(function (o) {
      o.gw = o.gl.offsetWidth;
      o.gh = o.gl.offsetHeight;
    });
    if (ds.gl) ds.gl.resize(ds.W, ds.H, Math.min(window.devicePixelRatio || 1, ds.ph ? 1.5 : 1.75));
  }
  function dsFn(p, time) {
    ds.p = p;
    time = time || 0;
    if (!ds.W) dsMeasure();
    if (!ds.W) return;
    var W = ds.W,
      H = ds.H,
      cx = W / 2,
      cy = H * 0.48,
      m = ds.items.length;
    // 1. the bag: the camera pushes toward the liquid under the label, then the liquid rises over it
    var push = ss((p - 0.04) / 0.15),
      surf = ss((p - 0.12) / 0.08);
    if (vis(ds.out, surf < 1)) ds.out.style.transform = "scale(" + (1 + push * push * 5).toFixed(3) + ")";
    // the water opens out of that point in the bag; its centre drifts to the screen's as it fills the view
    var c0 = [ds.ox / W + (0.5 - ds.ox / W) * surf, ds.oy / H + (0.48 - ds.oy / H) * surf];
    // 2. inside the carrier: each glass drifts in from the dark, tilting in 3D, names itself and lets its colour
    //    go; the clouds spiral into one; then the camera flies into the centre where they met
    var t = ss((p - 0.57) / 0.09),
      dive = ss((p - 0.62) / 0.1),
      camZ = 1 + 1.6 * dive,
      sum = 0,
      w = 0.3 / Math.max(m, 1);
    var rx = W * (ds.ph ? 0.27 : 0.31),
      ry = H * (ds.ph ? 0.2 : 0.25),
      sprites = [];
    ds.items.forEach(function (o, k) {
      var u = (p - (0.23 + k * w * 0.85)) / (w * 1.9);
      var th = ((m > 1 ? -170 + (k * 250) / (m - 1) : -90) * Math.PI) / 180,
        co = Math.cos(th),
        sn = Math.sin(th);
      var a = ss(u / 0.4),
        far = 1 - a,
        leave = ss((u - 0.55) / 0.3),
        on = u > -0.05 && u < 1.05;
      if (vis(o.g, on)) {
        var gx = cx + co * rx * (1 + 1.7 * far),
          gy = cy + sn * ry * (1 + 2 * far) + Math.sin(time * 0.9 + k * 1.7) * 7;
        var gs = (0.45 + 0.55 * a) * (1 - 0.3 * leave),
          gr = (k % 2 ? 1 : -1) * (20 * far + 4 * Math.sin(time * 0.6 + k));
        var ry3 = (k % 2 ? 1 : -1) * (34 * far + 10 * Math.sin(time * 0.7 + k)),
          rx3 = 8 * Math.sin(time * 0.55 + k * 1.3);
        o.g.classList.toggle("l", co > 0.2);
        o.g.style.transform =
          "translate3d(" +
          (gx - o.gw / 2).toFixed(1) +
          "px," +
          (gy - o.gh / 2).toFixed(1) +
          "px,0) perspective(900px) rotateY(" +
          ry3.toFixed(2) +
          "deg) rotateX(" +
          rx3.toFixed(2) +
          "deg) rotate(" +
          gr.toFixed(2) +
          "deg) scale(" +
          gs.toFixed(3) +
          ")";
        o.g.style.opacity = (clamp(u * 4, 0, 1) * (1 - leave)).toFixed(3);
        o.tag.style.opacity = (ss((u - 0.12) / 0.18) * (1 - ss((u - 0.48) / 0.14))).toFixed(3);
      }
      var rel = ss((u - 0.42) / 0.45),
        phi = th + t * 1.9 + time * 0.04,
        rad = 1 - t;
      var ccx = cx + Math.cos(phi) * rx * rad * camZ,
        ccy = cy + Math.sin(phi) * ry * rad * camZ;
      sprites.push({
        tex: o.tex,
        mode: 0,
        x: ccx,
        y: ccy,
        size: Math.min(W, H) * 0.62 * (0.25 + 0.95 * rel) * (1 + 1.3 * t) * camZ,
        // as they spiral together they lighten (multiplied colours otherwise sum to mud) and the carrier takes over
        rot: th + t * 2.4 + rel * 0.7 + time * 0.05 * (k % 2 ? 1 : -1),
        color: o.rgb.map(function (c) {
          return c + (1 - c) * 0.6 * t;
        }),
        alpha: rel * 0.8 * (1 - 0.92 * t) * (1 - dive),
        swirl: 0.8 + 1.8 * t + 0.25 * Math.sin(time * 0.5 + k),
      });
      sum += rel;
    });
    var mo = ss((p - 0.6) / 0.04) * (1 - ss((p - 0.655) / 0.02));
    ds.merged.style.opacity = mo.toFixed(3);
    ds.merged.style.transform = "translate(-50%,-50%) scale(" + (0.96 + 0.04 * mo + 0.08 * dive).toFixed(3) + ")";
    ds.chip.style.opacity = ds.chip.textContent ? (ss((p - 0.2) / 0.03) * (1 - ss((p - 0.6) / 0.03))).toFixed(3) : "0";
    // 3..6: one camera, four photographs, no cuts
    // the bloodstream opens into paper, done a little before the pin lets go (progress trails the scroll a moment,
    // so the screen is already paper when the stage starts to move); "Six steps" rises out of it (styles: .how)
    var exit = ss((p - 0.955) / 0.035),
      g = ds.gl;
    if (g) {
      var lz = (1.22 - 0.22 * ss((p - 0.11) / 0.13)) * camZ;
      // the whole drip set in view first (bag, spike, chamber, tube), easing in on the chamber while it drips, then down the tube
      var dz = (ds.ph ? 1.05 : 1) + 0.42 * ss((p - 0.67) / 0.1),
        pan = ss((p - 0.75) / 0.06);
      var vz = (1 + 0.28 * ss((p - 0.895) / 0.1)) * (1 + 0.025 * Math.sin(time * 0.6));
      var fa = clamp((p - 0.922) / 0.078, 0, 1),
        fb = clamp((p - 0.95) / 0.05, 0, 1);
      sprites.push({
        tex: "cells",
        mode: 1,
        x: cx,
        y: cy,
        size: W * 1.15 * (0.8 + 1.7 * fa),
        rot: 0.2 * Math.sin(time * 0.2),
        alpha: ss(fa / 0.2) * (1 - ss((fa - 0.7) / 0.3)) * (1 - exit),
      });
      sprites.push({
        tex: "cells",
        mode: 1,
        x: cx,
        y: cy,
        size: W * 1.15 * (0.7 + 1.5 * fb),
        rot: -0.15,
        flip: true,
        alpha: ss(fb / 0.25) * 0.9 * (1 - exit),
      });
      var bub = ss((p - 0.12) / 0.05) * (1 - ss((p - 0.66) / 0.04)),
        cell = ss((p - 0.905) / 0.04);
      var mote = Math.max(0.5 * (1 - ss((p - 0.11) / 0.04)), ss((p - 0.655) / 0.05) * (1 - cell));
      // chamber to arm, one tilt: where each photo really ends on screen, and how far to travel so that the arm
      // photo's top edge always sits a strip above the chamber photo's bottom edge (the crossfade lives in that strip)
      var y2 = ss((p - 0.8) / 0.06),
        off1 = (ds.hh / H / 2) * (1 - ss((p - 0.67) / 0.1));
      var c1 = g.cam("drop", 0.4855, 0.46 + 0.5 * pan, dz);
      // the join: measured on the photos, the chamber's outlet tube is centred at x 0.4840 and 0.0201 wide, the arm
      // photo's tube at its top edge is centred at 0.4317 and 0.0092 wide. Through the tilt the arm camera's zoom and
      // centre are set so its tube lands exactly on the chamber's, same place and width (both photos share a span),
      // so the crossfade swaps one picture of the tube for another; then it moves to where the catheter enters the skin
      // under the dressing (0.456, 0.63), the point the bloodstream opens from
      // after the join the camera pulls back to show the arm on the recliner, then pushes into the cannula
      var azS = dz * (0.0201 / 0.0092) * 1.08;
      var az =
        p < 0.882 ? azS + (1.8 - azS) * ss((p - 0.856) / 0.026) : 1.8 + 2.4 * Math.pow(ss((p - 0.882) / 0.045), 2);
      var xMatch = 0.4321 - ((0.484 - c1[0]) * dz) / az; // 1.08 and 0.4321: trimmed against the rendered, still frame
      var c2 = g.cam("arm", xMatch + (0.456 - xMatch) * ss((p - 0.858) / 0.05), 0.3 + 0.33 * ss((p - 0.83) / 0.07), az);
      // that point on screen, wherever the camera is (plate(): screen = centre + (image - camera) * zoom / span)
      var sp2 = g.span("arm"),
        c3 = [0.5 + ((0.456 - c2[0]) * c2[2]) / sp2[0], 0.48 + ((0.63 - c2[1]) * c2[2]) / sp2[1]];
      var yDb = 0.48 + off1 + ((1 - c1[1]) * c1[2]) / g.span("drop")[1],
        yAt = 0.48 - (c2[1] * c2[2]) / g.span("arm")[1];
      // a long dissolve (a third of the screen) so the dark room becomes the warm one gradually; the arm photo is
      // rolled about the join so its tube continues the chamber's (they lean 2.8 degrees apart), easing back as the
      // camera pulls away to the arm. The roll tips the photo's top edge, so the band starts a margin lower.
      var rot2 = -1 * 0.049 * (1 - ss((p - 0.856) / 0.03));
      var OV = 0.36,
        TL = Math.max(0.3, yDb - yAt - OV),
        mg = Math.abs(rot2) * (W / H) * 0.55;
      var piv2 = [0.5 + ((0.484 - c1[0]) * dz) / g.span("drop")[0], yAt + mg + (OV - mg) / 2];
      g.render({
        time: time,
        surf: surf,
        c0: c0,
        r1: ss((p - 0.655) / 0.075) * 1.9,
        y2: y2,
        tl: TL,
        band: [yAt + mg + TL * (1 - y2), yDb - TL * y2],
        rot2: rot2,
        piv2: piv2,
        r3: ss((p - 0.895) / 0.05) * 1.9,
        c3: c3,
        exit: exit,
        cam0: g.cam("liquid", 0.5, 0.52 - 0.04 * ss((p - 0.2) / 0.4), lz),
        rot0: 0.55 * dive,
        cam1: c1,
        // centre the drip set in the part of the screen below the fixed header, so the bag's neck shows; it eases
        // back to the true centre as the camera moves in
        off1: off1,
        cam2: c2,
        cam3: g.cam("vessel", 0.5, 0.5, vz),
        rot3: -0.1 + 0.1 * ss((p - 0.895) / 0.1) + 0.02 * Math.sin(time * 0.3),
        // the water opens in the bag's own colour, then clears to the base fluid before each ingredient adds its own
        tint: ds.tint,
        tintAmt: Math.min(0.9, Math.max(0.62 * (1 - ss((p - 0.19) / 0.07)), 0.08 + 0.42 * (m ? sum / m : 1) + 0.4 * t)),
        paper: PAPER,
        // the drip: the scroll drives it (about four drops across the scene, backwards if you scroll back), and when
        // you stop it keeps going on its own, slowly
        drip: p * 20 + time * 0.33,
        sprites: sprites,
        travel: p * 7 + time * 0.025,
        w: [bub, mote, cell, 0],
        ptAlpha: 1 - exit,
      });
    }
    ds.cap.style.opacity = ds.railEl.style.opacity = (1 - clamp(exit * 1.6, 0, 1)).toFixed(3);
    // captions and the route rail
    var idx = p < 0.12 ? 0 : p < 0.6 ? 1 : p < 0.665 ? -1 : p < 0.86 ? 2 : p < 0.905 ? 3 : 4;
    if (idx !== ds.idx) {
      ds.idx = idx;
      ds.lines.forEach(function (l, k) {
        l.classList.toggle("on", k === idx);
      });
      ds.el.classList.toggle("is-dark", idx >= 2);
      var ri = idx < 0 ? 1 : idx;
      ds.rail.forEach(function (l, k) {
        l.classList.toggle("on", k === ri);
      });
    }
  }
  function vis(el, on) {
    el.style.visibility = on ? "visible" : "hidden";
    return on;
  }

  /* ------------------------------------------------------------------ the stack of case notes */
  // Sticky tops and heights are measured once; each frame reads the notes' positions before anything is written.
  var notes = $$(".note"),
    noteTop = [],
    noteH = [];
  function stackMeasure() {
    noteTop = notes.map(function (n) {
      return parseFloat(getComputedStyle(n).top) || 0;
    });
    noteH = notes.map(function (n) {
      return n.offsetHeight;
    });
  }
  function stackRead() {
    return notes.map(function (n) {
      return n.getBoundingClientRect().top;
    });
  }
  function stackWrite(tops) {
    notes.forEach(function (n, i) {
      if (i === notes.length - 1) return;
      var cov = clamp(1 - (tops[i + 1] - noteTop[i + 1]) / ((noteH[i] || 1) * 0.9), 0, 1);
      n.style.transform = "scale(" + (1 - 0.05 * cov).toFixed(4) + ")";
    });
  }

  /* ------------------------------------------------------------------ the vitals */
  var VIT = [
    ["sys", "Blood pressure", "systolic", "mmHg", 70, 180, 90, 140, 118, 1],
    ["dia", "Blood pressure", "diastolic", "mmHg", 40, 120, 60, 90, 76, 1],
    ["hr", "Heart rate", "", "bpm", 40, 140, 60, 100, 78, 1],
    ["spo2", "SpO₂", "", "%", 85, 100, 95, 100, 98, 1],
    ["temp", "Temperature", "", "°F", 95, 103, 97, 99.5, 98.4, 0.1],
  ];
  var vitals = $("#vitals"),
    vOut = $("#vitOut"),
    vitUser = false;
  VIT.forEach(function (v) {
    var row = document.createElement("div");
    row.className = "vrow";
    row.dataset.id = v[0];
    var pl = ((v[6] - v[4]) / (v[5] - v[4])) * 100,
      pw = ((v[7] - v[6]) / (v[5] - v[4])) * 100;
    row.innerHTML =
      '<label for="v_' +
      v[0] +
      '">' +
      v[1] +
      (v[2] ? ", " + v[2] : "") +
      "<small>Must be within " +
      v[6] +
      "–" +
      v[7] +
      " " +
      v[3] +
      "</small></label>" +
      '<div class="rng"><div class="rng__track"></div><div class="rng__ok" style="left:' +
      pl +
      "%;width:" +
      pw +
      '%"></div><input type="range" id="v_' +
      v[0] +
      '" min="' +
      v[4] +
      '" max="' +
      v[5] +
      '" step="' +
      v[9] +
      '" value="' +
      v[8] +
      '"></div>' +
      '<output for="v_' +
      v[0] +
      '"></output>';
    vitals.appendChild(row);
  });
  function vitEval() {
    var bad = [];
    VIT.forEach(function (v) {
      var inp = $("#v_" + v[0]),
        val = parseFloat(inp.value),
        row = inp.closest(".vrow"),
        ok = val >= v[6] && val <= v[7];
      $("output", row).innerHTML = (v[9] < 1 ? val.toFixed(1) : val) + "<small>" + v[3] + "</small>";
      inp.setAttribute("aria-valuetext", val + " " + v[3] + (ok ? ", within range" : ", outside its range"));
      row.classList.toggle("bad", !ok);
      if (!ok) bad.push(v[1] + (v[2] ? " " + v[2] : ""));
    });
    vOut.classList.toggle("stop", bad.length > 0);
    $("#vitSt").textContent = bad.length ? "Drip stopped" : "Clear to infuse";
    $("#vitH").textContent = bad.length ? bad[0] + " is outside its range." : "Every vital is inside its range.";
    $("#vitP").textContent = bad.length
      ? "The drip does not start, and it stays stopped until the physician clears it. The nurse calls the reviewing physician. A session that does not run is refunded in full."
      : "The nurse can go on to the next step of the checklist.";
  }
  vitals.addEventListener("input", function () {
    vitUser = true;
    vitEval();
  });
  vitEval();
  function vitDemo() {
    if (isStill()) return;
    var hr = $("#v_hr"),
      t0 = performance.now();
    (function step(now) {
      if (vitUser) return;
      var t = now - t0,
        v;
      if (t < 1300) v = 78 + 46 * ss(t / 1300);
      else if (t < 2900) v = 124;
      else if (t < 3900) v = 124 - 46 * ss((t - 2900) / 1000);
      else {
        hr.value = 78;
        vitEval();
        return;
      }
      hr.value = v;
      vitEval();
      requestAnimationFrame(step);
    })(t0);
  }

  /* ------------------------------------------------------------------ 29 steps, traced vials */
  var st = $("#steps29"),
    done = 0,
    stMsg = $("#stepMsg");
  for (var i = 1; i <= 29; i++) {
    var b = document.createElement("button");
    b.textContent = i;
    b.setAttribute("aria-label", "Step " + i);
    st.appendChild(b);
  }
  function stPaint() {
    $$("button", st).forEach(function (b, k) {
      b.classList.toggle("done", k < done);
      b.classList.toggle("next", k === done);
      b.setAttribute("aria-disabled", String(k > done));
    });
  }
  function stClose(msg) {
    if (done < 29) done++;
    stPaint();
    stMsg.className = "steps29__msg" + (done === 29 ? " ok" : "");
    stMsg.textContent = msg || (done === 29 ? "All 29 steps closed." : "");
  }
  st.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    var k = +b.textContent - 1;
    if (k < done) return;
    if (k === done) {
      stClose();
      return;
    }
    b.classList.remove("shake");
    void b.offsetWidth;
    b.classList.add("shake");
    stMsg.className = "steps29__msg";
    stMsg.textContent = "Step " + (k + 1) + " is locked: step " + (done + 1) + " is still open.";
  });
  $("#stepNext").addEventListener("click", function () {
    stClose();
  });
  stPaint();
  $("#trace").innerHTML = [
    ["Physician’s name and council number", "on your report"],
    ["Vitals before and after", "recorded"],
    ["Every dose", "recorded"],
    ["Batch numbers", "against your session"],
    ["Aftercare notes", "in your account"],
  ]
    .map(function (r) {
      return "<div><b>" + r[0] + "</b><i>" + r[1] + "</i></div>";
    })
    .join("");

  /* ------------------------------------------------------------------ the comparison */
  var VS = [
    ["Physician reviews before you book", 1, 0, 1],
    ["Comes to your home", 1, 0, 0],
    ["Batch numbers on your report", 1, 0, 1],
    ["Out-of-range vitals stop the session", 1, 0, 1],
    ["Book in under two minutes", 1, 1, 0],
    ["Named nurse with a council number", 1, 0, 1],
    ["Price known before you arrive", 1, 1, 0],
    ["Declines you when it is not right", 1, 0, 1],
  ];
  var yn = function (v) {
    return v
      ? '<span class="yn y"><i aria-hidden="true">✓</i><span>Yes</span></span>'
      : '<span class="yn n"><i aria-hidden="true"></i><span>No</span></span>';
  };
  $("#vs").innerHTML =
    '<thead><tr><td></td><th scope="col">NutriDrip</th><th scope="col">A drip bar</th><th scope="col">A hospital day-care</th></tr></thead><tbody>' +
    VS.map(function (r, i) {
      return (
        '<tr style="--i:' +
        i +
        '"><th scope="row">' +
        r[0] +
        "</th><td>" +
        yn(r[1]) +
        "</td><td>" +
        yn(r[2]) +
        "</td><td>" +
        yn(r[3]) +
        "</td></tr>"
      );
    }).join("") +
    "</tbody>";

  /* ------------------------------------------------------------------ IV or tablets: the route map */
  // The two routes' stops, as the page has always said them.
  var RT_TAB = [
    ["mouth", "Mouth", "Swallowed."],
    ["stomach", "Stomach", "It must dissolve first; B12 also needs a factor made in the stomach."],
    ["intestine", "Small intestine", "Absorption has limits; vitamin C is absorbed less efficiently at higher doses."],
    ["liver", "Liver", "Part of some doses is processed here first."],
    ["blood", "Bloodstream", "What remains, which varies by nutrient, dose and person."],
  ];
  var RT_IV = [
    ["vein", "Into a vein", "The dose goes in directly."],
    ["blood", "Bloodstream", "Straight in, with no stomach, gut or liver on the way."],
  ];
  // The tablet's road in four legs between its stops, on the plate's own 596 x 792 drawing, and how wide the line
  // runs on each: full to the gut, then thinner after the small intestine and again after the liver.
  // (placed on the glass figure, images/rt-body-glass.webp: its mouth, stomach, gut, liver, heart and the vein in its arm)
  var RT_LEGS = [
    ["M296,138 L296,250 Q298,360 305,400 Q311,414 318,420", 5],
    ["M318,420 Q348,480 298,520 Q290,525 295,520", 5],
    ["M295,520 Q240,522 232,462 Q229,416 255,395", 3.3],
    ["M255,395 Q262,352 278,318", 2],
  ];
  var RT_IVD = "M78,548 Q110,470 140,400 Q170,330 200,302 Q242,292 278,318";
  var RT_AT = {
    mouth: [296, 138, "r"],
    stomach: [318, 420, "r"],
    intestine: [295, 520, "r"],
    liver: [255, 395, "l"],
    blood: [278, 318, "l"],
    vein: [78, 548, "r"],
  };
  var rt = { el: $("#routes"), fig: $("#rmFig"), marks: {} };
  var rmEl = function (tag, a, parent) {
    var e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in a) e.setAttribute(k, a[k]);
    parent.appendChild(e);
    return e;
  };
  (function () {
    var ahead = $("#rmAhead"),
      lines = $("#rmLines"),
      stops = $("#rmStops"),
      specks = $("#rmSpecks");
    rt.legs = RT_LEGS.map(function (l) {
      rmEl("path", { d: l[0], class: "rm-ahead", style: "stroke: var(--gold)" }, ahead);
      var h = rmEl("path", { d: l[0], class: "rm-halo", "stroke-width": l[1] + 6 }, lines);
      var p = rmEl("path", { d: l[0], "stroke-width": l[1], style: "stroke: var(--gold)" }, lines);
      return { h: h, p: p, L: 0 };
    });
    rmEl("path", { d: RT_IVD, class: "rm-ahead", style: "stroke: var(--blue)" }, ahead);
    rt.ivH = rmEl("path", { d: RT_IVD, class: "rm-halo", "stroke-width": 11 }, lines);
    rt.ivP = rmEl("path", { d: RT_IVD, "stroke-width": 5, style: "stroke: var(--blue)" }, lines);
    var mark = function (key, label, color) {
      var a = RT_AT[key],
        c = rmEl("circle", { cx: a[0], cy: a[1], r: 7, class: "rm-stop" }, stops);
      c.style.color = color;
      c.style.stroke = color;
      var t = document.createElement("span");
      t.className = "rm-tag " + a[2];
      t.style.left = (a[0] / 596) * 100 + "%";
      t.style.top = (a[1] / 792) * 100 + "%";
      t.innerHTML = label;
      rt.fig.appendChild(t);
      rt.marks[key] = { c: c, t: t };
    };
    RT_TAB.forEach(function (s) {
      if (s[0] !== "blood") mark(s[0], s[1], "var(--gold)");
    });
    mark("vein", "Into a vein", "var(--blue)");
    mark("blood", "Bloodstream", "var(--blue)");
    // the specks that fall away after the small intestine (leg 2) and the liver (leg 3)
    rt.specks = [];
    [2, 3].forEach(function (k) {
      var a = RT_AT[k === 2 ? "intestine" : "liver"];
      for (var j = 0; j < 3; j++) {
        var ang = (k === 2 ? 0.4 : 3.6) + j * 0.55;
        rt.specks.push({
          c: rmEl("circle", { r: 2.6, style: "fill: var(--gold)", opacity: 0 }, specks),
          x: a[0],
          y: a[1],
          dx: Math.cos(ang),
          dy: Math.sin(ang),
          k: k,
          j: j,
        });
      }
    });
    // each card holds a row per state: not yet, then each stop, each with its own sentence and its own summary
    var card = function (id, rows, sums) {
      var c = $(id);
      $(".rm-pips", c).innerHTML = rows
        .map(function () {
          return "<i></i>";
        })
        .join("");
      var all = [["", "Not yet", "Scroll to follow the dose."]].concat(rows);
      $(".rm-card__rows", c).innerHTML = all
        .map(function (r, k) {
          return (
            '<div class="rm-row"><p class="rm-row__stop">' +
            r[1] +
            '</p><p class="rm-row__line">' +
            r[2] +
            '</p><p class="rm-row__sum">' +
            (sums[k] || "&nbsp;") +
            "</p></div>"
          );
        })
        .join("");
      return { el: c, pips: $$(".rm-pips i", c), rows: $$(".rm-row", c), at: -2 };
    };
    rt.cTab = card(
      "#rmTab",
      RT_TAB,
      [""].concat(
        RT_TAB.map(function (r, k) {
          return k === RT_TAB.length - 1 ? "In the blood, what remains" : "Stop " + (k + 1) + " of " + RT_TAB.length;
        })
      )
    );
    rt.cIv = card("#rmIv", RT_IV, ["", "On its way", "In the blood"]);
  })();
  // the lengths are read once the paths are on the page (and again if the page is measured anew)
  function rmMeasure() {
    var set = function (x, L) {
      x.style.strokeDasharray = L + " " + L;
    };
    rt.legs.forEach(function (l) {
      l.L = l.p.getTotalLength();
      set(l.h, l.L);
      set(l.p, l.L);
    });
    rt.LI = rt.ivP.getTotalLength();
    set(rt.ivH, rt.LI);
    set(rt.ivP, rt.LI);
    // on a wide plate the blood's label sits to the left of the heart, clear of the tablet's line; on a phone, above
    rt.marks.blood.t.className =
      "rm-tag " + (innerWidth <= 900 ? "t" : "l") + (rt.marks.blood.t.classList.contains("on") ? " on" : "");
  }
  // i: the state to show (-1 not yet, then each stop); prog: how far along its route, for the colour strip
  function rmCard(c, i, prog) {
    c.el.style.setProperty("--prog", prog.toFixed(3));
    c.pips.forEach(function (p, k) {
      p.classList.toggle("on", k <= i);
    });
    if (i === c.at) return;
    c.at = i;
    c.rows.forEach(function (r, k) {
      r.classList.toggle("is-on", k === i + 1);
      r.classList.toggle("is-past", k < i + 1);
    });
  }
  function rtFn(p) {
    if (!rt.LI) rmMeasure();
    // the drip: up the arm and in, early
    var v = ss((p - 0.05) / 0.17);
    rt.ivH.style.strokeDashoffset = rt.ivP.style.strokeDashoffset = (rt.LI * (1 - v)).toFixed(1);
    var b = rt.ivP.getPointAtLength(rt.LI * v),
      dIv = $("#rmDotIv"),
      dTab = $("#rmDotTab");
    dIv.setAttribute("cx", b.x);
    dIv.setAttribute("cy", b.y);
    // the tablet: four legs, a pause at each stop before it moves on
    var q = clamp((p - 0.06) / 0.84, 0, 1) * 4,
      leg = Math.min(3, Math.floor(q)),
      f = q >= 4 ? 1 : ss(clamp((q - leg - 0.22) / 0.78, 0, 1));
    rt.legs.forEach(function (l, k) {
      var done = k < leg ? 1 : k === leg ? f : 0;
      l.h.style.strokeDashoffset = l.p.style.strokeDashoffset = (l.L * (1 - done)).toFixed(1);
    });
    var a = rt.legs[leg].p.getPointAtLength(rt.legs[leg].L * f);
    dTab.setAttribute("cx", a.x);
    dTab.setAttribute("cy", a.y);
    dTab.setAttribute("r", [7, 7, 5.6, 4.4][leg]);
    dTab.style.opacity = dIv.style.opacity = p > 0.02 ? 1 : 0;
    var reached = p <= 0.06 ? -1 : q >= 4 ? 4 : leg + (f >= 0.999 ? 1 : 0); // the stops the tablet has reached: 0 = the mouth
    ["mouth", "stomach", "intestine", "liver"].forEach(function (k, i) {
      rt.marks[k].c.classList.toggle("on", reached >= i);
      rt.marks[k].t.classList.toggle("on", reached >= i);
    });
    rt.marks.vein.c.classList.toggle("on", v > 0.01);
    rt.marks.vein.t.classList.toggle("on", v > 0.01);
    var inB = v >= 0.99;
    rt.marks.blood.c.classList.toggle("on", inB);
    rt.marks.blood.t.classList.toggle("on", inB);
    rt.marks.blood.t.innerHTML =
      "Bloodstream " + (reached >= 4 ? "<i>both, by different roads</i>" : inB ? "<i>the drip, already</i>" : "");
    // the specks fall away just after the tablet leaves the small intestine and the liver
    rt.specks.forEach(function (s) {
      var u = clamp((q - s.k) / 0.55, 0, 1),
        o = u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0,
        d = 6 + u * 30 + s.j * 6;
      s.c.setAttribute("cx", (s.x + s.dx * d).toFixed(1));
      s.c.setAttribute("cy", (s.y + s.dy * d + u * 10).toFixed(1));
      s.c.setAttribute("opacity", o.toFixed(2));
    });
    // a pulse from the chest as each arrives
    $("#rmPuB1").classList.toggle("go", inB);
    $("#rmPuB2").classList.toggle("go", inB);
    $("#rmPuG").classList.toggle("go", reached >= 4);
    rmCard(rt.cIv, v <= 0.01 ? -1 : inB ? 1 : 0, v);
    rmCard(rt.cTab, reached, q / 4);
  }

  /* ------------------------------------------------------------------ zones */
  var zl = $("#zl");
  zl.innerHTML = ZONES.map(function (z, i) {
    var lim = z[2] === "limited";
    return (
      '<li style="--i:' +
      i +
      '" data-i="' +
      i +
      (lim ? '" class="lim' : "") +
      '"><b>' +
      z[0] +
      '</b><span class="pc">' +
      z[1].join(" · ") +
      '</span><span class="hr">' +
      z[3] +
      '</span><span class="st' +
      (lim ? " lim" : "") +
      '">' +
      (lim ? "Limited" : "Open") +
      "</span></li>"
    );
  }).join("");
  var pinIn = $("#pinIn"),
    pinRes = $("#pinRes");
  function pinSet(cls, b, s) {
    pinRes.className = "pin__res " + cls;
    pinRes.innerHTML = "<b>" + b + "</b><span>" + s + "</span>";
  }
  pinIn.addEventListener("input", function () {
    pinIn.value = pinIn.value.replace(/\D/g, "").slice(0, 6);
    var v = pinIn.value;
    $$("li", zl).forEach(function (l) {
      l.classList.remove("hit");
    });
    if (!v) {
      pinRes.className = "pin__res";
      pinRes.innerHTML = "<span>Six digits, and you will know.</span>";
      return;
    }
    if (v.length < 6) {
      pinRes.className = "pin__res";
      pinRes.innerHTML = "<span>" + (6 - v.length) + " more digit" + (6 - v.length > 1 ? "s" : "") + ".</span>";
      return;
    }
    var hit = -1;
    ZONES.forEach(function (z, i) {
      if (z[1].indexOf(v) >= 0) hit = i;
    });
    if (hit < 0) {
      pinSet(
        "no",
        "No. That pincode isn’t in our " + ZONES.length + " zones.",
        "Check the list, or try another pincode."
      );
      return;
    }
    var z = ZONES[hit],
      li = $('li[data-i="' + hit + '"]', zl);
    li.classList.add("hit");
    if (z[2] === "limited") pinSet("lim", "Yes, with limited availability.", z[0] + " · " + z[3]);
    else pinSet("yes", "Yes. We come to " + z[0] + ".", "Open · " + z[3]);
  });

  /* ------------------------------------------------------------------ price */
  var lad = $("#lad");
  lad.innerHTML = DRIPS.slice()
    .sort(function (a, b) {
      return a.price - b.price;
    })
    .map(function (d, i) {
      return (
        '<button data-id="' +
        d.id +
        '" style="--i:' +
        i +
        '" aria-label="' +
        d.name +
        ", " +
        money(d.price) +
        ', see what goes in"><b>' +
        d.name +
        '</b><span class="bar"><i style="--w:' +
        (d.price / 11000).toFixed(4) +
        ";--c:" +
        d.tint +
        '"></i></span><span class="num">' +
        money(d.price) +
        '<span class="tm">' +
        d.time +
        "</span></span></button>"
      );
    })
    .join("");
  lad.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (state.cmp) cmpBtn.click();
    selectDrip(b.dataset.id, { scroll: true });
  });
  var polIn = $("#polIn"),
    polOut = $("#polOut");
  $("#polOk").style.cssText = "left:" + (4 / 12) * 100 + "%;width:" + (8 / 12) * 100 + "%";
  function polSet() {
    var h = parseFloat(polIn.value),
      free = h >= LATE.windowHours;
    polOut.className = "pol__out " + (free ? "free" : "fee");
    polOut.innerHTML =
      "<b>" +
      (free ? "Free" : money(LATE.fee)) +
      "</b><span>" +
      (h === 0 ? "at the door" : h + (h === 1 ? " hour" : " hours") + " before your slot") +
      (free ? "" : ", the nurse already dispatched") +
      "</span>";
  }
  polIn.addEventListener("input", polSet);
  polSet();

  /* ------------------------------------------------------------------ FAQ */
  var qa = $("#qa");
  qa.innerHTML = FAQ.map(function (f, i) {
    return (
      '<div class="qa__i"><button class="qa__q" aria-expanded="false" aria-controls="qa' +
      i +
      '" id="qq' +
      i +
      '">' +
      f[0] +
      '<i aria-hidden="true"></i></button><div class="qa__a" id="qa' +
      i +
      '" role="region" aria-labelledby="qq' +
      i +
      '"><div><p>' +
      f[1] +
      "</p></div></div></div>"
    );
  }).join("");
  qa.addEventListener("click", function (e) {
    var q = e.target.closest(".qa__q");
    if (!q) return;
    var open = q.getAttribute("aria-expanded") === "true";
    $$(".qa__q", qa).forEach(function (x) {
      x.setAttribute("aria-expanded", "false");
    });
    q.setAttribute("aria-expanded", String(!open));
  });

  /* ------------------------------------------------------------------ reveals */
  var io = new IntersectionObserver(
    function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        io.unobserve(e.target);
        if (e.target === vitals.parentNode) setTimeout(vitDemo, 500);
        if (e.target === st) {
          var n = 0;
          (function t() {
            if (n++ < 6 && done < 6 && !isStill()) {
              stClose("");
              setTimeout(t, 130);
            }
          })();
        }
      });
    },
    { threshold: 0.18, rootMargin: "0px 0px -6% 0px" }
  );
  $$(".rv, #vs, #zl, #lad").forEach(function (el) {
    io.observe(el);
  });
  io.observe(vitals.parentNode);
  io.observe(st);
  // the bench fills the first time it is seen
  var bio = new IntersectionObserver(
    function (es) {
      if (es[0].isIntersecting) {
        benchSeen = true;
        renderBench(byId(state.id), true);
        bio.disconnect();
      }
    },
    { threshold: 0.3 }
  );
  bio.observe(bench);

  /* ------------------------------------------------------------------ the scroll loop */
  // Each pinned act's place on the page is measured once, and again whenever the page's height changes; nothing
  // is measured while scrolling. Progress glides toward the scroll position, so a wheel's steps become one motion.
  // The statement and the dose acts also run on a clock while they are on screen.
  var PINS = [
    { el: sta.el, fn: staFn },
    { el: doc.el, fn: docFn },
    { el: ds.el, fn: dsFn, live: true },
    { el: rt.el, fn: rtFn },
    { el: hero.el, fn: heroFn, live: true },
  ];
  PINS.forEach(function (pn) {
    pn.top = 0;
    pn.len = 1;
    pn.cur = 0;
    pn.target = 0;
    pn.on = false;
    pn.was = false;
    pn.dirty = true;
  });
  var stackSec = $("#stack"),
    stackTop = 0,
    stackBot = 0,
    raf = 0,
    last = 0,
    clock = 0;
  function measure() {
    var y = window.scrollY,
      vh = innerHeight;
    PINS.forEach(function (pn) {
      var r = pn.el.getBoundingClientRect();
      pn.top = r.top + y;
      pn.len = Math.max(1, r.height - vh);
      pn.dirty = true;
    });
    var sr = stackSec.getBoundingClientRect();
    stackTop = sr.top + y;
    stackBot = sr.bottom + y;
    staMeasure();
    docMeasure();
    rmMeasure();
    dsMeasure();
    stackMeasure();
    ringMeasure();
    if (isStill()) ringStill();
  }
  function targets() {
    var y = window.scrollY,
      vh = innerHeight;
    PINS.forEach(function (pn) {
      pn.target = clamp((y - pn.top) / pn.len, 0, 1);
      pn.on = y > pn.top - vh * 1.1 && y < pn.top + pn.len + vh * 1.1;
    });
    return y;
  }
  function stillRender() {
    staFn(1, 0);
    docStill();
    rtFn(1);
    ringStill();
  }
  function loop(now) {
    raf = 0;
    if (isStill()) {
      stillRender();
      return;
    }
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    clock += dt;
    var vh = innerHeight,
      y = targets(),
      busy = false;
    var st = y > stackTop - vh * 1.2 && y < stackBot + 200 ? stackRead() : null; // reads before any writes
    var k = 1 - Math.exp(-dt * 9);
    PINS.forEach(function (pn) {
      if (!pn.on) {
        pn.was = false;
        return;
      }
      if (!pn.was) {
        pn.cur = pn.target;
        pn.was = true;
        pn.dirty = true;
      } // arriving from afar: no catch-up run
      var d = pn.target - pn.cur;
      pn.cur = Math.abs(d) < 0.0003 ? pn.target : pn.cur + d * k;
      var moving = pn.cur !== pn.target;
      if (moving || pn.live || pn.dirty) {
        pn.fn(pn.cur, clock);
        pn.dirty = false;
      }
      if (moving || pn.live) busy = true;
    });
    if (st) stackWrite(st);
    if (busy) raf = requestAnimationFrame(loop);
    else last = 0;
  }
  function kick() {
    if (!raf) raf = requestAnimationFrame(loop);
  }
  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", function () {
    measure();
    kick();
  });
  if (window.ResizeObserver)
    new ResizeObserver(function () {
      measure();
      kick();
    }).observe(document.body);

  // a refresh starts at the top (with the head of index.html, which stops the browser restoring the old place)
  var navEntry = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
  if (navEntry && navEntry.type === "reload") window.scrollTo(0, 0);
  // The first paint needs only the ring and its caption: the rest that shows the chosen drip is built just after it
  // (building it all first, and laying the page out for it, held the first paint back by most of a second).
  (function () {
    var d = byId(state.id);
    $$(".dcard", rail).forEach(function (c) {
      c.setAttribute("aria-pressed", String(c.dataset.id === d.id));
    });
    heroSet(d, {});
    requestAnimationFrame(function () {
      setTimeout(function () {
        selectRest(byId(state.id));
        measure();
        PINS.forEach(function (pn) {
          pn.dirty = true;
        });
        if (isStill()) stillRender();
        kick();
      }, 0);
    });
  })();
  // the folded drape is on screen from the statement's first frame: decode its photograph while the page is idle,
  // so its first paint does not land on a scroll frame (the same file the stylesheet asks for at this width)
  (
    window.requestIdleCallback ||
    function (f) {
      setTimeout(f, 300);
    }
  )(function () {
    var im = new Image();
    im.src = "images/field-drape" + (matchMedia("(max-width: 800px)").matches ? "-m" : "") + ".webp";
    if (im.decode) im.decode().catch(function () {});
  });
  measure();
  targets();
  PINS.forEach(function (pn) {
    pn.cur = pn.target;
  });
  if (isStill()) stillRender();
  else {
    PINS.forEach(function (pn) {
      pn.fn(pn.cur, 0);
    });
    kick();
  }
  if (document.fonts && document.fonts.ready)
    document.fonts.ready.then(function () {
      measure();
      kick();
    });
})();

/* NutriDrip landing v2, prototype: the white sections. In the port these are
   server components reading the database; here they are filled from the data
   island so the prototype shows the real catalogue. The engine is mounted
   untouched. */
(function () {
  "use strict";
  var data = JSON.parse(document.getElementById("page-data").textContent || "{}");
  var root = document.documentElement;
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var inr = function (n) {
    return "₹" + Number(n).toLocaleString("en-IN");
  };

  function ready() {
    root.classList.add("page-ready");
  }
  if (document.readyState === "complete") ready();
  else
    addEventListener("load", function () {
      (window.requestIdleCallback || setTimeout)(ready, { timeout: 1200 });
    });

  document.querySelectorAll("[data-drip-count]").forEach(function (el) {
    el.textContent = (data.drips || []).length;
  });

  // By goal: the catalogue's own categories, with the live count of each.
  var CATS = [
    ["Energy", "Fatigue that sleep has not fixed", "goal-energy"],
    ["Immunity", "Before travel, after illness", "goal-immunity"],
    ["Skin", "Glutathione protocols", "goal-skin"],
    ["Hydration", "The fastest session we run", "goal-hydration"],
    ["Athletic recovery", "After the effort, not before", "goal-athletic"],
    ["Post-viral", "The flat weeks afterwards", "goal-postviral"],
  ];
  var goals = document.querySelector("[data-goals]");
  if (goals)
    goals.innerHTML = CATS.map(function (c) {
      var n = (data.drips || []).filter(function (d) {
        return d.category === c[0];
      }).length;
      return (
        '<li class="goal"><a href="/drips?goal=' +
        encodeURIComponent(c[0]) +
        '"><img src="assets/site/' +
        c[2] +
        '.jpg" alt="" loading="lazy" width="800" height="600"><span class="goal__txt"><b>' +
        esc(c[0]) +
        "</b><span>" +
        esc(c[1]) +
        " · " +
        n +
        " drip" +
        (n === 1 ? "" : "s") +
        "</span></span></a></li>"
      );
    }).join("");

  // Most booked: the drips the super admin ticked "Most popular".
  var pop = document.querySelector("[data-popular]");
  if (pop)
    pop.innerHTML = (data.drips || [])
      .filter(function (d) {
        return d.isPopular;
      })
      .slice(0, 4)
      .map(function (d) {
        var mins = d.durationToMin ? d.durationMin + " to " + d.durationToMin + " min" : d.durationMin + " min";
        return (
          '<li><a class="dcard" href="/drips/' +
          d.slug +
          '"><span class="dcard__cat">' +
          esc(d.category) +
          "</span><b>" +
          esc(d.name) +
          '</b><span class="dcard__tag">' +
          esc(d.tagline || "") +
          '</span><span class="dcard__meta"><span>' +
          inr(d.priceInr) +
          "</span><span>" +
          mins +
          "</span></span></a></li>"
        );
      })
      .join("");

  var CMP = [
    ["Physician reviews before you book", [1, 0, 1]],
    ["Comes to your home", [1, 0, 0]],
    ["Batch numbers on your report", [1, 0, 1]],
    ["Out-of-range vitals stop the session", [1, 0, 1]],
    ["Book in under two minutes", [1, 1, 0]],
    ["Named nurse with a council number", [1, 0, 1]],
    ["Price known before you arrive", [1, 1, 0]],
    ["Declines you when it is not right", [1, 0, 1]],
  ];
  var cmp = document.querySelector("[data-compare]");
  if (cmp)
    cmp.innerHTML =
      '<div class="cmp__row cmp__row--head" role="row"><span role="columnheader"></span><span role="columnheader">NutriDrip</span><span role="columnheader">A drip bar</span><span role="columnheader">A hospital day-care</span></div>' +
      CMP.map(function (r) {
        return (
          '<div class="cmp__row" role="row"><span role="rowheader">' +
          esc(r[0]) +
          "</span>" +
          r[1]
            .map(function (v) {
              return (
                '<span role="cell">' +
                (v ? '<span class="cmp__yes">✓ Yes</span>' : '<span class="cmp__no">No</span>') +
                "</span>"
              );
            })
            .join("") +
          "</div>"
        );
      }).join("");

  var FAQ = [
    [
      "Does a real doctor look at my quiz?",
      "Yes. A registered physician reads every submission and either approves the protocol, changes the doses, or declines it. Their name and council registration number appear on your session report.",
    ],
    [
      "Do I have to take the quiz every time I book?",
      "No. One approval covers all your bookings for 90 days. It lapses after that because a physician's approval is a judgement about you on the day: weight, medication and kidney function all move.",
    ],
    [
      "What if the nurse finds something wrong?",
      "The 29-step checklist gates the session. If your vitals fall outside the reference range the infusion does not start: the nurse escalates to the reviewing physician, and a session that does not run is refunded in full.",
    ],
    [
      "Can I cancel or reschedule?",
      "[At the port this answer is filled from the late-change rule and fees on the Billing page.]",
    ],
    [
      "Do you serve my pincode?",
      "We cover " +
        (data.zones || 14) +
        " zones across Bengaluru. Enter your pincode at booking and you get a straight yes or no, not a waitlist.",
    ],
    [
      "What happens to my health data?",
      "Your record is visible to you, the reviewing physician and the attending nurse. Nobody else. Access attempts are logged, and you can export or delete your record from your profile at any time.",
    ],
  ];
  var faq = document.querySelector("[data-faq]");
  if (faq)
    faq.innerHTML = FAQ.map(function (f) {
      return "<details><summary>" + esc(f[0]) + "</summary><p>" + esc(f[1]) + "</p></details>";
    }).join("");

  // How it works: the picture follows whichever step is at mid-screen.
  var pics = document.querySelectorAll("[data-step-pic]");
  if ("IntersectionObserver" in window && pics.length) {
    var io = new IntersectionObserver(
      function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          var k = e.target.getAttribute("data-step");
          pics.forEach(function (p) {
            p.classList.toggle("is-on", p.getAttribute("data-step-pic") === k);
          });
        });
      },
      { rootMargin: "-46% 0px -46% 0px" }
    );
    document.querySelectorAll("[data-step]").forEach(function (li) {
      io.observe(li);
    });
  }

  // Loops wait for idle and pause offscreen, as the live site's do.
  var track = document.querySelector("[data-pause-offscreen]");
  if (track && "IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        track.style.animationPlayState = e.isIntersecting ? "running" : "paused";
      });
    }).observe(track);
  }

  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var asm = document.querySelector("[data-assembly]");
  if (asm && reduce) {
    // No pin under reduced motion: assembly.js lays the act out as still frames.
    asm.setAttribute("data-sc-act", "flow");
    asm.removeAttribute("data-sc-span");
  }
  window.__scroll = ScrollCraft.mount(document.getElementById("sc-root"));
})();

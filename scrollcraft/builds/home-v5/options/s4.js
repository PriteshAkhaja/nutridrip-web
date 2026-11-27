/* Section 4 option previews: what the three share. The heading, the goal chips, the compare switch, the chosen drip's
   card, and the state (which drip, which goal, which are picked to compare). Everything comes from KIT (kit.js, built
   from ../app.js), so the counts, prices and doses are the page's own. */
window.S4 = (function () {
  "use strict";
  var K = KIT,
    $ = function (s, r) {
      return (r || document).querySelector(s);
    },
    $$ = function (s, r) {
      return Array.prototype.slice.call((r || document).querySelectorAll(s));
    };
  var st = { id: K.byId(K.FIRST).id, goal: "All", cmp: false, picks: [], on: [] };
  var emit = function () {
    st.on.forEach(function (f) {
      f(st);
    });
  };
  function head(el) {
    var n = K.DRIPS.length;
    el.innerHTML =
      '<div class="s4h"><div><p class="kick">The formulary</p><h2 id="s4h">' +
      K.upFirst(K.word(n)) +
      " drips. <em>Every ingredient</em> in view.</h2></div>" +
      '<p class="lede">Every bag is 500 mL and every drip needs a physician’s approval. Choose by goal, open one up, or put up to three side by side.</p></div>' +
      '<div class="s4bar"><div class="s4chips" role="group" aria-label="Choose by goal"></div><button class="chip s4cmp" aria-pressed="false">Compare drips</button></div>' +
      '<p class="drips__goal s4line" aria-live="polite"></p>';
    var chips = $(".s4chips", el),
      line = $(".s4line", el),
      cmp = $(".s4cmp", el);
    var mk = function (label, key) {
      var b = document.createElement("button");
      b.className = "chip";
      b.textContent = label;
      b.dataset.k = key;
      b.setAttribute("aria-pressed", key === st.goal ? "true" : "false");
      chips.appendChild(b);
    };
    mk("All", "All");
    K.GOALS.forEach(function (g) {
      mk(g[0], g[0]);
    });
    var count = ""; // no count under the chips (the user, 2026-11-26)
    line.textContent = count;
    chips.addEventListener("click", function (e) {
      var b = e.target.closest(".chip");
      if (!b) return;
      st.goal = b.dataset.k;
      $$(".chip", chips).forEach(function (c) {
        c.setAttribute("aria-pressed", c === b ? "true" : "false");
      });
      var g = K.GOALS.filter(function (x) {
        return x[0] === st.goal;
      })[0];
      line.textContent = g ? g[0] + ": " + g[1] : count;
      var vis = shown();
      if (
        vis.length &&
        !vis.some(function (d) {
          return d.id === st.id;
        }) &&
        !st.cmp
      )
        st.id = vis[0].id;
      emit();
    });
    cmp.addEventListener("click", function () {
      st.cmp = !st.cmp;
      cmp.setAttribute("aria-pressed", st.cmp ? "true" : "false");
      cmp.textContent = st.cmp ? "Done comparing" : "Compare drips";
      st.picks = st.cmp ? [st.id] : [];
      emit();
    });
  }
  var shown = function () {
    return K.DRIPS.filter(function (d) {
      return st.goal === "All" || d.goal === st.goal;
    });
  };
  // choosing a drip: open it, or, while comparing, add it (up to three) or take it out
  function choose(id) {
    if (st.cmp) {
      var i = st.picks.indexOf(id);
      if (i >= 0) st.picks.splice(i, 1);
      else {
        st.picks.push(id);
        if (st.picks.length > 3) st.picks.shift();
      }
    } else st.id = id;
    emit();
  }
  function card(d) {
    return (
      '<div class="s4card" style="--tint:' +
      d.tint +
      '"><h3>' +
      d.name +
      "</h3>" +
      (d.tag ? '<p class="s4card__tag">' + d.tag + "</p>" : "") +
      '<p class="s4card__price">' +
      K.money(d.price) +
      '</p><p class="s4card__meta">' +
      d.time +
      " · " +
      d.goal +
      "</p>" +
      '<p class="kick">What it is</p><p>' +
      d.desc +
      "</p>" +
      (d.best ? '<p class="kick">Best for</p><p>' + d.best + "</p>" : "") +
      (d.know && d.know.length
        ? '<p class="kick">Good to know</p><ul>' +
          d.know
            .map(function (k) {
              return "<li>" + k + "</li>";
            })
            .join("") +
          "</ul>"
        : "") +
      '<a class="btn s4card__go" href="/quiz">Take the health quiz · 3 min<i></i></a><p class="s4card__fine">Needs a physician’s approval.</p></div>'
    );
  }
  // the ingredients of the picked drips, lined up row by row, for compare
  function cmpTable(ids) {
    var ds = ids.map(K.byId),
      names = [];
    ds.forEach(function (d) {
      d.items.forEach(function (it) {
        if (names.indexOf(it[0]) < 0) names.push(it[0]);
      });
    });
    var cell = function (d, n) {
      var it = d.items.filter(function (x) {
        return x[0] === n;
      })[0];
      return it ? "<b>" + it[1] + "</b>" + (it[3] ? "<i>beside the bag</i>" : "") : '<span class="s4cmp__no">—</span>';
    };
    return (
      '<div class="s4cmpt" style="--n:' +
      ds.length +
      '"><div class="s4cmpt__row s4cmpt__hd"><span></span>' +
      ds
        .map(function (d) {
          return (
            '<span style="--tint:' +
            d.tint +
            '"><div class="s4cmpt__bag">' +
            K.bagHTML(d, false, 0.92) +
            "</div><b>" +
            d.name +
            "</b><em>" +
            K.money(d.price) +
            " · " +
            d.time +
            "</em></span>"
          );
        })
        .join("") +
      "</div>" +
      '<div class="s4cmpt__row"><span>Base fluid</span>' +
      ds
        .map(function (d) {
          return "<span>" + d.base + "</span>";
        })
        .join("") +
      "</div>" +
      names
        .map(function (n) {
          return (
            '<div class="s4cmpt__row"><span>' +
            n +
            "</span>" +
            ds
              .map(function (d) {
                return "<span>" + cell(d, n) + "</span>";
              })
              .join("") +
            "</div>"
          );
        })
        .join("") +
      "</div>"
    );
  }
  return {
    K: K,
    st: st,
    head: head,
    shown: shown,
    choose: choose,
    card: card,
    cmpTable: cmpTable,
    on: function (f) {
      st.on.push(f);
      f(st);
    },
    $: $,
    $$: $$,
  };
})();

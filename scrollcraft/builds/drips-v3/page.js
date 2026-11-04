/* NutriDrip Drips list prototype (BRIEF.md). The goal chips and the search
   narrow the grid at once, and keep the address in step (?goal=&q=), so a
   filtered list can be shared; without the script, the chips are links and
   the search a form, and the page answers them. The cards that stay glide to
   their new places, as the list page did before. The engine draws the
   reading bar, reveals the close and tilts the bags. */
(function () {
  "use strict";
  var doc = document;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function $(s, c) {
    return (c || doc).querySelector(s);
  }
  function $$(s, c) {
    return Array.prototype.slice.call((c || doc).querySelectorAll(s));
  }

  var cards = $$("[data-card]"),
    chips = $$("[data-goal-chip]");
  var input = $("#dl-q"),
    form = $("[data-search-form]"),
    goalField = $("[data-goal-field]");
  var countEl = $("[data-count]"),
    none = $("[data-none]"),
    noneText = $("[data-none-text]");
  var total = cards.length;

  // As src/lib/data/drip-search.ts: every word, anywhere, in any order.
  function normalise(v) {
    return v
      .toLowerCase()
      .replace(/[^a-z0-9%+\s.-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  function matches(card, q) {
    var terms = normalise(q).split(" ").filter(Boolean);
    var hay = card.getAttribute("data-search");
    return terms.every(function (t) {
      return hay.indexOf(t) >= 0;
    });
  }

  var state = { goal: "", q: "" };
  function readUrl() {
    var p = new URLSearchParams(location.search);
    state.goal = p.get("goal") || "";
    state.q = p.get("q") || "";
  }
  function writeUrl(push) {
    var p = new URLSearchParams();
    if (state.goal) p.set("goal", state.goal);
    if (state.q.trim()) p.set("q", state.q.trim());
    var url = location.pathname + (p.toString() ? "?" + p : "");
    history[push ? "pushState" : "replaceState"](null, "", url);
  }
  function chipHref(goal) {
    var p = new URLSearchParams();
    if (goal) p.set("goal", goal);
    if (state.q.trim()) p.set("q", state.q.trim());
    return "/drips" + (p.toString() ? "?" + p : "");
  }

  function apply(animate) {
    // First: where the cards that are showing sit now.
    var before = new Map();
    if (animate && !reduce)
      cards.forEach(function (c) {
        if (!c.hidden) before.set(c, c.getBoundingClientRect());
      });
    var shown = 0;
    cards.forEach(function (c) {
      var on = (!state.goal || c.getAttribute("data-goal") === state.goal) && matches(c, state.q);
      c.hidden = !on;
      if (on) shown++;
    });
    chips.forEach(function (a) {
      var g = a.getAttribute("data-goal-chip");
      if (g === state.goal) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
      a.setAttribute("href", chipHref(g));
    });
    goalField.value = state.goal;
    countEl.textContent =
      shown === total ? "Showing all " + total + " drips" : "Showing " + shown + " of " + total + " drips";
    none.hidden = shown > 0;
    if (!shown)
      noneText.textContent = "Nothing matches “" + state.q.trim() + "”. Try a drug name, or part of the drip's name.";
    if (!animate || reduce) return;
    // Last, invert, play: a card that stayed glides from where it was; one
    // that has just come in fades up in place.
    cards.forEach(function (c) {
      if (c.hidden) return;
      var was = before.get(c);
      var now = c.getBoundingClientRect();
      c.style.transition = "none";
      if (was) {
        var dx = was.left - now.left,
          dy = was.top - now.top;
        if (!dx && !dy) return;
        c.style.transform = "translate(" + dx + "px," + dy + "px)";
      } else {
        c.style.opacity = "0";
        c.style.transform = "translateY(10px)";
      }
      void c.offsetWidth;
      c.style.transition = "transform 320ms cubic-bezier(.2,.7,.2,1), opacity 240ms cubic-bezier(.2,.7,.2,1)";
      c.style.transform = "";
      c.style.opacity = "";
    });
  }

  chips.forEach(function (a) {
    a.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; // a new tab keeps the link's own behaviour
      e.preventDefault();
      state.goal = a.getAttribute("data-goal-chip");
      writeUrl(true);
      apply(true);
    });
  });
  var typing = 0;
  input.addEventListener("input", function () {
    clearTimeout(typing);
    typing = setTimeout(function () {
      state.q = input.value;
      writeUrl(false);
      apply(true);
    }, 120);
  });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearTimeout(typing);
    state.q = input.value;
    writeUrl(false);
    apply(true);
    input.blur();
  });
  $("[data-clear]").addEventListener("click", function (e) {
    e.preventDefault();
    state.q = "";
    input.value = "";
    writeUrl(true);
    apply(true);
    input.focus();
  });
  addEventListener("popstate", function () {
    readUrl();
    input.value = state.q;
    apply(true);
  });

  // ---------------------------------------------------- menu (the app's header does this)
  var menu = $("[data-menu-btn]"),
    ledger = $("#nd-ledger");
  if (menu && ledger)
    menu.addEventListener("click", function () {
      var on = !ledger.classList.contains("is-open");
      ledger.classList.toggle("is-open", on);
      menu.setAttribute("aria-expanded", on ? "true" : "false");
    });

  readUrl();
  input.value = state.q;
  apply(false);
  window.ND_SC = ScrollCraft.mount(doc.getElementById("sc-root"));
  doc.body.classList.add("nd-js");
})();

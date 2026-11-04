/* NutriDrip v2: shared page behaviour. Chosen drip, question ledger, sticky
   bar, contact fill-in, WhatsApp forms, practitioner gate. */
(function () {
  "use strict";
  var ND = window.ND, doc = document, root = doc.documentElement;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function sstore(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }

  // ------------------------------------------------------------ chosen drip
  var listeners = [];
  function chosen() {
    var q = new URLSearchParams(location.search).get("drip");
    if (q && ND.byId(q)) return q;
    var page = doc.body.getAttribute("data-drip");
    if (page && ND.byId(page)) return page;
    var s = store("nd-drip");
    return s && ND.byId(s) ? s : null;
  }
  function setChosen(id, why) {
    if (id && !ND.byId(id)) id = null;
    if (id) store("nd-drip", id);
    paintChosen(id);
    listeners.forEach(function (f) { f(id, why); });
  }
  function paintChosen(id) {
    var d = id ? ND.byId(id) : null;
    $$("[data-chosen-name]").forEach(function (el) { el.textContent = d ? d.name : (el.getAttribute("data-chosen-empty") || "your drip"); });
    $$("[data-chosen-price]").forEach(function (el) { el.textContent = d ? ND.rupees(d.price) : "From " + ND.rupees(5000); });
    $$("[data-chosen-tint]").forEach(function (el) { if (d) el.style.setProperty("--tint", d.tint); });
    $$("select[name=drip]").forEach(function (s) { if (d) s.value = d.id; });
    $$("a[data-book-link]").forEach(function (a) { var u = a.getAttribute("href").split("#"), path = u[0].split("?")[0]; if (!path) return; a.setAttribute("href", path + (d ? "?drip=" + d.id : "") + (u[1] ? "#" + u[1] : "")); });
  }
  ND.chosen = chosen; ND.setChosen = setChosen; ND.onChosen = function (f) { listeners.push(f); };

  // ------------------------------------------------------------ contact
  var C = ND.CONTACT;
  var fallbacks = { address: "Shared when you book", hours: "By appointment", cities: "Telangana", homeArea: "Ask us about your area when you book" };
  $$("[data-contact]").forEach(function (el) { var k = el.getAttribute("data-contact"); el.textContent = C[k] || fallbacks[k] || ""; });
  $$("a[data-tel]").forEach(function (a) { a.href = "tel:" + C.phone.replace(/\s/g, ""); });
  function waUrl(text) { return "https://wa.me/" + C.whatsapp + (text ? "?text=" + encodeURIComponent(text) : ""); }
  $$("a[data-wa]").forEach(function (a) { a.href = waUrl(a.getAttribute("data-wa") || "Hello NutriDrip, I'd like to book a consultation."); a.target = "_blank"; a.rel = "noopener"; });
  ND.waUrl = waUrl;

  // ------------------------------------------------------------ drip selects
  $$("select[name=drip]").forEach(function (s) {
    var keep = s.innerHTML;
    var groups = {};
    ND.DRIPS.forEach(function (d) { (groups[d.cat] = groups[d.cat] || []).push(d); });
    var html = '<option value="">Not sure yet: let the doctor suggest</option>';
    Object.keys(groups).forEach(function (g) {
      html += '<optgroup label="' + g + '">' + groups[g].map(function (d) { return '<option value="' + d.id + '">' + d.name + " (" + ND.rupees(d.price) + ")</option>"; }).join("") + "</optgroup>";
    });
    s.innerHTML = keep + html;
    s.addEventListener("change", function () { if (s.value) setChosen(s.value, "form"); });
  });

  // ------------------------------------------------------------ the ledger
  var bar = $(".nd-bar"), ledger = $("#nd-ledger"), lbtn = $("[data-ledger-btn]");
  var qs = $$("[data-q]");
  if (ledger) {
    var list = $("ol", ledger);
    if (list && qs.length) {
      list.innerHTML = qs.map(function (s, i) {
        return '<li><a href="#' + s.id + '" data-qi="' + i + '"><span class="tick" aria-hidden="true"></span><span>' + s.getAttribute("data-q") + "</span></a></li>";
      }).join("");
    }
    function toggle(open) {
      var on = open === undefined ? !ledger.classList.contains("is-open") : open;
      ledger.classList.toggle("is-open", on);
      $$("[data-ledger-btn],[data-menu-btn]").forEach(function (b) { b.setAttribute("aria-expanded", on ? "true" : "false"); });
      if (on) { var f = $("a", ledger); if (f) f.focus({ preventScroll: true }); }
    }
    $$("[data-ledger-btn],[data-menu-btn]").forEach(function (b) { b.addEventListener("click", function (e) { e.stopPropagation(); toggle(); }); });
    ledger.addEventListener("click", function (e) { if (e.target.closest("a")) toggle(false); });
    doc.addEventListener("click", function (e) { if (!ledger.contains(e.target)) toggle(false); });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && ledger.classList.contains("is-open")) { toggle(false); if (lbtn) lbtn.focus(); } });
  }
  var done = {};
  function ledgerTick() {
    if (!qs.length) return;
    var vh = innerHeight, now = 0;
    qs.forEach(function (s, i) {
      var r = s.getBoundingClientRect();
      if (r.top < vh * 0.45) now = i;
      if (r.bottom < vh * 0.55) done[i] = true;
    });
    var answered = Object.keys(done).length;
    if (lbtn) {
      $(".nd-ledger-btn__count", lbtn).textContent = answered + "/" + qs.length;
      $(".nd-ledger-btn__q", lbtn).textContent = qs[now].getAttribute("data-q");
    }
    $$("a[data-qi]").forEach(function (a) {
      var i = +a.getAttribute("data-qi");
      a.parentNode.classList.toggle("is-done", !!done[i]);
      a.classList.toggle("is-now", i === now);
      if (i === now) a.setAttribute("aria-current", "step"); else a.removeAttribute("aria-current");
    });
  }

  // ------------------------------------------------------------ sticky bar
  var sticky = $(".nd-sticky"), hero = $("[data-hero]");
  function stickyTick() {
    if (!sticky) return;
    var after = hero ? hero.getBoundingClientRect().bottom < innerHeight * 0.35 : scrollY > innerHeight * 0.6;
    var slip = $("#book");
    var atSlip = slip && slip.getBoundingClientRect().top < innerHeight * 0.8 && slip.getBoundingClientRect().bottom > 0;
    var bld = $("#build"), inBuild = false;
    if (bld) { var br = bld.getBoundingClientRect(); inBuild = br.top < innerHeight * 0.5 && br.bottom > innerHeight * 0.5; }
    sticky.classList.toggle("is-on", after && !atSlip && !inBuild);
  }
  var ticking = false;
  function onScroll() { if (ticking) return; ticking = true; requestAnimationFrame(function () { ticking = false; ledgerTick(); stickyTick(); }); }
  addEventListener("scroll", onScroll, { passive: true }); addEventListener("resize", onScroll);
  onScroll();

  // ------------------------------------------------------------ forms
  function err(field, msg) {
    var wrap = field.closest(".nd-field") || field.parentNode, e = $(".nd-err", wrap);
    field.setAttribute("aria-invalid", msg ? "true" : "false");
    if (e) e.textContent = msg || "";
    return !msg;
  }
  function wireForm(form, build) {
    var out = $(".nd-out", form.parentNode), pre = out && $("pre", out), wa = out && $("[data-out-wa]", out), status = out && $(".nd-status", out);
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var r = build(form);
      if (!r) { var bad = $('[aria-invalid="true"]', form); if (bad) bad.focus(); return; }
      pre.textContent = r;
      wa.href = waUrl(r); wa.target = "_blank"; wa.rel = "noopener";
      out.hidden = false;
      status.textContent = "Your message is ready. Nothing is sent until you press send in WhatsApp.";
      out.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
      wa.focus({ preventScroll: true });
    });
    var copy = out && $("[data-out-copy]", out);
    if (copy) copy.addEventListener("click", function () {
      var t = pre.textContent;
      function sel() { var rg = doc.createRange(); rg.selectNodeContents(pre); var s = getSelection(); s.removeAllRanges(); s.addRange(rg); status.textContent = "Selected. Press Ctrl+C or Cmd+C to copy."; }
      try { navigator.clipboard.writeText(t).then(function () { status.textContent = "Copied. Paste it into WhatsApp or SMS to the NutriDrip team. Nothing has been sent."; }, sel); } catch (e) { sel(); }
    });
  }
  function mobileOk(f) { var d = f.value.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, ""); return /^[6-9]\d{9}$/.test(d) ? d : null; }
  function consentOk(form) { var c = $("input[name=consent]", form); var ok = c.checked; var e = $(".nd-err", c.closest(".nd-consent").parentNode); if (e) e.textContent = ok ? "" : "Please tick to agree before we prepare your message."; c.setAttribute("aria-invalid", ok ? "false" : "true"); return ok; }

  $$("form[data-book-form]").forEach(function (form) {
    wireForm(form, function (f) {
      var name = f.elements.name, mob = f.elements.mobile, ok = true, m;
      ok = err(name, name.value.trim() ? "" : "Please enter your name.") && ok;
      m = mobileOk(mob); ok = err(mob, m ? "" : "Please enter a 10-digit Indian mobile number.") && ok;
      ok = consentOk(f) && ok;
      if (!ok) return null;
      var d = ND.byId(f.elements.drip.value), where = (f.querySelector("input[name=where]:checked") || {}).value || "At the clinic";
      return ["Hello NutriDrip, I'd like to book a consultation.", "",
        "Name: " + name.value.trim(), "Mobile: +91 " + m.slice(0, 5) + " " + m.slice(5),
        "Drip: " + (d ? d.name + " (" + ND.rupees(d.price) + " per session)" : "Not sure yet, please suggest one"),
        "Where: " + where, "Free consultation with my drip: yes", "",
        "I agree to NutriDrip using these details to contact me about my consultation."].join("\n");
    });
  });
  $$("form[data-trade-form]").forEach(function (form) {
    wireForm(form, function (f) {
      var name = f.elements.name, org = f.elements.org, mob = f.elements.mobile, ok = true, m;
      ok = err(name, name.value.trim() ? "" : "Please enter your name.") && ok;
      ok = err(org, org.value.trim() ? "" : "Please enter the clinic, hospital or company.") && ok;
      m = mobileOk(mob); ok = err(mob, m ? "" : "Please enter a 10-digit Indian mobile number.") && ok;
      ok = consentOk(f) && ok;
      if (!ok) return null;
      return ["Hello NutriDrip, I'd like to request trade access.", "",
        "Name: " + name.value.trim(), "Organisation: " + org.value.trim(), "Mobile: +91 " + m.slice(0, 5) + " " + m.slice(5),
        "Interested in: " + f.elements.need.value, "",
        "I agree to NutriDrip using these details to contact me about trade access."].join("\n");
    });
  });
  $$("form[data-story-form]").forEach(function (form) {
    wireForm(form, function (f) {
      var name = f.elements.name, city = f.elements.city, text = f.elements.story, ok = true;
      ok = err(name, name.value.trim() ? "" : "Please enter your first name.") && ok;
      ok = err(city, city.value.trim() ? "" : "Please enter your city.") && ok;
      ok = err(text, text.value.trim().length > 10 ? "" : "Please tell us a little about your session.") && ok;
      ok = consentOk(f) && ok;
      if (!ok) return null;
      var d = ND.byId(f.elements.drip.value);
      return ["Hello NutriDrip, here is my experience for your website.", "",
        "First name: " + name.value.trim(), "City: " + city.value.trim(), "Drip: " + (d ? d.name : "Not sure"), "",
        text.value.trim(), "",
        "I give written consent for NutriDrip to publish this with my first name, city and drip."].join("\n");
    });
  });

  // ------------------------------------------------------------ stories
  var storyList = $("[data-stories]");
  if (storyList && ND.STORIES.length >= 3) {
    storyList.hidden = false;
    $("ul", storyList).innerHTML = ND.STORIES.map(function (s) {
      var d = ND.byId(s.drip);
      return "<li><blockquote><p></p></blockquote><p class=\"nd-small\"></p></li>";
    }).join("");
    $$("li", storyList).forEach(function (li, i) { var s = ND.STORIES[i], d = ND.byId(s.drip); $("blockquote p", li).textContent = s.text; $(".nd-small", li).textContent = s.name + ", " + s.city + (d ? " · " + d.name : ""); });
  }

  // ------------------------------------------------------------ RMP gate
  var gate = $("#nd-gate");
  if (gate) {
    var okd = sstore("nd-rmp") === "1";
    if (!okd) { gate.hidden = false; doc.body.classList.add("nd-gated"); $("main").setAttribute("aria-hidden", "true"); var b = $("[data-gate-yes]", gate); setTimeout(function () { b.focus(); }, 30); }
    $("[data-gate-yes]", gate).addEventListener("click", function () { sstore("nd-rmp", "1"); gate.hidden = true; doc.body.classList.remove("nd-gated"); $("main").removeAttribute("aria-hidden"); });
  }
  $$("a[data-rmp-link]").forEach(function () {});

  paintChosen(chosen());
  doc.body.classList.add("nd-js");
})();

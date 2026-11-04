/* Drip pages: the bag fills as you read down the ingredient list, and each
   ingredient lights up as you pass it. */
(function () {
  "use strict";
  var doc = document, reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ings = Array.prototype.slice.call(doc.querySelectorAll("[data-ing]"));
  var bag = doc.querySelector("[data-dp-bag]"), count = doc.querySelector("[data-dp-count]");
  var id = doc.body.getAttribute("data-drip");
  if (id && window.ND && ND.setChosen) ND.setChosen(id, "page");
  function render() {
    var line = innerHeight * 0.62, n = 0;
    ings.forEach(function (li) { var on = reduce || li.getBoundingClientRect().top < line; li.classList.toggle("is-lit", on); if (on) n++; });
    bag.style.setProperty("--fill", (n / ings.length).toFixed(3));
    count.textContent = String(n);
    var col = doc.querySelector(".dp__bagcol"), list = doc.querySelector("[data-ings]");
    if (col && list && matchMedia("(max-width: 860px)").matches) col.style.setProperty("--bagcol-h", (list.getBoundingClientRect().bottom - col.parentNode.getBoundingClientRect().top + 40) + "px");
  }
  var t = false;
  function on() { if (t) return; t = true; requestAnimationFrame(function () { t = false; render(); }); }
  addEventListener("scroll", on, { passive: true }); addEventListener("resize", on); render();
})();

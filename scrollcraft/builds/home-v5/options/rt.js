/* IV or tablets options: the two routes' stops, word for word as the page has them (../app.js), and the two lists
   beside each option that light as the routes are travelled. */
window.RT = (function () {
  "use strict";
  var TAB = [
    ["mouth", "Mouth", "Swallowed."],
    ["stomach", "Stomach", "It must dissolve first; B12 also needs a factor made in the stomach."],
    ["intestine", "Small intestine", "Absorption has limits; vitamin C is absorbed less efficiently at higher doses."],
    ["liver", "Liver", "Part of some doses is processed here first."],
    ["blood", "Bloodstream", "What remains, which varies by nutrient, dose and person."],
  ];
  var IV = [
    ["vein", "Into a vein", "The dose goes in directly."],
    ["blood", "Bloodstream", "Straight in, with no stomach, gut or liver on the way."],
  ];
  var els = { tab: [], iv: [] };
  function list(key, title, line, rows) {
    return (
      '<div class="rt-list rt-list--' +
      key +
      '"><p class="rt-list__k">' +
      title +
      "<b>" +
      line +
      "</b></p><ol>" +
      rows
        .map(function (r) {
          return "<li><b>" + r[1] + "</b><span>" + r[2] + "</span></li>";
        })
        .join("") +
      "</ol></div>"
    );
  }
  function lists(el) {
    el.innerHTML =
      list("tab", "By tablet", "Part of it is absorbed.", TAB) +
      list("iv", "By IV drip", "All of it enters the blood.", IV);
    els.tab = Array.prototype.slice.call(el.querySelectorAll(".rt-list--tab li"));
    els.iv = Array.prototype.slice.call(el.querySelectorAll(".rt-list--iv li"));
  }
  // t, v: how far along the tablet's and the drip's route (0 to 1)
  function light(t, v) {
    els.tab.forEach(function (li, i) {
      li.classList.toggle("on", t >= i / (TAB.length - 1) - 0.01 && t > 0);
    });
    els.iv.forEach(function (li, i) {
      li.classList.toggle("on", i === 0 ? v > 0 : v >= 0.99);
    });
  }
  return { TAB: TAB, IV: IV, lists: lists, light: light };
})();

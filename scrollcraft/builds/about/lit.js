/* About: the mission statement lights up as you read it (see BRIEF.md).
   The paragraph's words are wrapped one by one (it is editable copy, so this
   happens on whatever text is there) and turn from the muted ink to full ink
   in reading order as the paragraph crosses the screen. A GSAP stagger,
   scrubbed by ScrollTrigger. The text itself never changes, so screen readers
   read it as one sentence. */
(function () {
  "use strict";
  function mountLit(p) {
    if (!p || !window.gsap || !window.ScrollTrigger) return function () {};
    gsap.registerPlugin(ScrollTrigger);
    var original = p.innerHTML;
    var words = [];
    // Wrap the words of every text node, keeping any inline markup around them.
    (function wrap(node) {
      [].slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(part));
              return;
            }
            var s = document.createElement("span");
            s.className = "lit__w";
            s.textContent = part;
            words.push(s);
            frag.appendChild(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) wrap(n);
      });
    })(p);
    p.classList.add("lit--live");
    // GSAP blends real colours, not var() strings: resolve the two tokens.
    var resolve = function (v) {
      var probe = document.createElement("span");
      probe.style.color = "var(" + v + ")";
      p.appendChild(probe);
      var c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    };
    var from = resolve("--lit-from"),
      to = resolve("--lit-to");
    var tw = gsap.fromTo(
      words,
      { color: from },
      {
        color: to,
        ease: "none",
        stagger: 0.12,
        scrollTrigger: { trigger: p, start: "top 78%", end: "bottom 48%", scrub: 0.4 },
      }
    );
    return function () {
      if (tw.scrollTrigger) tw.scrollTrigger.kill();
      tw.kill();
      p.innerHTML = original;
      p.classList.remove("lit--live");
    };
  }
  window.mountLit = mountLit;
})();

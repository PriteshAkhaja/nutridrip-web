// The live page renders this on the server; here it is drawn from the same data
// (data/checklist.json, exported from src/lib/clinical/checklist.ts).
fetch("data/checklist.json")
  .then(function (r) {
    return r.json();
  })
  .then(function (d) {
    var esc = function (s) {
      return String(s).replace(/[&<>"]/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
      });
    };
    var steps = d.steps,
      total = steps.length;
    var mand = steps.filter(function (s) {
      return s.mandatory;
    }).length;
    document.querySelectorAll("[data-total]").forEach(function (e) {
      e.textContent = total;
    });
    document.querySelector("[data-mandatory]").textContent = mand;
    var tick =
      '<svg class="tick" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    document.querySelector("[data-cl-list]").innerHTML = d.phases
      .map(function (p) {
        var s = steps.filter(function (x) {
          return x.phase === p;
        });
        return (
          '<div class="ph"><span class="t-micro">' +
          esc(p) +
          '</span><span class="t-data" style="font-size:12.5px;color:var(--ink-3)">' +
          s.length +
          " steps</span></div><ol>" +
          s
            .map(function (x, i) {
              return (
                '<li class="step" data-cl-step data-cl-phase="' +
                esc(p) +
                '"><span class="step__n t-data"><span class="num">' +
                (i + 1) +
                "</span>" +
                tick +
                '</span><span class="t-body step__label">' +
                esc(x.label) +
                "</span>" +
                (x.mandatory ? '<span class="t-small step__m">Mandatory</span>' : "") +
                "</li>"
              );
            })
            .join("") +
          "</ol>"
        );
      })
      .join("");

    document.querySelector("[data-card]").innerHTML =
      '<p class="now" aria-hidden="true"><b>Step <span data-cl-now>1</span> of ' +
      total +
      '</b><span class="t-small">as you read</span></p>' +
      d.phases
        .map(function (p) {
          var s = steps.filter(function (x) {
            return x.phase === p;
          });
          var m = s.filter(function (x) {
            return x.mandatory;
          }).length;
          return (
            '<div><div class="phase__top"><span class="t-body phase__name">' +
            esc(p) +
            '</span><span class="t-data phase__n"><span data-cl-count>' +
            m +
            "</span> / " +
            s.length +
            '</span></div><div class="segs" role="img" aria-label="' +
            esc(p) +
            ": " +
            m +
            " of " +
            s.length +
            ' steps mandatory">' +
            s
              .map(function (x) {
                return '<div class="seg" data-m="' + (x.mandatory ? 1 : 0) + '"><i data-cl-fill></i></div>';
              })
              .join("") +
            "</div></div>"
          );
        })
        .join("") +
      '<p class="t-small note note--rest">Filled segments are the mandatory steps within each phase.</p><p class="t-small note note--live">Fills as you read.</p>';

    document.querySelector("[data-bands]").innerHTML = Object.keys(d.ranges)
      .map(function (k) {
        var r = d.ranges[k];
        return (
          '<div class="band"><div><span class="t-micro">' +
          esc(r.label) +
          '</span><div class="t-data">' +
          r.min +
          " – " +
          r.max +
          '</div></div><span class="t-small" style="color:var(--ink-3)">' +
          esc(r.unit) +
          "</span></div>"
        );
      })
      .join("");

    if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
      window.__unmount = mountChecklist(document.querySelector("[data-checklist]"));
    document.body.dataset.ready = "1";
  });

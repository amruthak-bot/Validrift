/* Validrift landing page: Start, Guided Demo (with canonical intro + reset), Explore. */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }

  document.addEventListener("DOMContentLoaded", function () {
    var V = window.Validrift, api = window.ValidriftAPI;
    $("btn-start").addEventListener("click", function () {
      window.location.href = "new-incident.html";
    });
    $("btn-explore").addEventListener("click", function () {
      window.location.href = "overview.html";
    });
    var modal = $("demo-modal");
    $("btn-demo").addEventListener("click", function () { modal.classList.remove("hidden"); });
    $("demo-close").addEventListener("click", function () { modal.classList.add("hidden"); });
    $("demo-cancel").addEventListener("click", function () { modal.classList.add("hidden"); });
    modal.addEventListener("click", function (e) {
      if (e.target === modal) modal.classList.add("hidden");
    });
    // How-it-works interactive strip
    var HIW = [
      "Describe the quality problem: what defect you saw, how bad it is, and what product was running. Validrift attaches the current machine context (Sealer-02, material, recipe) automatically.",
      "Validrift searches its memory for fixes that solved this defect before \u2014 and shows you exactly which records it found, with honest dates like \u201crecorded 3 weeks ago\u201d.",
      "Past success isn\u2019t enough. Validrift re-checks each remembered fix against today\u2019s conditions and recommends only fixes that are still valid now.",
      "Record whether the fix worked. Your outcome becomes a new memory record, so the next recommendation is smarter \u2014 and outdated fixes get flagged automatically."
    ];
    var hiwDetail = $("hiw-detail");
    var hiwBtns = Array.prototype.slice.call(document.querySelectorAll("[data-hiw]"));
    function paintHiw(i) {
      hiwBtns.forEach(function (b) {
        b.classList.toggle("hiw-active", b.getAttribute("data-hiw") === String(i));
      });
      if (hiwDetail) hiwDetail.innerHTML = "<strong>Step " + (i + 1) + ".</strong> " + HIW[i];
    }
    hiwBtns.forEach(function (b) {
      b.addEventListener("click", function () { paintHiw(parseInt(b.getAttribute("data-hiw"), 10)); });
    });
    paintHiw(0);
    // Guided tour (first visit + replay button)
    var tourBtn = $("btn-tour");
    if (tourBtn && window.ValidriftTour) {
      tourBtn.addEventListener("click", function () { window.ValidriftTour.start("landing"); });
      window.ValidriftTour.auto("landing");
    }
    $("demo-start").addEventListener("click", function () {
      var btn = $("demo-start");
      btn.disabled = true;
      btn.querySelector("span:last-child").textContent = "Preparing demo\u2026";
      // Guided Demo always runs on the canonical baseline: real reset, no fake wait.
      api.resetDemo().then(function () {
        window.location.href = "new-incident.html?guided=1";
      }).catch(function (err) {
        V.toast(V.errorMessage(err));
        btn.disabled = false;
        btn.querySelector("span:last-child").textContent = "Start Guided Demo";
      });
    });
  });
})();

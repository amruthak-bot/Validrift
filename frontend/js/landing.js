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

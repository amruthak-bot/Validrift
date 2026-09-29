/* Validrift Steps 2-3: review recommendation, record result, completion screen. */
(function () {
  "use strict";
  var recId = null, rec = null, incident = null, guided = false;
  var beforeSnapshot = null, selectedOutcome = null;

  function qs(k) {
    var m = new RegExp("[?&]" + k + "=([^&]*)").exec(window.location.search || "");
    return m ? decodeURIComponent(m[1]) : null;
  }
  function setText(sel, text) {
    var el = document.querySelector('[data-r="' + sel + '"]');
    if (el && text != null) el.textContent = text;
  }
  function ctxLabel(ctx) {
    if (!ctx) return "";
    return (ctx.material || "") + " / " + (ctx.recipe || "");
  }
  function setCrumb(n, done) {
    document.querySelectorAll("#crumb [data-crumb]").forEach(function (el) {
      var i = parseInt(el.getAttribute("data-crumb"), 10);
      var on = done ? true : i <= n;
      el.classList.toggle("text-secondary", on);
      el.classList.toggle("font-bold", on);
      el.classList.toggle("text-on-surface-variant", !on);
    });
    var bar = document.getElementById("flow-progress");
    if (bar) bar.style.width = done ? "100%" : (n === 2 ? 45 : 90) + "%";
    var label = document.getElementById("step-label");
    if (label) label.textContent = done ? "Complete" : "Step " + n + " of 3";
  }
  function showView(id) {
    ["view-step2", "view-step3", "view-done"].forEach(function (v) {
      document.getElementById(v).classList.toggle("hidden", v !== id);
    });
    window.scrollTo(0, 0);
  }
  function counts(s, f) {
    return (s || 0) + ((s || 0) === 1 ? " success" : " successes") + " \u00b7 " +
           (f || 0) + ((f || 0) === 1 ? " failure" : " failures");
  }
  function pickRejected() {
    var alts = rec.alternative_fixes || [];
    if (!alts.length) return null;
    var d = alts.filter(function (a) { return a.status === "DRIFTED"; });
    return d[0] || alts[0];
  }

  function renderStep2() {
    var V = window.Validrift;
    var ev = rec.evaluation || {};
    var s = ev.current_successes, f = ev.current_failures;
    if (s == null && f == null) {
      var sup = rec.supporting_evidence || [];
      s = sup.filter(function (e) { return e.outcome === "SUCCESS"; }).length;
      f = sup.filter(function (e) { return e.outcome === "FAILURE" || e.outcome === "FAILED"; }).length;
    }
    var ctx = incident ? ctxLabel({ material: incident.material, recipe: incident.recipe }) : "Film-B / R11";
    setText("fix-name", rec.recommended_fix);
    document.querySelector('[data-r="status-chip"]').innerHTML = V.statusChip(rec.validity_status);
    document.querySelector('[data-r="evidence-line"]').textContent = counts(s, f);
    setText("ctx", ctx);
    setText("why-text", rec.recommended_fix + " has worked " + (s || 0) +
      ((s || 0) === 1 ? " time" : " times") + " in the current " + ctx + " production context.");

    var rej = pickRejected();
    if (rej) {
      setText("why-not-title", "Why not " + rej.fix_name + "?");
      var h = rej.historical_evidence || [];
      setText("before-ctx", h.length && h[0].context ? ctxLabel(h[0].context) : "Film-A / R10");
      setText("before-fix", rej.fix_name);
      setText("before-counts", (rej.historical_successes || 0) + " successes \u00b7 " + (rej.historical_failures || 0) + " failures");
      document.querySelector('[data-r="before-chip"]').innerHTML = V.statusChip("VALIDATED");
      var c = rej.current_evidence || [];
      setText("now-ctx", c.length && c[0].context ? ctxLabel(c[0].context) : ctx);
      setText("now-fix", rej.fix_name);
      setText("now-counts", (rej.current_successes || 0) + " successes \u00b7 " + (rej.current_failures || 0) + " failures");
      document.querySelector('[data-r="now-chip"]').innerHTML = V.statusChip(rej.status);
    }
    var det = document.querySelector('[data-r="evidence-detail"]');
    if (det) {
      var parts = [];
      if (rec.reflection) parts.push("<p>" + V.esc(rec.reflection) + "</p>");
      var supN = (rec.supporting_evidence || []).length, conN = (rec.conflicting_evidence || []).length;
      parts.push("<p class=\"mt-2\">" + supN + " supporting record(s) and " + conN +
        " conflicting record(s) in the current context.</p>");
      det.innerHTML = parts.join("");
    }
  }

  function enterStep3() {
    if (rec && rec.evaluation) {
      beforeSnapshot = {
        status: rec.validity_status,
        successes: rec.evaluation.current_successes || 0,
        failures: rec.evaluation.current_failures || 0
      };
    }
    selectedOutcome = guided ? "SUCCESS" : null;
    paintOutcomes();
    document.querySelector('[data-r3="fix-line"]').textContent =
      "Recommendation: " + (rec ? rec.recommended_fix : "");
    setCrumb(3); showView("view-step3");
    if (guided) {
      document.getElementById("guided-where").textContent = "\u2014 Step 3 of 3";
      document.getElementById("guided-next").textContent =
        "Record whether the recommendation worked. Success is selected \u2014 just click Save & Learn.";
    }
  }
  function paintOutcomes() {
    document.querySelectorAll(".outcome-card").forEach(function (card) {
      var on = card.getAttribute("data-outcome") === selectedOutcome;
      card.classList.toggle("border-secondary", on);
      card.classList.toggle("bg-secondary-fixed/20", on);
      card.classList.toggle("border-outline-variant/40", !on);
      card.setAttribute("aria-checked", on ? "true" : "false");
    });
  }

  async function saveOutcome() {
    var V = window.Validrift, api = window.ValidriftAPI;
    if (!selectedOutcome) { V.toast("Pick an outcome first: Success, Partially Improved, or Failed."); return; }
    var btn = document.getElementById("btn-save");
    btn.disabled = true;
    btn.querySelector("span:last-child").textContent = "Saving\u2026";
    try {
      var notes = document.getElementById("r3-notes").value.trim();
      await api.recordOutcome(recId, {
        followed: true,
        action_taken: rec ? rec.recommended_fix : "",
        result: selectedOutcome,
        notes: notes
      });
      renderDone();
    } catch (err) {
      V.toast(V.errorMessage(err));
      btn.disabled = false;
      btn.querySelector("span:last-child").textContent = "Save & Learn";
    }
  }

  function renderDone() {
    var V = window.Validrift, api = window.ValidriftAPI;
    setCrumb(3, true); showView("view-done");
    var callout = document.getElementById("guided-callout");
    if (guided && callout) {
      callout.classList.remove("hidden");
      document.getElementById("guided-where").textContent = "\u2014 Done";
      document.getElementById("guided-next").textContent =
        "Validrift learned. Finish to go home, or see why Validrift changed.";
    }
    document.querySelector('[data-d="fix-name"]').textContent = rec ? rec.recommended_fix : "";
    var bs = beforeSnapshot ? beforeSnapshot.successes : 0,
        bf = beforeSnapshot ? beforeSnapshot.failures : 0;
    document.querySelector('[data-d="before-chip"]').innerHTML =
      V.statusChip(beforeSnapshot ? beforeSnapshot.status : "\u2014");
    document.querySelector('[data-d="before-counts"]').textContent = counts(bs, bf);
    document.querySelector('[data-d="now-counts"]').textContent = "Updating\u2026";
    var ctxKey = incident ? (incident.material + "/" + incident.recipe) : "";
    api.fixPassport(rec.recommended_fix).then(function (pp) {
      var contexts = pp.contexts || [], cur = null;
      contexts.forEach(function (c) {
        var e0 = (c.evidence || [])[0];
        var key = e0 && e0.context ? (e0.context.material + "/" + e0.context.recipe) : "";
        if (ctxKey && key === ctxKey) cur = c;
      });
      cur = cur || contexts[contexts.length - 1] || {};
      document.querySelector('[data-d="now-chip"]').innerHTML = V.statusChip(cur.status || "\u2014");
      document.querySelector('[data-d="now-counts"]').textContent = counts(cur.successes, cur.failures);
    }).catch(function () {
      document.querySelector('[data-d="now-counts"]').textContent = "Saved \u2014 see the Fix Passport for updated counts.";
    });
  }

  async function load() {
    var api = window.ValidriftAPI, V = window.Validrift;
    try {
      if (!recId) {
        var latest = await api.latestRecommendation();
        recId = latest && latest.recommendation_id;
      }
      if (!recId) { V.toast("No recommendation yet \u2014 log an incident first."); window.location.href = "new-incident.html"; return; }
      rec = await api.recommendation(recId);
      try { incident = await api.incident(rec.incident_id); } catch (e) { incident = null; }
      renderStep2();
    } catch (err) { V.toast(V.errorMessage(err)); }
  }

  document.addEventListener("DOMContentLoaded", function () {
    recId = qs("id");
    guided = qs("guided") === "1";
    setCrumb(2); showView("view-step2");
    var exitBtn = document.getElementById("exit-flow");
    exitBtn.textContent = guided ? "Exit Demo" : "Exit";
    exitBtn.addEventListener("click", function () { window.location.href = "index.html"; });
    if (guided) {
      var callout = document.getElementById("guided-callout");
      callout.classList.remove("hidden");
      document.getElementById("guided-where").textContent = "\u2014 Step 2 of 3";
      document.getElementById("guided-next").textContent =
        "Review the recommendation. Notice why Temperature +5\u00b0C is rejected \u2014 then click Record Result.";
    }
    document.getElementById("btn-record").addEventListener("click", enterStep3);
    document.getElementById("btn-back2").addEventListener("click", function () {
      setCrumb(2); showView("view-step2");
    });
    document.querySelectorAll(".outcome-card").forEach(function (card) {
      card.addEventListener("click", function () {
        selectedOutcome = card.getAttribute("data-outcome");
        paintOutcomes();
      });
    });
    document.getElementById("btn-save").addEventListener("click", saveOutcome);
    document.getElementById("btn-finish").addEventListener("click", function () {
      window.location.href = "index.html";
    });
    document.getElementById("btn-why-changed").addEventListener("click", function () {
      window.location.href = "overview.html";
    });
    load();
  });
})();

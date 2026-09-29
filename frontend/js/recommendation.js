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

  /* Honest long-term-memory references, derived from real evidence timestamps. */
  function memRefLine(evidence) {
    var V = window.Validrift;
    var items = (evidence || []).filter(function (e) { return e && e.date; });
    if (!items.length) return "";
    var times = items.map(function (e) { return new Date(e.date).getTime(); })
      .filter(function (t) { return !isNaN(t); }).sort(function (a, b) { return a - b; });
    if (!times.length) return "";
    var first = V.timeAgo(new Date(times[0]).toISOString());
    var last = V.timeAgo(new Date(times[times.length - 1]).toISOString());
    var n = items.length;
    return '<div class="mem-ref"><span class="material-symbols-outlined">history</span><span>' +
      "First recorded " + V.esc(first) + " \u00b7 most recent " + V.esc(last) +
      " \u00b7 " + n + (n === 1 ? " dated record" : " dated records") + "</span></div>";
  }

  function relatedCtxStrip(evidence, curCtx) {
    var V = window.Validrift;
    var groups = {};
    (evidence || []).forEach(function (e) {
      var c = e.context || {};
      var key = (c.material || "?") + " / " + (c.recipe || "?");
      if (key === curCtx) return;
      if (!groups[key]) groups[key] = { n: 0, s: 0 };
      groups[key].n++;
      if (e.outcome === "SUCCESS") groups[key].s++;
    });
    var keys = Object.keys(groups);
    if (!keys.length) return "";
    var chips = keys.map(function (k) {
      return '<span class="vr-chip vr-chip-neutral">' + V.esc(k) + " \u00b7 " +
        groups[k].s + "/" + groups[k].n + " worked</span>";
    }).join("");
    return '<div class="mt-3"><p class="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant font-semibold">Also remembered in other contexts</p>' +
      '<div class="mt-1.5 flex flex-wrap gap-1.5">' + chips + "</div></div>";
  }

  function evidenceRows(evidence) {
    var V = window.Validrift;
    return (evidence || []).map(function (e) {
      var c = e.context || {};
      var ctx = ((c.material || "") + " / " + (c.recipe || "")).replace(/^ \/ | \/ $/g, "") || "\u2014";
      return '<div class="flex items-center justify-between gap-2 py-1.5 border-b border-outline-variant/30 last:border-0">' +
        "<span>" + V.statusChip(e.outcome || "") +
        ' <span class="font-body-sm text-body-sm">' + V.esc(e.fix_name || "") + " \u00b7 " + V.esc(ctx) + "</span></span>" +
        '<span class="font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap">recorded ' +
        V.esc(V.timeAgo(e.date) || V.fmtDay(e.date)) + "</span></div>";
    }).join("");
  }
  function pickRejected() {
    var alts = rec.alternative_fixes || [];
    if (!alts.length) return null;
    var d = alts.filter(function (a) { return a.status === "DRIFTED"; });
    return d[0] || alts[0];
  }

  function currentCounts() {
    // GET /recommendations/{id} does not persist the evaluation snapshot, so
    // derive current-context counts from supporting_evidence when needed.
    var ev = (rec && rec.evaluation) || {};
    var s = ev.current_successes, f = ev.current_failures;
    if (s == null && f == null) {
      var sup = (rec && rec.supporting_evidence) || [];
      s = sup.filter(function (e) { return e.outcome === "SUCCESS"; }).length;
      f = sup.filter(function (e) { return e.outcome === "FAILURE" || e.outcome === "FAILED"; }).length;
    }
    return { s: s || 0, f: f || 0 };
  }

  function renderStep2() {
    var V = window.Validrift;
    var cf = currentCounts(), s = cf.s, f = cf.f;
    var ctx = incident ? ctxLabel({ material: incident.material, recipe: incident.recipe }) : "Film-B / R11";
    setText("fix-name", rec.recommended_fix);
    document.querySelector('[data-r="status-chip"]').innerHTML = V.statusChip(rec.validity_status);
    document.querySelector('[data-r="evidence-line"]').textContent = counts(s, f);
    setText("ctx", ctx);
    setText("why-text", rec.recommended_fix + " has worked " + (s || 0) +
      ((s || 0) === 1 ? " time" : " times") + " in the current " + ctx + " production context.");
    var sup = rec.supporting_evidence || [];
    var memRef = document.querySelector('[data-r="mem-ref"]');
    if (memRef) memRef.innerHTML = memRefLine(sup);
    var relCtx = document.querySelector('[data-r="related-ctx"]');
    if (relCtx) relCtx.innerHTML = relatedCtxStrip(sup, ctx);

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
      var rows = evidenceRows(rec.supporting_evidence);
      if (rows) parts.push('<div class="mt-2">' + rows + "</div>");
      det.innerHTML = parts.join("");
    }
  }

  function enterStep3() {
    if (rec) {
      var cf = currentCounts();
      beforeSnapshot = {
        status: rec.validity_status,
        successes: cf.s,
        failures: cf.f
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
    var helpBtn = document.getElementById("btn-help");
    if (helpBtn && window.ValidriftTour) {
      helpBtn.addEventListener("click", function () { window.ValidriftTour.start("recommendation"); });
      if (!guided) window.ValidriftTour.auto("recommendation");
    }
    load();
  });
})();

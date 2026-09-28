/* Validrift New Incident page: severity selector, live process context,
   incident creation + recommendation generation with stepper progress. */
(function () {
  "use strict";

  var DEFECT_LABELS = {
    "weak-seal": "Weak Seal",
    "wrinkling": "Wrinkling",
    "leakage": "Channel Leaks",
    "misalignment": "Jaw Misalignment",
    "surface-burn": "Surface Burn"
  };

  var state = { severity: "MEDIUM", ctx: null, submitting: false };

  function defectLabel(slug) {
    return DEFECT_LABELS[slug] || slug;
  }

  /* --- severity segmented control --- */
  var ACTIVE = ["bg-secondary", "text-white", "font-semibold", "shadow-sm"];
  var INACTIVE = ["text-on-surface-variant", "hover:text-on-surface", "hover:bg-surface-container-lowest"];

  function paintSeverity() {
    var group = document.querySelector("[data-ni-severity]");
    if (!group) return;
    Array.prototype.forEach.call(group.querySelectorAll("button"), function (btn) {
      var on = btn.getAttribute("data-sev") === state.severity;
      ACTIVE.forEach(function (c) { btn.classList.toggle(c, on); });
      INACTIVE.forEach(function (c) { btn.classList.toggle(c, !on); });
    });
  }

  /* --- stepper progress --- */
  var stepDefaults = [];
  function initStepper() {
    stepDefaults = [];
    Array.prototype.forEach.call(document.querySelectorAll("[data-step]"), function (el) {
      var badge = el.querySelector("span");
      stepDefaults.push({ el: el, badge: badge, cls: badge ? badge.className : "" });
    });
  }
  function setStep(n) {
    stepDefaults.forEach(function (s, i) {
      if (!s.badge) return;
      var idx = i + 1;
      if (idx < n) {
        s.badge.className = "flex items-center justify-center w-5 h-5 rounded-full bg-on-tertiary-container text-white font-label-sm text-label-sm font-bold shrink-0 mt-0.5";
      } else if (idx === n) {
        s.badge.className = "flex items-center justify-center w-5 h-5 rounded-full bg-secondary text-white font-label-sm text-label-sm font-bold shrink-0 mt-0.5 animate-pulse";
      } else {
        s.badge.className = s.cls;
      }
    });
  }
  function resetStepper() {
    stepDefaults.forEach(function (s) { if (s.badge) s.badge.className = s.cls; });
  }

  /* --- submit --- */
  function setBusy(btn, busy, label) {
    if (!btn) return;
    btn.style.pointerEvents = busy ? "none" : "";
    btn.style.opacity = busy ? "0.75" : "";
    var inner = btn.querySelector("div");
    if (inner) {
      if (busy) inner.setAttribute("data-orig", inner.innerHTML);
      else if (inner.getAttribute("data-orig")) inner.innerHTML = inner.getAttribute("data-orig");
    }
    if (busy && inner) {
      inner.innerHTML = '<span class="material-symbols-outlined text-[22px] animate-spin">progress_activity</span>' +
        '<span class="font-headline-sm text-headline-sm font-bold tracking-tight">' + Validrift.esc(label) + "</span>";
    }
  }

  async function submitIncident(ev) {
    if (ev) ev.preventDefault();
    if (state.submitting) return;
    var api = window.ValidriftAPI;
    var V = window.Validrift;
    if (!api) { V.toast("API client not loaded."); return; }

    var defectSel = document.querySelector('[data-ni="defect"]');
    var notesEl = document.getElementById("problem-notes");
    var defect = defectLabel(defectSel ? defectSel.value : "weak-seal");
    var notes = notesEl ? notesEl.value.trim() : "";
    var ctx = state.ctx || {};

    var btn = document.querySelector('[data-action="submit-incident"]');
    state.submitting = true;
    try {
      setBusy(btn, true, "Retaining incident memory…");
      setStep(1); // RETAIN
      var incident = await api.createIncident({
        defect: defect,
        severity: state.severity,
        notes: notes,
        machine: ctx.machine || "Sealer-02",
        material: ctx.material || "Film-B",
        supplier: ctx.supplier || "FlexPack",
        recipe: ctx.recipe || "R11",
        firmware: ctx.firmware || "V3"
      });

      setBusy(btn, true, "Recalling similar fixes…");
      setStep(2); // RECALL
      await new Promise(function (r) { setTimeout(r, 350); });

      setBusy(btn, true, "Validating against current context…");
      setStep(3); // VALIDATE
      await new Promise(function (r) { setTimeout(r, 350); });

      setBusy(btn, true, "Generating recommendation…");
      setStep(4); // RECOMMEND
      var rec = await api.recommend({ incident_id: incident.id });

      V.toast("Incident " + incident.id + " logged. Recommendation ready.");
      V.go("recommendation.html", { id: rec.recommendation_id });
    } catch (err) {
      resetStepper();
      V.toast(V.errorMessage(err));
    } finally {
      state.submitting = false;
      setBusy(btn, false);
    }
  }

  /* --- init --- */
  document.addEventListener("DOMContentLoaded", function () {
    initStepper();
    paintSeverity();

    var group = document.querySelector("[data-ni-severity]");
    if (group) {
      group.addEventListener("click", function (ev) {
        var btn = ev.target.closest("button[data-sev]");
        if (!btn) return;
        state.severity = btn.getAttribute("data-sev");
        paintSeverity();
      });
    }

    var submit = document.querySelector('[data-action="submit-incident"]');
    if (submit) submit.addEventListener("click", submitIncident);

    var api = window.ValidriftAPI;
    var V = window.Validrift;
    if (api) {
      api.processContext().then(function (ctx) {
        state.ctx = ctx || {};
        var map = { machine: "machine", material: "material", supplier: "supplier", recipe: "recipe" };
        Object.keys(map).forEach(function (k) {
          var el = document.querySelector('[data-ni-ctx="' + k + '"]');
          if (el && ctx && ctx[map[k]]) {
            el.textContent = (k === "recipe" ? "Recipe " : "") + ctx[map[k]];
          }
        });
      }).catch(function () { /* static fallback remains */ });

      V.fillMemoryActivity("[data-memory-activity]");
    }
  });
})();

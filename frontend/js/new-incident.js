/* Validrift Step 1 of 3: report the problem. Plain progress, no Hindsight jargon. */
(function () {
  "use strict";
  var DEFECT_LABELS = {
    "weak-seal": "Weak Seal", "leakage": "Channel Leak", "wrinkling": "Wrinkling",
    "surface-wrinkle": "Surface Wrinkle", "misalignment": "Misalignment",
    "film-misalignment": "Film Misalignment", "surface-burn": "Surface Burn",
    "seal-blistering": "Seal Blistering", "surface-damage": "Surface Damage"
  };
  var CATEGORY_LABELS = { "pouches": "Pouches & Bags", "flow-wrap": "Flow Wraps", "blister": "Blister Packs" };
  var CATEGORY_DEFECTS = {
    "pouches": ["weak-seal", "leakage"],
    "flow-wrap": ["wrinkling", "surface-wrinkle", "misalignment", "film-misalignment"],
    "blister": ["surface-burn", "seal-blistering", "surface-damage"]
  };
  var state = { severity: "MEDIUM", ctx: null, submitting: false, guided: false, category: "pouches" };

  function paintDefects() {
    var sel = document.querySelector('[data-ni="defect"]');
    var list = CATEGORY_DEFECTS[state.category] || CATEGORY_DEFECTS.pouches;
    var prev = sel.value;
    sel.innerHTML = "";
    list.forEach(function (v) {
      var o = document.createElement("option");
      o.value = v; o.textContent = DEFECT_LABELS[v] || v;
      sel.appendChild(o);
    });
    sel.value = list.indexOf(prev) >= 0 ? prev : list[0];
    paintRelated();
  }
  function paintRelated() {
    var wrap = document.getElementById("related-defects");
    var chips = document.getElementById("related-chips");
    var sel = document.querySelector('[data-ni="defect"]');
    var list = (CATEGORY_DEFECTS[state.category] || []).filter(function (v) { return v !== sel.value; });
    if (!wrap || !chips) return;
    if (!list.length) { wrap.classList.add("hidden"); return; }
    wrap.classList.remove("hidden");
    chips.innerHTML = "";
    list.forEach(function (v) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "px-3 py-1.5 rounded-full border border-outline-variant/50 font-body-sm text-body-sm text-on-surface-variant hover:border-secondary hover:text-on-surface transition-colors cursor-pointer";
      b.textContent = DEFECT_LABELS[v] || v;
      b.addEventListener("click", function () {
        document.querySelector('[data-ni="defect"]').value = v;
        paintRelated();
      });
      chips.appendChild(b);
    });
  }

  function qs(k) {
    var m = new RegExp("[?&]" + k + "=([^&]*)").exec(window.location.search || "");
    return m ? decodeURIComponent(m[1]) : null;
  }
  function setCrumb(n) {
    document.querySelectorAll("#crumb [data-crumb]").forEach(function (el) {
      var on = parseInt(el.getAttribute("data-crumb"), 10) <= n;
      el.classList.toggle("text-secondary", on);
      el.classList.toggle("font-bold", on);
      el.classList.toggle("text-on-surface-variant", !on);
    });
    var bar = document.getElementById("flow-progress");
    if (bar) bar.style.width = (n === 1 ? 5 : n === 2 ? 45 : 90) + "%";
  }
  function paintSeverity() {
    var group = document.querySelector("[data-ni-severity]");
    if (!group) return;
    group.querySelectorAll("button").forEach(function (btn) {
      var on = btn.getAttribute("data-sev") === state.severity;
      btn.classList.toggle("bg-secondary", on);
      btn.classList.toggle("text-white", on);
      btn.classList.toggle("font-semibold", on);
      btn.classList.toggle("border-secondary", on);
      btn.classList.toggle("text-on-surface-variant", !on);
    });
  }
  function pstep(n, done) {
    var row = document.querySelector('[data-pstep="' + n + '"]');
    if (!row) return;
    var icon = row.querySelector("[data-picon]");
    if (done) {
      row.classList.add("border-secondary/40");
      if (icon) { icon.textContent = "check_circle"; icon.classList.add("text-on-tertiary-container"); }
    } else {
      if (icon) { icon.textContent = "progress_activity"; icon.classList.add("animate-spin", "text-secondary"); }
    }
  }
  function advVal(name, fallback) {
    var el = document.querySelector('[data-adv="' + name + '"]');
    return el && el.value ? el.value : fallback;
  }

  async function submit(ev) {
    if (ev) ev.preventDefault();
    if (state.submitting) return;
    var api = window.ValidriftAPI, V = window.Validrift;
    var defectSel = document.querySelector('[data-ni="defect"]');
    var defect = DEFECT_LABELS[defectSel.value] || defectSel.value;
    var notes = document.getElementById("f-notes").value.trim();
    var ctx = state.ctx || {};
    var btn = document.getElementById("btn-analyze");
    state.submitting = true;
    document.getElementById("step1-view").classList.add("hidden");
    document.getElementById("progress-view").classList.remove("hidden");
    btn.disabled = true;
    try {
      pstep(1, false);
      var incident = await api.createIncident({
        defect: defect, severity: state.severity, notes: notes,
        parameters: { product_category: state.category },
        machine: ctx.machine || "Sealer-02",
        material: advVal("material", ctx.material || "Film-B"),
        supplier: advVal("supplier", ctx.supplier || "FlexPack"),
        recipe: advVal("recipe", ctx.recipe || "R11"),
        firmware: advVal("firmware", ctx.firmware || "V3")
      });
      pstep(1, true); pstep(2, false);
      // Deterministic path: create -> recommend without reflection blocking.
      pstep(2, true); pstep(3, false);
      var rec = await api.recommend(incident.id, false);
      pstep(3, true); pstep(4, true);
      var url = "recommendation.html?id=" + encodeURIComponent(rec.recommendation_id) +
        (state.guided ? "&guided=1" : "");
      window.location.href = url;
    } catch (err) {
      V.toast(V.errorMessage(err));
      document.getElementById("progress-view").classList.add("hidden");
      document.getElementById("step1-view").classList.remove("hidden");
      btn.disabled = false;
      state.submitting = false;
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    state.guided = qs("guided") === "1";
    setCrumb(1);
    paintSeverity();
    var exitBtn = document.getElementById("exit-flow");
    exitBtn.textContent = state.guided ? "Exit Demo" : "Exit";
    exitBtn.addEventListener("click", function () { window.location.href = "index.html"; });

    if (state.guided) {
      var callout = document.getElementById("guided-callout");
      callout.classList.remove("hidden");
      document.getElementById("guided-where").textContent = "\u2014 Step 1 of 3";
      document.getElementById("guided-next").textContent =
        "Report the current problem. The Weak Seal details are filled in \u2014 just click Analyze Incident.";
      document.querySelector('[data-ni="product"]').value = "pouches";
      state.category = "pouches";
      document.querySelector('[data-ni="defect"]').value = "weak-seal";
      document.getElementById("f-notes").value = "Weak seals on Film-B / R11 pouches.";
    }
    paintDefects();
    document.querySelector('[data-ni="product"]').addEventListener("change", function (e) {
      state.category = e.target.value;
      paintDefects();
    });
    document.querySelector('[data-ni="defect"]').addEventListener("change", paintRelated);
    document.querySelector("[data-ni-severity]").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-sev]");
      if (!b) return;
      state.severity = b.getAttribute("data-sev");
      paintSeverity();
    });
    document.getElementById("incident-form").addEventListener("submit", submit);

    var helpBtn = document.getElementById("btn-help");
    if (helpBtn && window.ValidriftTour) {
      helpBtn.addEventListener("click", function () { window.ValidriftTour.start("new-incident"); });
      if (!state.guided) window.ValidriftTour.auto("new-incident");
    }

    var api = window.ValidriftAPI;
    if (api) api.processContext().then(function (ctx) {
      state.ctx = ctx || {};
      ["machine", "material", "supplier", "recipe", "firmware"].forEach(function (k) {
        var el = document.querySelector('[data-ctx="' + k + '"]');
        if (el && ctx && ctx[k]) el.textContent = ctx[k];
        var adv = document.querySelector('[data-adv="' + k + '"]');
        if (adv && ctx && ctx[k]) {
          for (var i = 0; i < adv.options.length; i++) {
            if (adv.options[i].text === ctx[k] || adv.options[i].value === ctx[k]) { adv.selectedIndex = i; break; }
          }
        }
      });
    }).catch(function () {});
  });
})();

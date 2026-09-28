/* Validrift Fix Passport page: real passport data — header, twin validity
   cards (Film-A VALIDATED + Film-B DRIFTED simultaneously), evidence table
   with filters, timeline, and source memories. */
(function () {
  "use strict";

  var DEFAULT_FIX = "Increase Temperature +5°C";
  var fixName = DEFAULT_FIX;
  var passport = null;
  var activeFilter = "all"; // all | 0 | 1 (context index)

  function qs(k) {
    var m = new RegExp("[?&]" + k + "=([^&]*)").exec(window.location.search || "");
    return m ? decodeURIComponent(m[1]) : null;
  }

  function setText(sel, text) {
    var el = document.querySelector('[data-fp="' + sel + '"]');
    if (el && text != null) el.textContent = text;
  }

  function ctxShort(ctx) {
    if (!ctx) return "";
    return (ctx.material || "") + " / " + (ctx.recipe || "");
  }

  function lastDate(evidence) {
    var ds = (evidence || []).map(function (e) { return e.date || ""; }).filter(Boolean).sort();
    return ds.length ? ds[ds.length - 1] : "";
  }

  /* --- header + metrics --- */
  function renderHeader() {
    var V = window.Validrift;
    setText("crumb-fix", fixName);
    setText("fix-name", fixName);
    setText("defect", "Defect: " + (passport.defect || ""));
    var cur = passport.current_context || {};
    setText("machine", "Machine: " + (cur.machine || ""));
    setText("first-learned", V.fmtDay(passport.first_learned));
    var firstEv = null;
    (passport.contexts || []).forEach(function (c) {
      (c.evidence || []).forEach(function (e) {
        if (!firstEv || (e.date || "") < (firstEv.date || "")) firstEv = e;
      });
    });
    setText("first-ref", firstEv ? "Line Run #" + (firstEv.incident_id || "").replace(/\D/g, "") : "");
    setText("last-event", V.fmtDay(passport.last_event));
    var lastCtx = null;
    (passport.contexts || []).forEach(function (c) {
      if (lastDate(c.evidence) === passport.last_event) lastCtx = c.label;
    });
    setText("last-ctx", (lastCtx || "") + " Context");
    setText("total-runs", passport.total_attempts + (passport.total_attempts === 1 ? " Run" : " Runs"));
    setText("contexts-count", "Across " + passport.contexts_count + " Contexts");
    var s = 0, t = 0;
    (passport.contexts || []).forEach(function (c) { s += c.successes || 0; t += (c.successes || 0) + (c.failures || 0); });
    setText("efficacy", t ? (Math.round(1000 * s / t) / 10) + "%" : "—");
    setText("related", "View Related Incidents (" + passport.total_attempts + ")");
  }

  /* --- twin validity cards --- */
  function twinCard(c, side) {
    var V = window.Validrift;
    var total = (c.successes || 0) + (c.failures || 0);
    var pct = total ? Math.round(100 * (c.successes || 0) / total) : 0;
    var drifted = c.status === "DRIFTED";
    var pillBg = drifted ? "bg-error-container text-on-error-container" : "bg-tertiary-container text-tertiary-fixed";
    var dotBg = drifted ? "bg-error" : "bg-tertiary-fixed";
    var border = drifted ? "border-error" : "border-on-tertiary-container";
    var barBg = drifted ? "bg-error" : "bg-on-tertiary-container";
    var numCls = drifted ? "text-error" : "text-on-tertiary-container";
    var ctx = (c.evidence && c.evidence[0] && c.evidence[0].context) || {};
    return '<div>' +
      '<div class="flex items-center justify-between pb-space-xs mb-space-sm border-b border-surface-container">' +
      '<div class="flex flex-col">' +
      '<span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Context Envelope ' + side + "</span>" +
      '<span class="font-headline-sm text-headline-sm font-bold text-on-surface">' + V.esc(c.label || "") + "</span></div>" +
      '<div class="flex items-center gap-space-xs px-2.5 py-1 rounded ' + pillBg + ' font-label-sm text-label-sm font-bold tracking-wider">' +
      '<span class="w-2 h-2 rounded-full ' + dotBg + '"></span><span>' + V.esc(c.status || "") + "</span></div></div>" +
      '<div class="flex flex-col gap-1 font-body-sm text-body-sm mb-space-sm">' +
      '<div class="flex justify-between py-1 px-space-xs rounded bg-surface-container-low">' +
      '<span class="text-on-surface-variant">Material</span>' +
      '<span class="font-mono text-on-surface font-semibold">' + V.esc(ctx.material || "") + "</span></div>" +
      '<div class="flex justify-between py-1 px-space-xs rounded">' +
      '<span class="text-on-surface-variant">Supplier</span>' +
      '<span class="font-mono text-on-surface font-semibold">' + V.esc(ctx.supplier || "") + "</span></div>" +
      '<div class="flex justify-between py-1 px-space-xs rounded bg-surface-container-low">' +
      '<span class="text-on-surface-variant">Recipe</span>' +
      '<span class="font-mono text-on-surface font-semibold">' + V.esc(ctx.recipe || "") + "</span></div>" +
      "</div></div>" +
      "<div>" +
      '<div class="p-space-sm rounded bg-surface-container-low mb-space-xs">' +
      '<div class="flex items-center justify-between mb-1">' +
      '<span class="font-label-sm text-label-sm uppercase font-bold text-on-surface-variant">Efficacy</span>' +
      '<span class="font-mono font-bold text-headline-sm ' + numCls + '">' + pct + "% (" + c.successes + "/" + total + ")</span></div>" +
      '<div class="w-full h-2 rounded bg-surface-container-high overflow-hidden">' +
      '<div class="h-full ' + barBg + ' rounded" style="width: ' + pct + '%"></div></div>' +
      '<div class="flex justify-between items-center mt-1 text-label-sm font-label-sm text-on-surface-variant">' +
      "<span>" + c.successes + " Successes / " + c.failures + " Failures</span>" +
      "<span>Last Event: " + V.esc(V.fmtDay(lastDate(c.evidence))) + "</span></div></div>" +
      '<div class="p-space-xs px-space-sm rounded ' + (drifted ? "bg-error-container text-on-error-container" : "bg-surface-container text-on-surface") +
      ' flex items-center gap-space-xs font-body-sm text-body-sm">' +
      '<span class="material-symbols-outlined text-[16px] ' + (drifted ? "" : "text-on-tertiary-container") + '">' +
      (drifted ? "block" : "verified") + "</span>" +
      "<span><strong class=\"font-semibold\">Policy:</strong> " +
      V.esc(drifted ? "Blocked under this context — validity drifted." : "Recommended fix for this context.") +
      "</span></div></div>";
  }

  function renderTwins() {
    var contexts = passport.contexts || [];
    var a = document.querySelector('[data-fp="twin-a"]');
    var b = document.querySelector('[data-fp="twin-b"]');
    if (a && contexts[0]) a.innerHTML = twinCard(contexts[0], "A");
    if (b && contexts[1]) b.innerHTML = twinCard(contexts[1], "B");
    else if (b && !contexts[1]) b.style.display = "none";
  }

  /* --- evidence table with filters --- */
  function evidenceItems() {
    var items = [];
    (passport.contexts || []).forEach(function (c, ci) {
      (c.evidence || []).forEach(function (e) {
        items.push({ ctxIdx: ci, ctxLabel: c.label, incident_id: e.incident_id, date: e.date,
                     outcome: e.outcome, notes: e.notes, memory_document_id: e.memory_document_id });
      });
    });
    items.sort(function (x, y) { return (x.date || "") < (y.date || "") ? -1 : 1; });
    return items;
  }

  function renderEvidence() {
    var V = window.Validrift;
    var body = document.querySelector('[data-fp="evidence-body"]');
    if (!body) return;
    var items = evidenceItems().filter(function (it) {
      return activeFilter === "all" || it.ctxIdx === activeFilter;
    });
    body.innerHTML = items.map(function (it) {
      var ok = it.outcome === "SUCCESS";
      var rowCls = it.ctxIdx === 0 ? "filmA-row" : "filmB-row";
      return '<tr class="evidence-row ' + rowCls + ' hover:bg-surface-container-low transition-colors">' +
        '<td class="py-2.5 px-space-md font-mono font-bold text-secondary">' + V.esc(it.incident_id || "") + "</td>" +
        '<td class="py-2.5 px-space-md font-mono text-on-surface">' + V.esc(it.ctxLabel || "") + "</td>" +
        '<td class="py-2.5 px-space-md font-mono text-on-surface-variant">' + V.esc(V.fmtDate(it.date)) + "</td>" +
        '<td class="py-2.5 px-space-md text-on-surface">' + V.esc(fixName) + "</td>" +
        '<td class="py-2.5 px-space-md">' + V.statusChip(it.outcome || "") + "</td>" +
        '<td class="py-2.5 px-space-md text-on-surface-variant">' + V.esc(it.notes || "—") + "</td>" +
        '<td class="py-2.5 px-space-md font-mono text-on-surface-variant text-right">' + V.esc(it.memory_document_id || "") + "</td></tr>";
    }).join("");
    setText("filter-badge", "DISPLAYING " + items.length + " OF " + evidenceItems().length);
    // filter button labels
    var contexts = passport.contexts || [];
    var fa = document.querySelector('[data-fp="filter-all"]');
    if (fa) fa.textContent = " All Contexts (" + evidenceItems().length + " Runs) ";
    var fb = document.querySelector('[data-fp="filter-a"]');
    if (fb && contexts[0]) fb.textContent = " " + contexts[0].label + " (" + contexts[0].successes + " Success • " + contexts[0].status + ") ";
    var fc = document.querySelector('[data-fp="filter-b"]');
    if (fc && contexts[1]) fc.textContent = " " + contexts[1].label + " (" + contexts[1].failures + " Failure • " + contexts[1].status + ") ";
  }

  function wireFilters() {
    var V = window.Validrift;
    function paint() {
      [["filter-all", "all"], ["filter-a", 0], ["filter-b", 1]].forEach(function (pair) {
        var btn = document.querySelector('[data-fp="' + pair[0] + '"]');
        if (!btn) return;
        var on = activeFilter === pair[1];
        btn.classList.toggle("bg-surface-container-lowest", on);
        btn.classList.toggle("text-on-surface", on);
        btn.classList.toggle("font-bold", on);
        btn.classList.toggle("shadow-xs", on);
        btn.classList.toggle("text-on-surface-variant", !on);
      });
    }
    [["filter-all", "all"], ["filter-a", 0], ["filter-b", 1]].forEach(function (pair) {
      var btn = document.querySelector('[data-fp="' + pair[0] + '"]');
      if (btn) btn.addEventListener("click", function () { activeFilter = pair[1]; paint(); renderEvidence(); });
    });
    paint();
  }

  /* --- timeline --- */
  function renderTimeline() {
    var V = window.Validrift;
    var tab = document.querySelector('[data-fp="timeline-tab"]');
    if (!tab) return;
    var items = passport.timeline || [];
    tab.innerHTML = '<div class="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-container-highest">' +
      items.map(function (t) {
        var ok = t.outcome === "SUCCESS";
        var dot = ok ? "bg-on-tertiary-container" : (t.outcome === "FAILURE" ? "bg-error" : "bg-secondary-container");
        var label = t.type === "LEARNED" ? "Learned" :
                    t.type === "VALIDATED" ? "Validated" :
                    t.type === "DRIFT_DETECTED" ? "Drift Detected" : (t.outcome || t.type || "");
        return '<div class="relative">' +
          '<div class="absolute -left-6 top-1 w-4 h-4 rounded-full ' + dot + '"></div>' +
          '<div class="flex flex-col">' +
          '<div class="flex items-center gap-space-xs font-mono font-semibold text-body-sm">' +
          '<span class="text-on-surface font-bold">' + V.esc(V.fmtDay(t.date)) + "</span>" +
          '<span class="text-outline-variant">•</span>' +
          '<span class="' + (ok ? "text-on-tertiary-container" : (t.outcome === "FAILURE" ? "text-error" : "text-secondary")) + ' font-bold">' +
          V.esc(label + (t.incident_id ? " in Incident " + t.incident_id : "")) + "</span></div>" +
          '<p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">' +
          V.esc(fixName + " — " + ctxShort(t.context) + (t.outcome ? ", outcome " + t.outcome.toLowerCase() : "") + ".") +
          "</p></div></div>";
      }).join("") + "</div>";
  }

  /* --- source memories --- */
  function renderSources() {
    var V = window.Validrift;
    var tab = document.querySelector('[data-fp="sources-tab"]');
    if (!tab) return;
    var mems = passport.source_memories || [];
    if (!mems.length) { tab.innerHTML = '<p class="font-body-sm text-body-sm text-on-surface-variant">No source memories.</p>'; return; }
    tab.innerHTML = mems.map(function (m) {
      return '<div class="p-space-md rounded bg-surface-container-low flex flex-col justify-between">' +
        "<div>" +
        '<div class="flex items-center justify-between">' +
        '<span class="font-mono font-bold text-label-sm text-secondary">' + V.esc(m.document_id || "") + "</span>" +
        '<span class="font-label-sm text-label-sm text-on-surface-variant">' + V.esc(V.fmtDay(m.date)) + "</span></div>" +
        '<span class="font-body-sm text-body-sm font-semibold text-on-surface mt-1 block">' + V.esc(m.incident_id || "") + "</span>" +
        '<p class="font-body-sm text-body-sm text-on-surface-variant mt-1">' + V.esc(m.summary || "") + "</p></div></div>";
    }).join("");
  }

  async function load() {
    var api = window.ValidriftAPI, V = window.Validrift;
    try {
      passport = await api.fixPassport(fixName);
      renderHeader();
      renderTwins();
      renderEvidence();
      renderTimeline();
      renderSources();
      V.fillMemoryActivity("[data-memory-activity]");
    } catch (err) {
      V.toast(V.errorMessage(err));
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    fixName = qs("fix") || DEFAULT_FIX;
    wireFilters();
    var runBtn = document.querySelector('[data-fp="run-audit"]');
    if (runBtn) {
      var btn = runBtn.closest("button");
      if (btn) btn.addEventListener("click", function () { window.Validrift.go("validity-audit.html"); });
    }
    load();
  });
})();

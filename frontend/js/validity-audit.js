/* Validrift Memory Validity Audit page: real audit results, hero drift
   comparison, knowledge registry, lineage timeline, process-change submission. */
(function () {
  "use strict";

  var audit = null;
  var showAll = false;

  function ctxShort(ctx) {
    if (!ctx) return "";
    return (ctx.material || "") + " / " + (ctx.recipe || "");
  }

  function setText(sel, text) {
    var el = document.querySelector('[data-au="' + sel + '"]');
    if (el && text != null) el.textContent = text;
  }

  function statusPill(status) {
    return window.Validrift.statusChip(status);
  }

  /* --- summary strip + process change card --- */
  function renderSummary() {
    var s = audit.summary || {};
    setText("reviewed", s.reviewed);
    setText("supported", s.remain_supported);
    setText("reval", s.revalidation_required);
    setText("drifted", s.drifted);
  }

  function renderPcText(latestPc) {
    if (!latestPc || !latestPc.changes) return;
    var parts = [];
    Object.keys(latestPc.changes).forEach(function (k) {
      var c = latestPc.changes[k];
      parts.push((c.old || "") + " → " + (c.new || ""));
    });
    var date = window.Validrift.fmtDay(latestPc.date);
    setText("pc-text", "\n          " + date + ": " + parts.join(" • ") + "\n        ");
  }

  /* --- hero drift comparison: first DRIFTED fix --- */
  function heroFix() {
    var fixes = audit.fixes || [];
    var d = fixes.filter(function (f) { return f.status === "DRIFTED"; });
    return d[0] || fixes[0] || null;
  }

  function renderHero() {
    var f = heroFix();
    if (!f) return;
    var V = window.Validrift;
    setText("hero-fix", f.fix_name);
    setText("hero-target", "(Target: " + f.defect + ")");
    var h = f.historical_evidence || [];
    var c = f.current_evidence || [];
    var hctx = h.length ? h[0].context : null;
    var cctx = c.length ? c[0].context : (audit.current_context || null);

    var left = document.querySelector('[data-au="hero-left"]');
    if (left) {
      left.innerHTML =
        '<div class="flex items-center justify-between">' +
        '<span class="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold"> Historical Context (Epoch A) </span>' +
        V.statusChip("VALIDATED") + "</div>" +
        '<div class="font-headline-sm text-[15px] font-semibold text-on-surface"> ' + V.esc(ctxShort(hctx)) +
        ' <span class="font-normal text-on-surface-variant text-body-sm">(' + V.esc(hctx ? hctx.supplier || "" : "") + ' baseline)</span> </div>' +
        '<div class="flex items-center justify-between text-body-sm pt-1">' +
        '<span class="text-on-surface-variant">Empirical Result:</span>' +
        '<span class="font-label-md text-label-md font-bold text-on-tertiary-container bg-surface-container-lowest px-2 py-0.5 rounded border border-surface-container">' +
        V.esc(f.historical_successes + " of " + (f.historical_successes + f.historical_failures) + " Successful") + "</span></div>" +
        '<div class="flex items-center justify-between text-body-sm">' +
        '<span class="text-on-surface-variant">Validity:</span>' +
        '<span class="font-label-md text-label-md font-semibold text-on-surface">Held under historical context</span></div>';
    }
    var right = document.querySelector('[data-au="hero-right"]');
    if (right) {
      right.innerHTML =
        '<div class="flex items-center justify-between">' +
        '<span class="font-label-sm text-label-sm uppercase tracking-wider text-error font-bold"> Current Context (Epoch B) </span>' +
        V.statusChip(f.status) + "</div>" +
        '<div class="font-headline-sm text-[15px] font-semibold text-on-surface"> ' + V.esc(ctxShort(cctx)) +
        ' <span class="font-normal text-on-surface-variant text-body-sm">(' + V.esc(cctx ? cctx.supplier || "" : "") + ')</span> </div>' +
        '<div class="flex items-center justify-between text-body-sm pt-1">' +
        '<span class="text-on-surface-variant">Empirical Result:</span>' +
        '<span class="font-label-md text-label-md font-bold text-error bg-surface-container-lowest px-2 py-0.5 rounded border border-error-container/50">' +
        V.esc(f.current_successes + " of " + (f.current_successes + f.current_failures) + " Successful") + "</span></div>" +
        '<div class="flex items-center justify-between text-body-sm">' +
        '<span class="text-on-surface-variant">Failures:</span>' +
        '<span class="font-label-md text-label-md font-semibold text-error">' + V.esc(f.current_failures + " recorded under current context") + "</span></div>";
    }
    // hero "View Fix Passport" button -> passport page with fix
    var title = document.querySelector('[data-au="hero-fix"]');
    var card = title ? title.closest("div.bg-surface-container-lowest") : null;
    var btn = card ? card.querySelector('button[onclick^="openPassportModal"]') : null;
    if (btn) {
      btn.removeAttribute("onclick");
      btn.setAttribute("data-fix-nav", f.fix_name);
      btn.addEventListener("click", function () { V.go("fix-passport.html", { fix: f.fix_name }); });
    }
  }

  /* --- knowledge registry table --- */
  function rowHtml(f) {
    var V = window.Validrift;
    var rowBg = f.status === "DRIFTED" ? " bg-error-container/10" : "";
    return '<tr class="hover:bg-surface-container-low/60 transition-colors' + rowBg + '">' +
      '<td class="pl-space-md pr-space-sm py-3 font-semibold">' + V.esc(f.fix_name) + "</td>" +
      '<td class="px-space-sm py-3 font-body-sm text-on-surface-variant">' + V.esc(f.defect) + "</td>" +
      '<td class="px-space-sm py-3">' + statusPill(f.status) + "</td>" +
      '<td class="px-space-md py-3 text-body-sm">' +
      '<span class="font-label-sm text-label-sm font-semibold text-on-tertiary-container">' +
      V.esc(f.historical_successes + " historical successes") + "</span>" +
      '<span class="text-on-surface-variant mx-1">/</span>' +
      '<span class="font-label-sm text-label-sm font-semibold ' + (f.current_failures ? "text-error" : "text-on-tertiary-container") + '">' +
      V.esc(f.current_successes + " current successes, " + f.current_failures + " failures") + "</span></td>" +
      '<td class="pr-space-md pl-space-sm py-3 text-right">' +
      '<button class="px-2.5 py-1 rounded bg-surface-container-lowest hover:bg-surface-container border border-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold transition-colors shadow-xs" data-fix-nav="' + V.esc(f.fix_name) + '" type="button"> View Passport </button></td></tr>';
  }

  function renderTable() {
    var body = document.querySelector('[data-au="fixes-body"]');
    if (!body) return;
    var fixes = audit.fixes || [];
    var shown = showAll ? fixes : fixes.slice(0, 3);
    body.innerHTML = shown.map(rowHtml).join("");
    setText("view-all-text", showAll ? "Show Top 3 Fixes" : "View All " + fixes.length + " Audited Fixes");
    var arrow = document.getElementById("allRowsArrow");
    if (arrow) arrow.textContent = showAll ? "expand_less" : "expand_more";
    Array.prototype.forEach.call(body.querySelectorAll("[data-fix-nav]"), function (b) {
      b.addEventListener("click", function () {
        window.Validrift.go("fix-passport.html", { fix: b.getAttribute("data-fix-nav") });
      });
    });
  }

  /* --- lineage timeline for hero fix --- */
  function renderLineage() {
    var host = document.querySelector('[data-au="lineage-body"]');
    var f = heroFix();
    if (!host || !f) return;
    var V = window.Validrift;
    var items = [];
    (f.historical_evidence || []).forEach(function (e) {
      items.push({ date: e.date, id: e.incident_id || e.intervention_id, ok: e.outcome === "SUCCESS",
                   text: "Application of " + f.fix_name + " for " + f.defect + " on " + ctxShort(e.context) + "." });
    });
    (f.current_evidence || []).forEach(function (e) {
      items.push({ date: e.date, id: e.incident_id || e.intervention_id, ok: e.outcome === "SUCCESS",
                   text: "Under current context (" + ctxShort(e.context) + "): outcome " + (e.outcome || "").toLowerCase() + "." });
    });
    items.sort(function (a, b) { return (a.date || "") < (b.date || "") ? -1 : 1; });
    if (!items.length) { host.innerHTML = '<p class="font-body-sm text-body-sm text-on-surface-variant">No lineage events.</p>'; return; }
    host.innerHTML = items.map(function (it) {
      var dot = it.ok ? "bg-on-tertiary-container" : "bg-error";
      return '<div class="relative flex flex-col gap-0.5">' +
        '<span class="w-2.5 h-2.5 rounded-full ' + dot + ' absolute -left-6 top-1.5 ring-4 ring-surface-container-lowest"></span>' +
        '<div class="flex items-center justify-between font-label-sm text-label-sm">' +
        '<span class="font-mono font-bold text-on-surface">' + V.esc((it.id || "") + " • " + V.fmtDay(it.date)) + "</span>" +
        V.statusChip(it.ok ? "SUCCESS" : "FAILURE") + "</div>" +
        '<p class="font-body-sm text-body-sm text-on-surface-variant">' + V.esc(it.text) + "</p></div>";
    }).join("");
  }

  /* --- run audit flow --- */
  function openModal(id) {
    var m = document.getElementById(id);
    if (m) { m.classList.remove("hidden"); m.classList.add("flex"); }
  }
  function closeModal(id) {
    var m = document.getElementById(id);
    if (m) { m.classList.add("hidden"); m.classList.remove("flex"); }
  }

  function runAuditFlow() {
    var api = window.ValidriftAPI, V = window.Validrift;
    openModal("auditModal");
    var lines = document.querySelector('[data-au="audit-lines"]');
    if (lines) lines.innerHTML = '<div class="flex items-center justify-between text-on-surface"><span>Auditing memory vectors…</span></div>';
    api.validityAudit({})
      .then(function (res) {
        audit = res;
        renderAll();
        if (lines) {
          var fixes = (res.fixes || []).slice(0, 3);
          lines.innerHTML = fixes.map(function (f, i) {
            var cls = f.status === "DRIFTED" ? "text-error" : (f.status === "SUPPORTED" ? "text-on-tertiary-container" : "text-secondary");
            return '<div class="flex items-center justify-between text-on-surface"><span>[' + (i + 1) + "/" + (res.fixes || []).length +
              "] " + V.esc(f.fix_name) + ":</span> " + V.statusChip(f.status) + "</div>";
          }).join("") + '<div class="font-label-sm text-label-sm text-on-surface-variant mt-1">Trace: ' + V.esc(res.trace_id || "") + "</div>";
        }
      })
      .catch(function (err) {
        if (lines) lines.innerHTML = '<div class="text-error">' + V.esc(V.errorMessage(err)) + "</div>";
      });
  }

  /* --- process change modal --- */
  function wirePcModal() {
    var openBtn = document.querySelector('[data-au="open-pc"]');
    if (openBtn) openBtn.addEventListener("click", function () { openModal("record-pc-modal"); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-au-pc="close"]'), function (b) {
      b.addEventListener("click", function () { closeModal("record-pc-modal"); });
    });
    var form = document.querySelector('[data-au-pc="form"]');
    if (form) form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var field = form.querySelector('[data-au-pc="field"]').value;
      var from = form.querySelector('[data-au-pc="from"]').value.trim();
      var to = form.querySelector('[data-au-pc="to"]').value.trim();
      var reason = form.querySelector('[data-au-pc="reason"]').value.trim();
      if (!from || !to) { window.Validrift.toast("Enter both From and To values."); return; }
      var changes = {};
      changes[field] = { from: from, to: to };
      window.ValidriftAPI.processChange({ machine: "Sealer-02", changes: changes, reason: reason, run_audit: true })
        .then(function (res) {
          window.Validrift.toast("Process change recorded." + (res && res.audit ? " Audit re-ran." : ""));
          closeModal("record-pc-modal");
          form.reset();
          load();
        })
        .catch(function (err) { window.Validrift.toast(window.Validrift.errorMessage(err)); });
    });
  }

  function renderAll() {
    renderSummary();
    renderHero();
    renderTable();
    renderLineage();
  }

  async function load() {
    var api = window.ValidriftAPI, V = window.Validrift;
    try {
      audit = await api.validityAudit({});
      renderAll();
      try {
        var dash = await api.dashboard();
        renderPcText(dash.latest_process_change);
      } catch (e) { /* keep static */ }
      V.fillMemoryActivity("[data-memory-activity]");
    } catch (err) {
      V.toast(V.errorMessage(err));
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var runBtn = document.getElementById("runAuditBtn");
    if (runBtn) runBtn.addEventListener("click", runAuditFlow);
    var finish = document.getElementById("finishAuditBtn");
    if (finish) finish.addEventListener("click", function () { closeModal("auditModal"); });
    var closeA = document.getElementById("closeAuditModal");
    if (closeA) closeA.addEventListener("click", function () { closeModal("auditModal"); });
    var toggle = document.getElementById("toggleAllRowsBtn");
    if (toggle) toggle.addEventListener("click", function () { showAll = !showAll; renderTable(); });
    wirePcModal();
    load();
  });
})();

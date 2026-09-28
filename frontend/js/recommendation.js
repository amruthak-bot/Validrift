/* Validrift Recommendation page: renders a real recommendation from the API,
   including evidence, the rejected alternative, memory IDs, reflection,
   and the Record Outcome flow. */
(function () {
  "use strict";

  var recId = null;
  var rec = null;
  var incident = null;

  function qs(k) {
    var m = new RegExp("[?&]" + k + "=([^&]*)").exec(window.location.search || "");
    return m ? decodeURIComponent(m[1]) : null;
  }

  function setText(sel, text) {
    var el = document.querySelector('[data-rec="' + sel + '"]');
    if (el && text != null) el.textContent = text;
  }

  function ctxLabel(ctx) {
    if (!ctx) return "";
    return (ctx.material || "") + " / " + (ctx.recipe || "");
  }

  function renderHero() {
    var ev = rec.evaluation || {};
    var ctx = incident ? { material: incident.material, recipe: incident.recipe } : null;
    setText("fix-name", rec.recommended_fix);
    setText("status-pill", rec.validity_status + (ctx ? " (" + ctxLabel(ctx) + ")" : ""));
    setText("validated-on", ctx ? ctxLabel(ctx) : "");
    var line = document.querySelector('[data-rec="evidence-line"]');
    if (line) {
      var s = ev.current_successes, f = ev.current_failures;
      if (s == null && f == null) {
        // Stored recommendations don't persist the evaluation snapshot; derive the
        // counts from the backend-provided current-context evidence (supporting_evidence).
        var sup = rec.supporting_evidence || [];
        s = sup.filter(function (e) { return e.outcome === "SUCCESS"; }).length;
        f = sup.filter(function (e) { return e.outcome === "FAILURE" || e.outcome === "FAILED"; }).length;
      }
      s = s || 0; f = f || 0;
      line.innerHTML =
        '<span class="font-semibold text-on-tertiary-container flex items-center gap-1">' +
        '<span class="material-symbols-outlined text-[18px]">verified</span> ' +
        window.Validrift.esc(s + (s === 1 ? " success" : " successes")) + "</span>" +
        '<span class="text-outline-variant">·</span>' +
        '<span class="text-on-surface">' + window.Validrift.esc(f + (f === 1 ? " failure" : " failures")) + "</span>" +
        '<span class="text-outline-variant">·</span>' +
        "<span>Validated on <strong class=\"text-on-surface font-semibold\"" +
        ' data-rec="validated-on">' + window.Validrift.esc(ctx ? ctxLabel(ctx) : "") + "</strong></span>";
    }
    setText("trace-id", "TRACE: " + (rec.trace_id || rec.recommendation_id || ""));
    setText("modal-title", "Incident " + rec.incident_id + " • " + rec.recommended_fix);

    var link = document.querySelector('[data-rec="fix-passport-link"]');
    if (link) link.setAttribute("data-path-params", JSON.stringify({ fix: rec.recommended_fix }));
  }

  function renderContextBar() {
    setText("incident-label", "Incident " + rec.incident_id);
    setText("incident-chip", "Incident: " + rec.incident_id);
    if (incident) {
      setText("defect-chip", " " + incident.defect + " (" +
        (incident.severity || "").charAt(0) + (incident.severity || "").slice(1).toLowerCase() + ")");
      setText("context-chip", incident.material + " / " + incident.recipe);
    }
  }

  /* Pick the rejected alternative to feature: prefer a DRIFTED one, else first. */
  function pickRejected() {
    var alts = rec.alternative_fixes || [];
    if (!alts.length) return null;
    var drifted = alts.filter(function (a) { return a.status === "DRIFTED"; });
    return (drifted[0] || alts[0]);
  }

  function evTotals(a) {
    return { s: (a.current_successes || 0) + (a.historical_successes || 0),
             f: (a.current_failures || 0) + (a.historical_failures || 0) };
  }

  function renderWhyNot() {
    var rej = pickRejected();
    if (!rej) {
      var sec = document.querySelector('[data-rec="why-not-title"]');
      if (sec) sec.closest("div.rounded-xl").style.display = "none";
      return;
    }
    var t = evTotals(rej);
    setText("why-not-title", "WHY NOT " + rej.fix_name.toUpperCase() + "?");
    setText("why-not-sub", rej.fix_name + " " +
      (rej.status === "DRIFTED"
        ? "worked historically, but its validity drifted after the process change to the current context."
        : "is currently " + rej.status.toLowerCase().replace(/_/g, " ") + " for the active context."));

    var left = document.querySelector('[data-rec="why-not-left"]');
    if (left) {
      var h = rej.historical_evidence || [];
      var hctx = h.length ? ctxLabel(h[0].context) : "";
      left.innerHTML =
        '<div class="flex flex-col gap-2"><div class="flex items-center justify-between">' +
        '<span class="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold">Historical Context</span>' +
        window.Validrift.statusChip(rej.status === "DRIFTED" ? "VALIDATED" : rej.status) + "</div>" +
        '<div class="flex items-baseline justify-between mt-1">' +
        '<h3 class="font-headline-md text-headline-md font-bold text-on-surface">' + window.Validrift.esc(hctx || "Earlier context") + "</h3>" +
        '<span class="font-label-md text-label-md font-bold text-on-tertiary-container">' +
        window.Validrift.esc(rej.historical_successes + " / " + (rej.historical_successes + rej.historical_failures) + " Successes") + "</span></div>" +
        '<p class="font-body-sm text-body-sm text-on-surface-variant">' + window.Validrift.esc(rec.why || "") + "</p></div>" +
        '<div class="mt-space-md pt-space-xs"><div class="w-full bg-surface-container h-2 rounded-full overflow-hidden">' +
        '<div class="bg-on-tertiary-container h-full" style="width:' +
        (t.s + t.f ? Math.round(100 * rej.historical_successes / Math.max(1, rej.historical_successes + rej.historical_failures)) : 0) +
        '%"></div></div>' +
        '<div class="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant mt-1.5">' +
        "<span>Status: historical record</span>" +
        '<span class="font-bold text-on-tertiary-container">' + window.Validrift.esc(rej.historical_successes + " successes") + "</span></div></div>";
    }

    var right = document.querySelector('[data-rec="why-not-right"]');
    if (right) {
      var c = rej.current_evidence || [];
      right.innerHTML =
        '<div class="flex flex-col gap-2"><div class="flex items-center justify-between">' +
        '<span class="font-label-sm text-label-sm text-error uppercase font-bold">Active Context</span>' +
        window.Validrift.statusChip(rej.status) + "</div>" +
        '<div class="flex items-baseline justify-between mt-1">' +
        '<h3 class="font-headline-md text-headline-md font-bold text-on-surface">' +
        window.Validrift.esc(c.length ? ctxLabel(c[0].context) : (incident ? ctxLabel(incident) : "Current")) + "</h3>" +
        '<span class="font-label-md text-label-md font-bold text-error">' +
        window.Validrift.esc(rej.current_successes + " / " + (rej.current_successes + rej.current_failures) + " Successes") + "</span></div>" +
        '<p class="font-body-sm text-body-sm text-on-surface-variant">Under the active context this fix ' +
        (rej.status === "DRIFTED" ? "failed " + rej.current_failures + " time(s) — its earlier validity no longer holds." :
          "is " + rej.status.toLowerCase().replace(/_/g, " ") + ".") + "</p></div>" +
        '<div class="mt-space-md pt-space-xs"><div class="w-full bg-surface-container h-2 rounded-full overflow-hidden">' +
        '<div class="bg-error h-full" style="width:' +
        (rej.current_successes + rej.current_failures ? Math.round(100 * rej.current_failures / (rej.current_successes + rej.current_failures)) : 0) +
        '%"></div></div>' +
        '<div class="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant mt-1.5">' +
        "<span>Status: " + window.Validrift.esc(rej.status) + "</span>" +
        '<span class="font-bold text-error">' + window.Validrift.esc(rej.current_failures + " failures") + "</span></div></div>";
    }

    // point the "Open Fix Passport" link at the rejected fix
    var title = document.querySelector('[data-rec="why-not-title"]');
    if (title) {
      var card = title.closest("div.rounded-xl");
      var a = card ? card.querySelector('a[data-path="fix-passport"]') : null;
      if (a) {
        a.setAttribute("data-path-params", JSON.stringify({ fix: rej.fix_name }));
        var label = a.querySelectorAll("span")[1];
        if (label) label.textContent = "Open " + rej.fix_name + " Fix Passport";
      }
    }
  }

  function evidenceRows() {
    var rows = [];
    (rec.supporting_evidence || []).forEach(function (e) {
      rows.push({ id: e.incident_id || e.intervention_id, date: e.date, ctx: ctxLabel(e.context),
                  fix: e.fix_name, outcome: e.outcome, validity: "SUPPORTED" });
    });
    (rec.conflicting_evidence || []).forEach(function (e) {
      rows.push({ id: e.incident_id || e.intervention_id, date: e.date, ctx: ctxLabel(e.context),
                  fix: e.fix_name, outcome: e.outcome, validity: "DRIFTED" });
    });
    return rows;
  }

  function renderMemories() {
    var body = document.querySelector('[data-rec="memories-body"]');
    if (!body) return;
    var rows = evidenceRows();
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="6" class="py-3 px-space-sm text-on-surface-variant">No evidence records.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (r) {
      return "<tr class=\"border-t border-surface-container-low\">" +
        '<td class="py-2 px-space-sm font-mono">' + window.Validrift.esc(r.id || "") + "</td>" +
        '<td class="py-2 px-space-sm">' + window.Validrift.esc(window.Validrift.fmtDay(r.date)) + "</td>" +
        '<td class="py-2 px-space-sm">' + window.Validrift.esc(r.ctx || "") + "</td>" +
        '<td class="py-2 px-space-sm">' + window.Validrift.esc(r.fix || "") + "</td>" +
        '<td class="py-2 px-space-sm">' + window.Validrift.statusChip(r.outcome || "") + "</td>" +
        '<td class="py-2 px-space-sm text-right">' + window.Validrift.statusChip(r.validity || "") + "</td></tr>";
    }).join("");
    var head = document.querySelector('[data-rec="memories-body"]');
    var label = head ? head.closest("div.rounded-xl, section") : null;
    var count = document.querySelector("#memories-accordion");
    void count; void label;
  }

  function renderReflection() {
    var text = document.querySelector('[data-rec="reflection-text"]');
    var chips = document.querySelector('[data-rec="reflection-memories"]');
    if (rec.reflection) {
      if (text) text.textContent = rec.reflection;
    } else if (text) {
      text.textContent = window.ValidriftAPI.EXPLANATION_UNAVAILABLE;
    }
    if (chips) {
      var ids = rec.recalled_memory_ids || [];
      chips.innerHTML = ids.length
        ? ids.map(function (id) {
            return '<span class="font-label-sm text-label-sm font-mono px-2 py-0.5 rounded bg-surface-container text-on-surface">' +
              window.Validrift.esc(id) + "</span>";
          }).join("")
        : '<span class="font-label-sm text-label-sm text-on-surface-variant">No memory IDs recalled for this recommendation.</span>';
    }
  }

  /* --- Record Outcome --- */
  function wireOutcome() {
    var form = document.getElementById("record-outcome-form");
    if (!form) return;
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var checked = form.querySelector('input[name="outcome"]:checked');
      var outcome = checked ? checked.value : "SUCCESS";
      var notesEl = form.querySelector("textarea");
      var notes = notesEl ? notesEl.value.trim() : "";
      var btn = document.getElementById("submit-modal-btn");
      if (btn) btn.disabled = true;
      window.ValidriftAPI.recordOutcome(recId, {
          followed: true,
          action_taken: rec ? rec.recommended_fix : "",
          result: outcome,
          notes: notes
        })
        .then(function (res) {
          window.Validrift.toast((res && res.message) || ("Outcome recorded: " + outcome));
          if (typeof toggleModal === "function") toggleModal("record-outcome-modal");
          load(); // refresh evidence + counts
        })
        .catch(function (err) { window.Validrift.toast(window.Validrift.errorMessage(err)); })
        .finally(function () { if (btn) btn.disabled = false; });
    });
  }

  async function load() {
    var api = window.ValidriftAPI, V = window.Validrift;
    try {
      if (!recId) {
        var latest = await api.latestRecommendation();
        recId = latest && latest.recommendation_id;
      }
      if (!recId) {
        V.toast("No recommendation yet — log an incident first.");
        V.go("new-incident.html");
        return;
      }
      rec = await api.recommendation(recId);
      try { incident = await api.incident(rec.incident_id); } catch (e) { incident = null; }
      renderContextBar();
      renderHero();
      renderWhyNot();
      renderMemories();
      renderReflection();
      V.fillMemoryActivity("[data-memory-activity]");
    } catch (err) {
      V.toast(V.errorMessage(err));
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    recId = qs("id");
    wireOutcome();
    load();
  });
})();

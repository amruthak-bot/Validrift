/* VALIDRIFT dashboard hydration — binds the static Stitch markup to the real API.
   The static content remains as a fallback; every section below is re-rendered
   from live backend data when the API is reachable. */
(function () {
  'use strict';

  var api = window.ValidriftAPI;
  var H = window.Validrift;
  if (!api || !H) return;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return H.esc(s); }

  var latestIncidentId = null;

  function setKpi(key, value) {
    var el = document.querySelector('[data-kpi="' + key + '"]');
    if (el && value !== undefined && value !== null) el.textContent = String(value);
  }

  /* ---------- KPIs ---------- */
  function renderKpis(dash) {
    var k = dash.kpis || {};
    setKpi('learned_fixes', k.learned_fixes);
    setKpi('recent_incidents', k.recent_incidents);
    setKpi('hindsight_memories', k.hindsight_memories);
    setKpi('validity_alerts', k.validity_alerts);
    var sub = document.querySelector('[data-kpi-sub="alerts"]');
    if (sub && dash.audit_summary) {
      sub.textContent = dash.audit_summary.revalidation_required + ' Reval \u00B7 ' + dash.audit_summary.drifted + ' Drifted';
    }
  }

  /* ---------- context chips ---------- */
  function renderContext(dash) {
    var box = $('[data-context-chips]');
    if (!box) return;
    var ctx = dash.current_context || {};
    var items = [
      { label: 'Machine', value: ctx.machine, dot: true },
      { label: 'Film', value: ctx.material, dot: true },
      { label: 'Recipe', value: ctx.recipe, active: true },
      { label: 'Supplier', value: ctx.supplier },
      { label: 'Firmware', value: ctx.firmware },
    ];
    box.innerHTML = items.map(function (it) {
      return '<div class="flex items-center gap-1.5 px-space-sm py-1 bg-surface-container-low rounded border border-outline-variant/30 ' +
        'font-label-sm text-label-sm text-on-surface-variant">' +
        '<span class="font-semibold text-on-surface">' + esc(it.label) + ':</span> ' + esc(it.value || '\u2014') +
        (it.dot ? ' <span class="h-1.5 w-1.5 rounded-full bg-secondary"></span>' : '') +
        (it.active ? ' <span class="px-1 rounded bg-secondary-container text-on-secondary-container font-bold text-[10px]">ACTIVE</span>' : '') +
        '</div>';
    }).join('');
  }

  /* ---------- knowledge requiring attention ---------- */
  var PILL = {
    'DRIFTED': 'bg-[#FEE2E2] text-[#DC2626] border-[#FCA5A5]',
    'REVALIDATION REQUIRED': 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]',
    'SUPPORTED': 'bg-[#CCFBF1] text-[#0F766E] border-[#99F6E4]',
    'VALIDATED': 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]',
  };
  function pill(status) {
    return PILL[status] || 'bg-surface-container text-on-surface-variant border border-outline-variant/40';
  }

  function renderAttention(dash) {
    var list = $('[data-attention-list]');
    var count = $('[data-attention-count]');
    var items = dash.knowledge_requiring_attention || [];
    if (count) count.textContent = items.length + (items.length === 1 ? ' Action Item' : ' Action Items');
    if (!list) return;
    if (!items.length) {
      list.innerHTML = '<div class="p-space-md text-center font-body-sm text-body-sm text-on-surface-variant">No drift or revalidation alerts. All learned fixes are valid under the current process context.</div>';
      return;
    }
    list.innerHTML = items.map(function (it) {
      var change = it.relevant_process_change || {};
      var changes = change.changes || {};
      var changeText = Object.keys(changes).map(function (k) {
        var c = changes[k] || {};
        return k + ': ' + (c.old || '?') + ' \u2192 ' + (c.new || '?');
      }).join('; ');
      var passportUrl = H.passportUrl(it.fix_name, it.defect);
      return '<div class="bg-surface-container-lowest rounded-xl border border-outline-variant/40 p-space-md flex flex-col sm:flex-row sm:items-center gap-space-sm justify-between hover:shadow-md transition-shadow">' +
        '<div class="flex items-start gap-space-sm">' +
          '<div class="h-10 w-10 shrink-0 rounded-lg ' + (it.status === 'DRIFTED' ? 'bg-[#FEE2E2]' : 'bg-[#FEF3C7]') + ' flex items-center justify-center">' +
            '<span class="material-symbols-outlined ' + (it.status === 'DRIFTED' ? 'text-[#DC2626]' : 'text-[#B45309]') + '">warning</span>' +
          '</div>' +
          '<div class="flex flex-col gap-1">' +
            '<div class="flex flex-wrap items-center gap-2">' +
              '<span class="font-body-md text-body-md font-bold text-on-surface">"' + esc(it.fix_name) + '"</span>' +
              '<span class="px-2 py-0.5 rounded font-label-sm text-[10px] font-bold border ' + pill(it.status) + '">' + esc(it.status) + '</span>' +
            '</div>' +
            '<span class="font-body-sm text-body-sm text-on-surface-variant">' + esc(it.reason || '') + '</span>' +
            (changeText ? '<span class="font-label-sm text-label-sm text-on-surface-variant">Context shift \u2014 ' + esc(changeText) + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="flex items-center gap-2 shrink-0">' +
          '<a href="' + esc(passportUrl) + '" class="px-space-sm py-1.5 rounded-lg bg-secondary text-on-secondary font-label-sm text-label-sm font-semibold hover:bg-secondary-container transition-colors">View Fix Passport</a>' +
          '<a href="validity-audit.html" class="px-space-sm py-1.5 rounded-lg border border-outline-variant/40 font-label-sm text-label-sm font-medium text-on-surface hover:bg-surface-container-low transition-colors">Review Evidence</a>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  /* ---------- recent plant learning timeline ---------- */
  function renderLearning(dash) {
    var box = $('[data-learning-list]');
    if (!box) return;
    var rows = (dash.recent_incidents || []).filter(function (r) { return r.action_taken; }).slice(0, 4);
    if (!rows.length) {
      box.innerHTML = '<div class="font-body-sm text-body-sm text-on-surface-variant">No interventions recorded yet.</div>';
      return;
    }
    box.innerHTML = rows.map(function (r) {
      var good = r.outcome === 'SUCCESS';
      var dot = good ? 'bg-[#0F766E]' : 'bg-[#DC2626]';
      return '<div class="relative flex items-start justify-between gap-space-sm">' +
        '<span class="absolute -left-6 mt-1 h-2.5 w-2.5 rounded-full ' + dot + ' ring-4 ring-surface-container-lowest"></span>' +
        '<div class="flex flex-col">' +
          '<div class="flex items-center gap-2">' +
            '<span class="font-label-sm text-label-sm text-on-surface-variant font-bold">' + esc(H.fmtDay(r.date)) + '</span>' +
            '<span class="font-body-md text-body-md font-semibold text-on-surface">' + esc(r.action_taken) + ' ' + (good ? 'succeeded' : 'failed') + '</span>' +
          '</div>' +
          '<span class="font-body-sm text-body-sm text-on-surface-variant">' + esc(r.incident_id) + ' \u00B7 ' + esc(r.context) + ' \u00B7 ' + esc(r.defect) + '</span>' +
        '</div>' +
        '<span class="font-label-sm text-[10px] px-1.5 py-0.5 rounded font-bold ' + (good ? 'bg-[#CCFBF1] text-[#0F766E]' : 'bg-[#FEE2E2] text-[#DC2626]') + '">' + esc(r.outcome) + '</span>' +
      '</div>';
    }).join('');
  }

  /* ---------- memory activity ---------- */
  var OP_STYLE = {
    RETAIN: { cls: 'bg-[#CCFBF1] text-[#0F766E] border-[#99F6E4]', icon: 'archive' },
    RECALL: { cls: 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]', icon: 'manage_search' },
    REFLECT: { cls: 'bg-[#F3E8FF] text-[#7E22CE] border-[#E9D5FF]', icon: 'psychology' },
  };
  function memoryRow(t) {
    var st = OP_STYLE[t.operation] || OP_STYLE.RETAIN;
    var memIds = (t.memory_ids || []).slice(0, 3).join(', ');
    return '<div class="p-2.5 rounded-lg bg-surface-container-low/50 border border-outline-variant/20 flex flex-col gap-1 hover:bg-surface-container-low transition-colors">' +
      '<div class="flex items-center justify-between">' +
        '<span class="px-2 py-0.2 rounded font-label-sm text-[10px] font-bold border flex items-center gap-1 ' + st.cls + '">' +
          '<span class="material-symbols-outlined text-[12px]">' + st.icon + '</span> ' + esc(t.operation) + '</span>' +
        '<span class="font-label-sm text-label-sm text-on-surface-variant">' + esc(H.timeAgo(t.timestamp)) + '</span>' +
      '</div>' +
      '<span class="font-body-md text-body-md font-semibold text-on-surface">' + esc(t.summary || t.operation) + '</span>' +
      (memIds ? '<span class="font-label-sm text-label-sm text-on-surface-variant font-mono">ids: ' + esc(memIds) + '</span>' : '') +
    '</div>';
  }

  function renderMemory(activity, degraded) {
    var panel = $('[data-memory-panel]');
    var drawer = $('[data-memory-drawer-list]');
    var badge = $('[data-memory-count]');
    if (degraded) {
      var msg = '<div class="p-space-md text-center font-body-sm text-body-sm text-on-surface-variant">' + esc(api.MEMORY_UNAVAILABLE) + '</div>';
      if (panel) panel.innerHTML = msg;
      if (drawer) drawer.innerHTML = msg;
      return;
    }
    var rows = Array.isArray(activity) ? activity : [];
    var empty = '<div class="p-space-md text-center font-body-sm text-body-sm text-on-surface-variant">No memory activity recorded yet.</div>';
    if (panel) panel.innerHTML = rows.length ? rows.slice(0, 3).map(memoryRow).join('') : empty;
    if (drawer) drawer.innerHTML = rows.length ? rows.map(memoryRow).join('') : empty;
    if (badge) badge.textContent = String(rows.length);
  }

  /* ---------- incidents ledger ---------- */
  function validityPill(status) {
    if (!status) return '<span class="font-label-sm text-[10px] px-2 py-0.5 rounded font-bold bg-surface-container text-on-surface-variant">\u2014</span>';
    return '<span class="px-2 py-0.5 rounded font-label-sm text-[10px] font-bold border ' + pill(status) + '"> ' + esc(status) + ' </span>';
  }
  function outcomePill(outcome) {
    if (!outcome) return '<span class="font-label-sm text-[10px] px-2 py-0.5 rounded font-bold bg-surface-container text-on-surface-variant">PENDING</span>';
    var good = outcome === 'SUCCESS';
    return '<span class="font-label-sm text-[10px] px-2 py-0.5 rounded font-bold ' + (good ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEE2E2] text-[#DC2626]') + '">' + esc(outcome) + '</span>';
  }

  function renderIncidents(dash) {
    var tbody = $('[data-incidents-tbody]');
    var note = $('[data-incidents-note]');
    var rows = dash.recent_incidents || [];
    if (rows.length) latestIncidentId = rows[0].incident_id;
    if (note) note.textContent = 'Showing latest ' + rows.length + ' records';
    if (!tbody) return;
    tbody.innerHTML = rows.map(function (r) {
      return '<tr class="h-11 hover:bg-surface-container-low/50 transition-colors">' +
        '<td class="px-space-md font-label-md text-label-md font-bold text-secondary">' +
          '<span class="cursor-pointer hover:underline" data-incident="' + esc(r.incident_id) + '">' + esc(r.incident_id) + '</span></td>' +
        '<td class="px-space-md font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap">' + esc(H.fmtDay(r.date)) + '</td>' +
        '<td class="px-space-md font-medium">' + esc(r.defect) + '</td>' +
        '<td class="px-space-md font-label-md text-label-md">' + esc(r.context) + '</td>' +
        '<td class="px-space-md font-semibold ' + (r.action_taken ? 'text-on-surface' : 'text-outline') + '">' + esc(r.action_taken || '\u2014') + '</td>' +
        '<td class="px-space-md">' + outcomePill(r.outcome) + '</td>' +
        '<td class="px-space-md">' + validityPill(r.validity_status) + '</td>' +
        '<td class="px-space-md text-right">' +
          '<button class="font-label-sm text-secondary font-semibold hover:underline" data-details="' + esc(r.incident_id) + '|' + esc(r.action_taken || '') + '" type="button">Details</button>' +
        '</td></tr>';
    }).join('');
    // Static mock rows/toggle are superseded by real data.
    ['extra-row-1', 'extra-row-2'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    var toggle = document.querySelector('[onclick="toggleExtraLedger()"]');
    if (toggle) toggle.style.display = 'none';
    var idInput = document.getElementById('incident-id-input');
    if (idInput && latestIncidentId) idInput.value = latestIncidentId;
  }

  /* ---------- current recommendation card ---------- */
  function renderRecommendation(latest) {
    if (!latest || !latest.recommendation_id) return; // keep designed fallback
    var header = $('[data-current-rec]');
    if (!header) return;
    var card = header.parentElement; // card root
    function setRec(key, text) {
      var el = card.querySelector('[data-rec="' + key + '"]');
      if (el) el.textContent = text;
    }
    setRec('fix', ' ' + latest.recommended_fix + ' ');
    var ev = latest.evaluation || {};
    var evS = ev.current_successes || 0;
    var evTotal = evS + (ev.current_failures || 0);
    var pillEl = card.querySelector('[data-rec="verdict"]');
    if (pillEl) {
      pillEl.textContent = ' ' + latest.validity_status + (evTotal ? ' (' + evS + '/' + evTotal + ')' : '') + ' ';
      pillEl.className = 'px-2.5 py-0.5 rounded font-label-sm text-[11px] font-bold border ' + pill(latest.validity_status);
    }
    var ctxEl = card.querySelector('[data-rec="context"]');
    if (ctxEl) ctxEl.innerHTML = 'Context: <strong class="text-on-surface">' + esc(latest.context || '') + ' (Active)</strong> \u00B7 Station: ' + esc(latest.machine || '');
    var defEl = card.querySelector('[data-rec="defect"]');
    if (defEl) defEl.textContent = 'Defect: ' + (latest.defect || '');
    var evEl = card.querySelector('[data-rec="evidence"]');
    if (evEl) evEl.textContent = latest.why || '';
  }

  /* ---------- actions ---------- */
  function wireActions() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) {
        var inc = e.target.closest('[data-incident]');
        if (inc && window.showToast) window.showToast('Incident ' + inc.getAttribute('data-incident') + ' selected');
        var det = e.target.closest('[data-details]');
        if (det && window.openOutcomeModal) {
          var parts = det.getAttribute('data-details').split('|');
          window.openOutcomeModal(parts[0], parts[1]);
        }
        return;
      }
      var action = btn.getAttribute('data-action');
      if (action === 'goto-new-incident') {
        window.location.href = 'new-incident.html';
      } else if (action === 'goto-audit') {
        window.location.href = 'validity-audit.html?autorun=1';
      } else if (action === 'view-recommendation') {
        viewRecommendation(btn);
      } else if (action === 'reset-demo') {
        resetDemo();
      }
    });
  }

  function viewRecommendation(btn) {
    if (!latestIncidentId) { H.toast('No incidents to recommend for yet.'); return; }
    var original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>Generating recommendation\u2026</span>';
    api.recommend(latestIncidentId, true)
      .then(function (rec) {
        window.location.href = 'recommendation.html?id=' + encodeURIComponent(rec.recommendation_id);
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.innerHTML = original;
        H.toast(H.errorMessage(err));
      });
  }

  function resetDemo() {
    if (!window.confirm('Reset the demo scenario to the Film-B / R11 baseline? This clears all incidents, interventions, and memory traces.')) return;
    api.resetDemo()
      .then(function () {
        H.toast('Demo scenario reset to Film-B / R11 baseline.');
        window.location.reload();
      })
      .catch(function (err) { H.toast(H.errorMessage(err)); });
  }

  /* ---------- modals: real submits ---------- */
  function wireForms() {
    var pform = $('[data-process-form]');
    if (pform) {
      pform.addEventListener('submit', function (e) {
        e.preventDefault();
        var inputs = $all('input[type="text"]', pform);
        var material = (inputs[1] && inputs[1].value || '').trim();
        var recipe = (inputs[2] && inputs[2].value || '').trim();
        var notes = ($('textarea', pform) || {}).value || '';
        var runAudit = ($('[data-pc="run_audit"]', pform) || {}).checked !== false;
        var btn = pform.querySelector('[type="submit"]');
        var original = btn ? btn.textContent : '';
        if (btn) { btn.disabled = true; btn.textContent = 'Saving\u2026'; }
        var changes = {};
        if (material) changes.material = { new: material };
        if (recipe) changes.recipe = { new: recipe };
        api.processChange({ changes: changes, reason: notes, run_audit: runAudit })
          .then(function () {
            if (window.closeModal) window.closeModal('record-process-modal');
            H.toast('Process change recorded: Validity boundaries updated in Hindsight.');
            setTimeout(function () {
              if (runAudit) window.location.href = 'validity-audit.html?autorun=1';
              else window.location.reload();
            }, 600);
          })
          .catch(function (err) {
            if (btn) { btn.disabled = false; btn.textContent = original; }
            H.toast(H.errorMessage(err));
          });
      });
    }
    var iform = $('[data-incident-form]');
    if (iform) {
      iform.addEventListener('submit', function (e) {
        e.preventDefault();
        var incidentId = (document.getElementById('incident-id-input') || {}).value || '';
        var action = (document.getElementById('incident-action-input') || {}).value || '';
        var defectSel = iform.querySelector('select');
        var defect = defectSel ? defectSel.value : '';
        var outcomeEl = iform.querySelector('input[name="outcome"]:checked');
        var outcome = outcomeEl ? outcomeEl.value : 'SUCCESS';
        if (!incidentId || !action) { H.toast('Incident ID and action are required.'); return; }
        var btn = iform.querySelector('[type="submit"]');
        var original = btn ? btn.textContent : '';
        if (btn) { btn.disabled = true; btn.textContent = 'Retaining\u2026'; }
        api.createIntervention({ incident_id: incidentId, fix_name: action, outcome: outcome, notes: defect })
          .then(function () {
            if (window.closeModal) window.closeModal('record-incident-modal');
            H.toast('Incident outcome logged and retained in plant memory ledger.');
            setTimeout(function () { window.location.reload(); }, 600);
          })
          .catch(function (err) {
            if (btn) { btn.disabled = false; btn.textContent = original; }
            H.toast(H.errorMessage(err));
          });
      });
    }
  }

  /* ---------- boot ---------- */
  async function init() {
    var health = await api.health().catch(function () { return null; });
    if (!health) {
      H.toast('Backend unreachable. Showing designed fallback content.');
      wireActions();
      wireForms();
      return;
    }
    var degraded = !H.hindsightOk(health);
    try {
      var dash = await api.dashboard();
      var activity = await api.memoryActivity(50).catch(function () { return []; });
      var latest = await api.latestRecommendation().catch(function () { return null; });
      renderKpis(dash);
      renderContext(dash);
      renderAttention(dash);
      renderLearning(dash);
      renderMemory(activity, degraded);
      renderIncidents(dash);
      renderRecommendation(latest);
    } catch (err) {
      H.toast(H.errorMessage(err));
    }
    wireActions();
    wireForms();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

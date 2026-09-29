/* Validrift Memory Activity page: human-readable Hindsight feed, IDs collapsed. */
(function () {
  "use strict";
  var LABEL = {
    RETAIN: { icon: "save", verb: "Saved", desc: "new incident or outcome stored to memory" },
    RECALL: { icon: "manage_search", verb: "Recalled", desc: "relevant manufacturing history retrieved" },
    REFLECT: { icon: "autorenew", verb: "Reflected", desc: "summarized what changed and why" }
  };
  function itemHtml(t) {
    var V = window.Validrift;
    var op = String(t.operation || "").toUpperCase();
    var L = LABEL[op] || { icon: "memory", verb: op, desc: "" };
    var ids = (t.memory_ids || []).slice(0, 5);
    return '<div class="rounded-xl bg-surface-container-lowest border border-surface-container p-4">' +
      '<div class="flex items-center justify-between gap-2">' +
      '<span class="flex items-center gap-2 font-headline-sm text-headline-sm font-bold">' +
      '<span class="material-symbols-outlined text-[20px] text-secondary">' + L.icon + "</span>" +
      V.esc(L.verb) + "</span>" +
      '<span class="font-label-sm text-label-sm text-on-surface-variant">' + V.esc(V.timeAgo(t.timestamp)) + "</span></div>" +
      '<p class="mt-1 font-body-md text-body-md text-on-surface-variant">' + V.esc(L.desc) + "</p>" +
      (t.summary ? '<p class="mt-1 font-body-sm text-body-sm text-on-surface">' + V.esc(t.summary) + "</p>" : "") +
      (ids.length ? '<details class="mt-2"><summary class="font-label-md text-label-md text-secondary cursor-pointer">Technical details</summary>' +
        '<p class="mt-1 font-mono font-label-sm text-label-sm text-on-surface-variant break-all">' +
        V.esc(ids.join(", ")) + (t.memory_ids.length > 5 ? " \u2026" : "") + "</p></details>" : "") +
      "</div>";
  }
  document.addEventListener("DOMContentLoaded", function () {
    var host = document.getElementById("mem-list");
    window.ValidriftAPI.memoryActivity(30).then(function (traces) {
      host.innerHTML = traces.length ? traces.map(itemHtml).join("") :
        '<p class="font-body-md text-body-md text-on-surface-variant">No memory activity recorded yet.</p>';
    }).catch(function () {
      host.innerHTML = '<p class="font-body-md text-body-md text-error">' +
        window.Validrift.esc(window.ValidriftAPI.MEMORY_UNAVAILABLE) + "</p>";
    });
  });
})();

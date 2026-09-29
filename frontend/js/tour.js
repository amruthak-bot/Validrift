/* Validrift guided tours — coachmark overlay + dismissible contextual hints.
   Tours are defined per page; first visit auto-starts, replay via help buttons. */
(function () {
  "use strict";

  var TOURS = {
    landing: [
      { sel: "header", title: "Welcome to Validrift",
        body: "Your factory's memory for quality fixes. This short tour shows you around \u2014 you can replay it anytime from the help button up top." },
      { sel: ".machine-art", title: "Meet Sealer-02",
        body: "This heat-sealing machine is where the demo happens. Its past fixes, materials, and outcomes are what Validrift remembers.", pos: "left" },
      { sel: "#hiw-steps", title: "Three steps, no manual",
        body: "Report a problem, get a recommendation backed by dated memory records, then record the result. Tap each step above to preview what happens.", pos: "top" },
      { sel: "#btn-start", title: "Start when ready",
        body: "Report your first problem in three guided steps \u2014 or run the Guided Demo to watch Validrift catch a fix that stopped working.", pos: "top" },
      { sel: "[data-vr-theme-toggle]", title: "Forge or Dayshift",
        body: "Switch between the dark Forge theme and the light Dayshift theme anytime. Your choice is remembered.", pos: "bottom" },
    ],
    "new-incident": [
      { sel: '[data-ni="defect"]', title: "Pick the defect",
        body: "Choose what you saw on the line. Related defects seen on this machine appear below, so similar problems are one tap away." },
      { sel: '[data-ni="product"]', title: "Product category",
        body: "What was running when it happened? The category is stored with the incident and helps memory retrieval later." },
      { sel: "#btn-analyze", title: "Analyze",
        body: "Validrift attaches the current machine context automatically, then searches memory for fixes \u2014 and re-checks whether they still apply today.", pos: "top" },
    ],
    recommendation: [
      { sel: '[data-r="fix-name"]', title: "The recommendation",
        body: "The fix Validrift trusts right now. The dates next to it are real \u2014 they show when each supporting memory was recorded." },
      { sel: '[data-r="why-not-title"]', title: "Why not the old fix?",
        body: "This is the heart of Validrift: a fix that worked before can drift when the process changes. The Before/Now cards show exactly when that happened.", pos: "top" },
      { sel: "#btn-record", title: "Close the loop",
        body: "Record what actually happened. Your result becomes a new dated memory record, so the next recommendation is smarter.", pos: "top" },
    ],
    "knowledge-map": [
      { sel: "#km-svg", title: "The memory map",
        body: "Every fix, defect, machine, material, recipe, and supplier \u2014 connected by real records. Bigger nodes have more evidence. Drag to explore, click any node for details.", pos: "top" },
      { sel: "#km-legend", title: "Read the colors",
        body: "Green means the fix is validated, amber means supported, red means it drifted. The map is drawn from live validity data, not a static diagram.", pos: "top" },
    ],
  };

  var active = null; // {name, idx, els}

  function seenKey(name) { return "vr_tour_" + name; }
  function isSeen(name) {
    try { return localStorage.getItem(seenKey(name)) === "1"; } catch (e) { return true; }
  }
  function markSeen(name) {
    try { localStorage.setItem(seenKey(name), "1"); } catch (e) {}
  }

  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }

  function ensureChrome() {
    if (document.getElementById("vr-tour-backdrop")) return;
    var bd = el("div", "");
    bd.id = "vr-tour-backdrop";
    bd.addEventListener("click", end);
    var sp = el("div", "vr-spotlight");
    sp.id = "vr-tour-spot";
    sp.style.display = "none";
    var card = el("div", "");
    card.id = "vr-tour-card";
    card.style.display = "none";
    document.body.appendChild(bd);
    document.body.appendChild(sp);
    document.body.appendChild(card);
  }

  function show(i) {
    var steps = TOURS[active.name];
    var step = steps[i];
    active.idx = i;
    var target = document.querySelector(step.sel);
    var bd = document.getElementById("vr-tour-backdrop");
    var sp = document.getElementById("vr-tour-spot");
    var card = document.getElementById("vr-tour-card");
    if (!target) { next(); return; }
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    // wait a tick for scroll, then place
    setTimeout(function () {
      if (!active) return;
      var r = target.getBoundingClientRect();
      var pad = 8;
      sp.style.display = "block";
      sp.style.left = Math.max(4, r.left - pad) + "px";
      sp.style.top = Math.max(4, r.top - pad) + "px";
      sp.style.width = (r.width + pad * 2) + "px";
      sp.style.height = (r.height + pad * 2) + "px";
      requestAnimationFrame(function () { bd.classList.add("vr-show"); });
      card.style.display = "block";
      card.innerHTML =
        '<div class="vr-tour-steps">Step ' + (i + 1) + " of " + steps.length + "</div>" +
        "<h4>" + step.title + "</h4><p>" + step.body + "</p>" +
        '<div class="mt-4 flex items-center justify-between gap-2">' +
        '<button type="button" data-t="skip" class="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface cursor-pointer">Skip tour</button>' +
        '<div class="flex gap-2">' +
        (i > 0 ? '<button type="button" data-t="back" class="px-3 py-1.5 rounded-lg border border-outline-variant/50 font-body-sm text-body-sm cursor-pointer">Back</button>' : "") +
        '<button type="button" data-t="next" class="btn-press px-4 py-1.5 rounded-lg bg-secondary text-on-secondary font-body-sm text-body-sm font-bold cursor-pointer">' +
        (i === steps.length - 1 ? "Done" : "Next") + "</button>" +
        "</div></div>";
      card.querySelector('[data-t="skip"]').addEventListener("click", end);
      card.querySelector('[data-t="next"]').addEventListener("click", next);
      var back = card.querySelector('[data-t="back"]');
      if (back) back.addEventListener("click", function () { show(i - 1); });
      // position card near target
      var cw = 320, ch = card.offsetHeight || 220, m = 12;
      var cx = r.left + r.width / 2 - cw / 2;
      cx = Math.max(m, Math.min(window.innerWidth - cw - m, cx));
      var below = r.bottom + pad + m + ch <= window.innerHeight;
      var above = r.top - pad - m - ch >= 0;
      var cy;
      var want = step.pos || "bottom";
      if (want === "bottom" && below) cy = r.bottom + pad + m;
      else if (want === "top" && above) cy = r.top - pad - m - ch;
      else if (below) cy = r.bottom + pad + m;
      else if (above) cy = r.top - pad - m - ch;
      else cy = Math.max(m, Math.min(window.innerHeight - ch - m, r.top));
      card.style.left = cx + "px";
      card.style.top = Math.max(m, cy) + "px";
      card.style.width = cw + "px";
    }, 350);
  }

  function next() {
    var steps = TOURS[active.name];
    if (active.idx >= steps.length - 1) { end(); return; }
    show(active.idx + 1);
  }

  function end() {
    if (!active) return;
    markSeen(active.name);
    active = null;
    ["vr-tour-backdrop", "vr-tour-spot", "vr-tour-card"].forEach(function (id) {
      var n = document.getElementById(id);
      if (n) { n.classList.remove("vr-show"); n.style.display = "none"; }
    });
    window.removeEventListener("resize", reposition);
  }

  function reposition() {
    if (active) show(active.idx);
  }

  function start(name) {
    if (!TOURS[name]) return;
    ensureChrome();
    active = { name: name, idx: 0 };
    document.getElementById("vr-tour-backdrop").style.display = "block";
    window.addEventListener("resize", reposition);
    show(0);
  }

  function auto(name) {
    if (isSeen(name)) return;
    setTimeout(function () { start(name); }, 900);
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && active) end();
  });

  /* ---- contextual hint chips: any [data-vr-hint] gets a dismissible guide ---- */
  function hintKey(elm) {
    var t = (elm.getAttribute("data-vr-hint") || "").slice(0, 24);
    var h = 0;
    for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
    return "vr_hint_" + (h < 0 ? -h : h);
  }
  function paintHints() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-vr-hint]"), function (slot) {
      if (slot.querySelector(".vr-hint")) return;
      var key = hintKey(slot);
      try { if (localStorage.getItem(key) === "1") return; } catch (e) {}
      var chip = el("div", "vr-hint",
        '<span class="material-symbols-outlined">lightbulb</span><span>' +
        slot.getAttribute("data-vr-hint") + "</span>");
      var x = el("button", "", '<span class="material-symbols-outlined text-[18px]">close</span>');
      x.type = "button";
      x.setAttribute("aria-label", "Dismiss hint");
      x.addEventListener("click", function () {
        try { localStorage.setItem(key, "1"); } catch (e) {}
        chip.remove();
      });
      chip.appendChild(x);
      slot.appendChild(chip);
    });
  }

  window.ValidriftTour = { start: start, auto: auto, tours: TOURS };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", paintHints);
  } else { paintHints(); }
})();

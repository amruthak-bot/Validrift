/* Validrift Knowledge Map — entity relationship graph drawn from live validity data.
   Nodes: fixes, defects, machines, materials, recipes, suppliers.
   Edges: aggregated evidence links. Custom force-directed layout, drag, filters. */
(function () {
  "use strict";

  var PAL = {};
  function cssVar(n) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    return "rgb(" + v + ")";
  }
  function resolvePal() {
    PAL = {
      fixValidated: cssVar("--tertiary"), fixSupported: cssVar("--primary"),
      fixDrifted: cssVar("--error"), fixOther: cssVar("--steel"),
      defect: cssVar("--steel"), entity: cssVar("--on-surface-variant"),
      edge: cssVar("--outline"), edgeHot: cssVar("--primary"),
      label: cssVar("--on-surface"), sub: cssVar("--on-surface-variant"),
      halo: cssVar("--primary"),
    };
  }
  document.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest("[data-vr-theme-btn]")) {
      setTimeout(function () { resolvePal(); draw(); }, 60);
    }
  });

  var NS = "http://www.w3.org/2000/svg";
  function mk(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  var nodes = [], edges = [], nodeById = {};
  var W = 800, H = 520, running = false, selected = null;
  var filters = { fix: true, defect: true, machine: true, material: true, supplier: true, recipe: true };

  function addNode(id, type, label, extra) {
    if (nodeById[id]) return nodeById[id];
    var n = { id: id, type: type, label: label, x: 0, y: 0, vx: 0, vy: 0,
              count: 0, succ: 0, fail: 0, data: extra || {} };
    nodeById[id] = n; nodes.push(n); return n;
  }
  function addEdge(a, b, kind) {
    var id = a.id + ">" + b.id + ":" + kind;
    for (var i = 0; i < edges.length; i++) if (edges[i].id === id) {
      edges[i].count++; return edges[i];
    }
    var e = { id: id, a: a, b: b, kind: kind, count: 1, succ: 0, fail: 0 };
    edges.push(e); return e;
  }

  function buildGraph(fixes) {
    nodes = []; edges = []; nodeById = {};
    (fixes || []).forEach(function (f) {
      var ev = (f.current_evidence || []).concat(f.historical_evidence || []);
      var fn = addNode("fix:" + f.fix_name, "fix", f.fix_name,
        { status: f.status, defect: f.defect, cs: f.current_successes, cf: f.current_failures,
          hs: f.historical_successes, hf: f.historical_failures });
      var dn = addNode("defect:" + f.defect, "defect", f.defect, {});
      var e1 = addEdge(fn, dn, "targets"); e1.count = Math.max(1, ev.length);
      ev.forEach(function (it) {
        var c = it.context || {};
        [["machine", c.machine], ["material", c.material],
         ["supplier", c.supplier], ["recipe", c.recipe]].forEach(function (pair) {
          if (!pair[1]) return;
          var en = addNode(pair[0] + ":" + pair[1], pair[0], pair[1], {});
          var e = addEdge(fn, en, "context");
          if (it.outcome === "SUCCESS") e.succ++; else e.fail++;
        });
        fn.count++;
        if (it.outcome === "SUCCESS") fn.succ++; else fn.fail++;
      });
    });
    // seed positions on a circle
    nodes.forEach(function (n, i) {
      var a = (i / Math.max(1, nodes.length)) * Math.PI * 2;
      n.x = W / 2 + Math.cos(a) * Math.min(W, H) * 0.32;
      n.y = H / 2 + Math.sin(a) * Math.min(W, H) * 0.32;
    });
  }

  function visible(n) { return filters[n.type]; }

  function tick() {
    var i, j, n, m, e, dx, dy, d2, d, f;
    // repulsion
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i]; if (!visible(n) || n.fixed) continue;
      for (j = i + 1; j < nodes.length; j++) {
        m = nodes[j]; if (!visible(m) || m.fixed) continue;
        dx = n.x - m.x; dy = n.y - m.y; d2 = dx * dx + dy * dy + 40;
        d = Math.sqrt(d2);
        f = 5200 / d2;
        dx /= d; dy /= d;
        n.vx += dx * f; n.vy += dy * f;
        m.vx -= dx * f; m.vy -= dy * f;
      }
    }
    // springs
    edges.forEach(function (e) {
      if (!visible(e.a) || !visible(e.b)) return;
      dx = e.b.x - e.a.x; dy = e.b.y - e.a.y;
      d = Math.sqrt(dx * dx + dy * dy) || 1;
      var rest = 110 + Math.min(60, e.count * 4);
      f = (d - rest) * 0.012;
      dx /= d; dy /= d;
      if (!e.a.fixed) { e.a.vx += dx * f; e.a.vy += dy * f; }
      if (!e.b.fixed) { e.b.vx -= dx * f; e.b.vy -= dy * f; }
    });
    // gravity + integrate
    var energy = 0;
    nodes.forEach(function (n) {
      if (!visible(n) || n.fixed) return;
      n.vx += (W / 2 - n.x) * 0.004;
      n.vy += (H / 2 - n.y) * 0.004;
      n.vx *= 0.86; n.vy *= 0.86;
      n.x += n.vx; n.y += n.vy;
      n.x = Math.max(40, Math.min(W - 40, n.x));
      n.y = Math.max(34, Math.min(H - 30, n.y));
      energy += Math.abs(n.vx) + Math.abs(n.vy);
    });
    draw();
    if (energy > 0.6) requestAnimationFrame(tick);
    else running = false;
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(tick); } }

  var svg, gE, gN;
  function nodeColor(n) {
    if (n.type === "fix") {
      var s = (n.data.status || "").toUpperCase();
      if (s === "VALIDATED") return PAL.fixValidated;
      if (s === "SUPPORTED") return PAL.fixSupported;
      if (s === "DRIFTED") return PAL.fixDrifted;
      return PAL.fixOther;
    }
    if (n.type === "defect") return PAL.defect;
    return PAL.entity;
  }
  function nodeR(n) {
    if (n.type === "fix") return 13 + Math.min(14, n.count * 1.6);
    if (n.type === "defect") return 12;
    return 8 + Math.min(8, n.count);
  }

  function draw() {
    if (!svg) return;
    // edges
    while (gE.firstChild) gE.removeChild(gE.firstChild);
    edges.forEach(function (e) {
      if (!visible(e.a) || !visible(e.b)) return;
      var hot = e.fail > e.succ;
      var line = mk("line", {
        x1: e.a.x, y1: e.a.y, x2: e.b.x, y2: e.b.y,
        stroke: hot ? PAL.fixDrifted : (e.kind === "targets" ? PAL.edgeHot : PAL.edge),
        "stroke-width": 1 + Math.min(4, e.count * 0.5),
        "stroke-dasharray": e.kind === "context" ? "5 4" : "none",
        opacity: e.kind === "targets" ? 0.85 : 0.55,
        class: "km-edge",
      });
      gE.appendChild(line);
      if (e.count > 1) {
        var t = mk("text", {
          x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 - 4,
          "text-anchor": "middle", class: "km-edge-label",
        });
        t.textContent = "×" + e.count;
        gE.appendChild(t);
      }
    });
    // nodes
    while (gN.firstChild) gN.removeChild(gN.firstChild);
    nodes.forEach(function (n) {
      if (!visible(n)) return;
      var g = mk("g", { class: "km-node" + (selected === n ? " km-selected" : ""), transform: "translate(" + n.x + "," + n.y + ")" });
      var r = nodeR(n);
      g.appendChild(mk("circle", { r: r + 9, class: "km-halo" }));
      var core = mk("circle", {
        r: r, class: "km-core",
        fill: n.type === "entity" || n.type === "defect" ? "none" : nodeColor(n),
        stroke: nodeColor(n), "stroke-width": n.type === "fix" ? 0 : 2.5,
        opacity: n.type === "fix" ? 0.92 : 1,
      });
      g.appendChild(core);
      if (n.type !== "fix") {
        g.appendChild(mk("circle", { r: r * 0.42, fill: nodeColor(n) }));
      } else {
        var ic = mk("text", { "text-anchor": "middle", dy: "0.35em", "font-size": r * 0.8, fill: "#fff", "pointer-events": "none" });
        ic.textContent = n.data.status === "DRIFTED" ? "!" : "✓";
        g.appendChild(ic);
      }
      var lab = mk("text", { y: r + 15, "text-anchor": "middle", class: "km-label" });
      lab.textContent = n.label.length > 22 ? n.label.slice(0, 21) + "…" : n.label;
      g.appendChild(lab);
      g.addEventListener("pointerdown", function (ev) { startDrag(ev, n); });
      g.addEventListener("click", function () { select(n); });
      gN.appendChild(g);
    });
  }

  /* drag */
  var dragN = null;
  function svgPoint(ev) {
    var pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }
  function startDrag(ev, n) {
    dragN = n; n.fixed = true;
    ev.preventDefault();
    function mv(e2) {
      var p = svgPoint(e2);
      n.x = Math.max(40, Math.min(W - 40, p.x));
      n.y = Math.max(34, Math.min(H - 30, p.y));
      n.vx = n.vy = 0; draw();
    }
    function up() {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", up);
      if (dragN) { dragN.fixed = false; dragN = null; kick(); }
    }
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
  }

  /* detail panel */
  function retrievalNote(n) {
    if (n.type === "fix") {
      var s = (n.data.status || "").toUpperCase();
      var why = s === "DRIFTED"
        ? "Validrift will NOT recommend this fix in its old context anymore — the map shows exactly which context links broke."
        : "When a matching incident arrives, Validrift retrieves this fix through these links — every edge is a dated memory record, not a guess.";
      return why + " It connects to " + n.count + " record" + (n.count === 1 ? "" : "s") +
        " (" + n.succ + " successful, " + n.fail + " failed).";
    }
    if (n.type === "defect") {
      return "Defects are the entry point for retrieval: an incident with this defect pulls every fix linked here, then validity is re-checked per fix.";
    }
    return "Context entities are what validity is checked against. When one of these changes (e.g. a new material), linked fixes are re-evaluated — that is how drift is caught.";
  }
  function select(n) {
    selected = n;
    var V = window.Validrift;
    var panel = document.getElementById("km-panel");
    var links = edges.filter(function (e) { return visible(e.a) && visible(e.b) && (e.a === n || e.b === n); });
    var rows = links.map(function (e) {
      var o = e.a === n ? e.b : e.a;
      var tag = o.type === "fix" && o.data.status ? V.statusChip(o.data.status) : "";
      return '<div class="flex items-center justify-between gap-2 py-1 border-b border-outline-variant/30 last:border-0">' +
        '<span class="font-body-sm text-body-sm"><strong>' + V.esc(o.label) + '</strong> <span class="text-on-surface-variant">(' + V.esc(o.type) + " ×" + e.count + ")</span></span>" + tag + "</div>";
    }).join("");
    var head = n.type === "fix"
      ? '<div class="flex items-center gap-2 flex-wrap"><strong class="font-headline-sm text-headline-sm">' + V.esc(n.label) + "</strong>" + V.statusChip(n.data.status || "") + "</div>"
      : '<div class="flex items-center gap-2"><strong class="font-headline-sm text-headline-sm">' + V.esc(n.label) + '</strong><span class="vr-chip vr-chip-neutral">' + V.esc(n.type) + "</span></div>";
    panel.innerHTML = head +
      '<p class="mt-2 font-body-sm text-body-sm text-on-surface-variant">' + V.esc(retrievalNote(n)) + "</p>" +
      '<p class="mt-3 font-label-md text-label-md uppercase tracking-wider text-on-surface-variant font-semibold">Connected to</p>' +
      '<div class="mt-1">' + (rows || '<p class="font-body-sm text-body-sm text-on-surface-variant">No visible connections.</p>') + "</div>";
    draw();
  }

  /* filters */
  var TYPE_LABEL = { fix: "Fixes", defect: "Defects", machine: "Machines", material: "Materials", supplier: "Suppliers", recipe: "Recipes" };
  function paintFilters() {
    var box = document.getElementById("km-filters");
    box.innerHTML = "";
    Object.keys(TYPE_LABEL).forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "px-3 py-1.5 rounded-full border font-body-sm text-body-sm transition-colors cursor-pointer " +
        (filters[t] ? "bg-secondary text-on-secondary border-secondary font-semibold" : "border-outline-variant/50 text-on-surface-variant");
      b.textContent = TYPE_LABEL[t];
      b.setAttribute("aria-pressed", filters[t] ? "true" : "false");
      b.addEventListener("click", function () {
        filters[t] = !filters[t];
        if (selected && !visible(selected)) selected = null;
        paintFilters(); draw(); kick();
      });
      box.appendChild(b);
    });
  }

  function sizeSvg() {
    var wrap = svg.parentElement;
    W = Math.max(320, wrap.clientWidth);
    H = Math.max(420, Math.min(560, wrap.clientWidth * 0.62));
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  }

  document.addEventListener("DOMContentLoaded", function () {
    resolvePal();
    svg = document.getElementById("km-svg");
    if (!svg) return;
    gE = mk("g", {}); gN = mk("g", {});
    svg.appendChild(gE); svg.appendChild(gN);
    sizeSvg();
    window.addEventListener("resize", function () { sizeSvg(); draw(); kick(); });
    paintFilters();
    var help = document.getElementById("km-help");
    if (help && window.ValidriftTour) {
      help.addEventListener("click", function () { window.ValidriftTour.start("knowledge-map"); });
      window.ValidriftTour.auto("knowledge-map");
    }
    var api = window.ValidriftAPI, V = window.Validrift;
    api.validityAudit({}).then(function (audit) {
      var fixes = (audit && audit.fixes) || [];
      if (!fixes.length) {
        document.getElementById("km-panel").innerHTML =
          '<p class="font-body-md text-body-md text-on-surface-variant">No validity data yet. Report an incident first, then come back to see the map.</p>';
        return;
      }
      buildGraph(fixes);
      // center of mass to middle
      kick();
      draw();
    }).catch(function (err) {
      document.getElementById("km-panel").innerHTML =
        '<p class="font-body-md text-body-md text-on-surface-variant">Could not load the map: ' + V.esc(V.errorMessage(err)) + "</p>";
    });
  });
})();

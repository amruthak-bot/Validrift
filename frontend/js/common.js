/* Validrift shared page helpers: navigation router, toasts, health badge,
 * memory-activity rendering, and small formatting utilities.
 * Loaded on every page. Page-specific logic lives in js/<page>.js.
 */
(function () {
  "use strict";

  var ROUTES = {
    "overview-dashboard": "index.html",
    "new-quality-incident": "new-incident.html",
    "recommendation": "recommendation.html",
    "memory-validity-audit": "validity-audit.html",
    "fix-passport": "fix-passport.html",
  };

  function go(path) { window.location.href = path; }

  // --- navigation ---------------------------------------------------------
  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest ? e.target.closest("[data-path]") : null;
    if (!el) return;
    var dest = ROUTES[el.getAttribute("data-path")];
    if (!dest) return;
    // Let explicit handlers (with data-nav="custom") do their own work.
    if (el.getAttribute("data-nav") === "custom") return;
    e.preventDefault();
    var params = el.getAttribute("data-path-params");
    go(dest + (params ? "?" + params : ""));
  });

  function passportUrl(fixName, defect) {
    return "fix-passport.html?fix=" + encodeURIComponent(fixName || "") +
      "&defect=" + encodeURIComponent(defect || "");
  }

  // --- toast --------------------------------------------------------------
  function toast(msg, ms) {
    if (typeof window.showToast === "function") { window.showToast(msg); return; }
    var host = document.getElementById("quick-action-toast") || document.getElementById("vr-toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "vr-toast-host";
      host.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;";
      document.body.appendChild(host);
    }
    var textEl = document.getElementById("toast-message");
    if (textEl) { textEl.textContent = msg; }
    else {
      host.innerHTML = "";
      var pill = document.createElement("div");
      pill.style.cssText = "background:#131b2e;color:#fff;padding:10px 18px;border-radius:10px;font:500 13px Inter,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);";
      pill.textContent = msg;
      host.appendChild(pill);
    }
    if (host.classList) {
      host.classList.remove("translate-y-24", "opacity-0");
    }
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      if (host.id === "vr-toast-host") host.innerHTML = "";
    }, ms || 3200);
  }

  // --- formatting ---------------------------------------------------------
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d)) return String(iso);
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear() + ", " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function fmtDay(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d)) return String(iso);
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
  }

  function timeAgo(iso) {
    if (!iso) return "";
    var d = new Date(iso).getTime();
    if (isNaN(d)) return "";
    var s = Math.max(0, Math.floor((Date.now() - d) / 1000));
    if (s < 60) return "just now";
    var m = Math.floor(s / 60);
    if (m < 60) return m + " min ago";
    var h = Math.floor(m / 60);
    if (h < 24) return h + " hr ago";
    var days = Math.floor(h / 24);
    return days + (days === 1 ? " day ago" : " days ago");
  }

  // --- status chips (same palette language as the Stitch markup) ----------
  var STATUS_STYLE = {
    "VALIDATED": "background:#E4F4E8;color:#166534;border:1px solid #16653433;",
    "SUPPORTED": "background:#DFF5F0;color:#0C6E63;border:1px solid #0C6E6333;",
    "DRIFTED": "background:#FDECEA;color:#C62828;border:1px solid #C6282833;",
    "REVALIDATION REQUIRED": "background:#FFF7E0;color:#9A6B1A;border:1px solid #9A6B1A33;",
    "UNVERIFIED": "background:#E8EEF7;color:#3F5B8A;border:1px solid #3F5B8A33;",
    "INSUFFICIENT EVIDENCE": "background:#F1F3F7;color:#6B7280;border:1px solid #6B728033;",
    "SUCCESS": "background:#E4F4E8;color:#166534;border:1px solid #16653433;",
    "FAILURE": "background:#FDECEA;color:#C62828;border:1px solid #C6282833;",
    "PARTIAL IMPROVEMENT": "background:#FFF7E0;color:#9A6B1A;border:1px solid #9A6B1A33;",
    "RETAIN": "background:#E4F4E8;color:#166534;border:1px solid #16653433;",
    "RECALL": "background:#E8EEF7;color:#3F5B8A;border:1px solid #3F5B8A33;",
    "REFLECT": "background:#EFE7FB;color:#6D3BC7;border:1px solid #6D3BC733;",
  };

  function statusChip(status, extraClass) {
    var s = String(status || "—").toUpperCase();
    var style = STATUS_STYLE[s] || STATUS_STYLE["INSUFFICIENT EVIDENCE"];
    return '<span class="' + (extraClass || "") + '" style="display:inline-flex;align-items:center;gap:6px;' +
      'padding:3px 10px;border-radius:6px;font:600 10px \'JetBrains Mono\',monospace;letter-spacing:.04em;white-space:nowrap;' +
      style + '"><span style="width:6px;height:6px;border-radius:9999px;background:currentColor;display:inline-block;"></span>' +
      esc(status || "—") + "</span>";
  }

  // --- health badge -------------------------------------------------------
  var healthCache = null;
  async function getHealth() {
    if (healthCache) return healthCache;
    try {
      healthCache = await window.ValidriftAPI.health();
    } catch (e) {
      healthCache = { status: "offline", database: "error", hindsight: { ok: false, mode: "offline" } };
    }
    return healthCache;
  }
  function hindsightOk(h) {
    return !!(h && h.hindsight && h.hindsight.ok);
  }

  function paintHealthBadge() {
    var badges = document.querySelectorAll("[data-health-badge]");
    if (!badges.length) return;
    getHealth().then(function (h) {
      var ok = hindsightOk(h);
      var online = h.status !== "offline";
      badges.forEach(function (b) {
        if (!online) {
          b.innerHTML = '<span style="width:8px;height:8px;border-radius:9999px;background:#C62828;display:inline-block;"></span> Backend Offline';
          b.setAttribute("title", "Cannot reach the Validrift backend.");
        } else if (ok) {
          b.innerHTML = '<span style="width:8px;height:8px;border-radius:9999px;background:#12B76A;display:inline-block;"></span> Hindsight Connected <span style="font-weight:700;">LIVE</span>';
          b.setAttribute("title", "Hindsight memory service reachable (" + ((h.hindsight && h.hindsight.mode) || "live") + ").");
        } else {
          b.innerHTML = '<span style="width:8px;height:8px;border-radius:9999px;background:#F79009;display:inline-block;"></span> ' + esc(window.ValidriftAPI.MEMORY_UNAVAILABLE);
          b.setAttribute("title", "Hindsight unreachable — deterministic evidence still works.");
        }
      });
    });
  }

  // --- memory activity rendering ------------------------------------------
  var OP_ICON = { RETAIN: "save", RECALL: "manage_search", REFLECT: "autorenew" };

  function memoryItemHtml(t) {
    var op = String(t.operation || "").toUpperCase();
    var icon = OP_ICON[op] || "memory";
    return (
      '<div style="background:#F4F7FE;border:1px solid #E3EAFB;border-radius:10px;padding:12px 14px;margin-bottom:10px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
      statusChip(op) +
      '<span style="font:500 11px Inter,sans-serif;color:#76777d;">' + esc(timeAgo(t.timestamp)) + "</span></div>" +
      '<div style="font:600 13px Inter,sans-serif;color:#0b1c30;margin-bottom:4px;">' + esc(t.summary || t.query_summary || op) + "</div>" +
      '<div style="font:400 12px Inter,sans-serif;color:#45464d;">' +
      (t.memory_ids && t.memory_ids.length ? esc(t.memory_ids.length) + " memorie(s): " + esc(t.memory_ids.slice(0, 3).join(", ")) + (t.memory_ids.length > 3 ? "…" : "") + " · " : "") +
      "status " + esc(t.status || "—") + (t.latency_ms != null ? " · " + esc(String(t.latency_ms)) + " ms" : "") +
      "</div></div>"
    );
  }

  async function fillMemoryActivity(selector, limit) {
    var hosts = document.querySelectorAll(selector);
    if (!hosts.length) return;
    try {
      var traces = await window.ValidriftAPI.memoryActivity(limit || 20);
      var html = traces.length
        ? traces.map(memoryItemHtml).join("")
        : '<div style="font:400 13px Inter,sans-serif;color:#76777d;padding:8px 2px;">No memory activity recorded yet.</div>';
      hosts.forEach(function (h) { h.innerHTML = html; });
    } catch (e) {
      hosts.forEach(function (h) {
        h.innerHTML = '<div style="font:400 13px Inter,sans-serif;color:#C62828;padding:8px 2px;">' +
          esc(window.ValidriftAPI.MEMORY_UNAVAILABLE) + "</div>";
      });
    }
  }

  function errorMessage(err) {
    if (err && err.message) return err.message;
    return "Something went wrong.";
  }

  // Expose
  window.Validrift = {
    go: go,
    passportUrl: passportUrl,
    toast: toast,
    esc: esc,
    fmtDate: fmtDate,
    fmtDay: fmtDay,
    timeAgo: timeAgo,
    statusChip: statusChip,
    getHealth: getHealth,
    hindsightOk: hindsightOk,
    paintHealthBadge: paintHealthBadge,
    fillMemoryActivity: fillMemoryActivity,
    errorMessage: errorMessage,
  };

  document.addEventListener("DOMContentLoaded", paintHealthBadge);
})();

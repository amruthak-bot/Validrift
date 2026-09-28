/* Validrift frontend configuration.
 * API base URL resolution order:
 *   1. ?api=<base> query parameter (also persisted to localStorage)
 *   2. localStorage "validrift_api_base"
 *   3. window.VALIDRIFT_API_BASE_URL (set before this file loads)
 *   4. default http://127.0.0.1:8000/api
 * No secrets live here. Never put API keys in frontend files.
 */
(function () {
  var DEFAULT_API = "http://127.0.0.1:8000/api";

  function fromQuery() {
    try {
      var q = new URLSearchParams(window.location.search).get("api");
      if (q) {
        q = q.replace(/\/$/, "");
        try { window.localStorage.setItem("validrift_api_base", q); } catch (e) {}
        return q;
      }
    } catch (e) {}
    return null;
  }

  function fromStorage() {
    try { return window.localStorage.getItem("validrift_api_base") || null; } catch (e) { return null; }
  }

  var base = fromQuery() || fromStorage() || window.VALIDRIFT_API_BASE_URL || DEFAULT_API;
  base = String(base).replace(/\/$/, "");

  window.VALIDRIFT_CONFIG = {
    apiBaseUrl: base,
    setApiBaseUrl: function (url) {
      url = String(url || "").replace(/\/$/, "");
      try { window.localStorage.setItem("validrift_api_base", url); } catch (e) {}
      window.VALIDRIFT_CONFIG.apiBaseUrl = url;
    },
  };
})();

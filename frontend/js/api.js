/* Validrift API client — the single place the frontend talks to FastAPI.
 * Every page uses this instead of calling fetch() directly.
 * Handles: JSON, timeouts, HTTP errors, offline detection.
 */
(function () {
  "use strict";

  var MEMORY_UNAVAILABLE = "Memory service temporarily unavailable.";
  var EXPLANATION_UNAVAILABLE =
    "Evidence is available, but natural-language explanation is temporarily unavailable.";

  function ApiError(message, status, body) {
    this.name = "ApiError";
    this.message = message;
    this.status = status || 0;
    this.body = body || null;
  }
  ApiError.prototype = Object.create(Error.prototype);

  function baseUrl() {
    return (window.VALIDRIFT_CONFIG && window.VALIDRIFT_CONFIG.apiBaseUrl) || "http://127.0.0.1:8000/api";
  }

  function timeoutMs(options) {
    if (options && options.timeoutMs) return options.timeoutMs;
    return 30000;
  }

  async function request(path, options) {
    options = options || {};
    var url = baseUrl() + path;
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs(options));
    var init = {
      method: options.method || "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    };
    if (options.body !== undefined) init.body = JSON.stringify(options.body);
    try {
      var res = await fetch(url, init);
      clearTimeout(timer);
      var text = await res.text();
      var data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
      if (!res.ok) {
        var detail = data && (data.detail || data.message);
        throw new ApiError(
          detail || ("Request failed (" + res.status + " " + res.statusText + ")"),
          res.status, data
        );
      }
      return data;
    } catch (err) {
      clearTimeout(timer);
      if (err && err.name === "ApiError") throw err;
      var isAbort = err && (err.name === "AbortError" || err.name === "TimeoutError");
      throw new ApiError(
        isAbort ? "The request took too long. Please try again." :
          "Unable to connect to Validrift. Please retry in a moment.",
        0, null
      );
    }
  }

  function get(path, options) { return request(path, Object.assign({ method: "GET" }, options)); }
  function post(path, body, options) {
    // Deterministic API calls get a tight timeout; Hindsight REFLECT may take
    // longer and passes its own timeoutMs explicitly.
    return request(path, Object.assign({ method: "POST", body: body, timeoutMs: 30000 }, options));
  }

  function enc(s) { return encodeURIComponent(s); }

  window.ValidriftAPI = {
    ApiError: ApiError,
    MEMORY_UNAVAILABLE: MEMORY_UNAVAILABLE,
    EXPLANATION_UNAVAILABLE: EXPLANATION_UNAVAILABLE,
    baseUrl: baseUrl,

    health: function () { return get("/health"); },
    dashboard: function () { return get("/dashboard"); },
    processContext: function () { return get("/process-context"); },
    incidents: function (limit) { return get("/incidents?limit=" + (limit || 50)); },
    incident: function (id) { return get("/incidents/" + enc(id)); },
    createIncident: function (payload) { return post("/incidents", payload); },
    createIntervention: function (payload) { return post("/interventions", payload); },
    processChange: function (payload) { return post("/process-changes", payload); },
    validityAudit: function (payload) { return post("/validity-audit", payload || {}); },
    recommend: function (incidentId, useReflect) {
      var reflect = useReflect !== false;
      return post("/recommend", { incident_id: incidentId, use_reflect: reflect },
        { timeoutMs: reflect ? 90000 : 30000 });
    },
    recommendation: function (id) { return get("/recommendations/" + enc(id)); },
    latestRecommendation: function () { return get("/recommendations/latest"); },
    recordOutcome: function (recId, payload) {
      return post("/recommendations/" + enc(recId) + "/outcome", payload);
    },
    fixPassport: function (fixName, defect) {
      var q = defect ? "?defect=" + enc(defect) : "";
      return get("/fixes/" + enc(fixName) + "/passport" + q);
    },
    memoryActivity: function (limit, operation) {
      var q = "?limit=" + (limit || 50);
      if (operation) q += "&operation=" + enc(operation);
      return get("/memory-activity" + q);
    },
    resetDemo: function () { return post("/admin/reset-demo", {}); },
    syncHindsight: function () { return post("/admin/sync-hindsight", {}); },
  };
})();

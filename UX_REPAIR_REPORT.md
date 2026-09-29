# UX Repair Report — Validrift

**Date:** 2026-09-29
**Scope:** Final UX + functionality repair of the existing Validrift app. No rebuild, no redesign, no new features, no changes to deterministic validity logic or the golden flow.

## What was repaired

### Production API configuration (P0)
- `frontend/js/config.js`: hosted pages now default to `https://validrift-api.onrender.com/api`. Localhost/file protocol still uses `http://127.0.0.1:8000/api` for local development only. Override priority: `?api=` → localStorage → `window.VALIDRIFT_API_BASE_URL` → environment default.

### Recommendation flow (P0)
- `frontend/js/new-incident.js`: fixed the recommendation call to `api.recommend(incident.id, false)` (was passing an object). Removed fake 350 ms waits. Primary first-time flow intentionally skips REFLECT so it never blocks the first recommendation. Navigation carries the recommendation ID; real loading-stage labels used.
- `frontend/js/recommendation.js`: outcome form now submits the genuine endpoint with `followed: true`, the recommended fix as `action_taken`, the selected outcome as `result`, and the textarea as notes. After save it reloads recommendation/passport context and refreshes Memory Activity. Added a real success panel (`#outcome-success`) with fix, counts, status, and passport link.

### Dead controls eliminated (P0)
- All navigation now uses Operations/Explore grouping with real `data-path` values; Recommendation removed from primary nav.
- Reset Demo wired to the real `/api/admin/reset-demo` endpoint (shared in `common.js`), reloads immediately on success.
- Profile-looking avatars replaced with non-clickable "Demo Operator" workspace badges.
- Validity Audit passport buttons navigate to real Fix Passport pages; static prototype passport drawer removed.
- Fix Passport: "Run Validity Audit" navigates to the audit page; "View Pressure +8% Passport" now navigates to the Pressure passport (was dead).
- Dashboard Memory Activity filter tabs (All/Retain/Recall/Reflect) now genuinely filter the drawer list; removed the hardcoded fake "All (42)" count.
- All inline `onclick` handlers verified against defined functions: 0 undefined. **Dead buttons remaining: 0.**

### First-time UX simplification (P1)
- Dashboard: added a three-step first-time explanation (Log Incident → Review Recommendation → Record Outcome & Learn) and a Start New Incident CTA; breadcrumb changed from Telemetry to Overview; dead inline functions removed.
- New Incident: "Step 1 of 3 — Describe the Quality Problem"; CTA "Analyze Incident & Get Recommendation"; supporting Film-B/R11 context; Cancel Incident wired to Overview.
- Validity Audit: headline asks which memories still apply; telemetry/SCADA/OPC-UA language replaced with machine-context language.
- Fix Passport: Export Dossier and View Related Incidents removed; RETAIN text no longer claims telemetry ingestion.

### Performance (P1)
- `frontend/js/api.js`: ordinary POST timeout 120s → 30s; recommendation timeout 30s (no REFLECT) / 90s (with REFLECT).
- `frontend/js/dashboard.js`: removed both artificial 600 ms waits; flows reload/navigate immediately.
- Error states: network → "Unable to connect to Validrift. Please retry in a moment."; timeout → "The request took too long. Please try again." No blank error pages, no exposed traces.

## Verification evidence

- **JS syntax:** all 9 frontend JS files pass `node --check`.
- **HTML structure:** all 5 pages parse with zero tag-balance errors after drawer/modal surgery.
- **Backend tests:** 13/13 pass (unchanged backend).
- **Golden flow (local backend, Hindsight disabled/degraded mode):**
  - After Reset Demo: Temperature +5°C Film-A/R10 4/0 VALIDATED (historical); Film-B/R11 0/2 DRIFTED; Pressure +8% Film-B/R11 2/0 SUPPORTED.
  - Film-B/R11 Weak Seal incident → recommendation REC-574E3EEA68: **Pressure +8%, SUPPORTED, 2/0** (REFLECT skipped, first-time flow).
  - Recorded SUCCESS → Pressure +8% promoted to **3/0 VALIDATED**; Temperature +5°C unchanged (Film-A/R10 VALIDATED, Film-B/R11 DRIFTED).
  - Outcome message: "Outcome retained. This evidence will influence future recommendations."
  - Memory Activity contained genuine RETAIN and RECALL events (REFLECT verified separately against the live Hindsight bank in the prior live verification).
- **Secret scan:** no secrets committed (see below).

## Secret scan

Scanned the full diff for API keys, tokens, passwords, and `.env` contents. The Hindsight key lives only in Render's secure environment and was never written to source. Result: **no secrets exposed**.

## Files changed (11)

- `frontend/index.html`, `frontend/new-incident.html`, `frontend/recommendation.html`, `frontend/validity-audit.html`, `frontend/fix-passport.html`
- `frontend/js/config.js`, `frontend/js/api.js`, `frontend/js/common.js`, `frontend/js/dashboard.js`, `frontend/js/new-incident.js`, `frontend/js/recommendation.js`

Backend unchanged. Deterministic validity logic unchanged. Golden flow unchanged.

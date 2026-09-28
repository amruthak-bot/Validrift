# INTEGRATION REPORT — Validrift frontend + backend merge

Date: 2026-09-28. Deliverable: one full-stack ZIP (`frontend/` + `backend/`).

## What was merged

**Frontend** (`frontend/`, from `stitch_validrift_manufacturing_memory_platform__1.zip`):
5 standalone vanilla-JS + Tailwind-CDN pages. The visual design, layout, tabs,
accordions, modals, dark sidebar, typography and colours are unchanged.

**Backend** (`backend/`, from `Validrift_Backend_Complete.zip`): FastAPI +
SQLite/SQLAlchemy, deterministic Validity Engine, real Hindsight
RETAIN/RECALL/REFLECT via the official `hindsight-client` SDK.

### Frontend wiring added (no redesign)

- `js/config.js` — API base resolution: `?api=` → `localStorage` → `window.VALIDRIFT_API_BASE_URL` → `http://127.0.0.1:8000/api`.
- `js/api.js` — **the single API client**. Every backend call goes through it
  (timeout, HTTP/JSON errors, offline detection). The only `fetch()` in the
  frontend lives inside it; there are no scattered fetch calls.
- `js/common.js` — nav, toasts, status chips, Hindsight health badge, memory
  panel/drawer, Fix Passport URL builder.
- One script per page (`dashboard.js`, `new-incident.js`, `recommendation.js`,
  `validity-audit.js`, `fix-passport.js`). The Audit and Passport pages shipped
  as static mockups in the template and were patched to hydrate from the real
  API (hooks + render logic); their design/markup was not altered.
- Exact degraded strings preserved: "Memory service temporarily unavailable."
  and "Evidence is available, but natural-language explanation is temporarily
  unavailable."

### Backend changes (additive only)

- Dev CORS expanded for local frontend origins.
- `POST /api/admin/reset-demo` (dev only; 403 in production) — wipes and
  reseeds the golden Film-A → Film-B dataset. Powers the dashboard "Reset demo
  data" button.
- `GET /api/recommendations/latest` — the dashboard/recommendation pages'
  "current recommendation" card.
- Dashboard incident rows now carry backend-computed `validity_status`.
- No changes to the Validity Engine, Hindsight service, or seed story.

## Verification evidence

### Backend tests — 13 passed

```
cd backend && .venv/bin/python -m pytest tests/ -q
# 13 passed (6 pre-existing + 7 new golden-path tests)
```

New `tests/test_golden_path.py` (isolated via reset fixture): admin reset,
process change + audit re-run, intervention outcome, recommendation outcome,
Fix Passport dual-context truth, memory-activity traces, and the complete
golden path (reset → Film-B incident → recommend → outcome → audit).

### Live golden E2E — ALL PASS (2026-09-28, real HTTP against uvicorn)

| Step | Result |
|---|---|
| `POST /admin/reset-demo` | 200, context = Film-B / R11 / FlexPack |
| `POST /incidents` (QI-GOLD1, Weak Seal, Film-B/R11) | 201 |
| `POST /recommend` | **Increase Pressure +8%**, SUPPORTED, evaluation 2/0; rejected alternative: Increase Temperature +5°C (DRIFTED) |
| `POST /recommendations/{id}/outcome` (SUCCESS) | 201 |
| `POST /validity-audit` | Temperature +5°C = DRIFTED; Pressure +8% promoted to **VALIDATED** (3/0 — the recorded outcome became new evidence: the learning loop works) |
| `GET /memory-activity` | RECALL, REFLECT, RETAIN traces present |
| `GET /recommendations/latest` | returns the new recommendation |

### Frontend pages — verified against the live backend (jsdom harness, real API)

| Page | Verified live |
|---|---|
| Dashboard | KPIs 18/6/8, 4 action items, 8-row ledger (QI-1039…), 3 memory traces, rec card "Increase Temperature +5°C / VALIDATED" — zero JS errors |
| New Incident | 5 defect options, live Film-B/R11 context, 4-stage stepper, submit + severity |
| Recommendation | fix, SUPPORTED verdict, evidence line "2 successes · 0 failures", 4 evidence rows, "WHY NOT TEMPERATURE +5°C?", trace ID |
| Validity Audit | 18 reviewed / 12 supported / 4 revalidation / 2 drifted; hero Film-A VALIDATED vs Film-B DRIFTED; process-change row rendered |
| Fix Passport | twin cards Film-A VALIDATED 100% + Film-B DRIFTED 0%, 6 evidence rows, 6 source memories |

Note: jsdom's `AbortController` produces a signal Node's `fetch` rejects, so the
harness strips `signal` from requests. An early harness run without this fix
silently read static fallback HTML — all results above are from the corrected
harness with toast/console capture enabled.

## Honest caveats

1. **No real-browser screenshots.** The delegated live browser ran on a separate
   VM and could not reach `127.0.0.1`; Cloudflare/localtunnel expositions
   failed. Layout/scroll/modal/tab behavior is per the untouched template;
   functional hydration is verified above, not pixels.
2. **Hindsight live mode not end-to-end verified** — no API key was available in
   this environment. RETAIN/RECALL/REFLECT calls reach the Hindsight API with
   well-formed requests (observed: HTTP 401 "API key required", traced honestly
   as ERROR). Mock-mode tests prove the wiring: traces recorded, reflection
   text flows into recommendations. For the judged demo, set
   `HINDSIGHT_API_KEY` in `backend/.env`; without it the app degrades
   gracefully per the strings above.
3. The DB ships reseeded to the golden baseline; judges should press
   "Reset demo data" before the 60-second story.

## Run it (judge path)

```bash
# backend
cd backend && cp ../.env.example .env   # set HINDSIGHT_API_KEY
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000
# frontend
cd frontend && python -m http.server 8080
# open http://127.0.0.1:8080/index.html
```

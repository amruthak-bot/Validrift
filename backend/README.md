# Validrift Backend

FastAPI backend for **Validrift — Change-Aware Manufacturing Memory**.

> The memory wasn't wrong. Its validity drifted.

## What is implemented

- SQLite/SQLAlchemy persistence for incidents, interventions, process changes, recommendations, recommendation outcomes, and memory traces.
- Real Hindsight integration using the official `hindsight-client` Python SDK.
- Async `aretain`, `arecall`, and `areflect` calls inside FastAPI.
- Deterministic, testable context-validity engine. The LLM/Hindsight reflection never invents evidence counts or validity labels.
- Memory Validity Audit.
- Fix Passport with evidence grouped by production context.
- Recommendation engine that prefers current-context evidence over historically frequent but drifted fixes.
- Outcome-learning loop: recording a recommendation result also creates new intervention evidence and retains it in Hindsight.
- Memory activity/provenance API.
- Golden Film-A -> Film-B demo seed data.
- Tests for the core drift/recommendation behavior.

## Hindsight design

Validrift uses Hindsight as the long-term experience layer:

- **RETAIN**: incidents, process changes, corrective actions, recommendation decisions, and real outcomes.
- **RECALL**: similar incidents, fixes, outcomes, and process-change history before a recommendation/audit.
- **REFLECT**: optional synthesis for an audit/recommendation explanation. The deterministic engine remains authoritative for status/counts.

The backend uses async Hindsight methods because FastAPI runs an async event loop. Hindsight's current Python client documentation explicitly recommends `aretain`, `arecall`, and `areflect` in async frameworks.

## Quick start — Windows

1. Extract the backend.
2. Open a terminal in this folder.
3. Run:

```bat
run_backend.bat
```

4. Open Swagger:

`http://127.0.0.1:8000/docs`

`run_backend.bat` creates the virtual environment, installs dependencies, copies `.env.example` to `.env` if needed, seeds the structured demo ledger, and starts FastAPI. Edit `.env` with your real Hindsight key before the final judged demo.

## Manual start

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python scripts/seed_demo.py
uvicorn app.main:app --reload
```

## Hindsight Cloud setup

Use the hosted endpoint:

```env
HINDSIGHT_MODE=live
HINDSIGHT_API_URL=https://api.hindsight.vectorize.io
HINDSIGHT_API_KEY=YOUR_KEY
HINDSIGHT_BANK_ID=validrift-demo
```

A bank does not need to be pre-created: a Hindsight write can create a missing bank automatically. After adding your key, run `python scripts/sync_hindsight.py` once so the seeded historical incidents/fixes exist in the Hindsight bank as well as SQLite. The script uses stable document IDs and is safe to rerun. For the final submission, confirm `/api/health` reports Hindsight `ok: true` and show real RETAIN/RECALL in the UI/demo.

### Local development without Hindsight credentials

Use only for tests/UI wiring:

```env
HINDSIGHT_MODE=mock
```

Do **not** use mock mode for the judged Hindsight demo.

## API endpoints

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | DB + Hindsight health |
| GET | `/api/dashboard` | Dashboard aggregate |
| GET | `/api/process-context` | Current production context |
| GET | `/api/incidents` | Recent/history incidents |
| GET | `/api/incidents/{id}` | Incident detail |
| POST | `/api/incidents` | Create incident + Hindsight RETAIN |
| POST | `/api/interventions` | Record action/outcome + RETAIN |
| POST | `/api/process-changes` | Update context + RETAIN + optional audit |
| POST | `/api/validity-audit` | Context-specific Memory Validity Audit |
| POST | `/api/recommend` | Recall -> deterministic evaluate/rank -> recommend |
| GET | `/api/recommendations/{id}` | Recommendation detail |
| POST | `/api/recommendations/{id}/outcome` | Close feedback loop + RETAIN |
| GET | `/api/fixes/{fix_name}/passport` | Fix Passport |
| GET | `/api/memory-activity` | RETAIN/RECALL/REFLECT trace |
| POST | `/api/admin/sync-hindsight` | Idempotently mirror existing demo/history records into Hindsight |
| POST | `/api/admin/reset-demo` | Restore the golden Film-A -> Film-B demo dataset (disabled in production) |

## Frontend mapping

### Dashboard

Call `GET /api/dashboard`.

### New Incident

1. `POST /api/incidents`
2. `POST /api/recommend` with returned incident id.

### Recommendation

Use the `/api/recommend` response directly. `supporting_evidence`, `alternative_fixes`, `validity_status`, and `recalled_memory_ids` map to the UI cards.

### Record Outcome

`POST /api/recommendations/{recommendation_id}/outcome`.

### Memory Validity Audit

`POST /api/validity-audit`.

### Fix Passport

For the hero demo:

`GET /api/fixes/Increase%20Temperature%20%2B5%C2%B0C/passport?defect=Weak%20Seal`

### Hindsight drawer

`GET /api/memory-activity?limit=20`

## Golden demo flow

1. Film-A/R10 history contains 4 successes for `Increase Temperature +5°C`.
2. Sep 20 process change switches to Film-B/R11/FlexPack.
3. Two current-context failures make Temperature +5°C `DRIFTED` for Film-B/R11 while historical Film-A evidence is preserved.
4. `Increase Pressure +8%` has 2 current-context successes, so it remains `SUPPORTED` and outranks the drifted fix.
5. Create `QI-1042` and call `/api/recommend` — Pressure +8% should be recommended.
6. Record the real outcome. That outcome is persisted, retained in Hindsight, and becomes future evidence.

## Deterministic validity rules

Default demo thresholds:

- `VALIDATED`: >= 3 successes in the current context and >= 75% positive weighted outcome ratio.
- `SUPPORTED`: >= 1 success in the current context and no repeated-failure pattern.
- `DRIFTED`: historical success exists + >= 2 current-context failures + no current-context success.
- `REVALIDATION REQUIRED`: historical success exists, a relevant process change occurred, and no current-context evidence exists yet.
- `UNVERIFIED`: historical relevance exists but transfer to current context is unknown.
- `INSUFFICIENT EVIDENCE`: too little reliable evidence.

The threshold of 3 for `VALIDATED` is deliberate for the demo: it preserves the frontend story where Pressure +8% is still `SUPPORTED` at 2/2, while Temperature +5°C reached `VALIDATED` with 4 historical successes.

## Tests

```bash
pytest -q
```

Tests run with `HINDSIGHT_MODE=mock`; they verify the deterministic engine and API behavior without requiring secrets.

## Important final-demo check

Before recording/submitting:

- Set `HINDSIGHT_MODE=live`.
- Add the real Hindsight API key.
- Start the API.
- `GET /api/health` must show Hindsight `ok: true`.
- Run `python scripts/sync_hindsight.py` once after configuring the real key.
- Create a new incident through the UI.
- Confirm `/api/memory-activity` shows a real `RETAIN` followed by a real `RECALL`.
- Show that the future recommendation changes because of the stored outcome.

## Safety

Validrift is decision support. It never writes directly to PLCs or automatically changes machine settings. A quality engineer records which intervention was actually applied and the real result.

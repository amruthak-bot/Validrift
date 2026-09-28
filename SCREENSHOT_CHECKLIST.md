# SCREENSHOT CHECKLIST — Validrift (under 5 minutes)

Why manual: screenshots need a real browser pointed at localhost, which can't be
done from here. Everything below uses the already-verified running app.

## One-time setup (2 min)

```bash
cd validrift/backend
cp ../.env.example .env        # add your HINDSIGHT_API_KEY for the LIVE badge
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```bash
cd validrift/frontend
python -m http.server 8080
```

Open `http://127.0.0.1:8080/index.html`. In the sidebar click **Reset Demo**
(or `POST /api/admin/reset-demo`) so the golden baseline is fresh.

## Capture these 8 shots (3 min)

1. **Dashboard** — `index.html`
   Moment: right after load. Must show: KPIs, incident ledger, memory panel,
   "Hindsight Connected / LIVE" badge in the sidebar.

2. **New Incident** — click **New Incident** in the sidebar.
   Moment: wizard visible. Must show: 5 defect options, current context
   `SEALER-02 • FILM-B • R11`, step 1 of 4.

3. **Recommendation (Pressure +8% SUPPORTED)** — create a Weak Seal incident
   (Film-B / R11, severity high) → **Get recommendation**.
   Moment: recommendation card rendered. Must show: `Increase Pressure +8%`,
   `SUPPORTED`, `2 successes · 0 failures`, real trace ID.

4. **Why Not Temperature +5°C** — same page, scroll to alternatives.
   Moment: alternatives section visible. Must show: `Increase Temperature +5°C`
   marked **DRIFTED** with `0 successes · 2 failures`.

5. **Memory Validity Audit** — sidebar → **Validity Audit** → run audit.
   Moment: results rendered. Must show: Temperature +5°C dual-context hero card
   (Film-A/R10 VALIDATED 4/0 **and** Film-B/R11 DRIFTED 0/2), reviewed/supported/
   drifted counts, and the live REFLECT explanation paragraph.

6. **Fix Passport** — sidebar → **Fix Passports** → open `Increase Pressure +8%`.
   Moment: passport rendered. Must show: both context envelopes side by side,
   current validity **VALIDATED (3/0)** after the outcome below, evidence timeline.

7. **Outcome recording → Pressure +8% VALIDATED** — on the recommendation page
   click **Record Outcome** → followed ✓, action `Increase Pressure +8%`,
   result `success` → submit, then reopen the Fix Passport.
   Moment: passport shows **VALIDATED, 3 successes / 0 failures**. This is the
   learning-loop money shot.

8. **Memory Activity (RETAIN / RECALL / REFLECT)** — click **Memory Activity**
   in the header.
   Moment: drawer open. Must show: genuine `RETAIN`, `RECALL`, `REFLECT` rows
   with `SUCCESS` status and timestamps.

## Save

Put all PNGs in `docs/screenshots/` (repo has the folder ready with a note).
Name them `01-dashboard.png` … `08-memory-activity.png`.

Do NOT include any API key in a screenshot (keys never appear in the UI anyway).

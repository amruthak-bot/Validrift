# Validrift frontend -> backend mapping

| Frontend action | Backend |
|---|---|
| Load dashboard | `GET /api/dashboard` |
| New Incident submit | `POST /api/incidents` |
| Find Context-Valid Past Knowledge | `POST /api/recommend` |
| Record Process Change | `POST /api/process-changes` |
| Run Memory Validity Audit | `POST /api/validity-audit` |
| Open Fix Passport | `GET /api/fixes/{fix_name}/passport` |
| Record Outcome / Save Outcome & Learn | `POST /api/recommendations/{id}/outcome` |
| Open Hindsight Memory Activity | `GET /api/memory-activity` |
| Connectivity badge | `GET /api/health` |

## Recommended frontend base URL

Development: `http://127.0.0.1:8000/api`

Put it in the frontend environment as something like:

`VITE_API_BASE_URL=http://127.0.0.1:8000/api`

or for Next.js:

`NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api`

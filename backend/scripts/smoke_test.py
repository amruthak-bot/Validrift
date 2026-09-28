import json
import httpx

BASE = "http://127.0.0.1:8000/api"

with httpx.Client(timeout=30) as c:
    print("HEALTH", json.dumps(c.get(f"{BASE}/health").json(), indent=2))
    dash = c.get(f"{BASE}/dashboard").json()
    print("DASHBOARD KPIS", dash["kpis"])
    audit = c.post(f"{BASE}/validity-audit", json={"include_reflect": False}).json()
    print("AUDIT", audit["summary"])
    rec = c.post(f"{BASE}/recommend", json={"incident_id": "QI-1039", "use_reflect": False}).json()
    print("RECOMMEND", rec.get("recommended_fix"), rec.get("validity_status"))

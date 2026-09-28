def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["database"] == "ok"


def test_dashboard(client):
    r = client.get("/api/dashboard")
    assert r.status_code == 200
    data = r.json()
    assert data["kpis"]["learned_fixes"] == 18
    assert data["audit_summary"]["drifted"] == 2
    assert data["audit_summary"]["revalidation_required"] == 4


def test_audit_golden_story(client):
    r = client.post("/api/validity-audit", json={"include_reflect": False})
    assert r.status_code == 200
    data = r.json()
    by_fix = {x["fix_name"]: x for x in data["fixes"]}
    assert by_fix["Increase Temperature +5°C"]["status"] == "DRIFTED"
    assert by_fix["Increase Pressure +8%"]["status"] == "SUPPORTED"


def test_recommendation_prefers_pressure(client):
    payload = {
        "id": "QI-1042", "timestamp": "2026-09-28T19:30:00",
        "defect": "Weak Seal", "severity": "MEDIUM", "machine": "Sealer-02",
        "material": "Film-B", "supplier": "FlexPack", "recipe": "R11", "firmware": "V3",
        "parameters": {"seal_temperature": 165, "pressure_psi": 42},
        "notes": "Seal strength below specification across multiple samples."
    }
    cr = client.post("/api/incidents", json=payload)
    assert cr.status_code in {201, 409}
    r = client.post("/api/recommend", json={"incident_id": "QI-1042", "use_reflect": False})
    assert r.status_code == 200
    data = r.json()
    assert data["recommended_fix"] == "Increase Pressure +8%"
    assert data["validity_status"] == "SUPPORTED"

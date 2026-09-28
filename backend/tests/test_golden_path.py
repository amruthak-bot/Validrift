"""Golden-path integration tests: the full VALIDRIFT demonstration story.

Film-A/R10/PackCo: Temperature +5C has 4 successes, 0 failures  -> VALIDATED
Process changes to Film-B/R11/FlexPack
Film-B/R11: Temperature +5C has 0 successes, 2 failures          -> DRIFTED
Film-B/R11: Pressure +8% has 2 successes, 0 failures             -> SUPPORTED
A new Film-B Weak Seal incident recommends Pressure +8%.
"""
import pytest


@pytest.fixture(autouse=True)
def _clean_state(client):
    """Every golden test starts from and leaves the seeded baseline."""
    client.post("/api/admin/reset-demo")
    yield
    client.post("/api/admin/reset-demo")


def _incident_payload(iid):
    return {
        "id": iid, "timestamp": "2026-09-28T19:30:00",
        "defect": "Weak Seal", "severity": "MEDIUM", "machine": "Sealer-02",
        "material": "Film-B", "supplier": "FlexPack", "recipe": "R11", "firmware": "V3",
        "parameters": {"seal_temperature": 165, "pressure_psi": 42},
        "notes": "Golden-path test incident.",
    }


def test_admin_reset_demo_restores_baseline(client):
    r = client.post("/api/admin/reset-demo")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    d = client.get("/api/dashboard").json()
    assert d["kpis"]["learned_fixes"] == 18
    assert d["audit_summary"]["drifted"] == 2
    assert d["current_context"]["material"] == "Film-B"
    assert d["current_context"]["recipe"] == "R11"


def test_process_change_updates_context_and_reruns_audit(client):
    r = client.post("/api/process-changes", json={
        "machine": "Sealer-02",
        "changes": {"supplier": {"old": "FlexPack", "new": "FlexPack-Test"}},
        "reason": "Golden-path test change",
        "run_audit": True,
    })
    assert r.status_code == 201
    body = r.json()
    assert body["id"].startswith("PC-")
    assert "audit" in body  # run_audit=True returns a fresh audit
    assert body["audit"]["summary"]["drifted"] == 0
    assert body["audit"]["summary"]["revalidation_required"] == 18
    # revert so later tests see the canonical Film-B/FlexPack/R11 context
    rr = client.post("/api/process-changes", json={
        "machine": "Sealer-02",
        "changes": {"supplier": {"old": "FlexPack-Test", "new": "FlexPack"}},
        "reason": "Revert golden-path test change",
        "run_audit": False,
    })
    assert rr.status_code == 201
    d = client.get("/api/dashboard").json()
    assert d["current_context"]["supplier"] == "FlexPack"


def test_intervention_outcome_recorded(client):
    cr = client.post("/api/incidents", json=_incident_payload("QI-9001"))
    assert cr.status_code in {201, 409}
    r = client.post("/api/interventions", json={
        "incident_id": "QI-9001", "fix_name": "Increase Pressure +8%",
        "parameter_change": "pressure +8%", "outcome": "SUCCESS",
        "notes": "Golden-path test intervention.",
    })
    assert r.status_code == 201
    body = r.json()
    assert body["incident_id"] == "QI-9001"
    assert body["outcome"] == "SUCCESS"


def test_recommendation_outcome_recorded(client):
    cr = client.post("/api/incidents", json=_incident_payload("QI-9001"))
    assert cr.status_code == 201
    r = client.post("/api/recommend", json={"incident_id": "QI-9001", "use_reflect": False})
    assert r.status_code == 200
    rec_id = r.json()["recommendation_id"]
    assert rec_id
    o = client.post(f"/api/recommendations/{rec_id}/outcome", json={
        "followed": True, "action_taken": "Increase Pressure +8%",
        "result": "SUCCESS", "notes": "Golden-path test outcome.",
    })
    assert o.status_code == 201
    assert o.json()["recommendation_id"] == rec_id


def test_passport_shows_both_context_truths(client):
    r = client.get("/api/fixes/Increase Temperature +5°C/passport")
    assert r.status_code == 200
    data = r.json()
    assert data["total_attempts"] == 6
    assert len(data["contexts"]) == 2
    by_ctx = {(c["context"]["material"], c["context"]["recipe"]): c for c in data["contexts"]}
    film_a = by_ctx[("Film-A", "R10")]
    film_b = by_ctx[("Film-B", "R11")]
    assert film_a["status"] == "VALIDATED"
    assert film_a["successes"] == 4 and film_a["failures"] == 0
    assert film_b["status"] == "DRIFTED"
    assert film_b["successes"] == 0 and film_b["failures"] == 2


def test_memory_activity_traces_recorded(client):
    cr = client.post("/api/incidents", json=_incident_payload("QI-9200"))
    assert cr.status_code == 201
    client.post("/api/recommend", json={"incident_id": "QI-9200", "use_reflect": True})
    r = client.get("/api/memory-activity", params={"limit": 50})
    assert r.status_code == 200
    ops = {t["operation"] for t in r.json()}
    assert "RECALL" in ops
    assert "RETAIN" in ops
    assert "REFLECT" in ops
    for t in r.json():
        assert t["status"] in {"OK", "SUCCESS", "ERROR", "DISABLED"}


def test_complete_golden_path(client):
    # 1. clean baseline
    assert client.post("/api/admin/reset-demo").status_code == 200
    # 2. new Film-B Weak Seal incident
    cr = client.post("/api/incidents", json=_incident_payload("QI-9100"))
    assert cr.status_code == 201
    # 3. recommend -> Pressure +8%, SUPPORTED (mock reflect: reflection text present)
    r = client.post("/api/recommend", json={"incident_id": "QI-9100", "use_reflect": True})
    assert r.status_code == 200
    rec = r.json()
    assert rec["recommended_fix"] == "Increase Pressure +8%"
    assert rec["validity_status"] == "SUPPORTED"
    assert rec["evaluation"]["current_successes"] == 2
    assert rec["evaluation"]["current_failures"] == 0
    assert rec["reflection"]  # mock Hindsight reflection text
    # 4. record a successful outcome
    o = client.post(f"/api/recommendations/{rec['recommendation_id']}/outcome", json={
        "followed": True, "action_taken": "Increase Pressure +8%",
        "result": "SUCCESS", "notes": "Golden-path end-to-end.",
    })
    assert o.status_code == 201
    # 5. audit still flags Temperature +5C as DRIFTED in the Film-B context
    a = client.post("/api/validity-audit", json={"include_reflect": False})
    assert a.status_code == 200
    by_fix = {x["fix_name"]: x for x in a.json()["fixes"]}
    assert by_fix["Increase Temperature +5°C"]["status"] == "DRIFTED"
    assert by_fix["Increase Pressure +8%"]["status"] == "VALIDATED"
    assert by_fix["Increase Pressure +8%"]["current_successes"] == 3

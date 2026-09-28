from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from .models import PlantContext, Incident, Intervention, ProcessChange


def dt(day: int, hour: int = 10, minute: int = 0):
    return datetime(2026, 9, day, hour, minute)


def _add_incident(db: Session, iid: str, day: int, defect: str, ctx: dict, fix: str, outcome: str, notes: str = ""):
    inc = Incident(id=iid, timestamp=dt(day), defect=defect, severity="MEDIUM", parameters={}, notes=notes, **ctx,
                   hindsight_document_id=f"incident:{iid}")
    iv = Intervention(id=f"IV-{iid}", incident_id=iid, fix_name=fix, parameter_change=fix, outcome=outcome,
                      notes=notes, created_at=dt(day, 10, 15), hindsight_document_id=f"intervention:{iid}")
    db.add(inc); db.flush(); db.add(iv)


def seed_demo(db: Session):
    if db.scalar(select(func.count(Incident.id))) > 0:
        return

    film_a = dict(machine="Sealer-02", material="Film-A", supplier="PackCo", recipe="R10", firmware="V3")
    film_b = dict(machine="Sealer-02", material="Film-B", supplier="FlexPack", recipe="R11", firmware="V3")
    film_c = dict(machine="Sealer-02", material="Film-C", supplier="NovaFilm", recipe="R12", firmware="V3")

    db.add(PlantContext(id=1, **film_b, updated_at=dt(20, 8)))
    db.add(ProcessChange(
        id="PC-20260920", timestamp=dt(20, 8), machine="Sealer-02",
        changes={
            "material": {"old": "Film-A", "new": "Film-B"},
            "supplier": {"old": "PackCo", "new": "FlexPack"},
            "recipe": {"old": "R10", "new": "R11"},
        },
        reason="Packaging film supplier and recipe changed due to supply constraints.",
        hindsight_document_id="process-change:PC-20260920",
    ))

    # Core golden story.
    for iid, day in [("QI-1021",1),("QI-1024",4),("QI-1028",8),("QI-1030",18)]:
        _add_incident(db, iid, day, "Weak Seal", film_a, "Increase Temperature +5°C", "SUCCESS")
    for iid, day in [("QI-1032",22),("QI-1035",24)]:
        _add_incident(db, iid, day, "Weak Seal", film_b, "Increase Temperature +5°C", "FAILURE")
    for iid, day in [("QI-1036",25),("QI-1039",27)]:
        _add_incident(db, iid, day, "Weak Seal", film_b, "Increase Pressure +8%", "SUCCESS")

    # Second drifted fix: historical success, repeated current-context failure.
    _add_incident(db, "QI-1101", 5, "Channel Leak", film_a, "Seal Dwell +0.4s", "SUCCESS")
    _add_incident(db, "QI-1102", 9, "Channel Leak", film_a, "Seal Dwell +0.4s", "SUCCESS")
    _add_incident(db, "QI-1103", 23, "Channel Leak", film_b, "Seal Dwell +0.4s", "FAILURE")
    _add_incident(db, "QI-1104", 26, "Channel Leak", film_b, "Seal Dwell +0.4s", "FAILURE")

    # Four revalidation-required fixes: only historical successes before process change.
    reval = [
        ("Cooling Time +3 sec", "Wrinkling"),
        ("Jaw Pressure -5%", "Surface Burn"),
        ("Heater Balance +2%", "Seal Blistering"),
        ("Preheat +4°C", "Film Misalignment"),
    ]
    idx=1200
    for j,(fix,defect) in enumerate(reval):
        _add_incident(db, f"QI-{idx+j*2}", 6+j, defect, film_a, fix, "SUCCESS")
        _add_incident(db, f"QI-{idx+j*2+1}", 10+j, defect, film_a, fix, "SUCCESS")

    # Eleven additional current-context fixes that remain supported/validated.
    supported = [
        ("Jaw Alignment +1mm", "Misalignment"),
        ("Reduce Line Speed 8%", "Wrinkling"),
        ("Cooling Fan +10%", "Surface Burn"),
        ("Jaw Clean & Inspect", "Surface Damage"),
        ("Tension +5%", "Film Misalignment"),
        ("Pre-dry Film 10 min", "Wrinkling"),
        ("Nip Pressure +3%", "Channel Leak"),
        ("Guide Alignment Reset", "Misalignment"),
        ("Sensor Calibration Check", "Surface Damage"),
        ("Sealing Time +0.15s", "Weak Seal"),
        ("Cooling Time +5 sec", "Surface Wrinkle"),
    ]
    base=1300
    for j,(fix,defect) in enumerate(supported):
        _add_incident(db, f"QI-{base+j*2}", 21+(j%6), defect, film_b, fix, "SUCCESS")
        # Only a few get a second success so they remain SUPPORTED under threshold=3.
        if j in {0,1,2,3,4}:
            _add_incident(db, f"QI-{base+j*2+1}", 22+(j%6), defect, film_b, fix, "SUCCESS")

    db.commit()

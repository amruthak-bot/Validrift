from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..core.database import get_db
from ..models import Incident, Intervention, ProcessChange, PlantContext, Recommendation, RecommendationOutcome, MemoryTrace
from ..schemas import IncidentCreate, InterventionCreate, ProcessChangeCreate, RecommendationRequest, RecommendationOutcomeCreate, AuditRequest
from ..utils import new_id
from ..services.hindsight_service import memory_service
from ..services.recommendation_service import recommend
from ..services.audit_service import run_audit
from ..services.passport_service import build_passport
from ..services.dashboard_service import dashboard
from ..services.memory_sync_service import sync_existing_history_to_hindsight

router = APIRouter()


def _incident_dict(x: Incident):
    return {
        "id": x.id, "timestamp": x.timestamp.isoformat(), "defect": x.defect, "severity": x.severity,
        "machine": x.machine, "material": x.material, "supplier": x.supplier, "recipe": x.recipe,
        "firmware": x.firmware, "parameters": x.parameters, "notes": x.notes,
    }


@router.get("/health")
async def health(db: Session = Depends(get_db)):
    try:
        db.execute(select(1))
        db_status = "ok"
    except Exception as exc:
        db_status = f"error: {exc}"
    return {"status": "ok" if db_status == "ok" else "degraded", "database": db_status, "hindsight": await memory_service.health()}


@router.get("/dashboard")
async def get_dashboard(db: Session = Depends(get_db)):
    return await dashboard(db)


@router.get("/process-context")
def get_process_context(db: Session = Depends(get_db)):
    ctx = db.get(PlantContext, 1)
    if not ctx:
        raise HTTPException(404, "Plant context not configured")
    return {k: getattr(ctx, k) for k in ("machine", "material", "supplier", "recipe", "firmware")} | {"updated_at": ctx.updated_at.isoformat()}


@router.get("/incidents")
def get_incidents(limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    rows = db.scalars(select(Incident).order_by(Incident.timestamp.desc()).limit(limit)).all()
    return [_incident_dict(x) for x in rows]


@router.get("/incidents/{incident_id}")
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    inc = db.get(Incident, incident_id)
    if not inc:
        raise HTTPException(404, "Incident not found")
    return _incident_dict(inc) | {"interventions": [
        {"id": i.id, "fix_name": i.fix_name, "outcome": i.outcome, "notes": i.notes, "created_at": i.created_at.isoformat()}
        for i in inc.interventions
    ]}


@router.post("/incidents", status_code=201)
async def create_incident(payload: IncidentCreate, db: Session = Depends(get_db)):
    incident_id = payload.id or new_id("QI")
    if db.get(Incident, incident_id):
        raise HTTPException(409, "Incident ID already exists")
    inc = Incident(
        id=incident_id, timestamp=payload.timestamp or datetime.utcnow(), defect=payload.defect,
        severity=payload.severity, machine=payload.machine, material=payload.material, supplier=payload.supplier,
        recipe=payload.recipe, firmware=payload.firmware, parameters=payload.parameters, notes=payload.notes,
        hindsight_document_id=f"incident:{incident_id}",
    )
    db.add(inc); db.commit()
    request_id = new_id("REQ")
    text = (
        f"Incident {incident_id}: {payload.defect} occurred on machine {payload.machine} under material {payload.material}, "
        f"supplier {payload.supplier}, recipe {payload.recipe}, firmware {payload.firmware}. Severity {payload.severity}. "
        f"Observed notes: {payload.notes or 'none'}."
    )
    memory = await memory_service.retain(
        db, request_id=request_id, content=text, context="Manufacturing quality incident",
        document_id=f"incident:{incident_id}", timestamp=inc.timestamp,
        metadata={"incident_id": incident_id, "defect": payload.defect, "machine": payload.machine},
        tags=["validrift", "incident", f"defect:{payload.defect.lower().replace(' ', '-')}"]
    )
    return _incident_dict(inc) | {"memory": memory, "trace_id": request_id}


@router.post("/interventions", status_code=201)
async def create_intervention(payload: InterventionCreate, db: Session = Depends(get_db)):
    inc = db.get(Incident, payload.incident_id)
    if not inc:
        raise HTTPException(404, "Incident not found")
    iid = new_id("IV")
    row = Intervention(
        id=iid, incident_id=inc.id, fix_name=payload.fix_name, parameter_change=payload.parameter_change,
        outcome=payload.outcome.upper(), notes=payload.notes, created_at=datetime.utcnow(),
        hindsight_document_id=f"intervention:{iid}",
    )
    db.add(row); db.commit()
    request_id = new_id("REQ")
    content = (
        f"For incident {inc.id} ({inc.defect}) on {inc.machine} under material {inc.material}, supplier {inc.supplier}, "
        f"recipe {inc.recipe}, firmware {inc.firmware}, the corrective action '{payload.fix_name}' was attempted. "
        f"Outcome: {payload.outcome}. Notes: {payload.notes or 'none'}."
    )
    memory = await memory_service.retain(
        db, request_id=request_id, content=content, context="Corrective action and real outcome",
        document_id=f"intervention:{iid}", timestamp=row.created_at,
        metadata={"incident_id": inc.id, "intervention_id": iid, "fix": payload.fix_name, "outcome": payload.outcome},
        tags=["validrift", "intervention", "outcome", f"defect:{inc.defect.lower().replace(' ', '-')}"]
    )
    return {"id": iid, "incident_id": inc.id, "fix_name": row.fix_name, "outcome": row.outcome, "memory": memory, "trace_id": request_id}


@router.post("/process-changes", status_code=201)
async def create_process_change(payload: ProcessChangeCreate, db: Session = Depends(get_db)):
    cid = new_id("PC")
    timestamp = payload.timestamp or datetime.utcnow()
    row = ProcessChange(id=cid, timestamp=timestamp, machine=payload.machine, changes=payload.changes,
                        reason=payload.reason, hindsight_document_id=f"process-change:{cid}")
    db.add(row)
    ctx = db.get(PlantContext, 1) or PlantContext(id=1, machine=payload.machine)
    for field, delta in payload.changes.items():
        if hasattr(ctx, field) and isinstance(delta, dict) and "new" in delta:
            setattr(ctx, field, delta["new"])
    ctx.updated_at = timestamp
    db.add(ctx); db.commit()

    request_id = new_id("REQ")
    parts = [f"{k}: {v.get('old')} -> {v.get('new')}" for k,v in payload.changes.items()]
    memory = await memory_service.retain(
        db, request_id=request_id,
        content=f"Production process change on {payload.machine} at {timestamp.isoformat()}: " + "; ".join(parts) + f". Reason: {payload.reason}",
        context="Manufacturing process change", document_id=f"process-change:{cid}", timestamp=timestamp,
        metadata={"process_change_id": cid, "machine": payload.machine}, tags=["validrift", "process-change", "world-fact"]
    )
    result = {"id": cid, "timestamp": timestamp.isoformat(), "changes": payload.changes, "memory": memory, "trace_id": request_id}
    if payload.run_audit:
        result["audit"] = await run_audit(db, machine=payload.machine, include_reflect=True)
    return result


@router.post("/validity-audit")
async def validity_audit(payload: AuditRequest, db: Session = Depends(get_db)):
    return await run_audit(db, machine=payload.machine, defect=payload.defect, include_reflect=payload.include_reflect)


@router.post("/recommend")
async def get_recommendation(payload: RecommendationRequest, db: Session = Depends(get_db)):
    try:
        return await recommend(db, payload.incident_id, use_reflect=payload.use_reflect)
    except ValueError as exc:
        raise HTTPException(404, str(exc))


@router.get("/recommendations/latest")
def read_latest_recommendation(db: Session = Depends(get_db)):
    r = db.scalars(select(Recommendation).order_by(Recommendation.created_at.desc()).limit(1)).first()
    if not r:
        return {"recommendation_id": None}
    return {
        "recommendation_id": r.id, "incident_id": r.incident_id, "recommended_fix": r.recommended_fix,
        "validity_status": r.validity_status, "why": r.explanation, "supporting_evidence": r.supporting_evidence,
        "conflicting_evidence": r.conflicting_evidence, "alternative_fixes": r.alternatives,
        "recalled_memory_ids": r.recalled_memory_ids, "trace_id": r.trace_id, "created_at": r.created_at.isoformat(),
    }


@router.get("/recommendations/{recommendation_id}")
def read_recommendation(recommendation_id: str, db: Session = Depends(get_db)):
    r = db.get(Recommendation, recommendation_id)
    if not r:
        raise HTTPException(404, "Recommendation not found")
    return {
        "recommendation_id": r.id, "incident_id": r.incident_id, "recommended_fix": r.recommended_fix,
        "validity_status": r.validity_status, "why": r.explanation, "supporting_evidence": r.supporting_evidence,
        "conflicting_evidence": r.conflicting_evidence, "alternative_fixes": r.alternatives,
        "recalled_memory_ids": r.recalled_memory_ids, "trace_id": r.trace_id, "created_at": r.created_at.isoformat(),
    }


@router.post("/recommendations/{recommendation_id}/outcome", status_code=201)
async def record_recommendation_outcome(recommendation_id: str, payload: RecommendationOutcomeCreate, db: Session = Depends(get_db)):
    rec = db.get(Recommendation, recommendation_id)
    if not rec:
        raise HTTPException(404, "Recommendation not found")
    oid = new_id("RO")
    row = RecommendationOutcome(id=oid, recommendation_id=rec.id, followed=payload.followed,
                                action_taken=payload.action_taken, result=payload.result.upper(), notes=payload.notes,
                                recorded_at=datetime.utcnow(), hindsight_document_id=f"recommendation-outcome:{oid}")
    db.add(row); db.commit()
    inc = db.get(Incident, rec.incident_id)

    # Outcome also becomes intervention evidence, which is what makes the next recommendation improve.
    iv = Intervention(
        id=new_id("IV"), incident_id=inc.id, fix_name=payload.action_taken,
        parameter_change=payload.action_taken, outcome=payload.result.upper(), notes=payload.notes,
        created_at=row.recorded_at, hindsight_document_id=f"recommendation-outcome:{oid}:intervention",
    )
    db.add(iv); db.commit()

    request_id = new_id("REQ")
    content = (
        f"Recommendation {rec.id} suggested '{rec.recommended_fix}' for incident {inc.id}. "
        f"Recommendation followed: {payload.followed}. Actual action: '{payload.action_taken}'. "
        f"Real outcome: {payload.result}. Production context was {inc.material}/{inc.recipe} on {inc.machine}. "
        f"Notes: {payload.notes or 'none'}."
    )
    memory = await memory_service.retain(
        db, request_id=request_id, content=content, context="Recommendation outcome feedback",
        document_id=f"recommendation-outcome:{oid}", timestamp=row.recorded_at,
        metadata={"recommendation_id": rec.id, "incident_id": inc.id, "actual_action": payload.action_taken, "outcome": payload.result},
        tags=["validrift", "recommendation-outcome", "outcome", f"defect:{inc.defect.lower().replace(' ', '-')}"]
    )
    return {"id": oid, "recommendation_id": rec.id, "memory": memory, "trace_id": request_id,
            "message": "Outcome retained. This evidence will influence future recommendations."}


@router.get("/fixes/{fix_name}/passport")
def get_passport(fix_name: str, defect: str | None = None, db: Session = Depends(get_db)):
    try:
        return build_passport(db, fix_name=fix_name, defect=defect)
    except ValueError as exc:
        raise HTTPException(404, str(exc))


@router.post("/admin/sync-hindsight")
async def sync_hindsight(db: Session = Depends(get_db)):
    """Mirror the existing structured demo/operational history into Hindsight using stable document IDs."""
    return await sync_existing_history_to_hindsight(db)


@router.post("/admin/reset-demo")
def reset_demo(db: Session = Depends(get_db)):
    """Restore the golden Film-A -> Film-B demo dataset. Disabled in production.

    Wipes incidents, interventions, process changes, recommendations, outcomes,
    and memory traces, then re-runs the deterministic seed. Structured data is
    authoritative; Hindsight documents use stable IDs so a later
    POST /api/admin/sync-hindsight restores parity without duplicates.
    """
    from ..core.config import settings as _settings
    from ..seed import seed_demo as _seed_demo

    if _settings.app_env.lower() == "production":
        raise HTTPException(403, "Demo reset is disabled in production")
    for model in (RecommendationOutcome, Recommendation, Intervention, Incident,
                  ProcessChange, PlantContext, MemoryTrace):
        db.query(model).delete()
    db.commit()
    _seed_demo(db)
    return {"status": "ok", "message": "Demo data reset to the Film-A -> Film-B golden baseline."}


@router.get("/memory-activity")
def memory_activity(limit: int = Query(50, ge=1, le=200), operation: str | None = None, db: Session = Depends(get_db)):
    q = select(MemoryTrace).order_by(MemoryTrace.timestamp.desc()).limit(limit)
    if operation:
        q = select(MemoryTrace).where(MemoryTrace.operation == operation.upper()).order_by(MemoryTrace.timestamp.desc()).limit(limit)
    rows = db.scalars(q).all()
    return [
        {"id": x.id, "request_id": x.request_id, "operation": x.operation, "summary": x.query_summary,
         "memory_ids": x.memory_ids, "latency_ms": x.latency_ms, "status": x.status, "details": x.details,
         "timestamp": x.timestamp.isoformat()}
        for x in rows
    ]

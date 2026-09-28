from sqlalchemy.orm import Session
from sqlalchemy import select, func
from ..models import Incident, Intervention, MemoryTrace, PlantContext, ProcessChange
from .audit_service import run_audit
from .validity_engine import evaluate_fix, context_of


async def dashboard(db: Session) -> dict:
    ctx = db.get(PlantContext, 1)
    audit = await run_audit(db, include_reflect=False)
    latest_change = db.scalars(select(ProcessChange).order_by(ProcessChange.timestamp.desc()).limit(1)).first()
    incidents = db.scalars(select(Incident).order_by(Incident.timestamp.desc()).limit(8)).all()
    recent = []
    for inc in incidents:
        latest_intervention = sorted(inc.interventions, key=lambda x: x.created_at, reverse=True)[0] if inc.interventions else None
        validity_status = None
        if latest_intervention:
            try:
                validity_status = evaluate_fix(
                    db, fix_name=latest_intervention.fix_name, defect=inc.defect,
                    current_context=context_of(inc),
                ).status
            except Exception:
                validity_status = None
        recent.append({
            "incident_id": inc.id, "date": inc.timestamp.isoformat(), "defect": inc.defect,
            "context": f"{inc.material} / {inc.recipe}",
            "action_taken": latest_intervention.fix_name if latest_intervention else None,
            "outcome": latest_intervention.outcome if latest_intervention else None,
            "validity_status": validity_status,
        })
    traces = db.scalars(select(MemoryTrace).order_by(MemoryTrace.timestamp.desc()).limit(5)).all()
    return {
        "current_context": {k: getattr(ctx, k) for k in ("machine", "material", "supplier", "recipe", "firmware")},
        "kpis": {
            "learned_fixes": db.scalar(select(func.count(func.distinct(Intervention.fix_name)))) or 0,
            "validity_alerts": audit["summary"]["revalidation_required"] + audit["summary"]["drifted"],
            "recent_incidents": len(recent),
            "hindsight_memories": db.scalar(select(func.count(MemoryTrace.id)).where(MemoryTrace.operation == "RETAIN")) or 0,
        },
        "audit_summary": audit["summary"],
        "knowledge_requiring_attention": [x for x in audit["fixes"] if x["status"] in {"DRIFTED", "REVALIDATION REQUIRED"}][:4],
        "latest_process_change": {
            "id": latest_change.id, "date": latest_change.timestamp.isoformat(), "changes": latest_change.changes, "reason": latest_change.reason
        } if latest_change else None,
        "recent_incidents": recent,
        "memory_activity": [
            {"id": t.id, "operation": t.operation, "summary": t.query_summary, "status": t.status,
             "latency_ms": t.latency_ms, "timestamp": t.timestamp.isoformat(), "memory_ids": t.memory_ids}
            for t in traces
        ],
    }

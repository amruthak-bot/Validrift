from sqlalchemy.orm import Session
from sqlalchemy import select
from ..models import PlantContext, Intervention, Incident
from ..utils import new_id
from .validity_engine import evaluate_fix
from .hindsight_service import memory_service


async def run_audit(db: Session, machine: str | None = None, defect: str | None = None, include_reflect: bool = True) -> dict:
    ctx = db.get(PlantContext, 1)
    if not ctx:
        raise ValueError("Plant context is not configured")
    current_context = {k: getattr(ctx, k) for k in ("machine", "material", "supplier", "recipe", "firmware")}
    if machine:
        current_context["machine"] = machine

    q = select(Intervention.fix_name, Incident.defect).join(Incident).distinct()
    if defect:
        q = q.where(Incident.defect == defect)
    pairs = db.execute(q).all()

    evaluations = [evaluate_fix(db, fix_name=fix, defect=dfct, current_context=current_context) for fix, dfct in pairs]
    evaluations.sort(key=lambda x: (x.status, -x.score))

    supported = sum(e.status in {"VALIDATED", "SUPPORTED"} for e in evaluations)
    revalidation = sum(e.status == "REVALIDATION REQUIRED" for e in evaluations)
    drifted = sum(e.status == "DRIFTED" for e in evaluations)
    unverified = sum(e.status in {"UNVERIFIED", "INSUFFICIENT EVIDENCE"} for e in evaluations)

    trace_id = new_id("AUDIT")
    recall_query = (
        f"Audit manufacturing corrective-action memory for current process {current_context}. "
        "Recall prior fixes, outcomes, and process changes that may affect transfer of learned knowledge."
    )
    recalled = await memory_service.recall(db, request_id=trace_id, query=recall_query)

    reflection = None
    if include_reflect:
        focus = next((e for e in evaluations if e.status == "DRIFTED"), None)
        if focus:
            reflection = await memory_service.reflect(
                db, request_id=trace_id,
                query=f"How has the effectiveness of '{focus.fix_name}' changed across production contexts?",
                context=f"Current context: {current_context}; deterministic status: {focus.status}; reason: {focus.reason}",
            )

    return {
        "trace_id": trace_id,
        "current_context": current_context,
        "summary": {
            "reviewed": len(evaluations),
            "remain_supported": supported,
            "revalidation_required": revalidation,
            "drifted": drifted,
            "unverified_or_insufficient": unverified,
        },
        "fixes": [e.to_dict() for e in evaluations],
        "recalled_memory_ids": recalled.memory_ids,
        "reflection": reflection.get("text") if reflection else None,
        "note": "Historical evidence is never deleted; validity is evaluated per production context.",
    }

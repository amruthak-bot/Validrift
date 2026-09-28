from sqlalchemy.orm import Session
from sqlalchemy import select
from ..models import Incident, Recommendation
from ..utils import new_id
from .validity_engine import evaluate_all_for_defect, context_of
from .hindsight_service import memory_service


def _evidence_summary(eval_):
    return [
        {
            "incident_id": x.incident_id,
            "date": x.date.isoformat(),
            "context": x.context,
            "outcome": x.outcome,
            "fix_name": x.fix_name,
            "notes": x.notes,
        }
        for x in eval_.current_evidence
    ]


async def recommend(db: Session, incident_id: str, use_reflect: bool = True) -> dict:
    incident = db.get(Incident, incident_id)
    if not incident:
        raise ValueError(f"Incident {incident_id} not found")

    current_context = context_of(incident)
    evaluations = evaluate_all_for_defect(db, defect=incident.defect, current_context=current_context)
    if not evaluations:
        return {
            "incident_id": incident_id,
            "recommended_fix": None,
            "validity_status": "INSUFFICIENT EVIDENCE",
            "why": "No corrective-action history exists for this defect yet.",
            "supporting_evidence": [],
            "conflicting_evidence": [],
            "alternative_fixes": [],
            "recalled_memory_ids": [],
        }

    request_id = new_id("TRACE")
    query = (
        f"Manufacturing quality incident {incident.id}: defect {incident.defect} on {incident.machine}; "
        f"current context material {incident.material}, supplier {incident.supplier}, recipe {incident.recipe}, firmware {incident.firmware}. "
        "Recall similar incidents, corrective actions, outcomes, and relevant process changes."
    )
    recalled = await memory_service.recall(db, request_id=request_id, query=query)

    best = evaluations[0]
    alternatives = [x.to_dict() for x in evaluations[1:4]]
    supporting = _evidence_summary(best)
    conflicting = [x.to_dict() for x in best.historical_evidence if x.outcome in {"FAILURE", "FAILED"}]

    if best.status == "DRIFTED":
        why = best.reason
    else:
        why = (
            f"{best.fix_name} is {best.status.lower()} for the current {incident.material} / {incident.recipe} context "
            f"with {best.current_successes} success(es) and {best.current_failures} failure(s)."
        )

    reflection = None
    if use_reflect:
        reflection_query = (
            f"Explain briefly how the effectiveness of '{best.fix_name}' compares with other fixes for {incident.defect}, "
            f"especially across current context {incident.material}/{incident.recipe}. Ground the answer in remembered outcomes."
        )
        reflection = await memory_service.reflect(db, request_id=request_id, query=reflection_query, context=query)

    rec_id = new_id("REC")
    rec = Recommendation(
        id=rec_id, incident_id=incident.id, recommended_fix=best.fix_name,
        validity_status=best.status, explanation=why,
        supporting_evidence=supporting, conflicting_evidence=conflicting,
        alternatives=alternatives, recalled_memory_ids=recalled.memory_ids,
        trace_id=request_id,
        hindsight_document_id=f"recommendation:{rec_id}",
    )
    db.add(rec)
    db.commit()

    retain_text = (
        f"Validrift recommended '{best.fix_name}' for incident {incident.id} ({incident.defect}) under "
        f"machine {incident.machine}, material {incident.material}, supplier {incident.supplier}, recipe {incident.recipe}, firmware {incident.firmware}. "
        f"Validity status: {best.status}. Current-context evidence: {best.current_successes} success(es), {best.current_failures} failure(s)."
    )
    await memory_service.retain(
        db, request_id=request_id, content=retain_text, context="Validrift recommendation",
        document_id=f"recommendation:{rec_id}", timestamp=rec.created_at,
        metadata={"recommendation_id": rec_id, "incident_id": incident.id, "fix": best.fix_name},
        tags=["validrift", "recommendation", f"defect:{incident.defect.lower().replace(' ', '-')}"]
    )

    return {
        "recommendation_id": rec_id,
        "incident_id": incident.id,
        "recommended_fix": best.fix_name,
        "validity_status": best.status,
        "why": why,
        "supporting_evidence": supporting,
        "conflicting_evidence": conflicting,
        "alternative_fixes": alternatives,
        "recalled_memory_ids": recalled.memory_ids,
        "trace_id": request_id,
        "reflection": reflection.get("text") if reflection else None,
        "evaluation": best.to_dict(),
    }

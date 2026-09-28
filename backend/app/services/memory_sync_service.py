from sqlalchemy.orm import Session
from sqlalchemy import select
from ..models import Incident, Intervention, ProcessChange, Recommendation, RecommendationOutcome
from ..utils import new_id
from .hindsight_service import memory_service


async def sync_existing_history_to_hindsight(db: Session) -> dict:
    """Idempotently mirror the structured operational ledger into Hindsight.

    Stable document IDs are used so repeating this sync replaces/upserts the same
    logical source documents rather than creating a new logical history each time.
    """
    request_id = new_id("SYNC")
    attempted = 0
    succeeded = 0
    failed = []

    async def retain(**kwargs):
        nonlocal attempted, succeeded
        attempted += 1
        result = await memory_service.retain(db, request_id=request_id, **kwargs)
        if result.get("ok"):
            succeeded += 1
        else:
            failed.append({"document_id": kwargs["document_id"], "error": result.get("error") or result.get("mode")})

    for pc in db.scalars(select(ProcessChange).order_by(ProcessChange.timestamp.asc())).all():
        parts = [f"{field}: {delta.get('old')} -> {delta.get('new')}" for field, delta in pc.changes.items()]
        await retain(
            content=f"Production process change on {pc.machine}: " + "; ".join(parts) + f". Reason: {pc.reason}",
            context="Manufacturing process change",
            document_id=pc.hindsight_document_id or f"process-change:{pc.id}",
            timestamp=pc.timestamp,
            metadata={"process_change_id": pc.id, "machine": pc.machine},
            tags=["validrift", "process-change", "world-fact"],
        )

    incidents = db.scalars(select(Incident).order_by(Incident.timestamp.asc())).all()
    for inc in incidents:
        await retain(
            content=(
                f"Incident {inc.id}: {inc.defect} occurred on machine {inc.machine} under material {inc.material}, "
                f"supplier {inc.supplier}, recipe {inc.recipe}, firmware {inc.firmware}. Severity {inc.severity}. "
                f"Observed notes: {inc.notes or 'none'}."
            ),
            context="Manufacturing quality incident",
            document_id=inc.hindsight_document_id or f"incident:{inc.id}",
            timestamp=inc.timestamp,
            metadata={"incident_id": inc.id, "defect": inc.defect, "machine": inc.machine,
                      "material": inc.material, "supplier": inc.supplier, "recipe": inc.recipe, "firmware": inc.firmware},
            tags=["validrift", "incident", f"defect:{inc.defect.lower().replace(' ', '-')}"],
        )
        for iv in sorted(inc.interventions, key=lambda x: x.created_at):
            await retain(
                content=(
                    f"For incident {inc.id} ({inc.defect}) on {inc.machine} under material {inc.material}, supplier {inc.supplier}, "
                    f"recipe {inc.recipe}, firmware {inc.firmware}, corrective action '{iv.fix_name}' was attempted. "
                    f"Outcome: {iv.outcome}. Notes: {iv.notes or 'none'}."
                ),
                context="Corrective action and real outcome",
                document_id=iv.hindsight_document_id or f"intervention:{iv.id}",
                timestamp=iv.created_at,
                metadata={"incident_id": inc.id, "intervention_id": iv.id, "fix": iv.fix_name, "outcome": iv.outcome,
                          "defect": inc.defect, "material": inc.material, "recipe": inc.recipe},
                tags=["validrift", "intervention", "outcome", f"defect:{inc.defect.lower().replace(' ', '-')}"],
            )

    for rec in db.scalars(select(Recommendation).order_by(Recommendation.created_at.asc())).all():
        inc = db.get(Incident, rec.incident_id)
        await retain(
            content=(
                f"Validrift recommended '{rec.recommended_fix}' for incident {rec.incident_id} ({inc.defect if inc else 'unknown defect'}). "
                f"Validity status: {rec.validity_status}. Explanation: {rec.explanation}"
            ),
            context="Validrift recommendation",
            document_id=rec.hindsight_document_id or f"recommendation:{rec.id}",
            timestamp=rec.created_at,
            metadata={"recommendation_id": rec.id, "incident_id": rec.incident_id, "fix": rec.recommended_fix},
            tags=["validrift", "recommendation"],
        )

    for outcome in db.scalars(select(RecommendationOutcome).order_by(RecommendationOutcome.recorded_at.asc())).all():
        rec = db.get(Recommendation, outcome.recommendation_id)
        await retain(
            content=(
                f"Outcome for recommendation {outcome.recommendation_id}: followed={outcome.followed}; "
                f"actual action '{outcome.action_taken}'; result {outcome.result}. Notes: {outcome.notes or 'none'}."
            ),
            context="Recommendation outcome feedback",
            document_id=outcome.hindsight_document_id or f"recommendation-outcome:{outcome.id}",
            timestamp=outcome.recorded_at,
            metadata={"recommendation_id": outcome.recommendation_id, "actual_action": outcome.action_taken, "outcome": outcome.result},
            tags=["validrift", "recommendation-outcome", "outcome"],
        )

    return {
        "trace_id": request_id,
        "attempted": attempted,
        "succeeded": succeeded,
        "failed_count": len(failed),
        "failed": failed[:20],
        "mode": memory_service.mode,
    }

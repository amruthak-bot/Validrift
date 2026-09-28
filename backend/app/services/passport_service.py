from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..models import Incident, Intervention, ProcessChange, PlantContext
from .validity_engine import context_of, evaluate_fix


def build_passport(db: Session, fix_name: str, defect: str | None = None) -> dict:
    q = select(Intervention).join(Incident).where(Intervention.fix_name == fix_name).order_by(Intervention.created_at.asc())
    if defect:
        q = q.where(Incident.defect == defect)
    rows = db.scalars(q).all()
    if not rows:
        raise ValueError(f"No evidence found for fix '{fix_name}'")

    defect = defect or rows[0].incident.defect
    context = db.get(PlantContext, 1)
    current_context = {k: getattr(context, k) for k in ("machine", "material", "supplier", "recipe", "firmware")}

    grouped = defaultdict(list)
    for row in rows:
        ctx = context_of(row.incident)
        key = f"{ctx['material']} / {ctx['recipe']}"
        grouped[key].append({
            "incident_id": row.incident.id,
            "date": row.created_at.isoformat(),
            "outcome": row.outcome,
            "context": ctx,
            "notes": row.notes,
            "memory_document_id": row.hindsight_document_id,
        })

    contexts = []
    for key, items in grouped.items():
        successes = sum(i["outcome"] == "SUCCESS" for i in items)
        failures = sum(i["outcome"] in {"FAILURE", "FAILED"} for i in items)
        sample = items[-1]["context"]
        evaluation = evaluate_fix(db, fix_name=fix_name, defect=defect, current_context=sample)
        contexts.append({
            "label": key,
            "context": sample,
            "successes": successes,
            "failures": failures,
            "status": evaluation.status,
            "evidence": items,
            "last_event": items[-1]["date"],
        })

    current_eval = evaluate_fix(db, fix_name=fix_name, defect=defect, current_context=current_context)
    process_changes = db.scalars(select(ProcessChange).order_by(ProcessChange.timestamp.asc())).all()
    timeline = []
    for row in rows:
        timeline.append({"type": "INTERVENTION", "date": row.created_at.isoformat(), "incident_id": row.incident.id,
                         "outcome": row.outcome, "context": context_of(row.incident), "fix_name": row.fix_name})
    for pc in process_changes:
        timeline.append({"type": "PROCESS_CHANGE", "date": pc.timestamp.isoformat(), "changes": pc.changes, "reason": pc.reason})
    timeline.sort(key=lambda x: x["date"])

    return {
        "fix_name": fix_name,
        "defect": defect,
        "first_learned": rows[0].created_at.isoformat(),
        "last_event": rows[-1].created_at.isoformat(),
        "total_attempts": len(rows),
        "contexts_count": len(grouped),
        "current_context": current_context,
        "current_validity": current_eval.to_dict(),
        "contexts": contexts,
        "timeline": timeline,
        "source_memories": [
            {"document_id": r.hindsight_document_id, "incident_id": r.incident.id, "date": r.created_at.isoformat(),
             "summary": f"{r.fix_name} -> {r.outcome} under {r.incident.material}/{r.incident.recipe}"}
            for r in rows
        ],
    }

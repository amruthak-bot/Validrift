from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Iterable
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..core.config import settings
from ..core.enums import ValidityStatus
from ..models import Incident, Intervention, ProcessChange

CORE_CONTEXT_FIELDS = ("machine", "material", "supplier", "recipe", "firmware")


@dataclass
class EvidenceItem:
    incident_id: str
    intervention_id: str
    date: datetime
    defect: str
    fix_name: str
    outcome: str
    context: dict
    notes: str

    def to_dict(self):
        d = asdict(self)
        d["date"] = self.date.isoformat()
        return d


@dataclass
class FixEvaluation:
    fix_name: str
    defect: str
    status: str
    current_successes: int
    current_failures: int
    current_partial: int
    historical_successes: int
    historical_failures: int
    current_evidence: list[EvidenceItem]
    historical_evidence: list[EvidenceItem]
    relevant_process_change: dict | None
    reason: str
    score: float

    def to_dict(self):
        return {
            "fix_name": self.fix_name,
            "defect": self.defect,
            "status": self.status,
            "current_successes": self.current_successes,
            "current_failures": self.current_failures,
            "current_partial": self.current_partial,
            "historical_successes": self.historical_successes,
            "historical_failures": self.historical_failures,
            "current_evidence": [x.to_dict() for x in self.current_evidence],
            "historical_evidence": [x.to_dict() for x in self.historical_evidence],
            "relevant_process_change": self.relevant_process_change,
            "reason": self.reason,
            "score": round(self.score, 4),
        }


def context_of(incident: Incident) -> dict:
    return {k: getattr(incident, k) for k in CORE_CONTEXT_FIELDS}


def contexts_match(a: dict, b: dict) -> bool:
    return all((a.get(k) or "") == (b.get(k) or "") for k in CORE_CONTEXT_FIELDS)


def _event(intervention: Intervention) -> EvidenceItem:
    inc = intervention.incident
    return EvidenceItem(
        incident_id=inc.id,
        intervention_id=intervention.id,
        date=intervention.created_at,
        defect=inc.defect,
        fix_name=intervention.fix_name,
        outcome=intervention.outcome,
        context=context_of(inc),
        notes=intervention.notes,
    )


def _latest_relevant_change(db: Session, current_context: dict, historical_contexts: list[dict]) -> dict | None:
    changes = db.scalars(select(ProcessChange).order_by(ProcessChange.timestamp.desc())).all()
    for change in changes:
        changed_fields = set(change.changes.keys())
        if not changed_fields.intersection(CORE_CONTEXT_FIELDS):
            continue
        # Relevant if one of the changed dimensions appears in historical context and current context differs.
        for hist in historical_contexts:
            if any(hist.get(f) != current_context.get(f) for f in changed_fields if f in CORE_CONTEXT_FIELDS):
                return {"id": change.id, "timestamp": change.timestamp.isoformat(), "changes": change.changes, "reason": change.reason}
    return None


def evaluate_fix(db: Session, *, fix_name: str, defect: str, current_context: dict) -> FixEvaluation:
    rows = db.scalars(
        select(Intervention)
        .join(Incident)
        .where(Intervention.fix_name == fix_name, Incident.defect == defect)
        .order_by(Intervention.created_at.asc())
    ).all()

    current = []
    historical = []
    for row in rows:
        item = _event(row)
        (current if contexts_match(item.context, current_context) else historical).append(item)

    success_values = {"SUCCESS"}
    partial_values = {"PARTIAL IMPROVEMENT", "PARTIAL"}
    fail_values = {"FAILURE", "FAILED"}

    cs = sum(x.outcome in success_values for x in current)
    cp = sum(x.outcome in partial_values for x in current)
    cf = sum(x.outcome in fail_values for x in current)
    hs = sum(x.outcome in success_values for x in historical)
    hf = sum(x.outcome in fail_values for x in historical)

    historical_contexts = [x.context for x in historical]
    process_change = _latest_relevant_change(db, current_context, historical_contexts) if hs else None

    attempts = cs + cp + cf
    weighted_success = cs + 0.5 * cp
    ratio = weighted_success / attempts if attempts else 0.0

    if hs > 0 and cf >= settings.drift_min_failures and cs == 0:
        status = ValidityStatus.DRIFTED
        reason = f"Historically successful evidence exists, but {cf} repeated failure(s) occurred in the current context."
    elif cs >= settings.validated_min_successes and ratio >= 0.75:
        status = ValidityStatus.VALIDATED
        reason = f"{cs} successful current-context outcomes support repeated validation."
    elif cs >= 1 and cf < settings.drift_min_failures:
        status = ValidityStatus.SUPPORTED
        reason = f"{cs} successful current-context outcome(s) provide positive support."
    elif hs > 0 and attempts == 0 and process_change:
        status = ValidityStatus.REVALIDATION_REQUIRED
        reason = "Historical success exists, but a relevant process change occurred and there is no current-context evidence yet."
    elif hs > 0 and attempts == 0:
        status = ValidityStatus.UNVERIFIED
        reason = "The fix is historically relevant, but applicability to the current context is unverified."
    elif attempts > 0 and cs == 0 and cf > 0:
        status = ValidityStatus.INSUFFICIENT_EVIDENCE
        reason = "Current evidence is negative, but there is not enough historical support to label validity drift."
    else:
        status = ValidityStatus.INSUFFICIENT_EVIDENCE
        reason = "There is not enough reliable evidence for this corrective action."

    status_weight = {
        ValidityStatus.VALIDATED: 100,
        ValidityStatus.SUPPORTED: 80,
        ValidityStatus.REVALIDATION_REQUIRED: 35,
        ValidityStatus.UNVERIFIED: 25,
        ValidityStatus.INSUFFICIENT_EVIDENCE: 10,
        ValidityStatus.DRIFTED: -30,
    }[status]
    recency = max([x.date.timestamp() for x in current], default=0) / 1e12
    score = status_weight + cs * 6 + cp * 2 - cf * 8 + min(hs, 5) * 0.3 + recency

    return FixEvaluation(
        fix_name=fix_name, defect=defect, status=str(status),
        current_successes=cs, current_failures=cf, current_partial=cp,
        historical_successes=hs, historical_failures=hf,
        current_evidence=current, historical_evidence=historical,
        relevant_process_change=process_change, reason=reason, score=score,
    )


def candidate_fixes(db: Session, defect: str) -> list[str]:
    rows = db.execute(
        select(Intervention.fix_name).join(Incident).where(Incident.defect == defect).distinct()
    ).all()
    return [r[0] for r in rows]


def evaluate_all_for_defect(db: Session, *, defect: str, current_context: dict) -> list[FixEvaluation]:
    evaluations = [evaluate_fix(db, fix_name=f, defect=defect, current_context=current_context) for f in candidate_fixes(db, defect)]
    return sorted(evaluations, key=lambda x: x.score, reverse=True)

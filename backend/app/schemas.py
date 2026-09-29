from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field


class ContextSchema(BaseModel):
    machine: str
    material: str
    supplier: str
    recipe: str
    firmware: str


class IncidentCreate(BaseModel):
    id: str | None = None
    timestamp: datetime | None = None
    defect: str
    severity: str = "MEDIUM"
    machine: str
    material: str
    supplier: str
    recipe: str
    firmware: str
    parameters: dict[str, Any] = Field(default_factory=dict)
    notes: str = ""


class InterventionCreate(BaseModel):
    incident_id: str
    fix_name: str
    parameter_change: str = ""
    outcome: str
    notes: str = ""


class ProcessChangeCreate(BaseModel):
    timestamp: datetime | None = None
    machine: str = "Sealer-02"
    changes: dict[str, dict[str, str]]
    reason: str = ""
    run_audit: bool = True


class RecommendationRequest(BaseModel):
    incident_id: str
    use_reflect: bool = True


class RecommendationOutcomeCreate(BaseModel):
    followed: bool = True
    action_taken: str
    result: str
    notes: str = ""


class AuditRequest(BaseModel):
    machine: str | None = None
    defect: str | None = None
    include_reflect: bool = True


class MemoryChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=600)


class HealthResponse(BaseModel):
    status: str
    database: str
    hindsight: dict[str, Any]

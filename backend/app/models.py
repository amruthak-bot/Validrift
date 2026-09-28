from datetime import datetime
from sqlalchemy import String, Integer, Float, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .core.database import Base


class PlantContext(Base):
    __tablename__ = "plant_contexts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    machine: Mapped[str] = mapped_column(String(100), default="Sealer-02")
    material: Mapped[str] = mapped_column(String(100), default="Film-B")
    supplier: Mapped[str] = mapped_column(String(100), default="FlexPack")
    recipe: Mapped[str] = mapped_column(String(100), default="R11")
    firmware: Mapped[str] = mapped_column(String(100), default="V3")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Incident(Base):
    __tablename__ = "incidents"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    defect: Mapped[str] = mapped_column(String(120), index=True)
    severity: Mapped[str] = mapped_column(String(40), default="MEDIUM")
    machine: Mapped[str] = mapped_column(String(100), index=True)
    material: Mapped[str] = mapped_column(String(100), index=True)
    supplier: Mapped[str] = mapped_column(String(100), index=True)
    recipe: Mapped[str] = mapped_column(String(100), index=True)
    firmware: Mapped[str] = mapped_column(String(100), index=True)
    parameters: Mapped[dict] = mapped_column(JSON, default=dict)
    notes: Mapped[str] = mapped_column(Text, default="")
    hindsight_document_id: Mapped[str | None] = mapped_column(String(160), nullable=True)

    interventions: Mapped[list["Intervention"]] = relationship(back_populates="incident", cascade="all, delete-orphan")


class Intervention(Base):
    __tablename__ = "interventions"
    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id"), index=True)
    fix_name: Mapped[str] = mapped_column(String(160), index=True)
    parameter_change: Mapped[str] = mapped_column(String(220), default="")
    outcome: Mapped[str] = mapped_column(String(40), index=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    hindsight_document_id: Mapped[str | None] = mapped_column(String(160), nullable=True)

    incident: Mapped[Incident] = relationship(back_populates="interventions")


class ProcessChange(Base):
    __tablename__ = "process_changes"
    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    machine: Mapped[str] = mapped_column(String(100), index=True)
    changes: Mapped[dict] = mapped_column(JSON)
    reason: Mapped[str] = mapped_column(Text, default="")
    hindsight_document_id: Mapped[str | None] = mapped_column(String(160), nullable=True)


class Recommendation(Base):
    __tablename__ = "recommendations"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id"), index=True)
    recommended_fix: Mapped[str] = mapped_column(String(160))
    validity_status: Mapped[str] = mapped_column(String(50))
    explanation: Mapped[str] = mapped_column(Text)
    supporting_evidence: Mapped[list] = mapped_column(JSON, default=list)
    conflicting_evidence: Mapped[list] = mapped_column(JSON, default=list)
    alternatives: Mapped[list] = mapped_column(JSON, default=list)
    recalled_memory_ids: Mapped[list] = mapped_column(JSON, default=list)
    trace_id: Mapped[str] = mapped_column(String(80), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    hindsight_document_id: Mapped[str | None] = mapped_column(String(160), nullable=True)


class RecommendationOutcome(Base):
    __tablename__ = "recommendation_outcomes"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    recommendation_id: Mapped[str] = mapped_column(ForeignKey("recommendations.id"), index=True)
    followed: Mapped[bool] = mapped_column(Boolean, default=True)
    action_taken: Mapped[str] = mapped_column(String(160))
    result: Mapped[str] = mapped_column(String(40))
    notes: Mapped[str] = mapped_column(Text, default="")
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    hindsight_document_id: Mapped[str | None] = mapped_column(String(160), nullable=True)


class MemoryTrace(Base):
    __tablename__ = "memory_traces"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    request_id: Mapped[str] = mapped_column(String(80), index=True)
    operation: Mapped[str] = mapped_column(String(30), index=True)
    query_summary: Mapped[str] = mapped_column(Text, default="")
    memory_ids: Mapped[list] = mapped_column(JSON, default=list)
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(30), default="SUCCESS")
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

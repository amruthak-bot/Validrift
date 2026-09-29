import time
from dataclasses import dataclass
from typing import Any
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.enums import MemoryOperation
from ..models import MemoryTrace
from ..utils import new_id

try:
    from hindsight_client import Hindsight
except Exception:  # package is optional in mock/test mode
    Hindsight = None


@dataclass
class MemoryRecall:
    memory_ids: list[str]
    results: list[dict[str, Any]]
    raw: dict[str, Any]


def _to_dict(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, list):
        return [_to_dict(x) for x in value]
    if isinstance(value, dict):
        return {str(k): _to_dict(v) for k, v in value.items()}
    if hasattr(value, "model_dump"):
        return _to_dict(value.model_dump())
    if hasattr(value, "to_dict"):
        return _to_dict(value.to_dict())
    if hasattr(value, "__dict__"):
        return {k: _to_dict(v) for k, v in value.__dict__.items() if not k.startswith("_")}
    return str(value)


class HindsightService:
    def __init__(self):
        self.mode = settings.hindsight_mode.lower()
        self._client = None
        if self.mode == "live" and Hindsight is not None:
            self._client = Hindsight(
                base_url=settings.hindsight_api_url,
                api_key=settings.hindsight_api_key,
                timeout=settings.hindsight_timeout_seconds,
                user_agent="validrift/1.0",
            )

    @property
    def enabled(self) -> bool:
        return self.mode in {"live", "mock"}

    async def health(self) -> dict[str, Any]:
        if self.mode == "disabled":
            return {"mode": "disabled", "ok": False, "message": "Hindsight disabled"}
        if self.mode == "mock":
            return {"mode": "mock", "ok": True, "message": "Mock memory adapter active"}
        if self._client is None:
            return {"mode": "live", "ok": False, "message": "hindsight-client package not installed"}
        try:
            version = await self._client.aget_version()
            return {"mode": "live", "ok": True, "version": _to_dict(version)}
        except Exception as exc:
            return {"mode": "live", "ok": False, "message": str(exc)}

    def _trace(self, db: Session, request_id: str, operation: str, summary: str, started: float,
               memory_ids: list[str] | None = None, status: str = "SUCCESS", details: dict | None = None):
        db.add(MemoryTrace(
            id=new_id("MT"), request_id=request_id, operation=operation,
            query_summary=summary, memory_ids=memory_ids or [],
            latency_ms=round((time.perf_counter() - started) * 1000, 2), status=status,
            details=details or {},
        ))
        db.commit()

    async def retain(self, db: Session, *, request_id: str, content: str, context: str,
                     document_id: str, timestamp=None, metadata: dict[str, str] | None = None,
                     tags: list[str] | None = None) -> dict[str, Any]:
        started = time.perf_counter()
        if self.mode == "disabled":
            self._trace(db, request_id, MemoryOperation.RETAIN, content[:200], started, status="DISABLED")
            return {"ok": False, "mode": "disabled"}
        if self.mode == "mock":
            mock_id = f"mock:{document_id}"
            self._trace(db, request_id, MemoryOperation.RETAIN, content[:200], started, [mock_id], details={"context": context})
            return {"ok": True, "mode": "mock", "memory_ids": [mock_id]}
        if self._client is None:
            self._trace(db, request_id, MemoryOperation.RETAIN, content[:200], started, status="ERROR", details={"error": "client unavailable"})
            return {"ok": False, "error": "hindsight-client unavailable"}
        try:
            response = await self._client.aretain(
                bank_id=settings.hindsight_bank_id,
                content=content,
                timestamp=timestamp,
                context=context,
                document_id=document_id,
                metadata={k: str(v) for k, v in (metadata or {}).items()},
                tags=tags or ["validrift"],
            )
            raw = _to_dict(response)
            ids = []
            for key in ("memory_ids", "ids"):
                if isinstance(raw, dict) and isinstance(raw.get(key), list):
                    ids = [str(x) for x in raw[key]]
            self._trace(db, request_id, MemoryOperation.RETAIN, content[:200], started, ids, details={"document_id": document_id})
            return {"ok": True, "raw": raw, "memory_ids": ids}
        except Exception as exc:
            self._trace(db, request_id, MemoryOperation.RETAIN, content[:200], started, status="ERROR", details={"error": str(exc)})
            return {"ok": False, "error": str(exc)}

    async def recall(self, db: Session, *, request_id: str, query: str, tags: list[str] | None = None) -> MemoryRecall:
        started = time.perf_counter()
        if self.mode == "disabled":
            self._trace(db, request_id, MemoryOperation.RECALL, query, started, status="DISABLED")
            return MemoryRecall([], [], {})
        if self.mode == "mock":
            self._trace(db, request_id, MemoryOperation.RECALL, query, started, details={"mock": True})
            return MemoryRecall([], [], {"mode": "mock"})
        if self._client is None:
            self._trace(db, request_id, MemoryOperation.RECALL, query, started, status="ERROR", details={"error": "client unavailable"})
            return MemoryRecall([], [], {"error": "client unavailable"})
        try:
            response = await self._client.arecall(
                bank_id=settings.hindsight_bank_id,
                query=query,
                types=["world", "experience", "observation"],
                max_tokens=settings.hindsight_recall_max_tokens,
                budget=settings.hindsight_recall_budget,
                trace=True,
                include_source_facts=True,
                tags=tags or ["validrift"],
                tags_match="any",
                prefer_observations=True,
            )
            raw = _to_dict(response)
            results = raw.get("results", []) if isinstance(raw, dict) else []
            ids = [str(x.get("id")) for x in results if isinstance(x, dict) and x.get("id")]
            self._trace(db, request_id, MemoryOperation.RECALL, query, started, ids, details={"returned": len(results)})
            return MemoryRecall(ids, results, raw)
        except Exception as exc:
            self._trace(db, request_id, MemoryOperation.RECALL, query, started, status="ERROR", details={"error": str(exc)})
            return MemoryRecall([], [], {"error": str(exc)})

    async def reflect(self, db: Session, *, request_id: str, query: str, context: str | None = None,
                      tags: list[str] | None = None, max_tokens: int = 700) -> dict[str, Any]:
        started = time.perf_counter()
        if self.mode == "disabled":
            self._trace(db, request_id, MemoryOperation.REFLECT, query, started, status="DISABLED")
            return {"ok": False, "text": None}
        if self.mode == "mock":
            text = "Mock reflection disabled for scoring; deterministic evidence remains authoritative."
            self._trace(db, request_id, MemoryOperation.REFLECT, query, started, details={"mock": True})
            return {"ok": True, "text": text, "mode": "mock"}
        if self._client is None:
            self._trace(db, request_id, MemoryOperation.REFLECT, query, started, status="ERROR", details={"error": "client unavailable"})
            return {"ok": False, "text": None}
        try:
            response = await self._client.areflect(
                bank_id=settings.hindsight_bank_id,
                query=query,
                budget="low",
                context=context,
                max_tokens=max_tokens,
                tags=tags or ["validrift"],
                tags_match="any",
                include_facts=True,
                fact_types=["world", "experience", "observation"],
            )
            raw = _to_dict(response)
            text = None
            if isinstance(raw, dict):
                text = raw.get("text") or raw.get("response") or raw.get("answer") or raw.get("content")
            self._trace(db, request_id, MemoryOperation.REFLECT, query, started, details={"text": text or ""})
            return {"ok": True, "text": text, "raw": raw}
        except Exception as exc:
            self._trace(db, request_id, MemoryOperation.REFLECT, query, started, status="ERROR", details={"error": str(exc)})
            return {"ok": False, "error": str(exc), "text": None}


memory_service = HindsightService()

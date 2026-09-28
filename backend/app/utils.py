import re
import uuid
from datetime import datetime


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10].upper()}"


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

os.environ.setdefault("HINDSIGHT_MODE", "mock")
os.environ.setdefault("DATABASE_URL", "sqlite:///./validrift_test.db")
os.environ.setdefault("SEED_DEMO", "true")

import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture(scope="session")
def client():
    dbfile = Path("validrift_test.db")
    if dbfile.exists():
        dbfile.unlink()
    with TestClient(app) as c:
        yield c
    if dbfile.exists():
        dbfile.unlink()

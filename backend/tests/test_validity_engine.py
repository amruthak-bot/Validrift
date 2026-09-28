from app.core.database import SessionLocal
from app.models import PlantContext
from app.services.validity_engine import evaluate_fix


def test_temperature_fix_is_drifted(client):
    db = SessionLocal()
    try:
        ctx = db.get(PlantContext, 1)
        current = {k: getattr(ctx, k) for k in ("machine", "material", "supplier", "recipe", "firmware")}
        result = evaluate_fix(db, fix_name="Increase Temperature +5°C", defect="Weak Seal", current_context=current)
        assert result.status == "DRIFTED"
        assert result.historical_successes == 4
        assert result.current_failures == 2
    finally:
        db.close()


def test_pressure_is_supported(client):
    db = SessionLocal()
    try:
        ctx = db.get(PlantContext, 1)
        current = {k: getattr(ctx, k) for k in ("machine", "material", "supplier", "recipe", "firmware")}
        result = evaluate_fix(db, fix_name="Increase Pressure +8%", defect="Weak Seal", current_context=current)
        assert result.status == "SUPPORTED"
        assert result.current_successes == 2
        assert result.current_failures == 0
    finally:
        db.close()

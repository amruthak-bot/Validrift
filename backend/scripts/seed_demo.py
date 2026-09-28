from app.core.database import Base, engine, SessionLocal
from app.seed import seed_demo

Base.metadata.create_all(bind=engine)
db = SessionLocal()
try:
    seed_demo(db)
    print("Validrift demo data seeded.")
finally:
    db.close()

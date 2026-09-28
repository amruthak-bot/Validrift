import asyncio
from app.core.database import Base, engine, SessionLocal
from app.seed import seed_demo
from app.services.memory_sync_service import sync_existing_history_to_hindsight

async def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_demo(db)
        result = await sync_existing_history_to_hindsight(db)
        print(result)
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())

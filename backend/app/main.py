from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.database import Base, engine, SessionLocal
from .api.routes import router
from .seed import seed_demo


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    if settings.seed_demo:
        db = SessionLocal()
        try:
            seed_demo(db)
        finally:
            db.close()
    yield


app = FastAPI(
    title="Validrift API",
    version="1.0.0",
    description="Change-aware manufacturing memory backend with Hindsight persistent memory and deterministic context-validity logic.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router, prefix=settings.api_prefix)


@app.get("/")
def root():
    return {"name": "Validrift API", "docs": "/docs", "health": f"{settings.api_prefix}/health"}

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from . import models  # noqa: F401  (registers tables)
from .api import public, staff, webhooks
from .config import get_settings
from .db import Base, SessionLocal, engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.env == "dev":
        Base.metadata.create_all(engine)  # prod: use Alembic migrations instead (see docs/production-checklist.md)
    yield


app = FastAPI(title="RMA Triage API", version="0.1.0", lifespan=lifespan,
              description="Warranty / RMA intake, AI triage, routing and SLA monitoring.")
app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
                   allow_methods=["GET", "POST"], allow_headers=["*"])
app.include_router(public.router)
app.include_router(webhooks.router)
app.include_router(staff.router)


@app.get("/health", tags=["ops"])
def health():
    return {"status": "ok"}


@app.get("/ready", tags=["ops"])
def ready():
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    return {"status": "ready"}

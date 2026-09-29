import os

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["PUBLIC_RATE_LIMIT_PER_MINUTE"] = "100000"
os.environ["ANTHROPIC_API_KEY"] = ""          # force the deterministic heuristic extractor

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from app import models  # noqa: F401
from app.api import deps
from app.config import get_settings
from app.db import Base, SessionLocal
from app.main import app
from app.seed import seed

STAFF = {"X-API-Key": "dev-staff-key"}


@pytest.fixture(autouse=True)
def db_engine():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SessionLocal.configure(bind=engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)
    deps._hits.clear()
    settings = get_settings()
    original = settings.model_copy()
    yield engine
    for field in settings.model_fields:
        setattr(settings, field, getattr(original, field))
    engine.dispose()


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session


@pytest.fixture
def client():
    return TestClient(app)  # no `with`: lifespan (create_all on the default engine) is not needed


@pytest.fixture
def submit(client):
    """Submit a portal claim; BackgroundTasks run before the response returns, so the pipeline is done."""
    def _submit(description, serial=None, name="Grace Wanjiru", email="grace@example.com", key=None):
        headers = {"Idempotency-Key": key} if key else {}
        r = client.post("/api/tickets", headers=headers, json={
            "customer_name": name, "customer_email": email, "description": description, "serial_number": serial})
        assert r.status_code == 202, r.text
        return r.json()

    return _submit


@pytest.fixture
def staff_ticket(client):
    def _get(ticket_id):
        r = client.get(f"/api/staff/tickets/{ticket_id}", headers=STAFF)
        assert r.status_code == 200, r.text
        return r.json()

    return _get

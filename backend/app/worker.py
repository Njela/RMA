"""Celery app: `process_ticket` (pipeline) and `sla_tick` (SLA scan + carrier sync, every 60s via beat).

    celery -A app.worker.celery_app worker -l info
    celery -A app.worker.celery_app beat -l info
"""
from celery import Celery
from sqlalchemy.exc import OperationalError

from .config import get_settings
from .db import SessionLocal
from .pipeline import sla
from .pipeline.orchestrator import run_pipeline_task

_s = get_settings()
celery_app = Celery("rma", broker=_s.redis_url, backend=_s.redis_url)
celery_app.conf.update(
    task_acks_late=True,                 # re-deliver if a worker dies mid-task
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    timezone="UTC",
    beat_schedule={"sla-tick": {"task": "rma.sla_tick", "schedule": 60.0}},
)


@celery_app.task(name="rma.process_ticket", autoretry_for=(OperationalError,), retry_backoff=True, max_retries=5)
def process_ticket_task(ticket_id: int) -> None:
    run_pipeline_task(ticket_id)  # idempotent, so redelivery is safe


@celery_app.task(name="rma.sla_tick")
def sla_tick_task() -> dict:
    with SessionLocal() as db:
        return sla.tick(db)

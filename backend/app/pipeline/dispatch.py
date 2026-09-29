"""Chooses HOW the pipeline runs: in-process background task (dev) or a Celery worker (production)."""
from fastapi import BackgroundTasks

from ..config import get_settings
from .orchestrator import run_pipeline_task


def enqueue(ticket_id: int, background: BackgroundTasks) -> None:
    if get_settings().pipeline_mode == "celery":
        from ..worker import process_ticket_task  # imported lazily: Celery is optional in dev
        process_ticket_task.delay(ticket_id)
    else:
        background.add_task(run_pipeline_task, ticket_id)

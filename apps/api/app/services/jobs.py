"""Background job runner.

Research runs, ingestion and exports are long enough that an HTTP request
should not hold them. Jobs are persisted rather than held in memory, so the UI
can poll a job across a restart and a failed run leaves a record with its error
rather than vanishing.

FastAPI's background tasks are the execution mechanism for the single-process
deployment. The `Job` row is the queue contract, so moving to a worker process
later means changing how a job is picked up, not how it is recorded.
"""

from __future__ import annotations

import logging
import traceback
from collections.abc import Callable
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.db.base import SessionLocal
from app.db.models import Job
from app.domain.enums import JobStatus

logger = logging.getLogger(__name__)

#: Registered job handlers, keyed by the `kind` stored on the row.
HANDLERS: dict[str, Callable[[Session, Job], dict]] = {}


def handler(kind: str):
    def decorate(func: Callable[[Session, Job], dict]):
        HANDLERS[kind] = func
        return func

    return decorate


def enqueue(session: Session, *, kind: str, project_id=None, payload: dict | None = None) -> Job:
    if kind not in HANDLERS:
        raise ValueError(f"No handler registered for job kind '{kind}'")
    job = Job(
        project_id=project_id,
        kind=kind,
        status=JobStatus.QUEUED,
        payload=payload or {},
        message="Queued.",
    )
    session.add(job)
    session.flush()
    return job


def execute(job_id) -> None:
    """Run a job in its own session.

    Called from a background task, so it owns its transaction: the request that
    enqueued the job has already committed and returned.
    """
    session = SessionLocal()
    try:
        job = session.get(Job, job_id)
        if job is None:
            logger.error("Job %s not found", job_id)
            return
        # The column is a String, so SQLAlchemy hands back a plain `str` rather
        # than the enum member. Coerce before comparing — an identity check here
        # silently skips every job.
        if JobStatus(job.status) is not JobStatus.QUEUED:
            logger.info("Job %s already %s; skipping", job.id, job.status)
            return

        job.status = JobStatus.RUNNING
        job.started_at = datetime.now(UTC)
        job.message = "Running."
        session.commit()

        try:
            result = HANDLERS[job.kind](session, job)
            job.status = JobStatus.SUCCEEDED
            job.result = result or {}
            job.message = "Complete."
        except Exception as exc:
            logger.exception("Job %s (%s) failed", job.id, job.kind)
            session.rollback()
            job = session.get(Job, job_id)
            job.status = JobStatus.FAILED
            job.error = f"{exc}\n\n{traceback.format_exc()}"[:8000]
            job.message = f"Failed: {exc}"[:1000]
        finally:
            job.finished_at = datetime.now(UTC)
            session.commit()
    finally:
        session.close()


def progress(session: Session, job: Job, message: str, **fields) -> None:
    job.message = message[:1000]
    entry = {"at": datetime.now(UTC).isoformat(), "message": message, **fields}
    job.progress = [*(job.progress or []), entry]
    session.flush()

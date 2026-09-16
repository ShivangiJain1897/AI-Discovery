"""Job status polling."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Job
from app.domain.api import JobOut
from app.domain.enums import JobStatus
from app.routers.deps import get_db

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: uuid.UUID, session: Session = Depends(get_db)) -> JobOut:
    job = session.get(Job, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Job {job_id} not found")
    return JobOut.model_validate(job)


@router.get("", response_model=list[JobOut])
def list_jobs(
    session: Session = Depends(get_db),
    project_id: uuid.UUID | None = Query(None),
    active_only: bool = Query(False),
    limit: int = Query(25, le=100),
) -> list[JobOut]:
    query = select(Job).order_by(Job.created_at.desc()).limit(limit)
    if project_id:
        query = query.where(Job.project_id == project_id)
    if active_only:
        query = query.where(Job.status.in_([JobStatus.QUEUED.value, JobStatus.RUNNING.value]))
    return [JobOut.model_validate(j) for j in session.execute(query).scalars().all()]

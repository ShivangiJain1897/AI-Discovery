"""Internal document upload and ingestion."""

from __future__ import annotations

import uuid

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Job, Project, UploadedDocument
from app.domain.api import UploadedDocumentOut
from app.routers.deps import get_db, get_project
from app.services import ingestion, jobs

router = APIRouter(prefix="/projects/{project_id}/uploads", tags=["uploads"])

MAX_BYTES = 40 * 1024 * 1024


@router.post("", response_model=UploadedDocumentOut, status_code=201)
async def upload_document(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    document_kind: str = Form("other"),
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
) -> UploadedDocumentOut:
    """Upload internal material.

    Parsed and scanned for identifiers synchronously so the response can tell
    the user what was detected; evidence extraction runs as a background job.
    """
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"File exceeds {MAX_BYTES // (1024 * 1024)}MB limit.",
        )

    try:
        document = ingestion.ingest(
            session,
            project,
            filename=file.filename or "upload",
            data=data,
            document_kind=document_kind,
        )
    except ingestion.UnsupportedDocument as exc:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, str(exc)) from exc

    job = jobs.enqueue(
        session,
        kind="ingest_document",
        project_id=project.id,
        payload={"document_id": str(document.id)},
    )
    session.commit()
    background.add_task(jobs.execute, job.id)
    return UploadedDocumentOut.model_validate(document)


@router.get("", response_model=list[UploadedDocumentOut])
def list_documents(
    project: Project = Depends(get_project), session: Session = Depends(get_db)
) -> list[UploadedDocumentOut]:
    rows = session.execute(
        select(UploadedDocument)
        .where(UploadedDocument.project_id == project.id)
        .order_by(UploadedDocument.created_at.desc())
    ).scalars().all()
    return [UploadedDocumentOut.model_validate(d) for d in rows]


@router.get("/kinds")
def list_document_kinds() -> list[dict]:
    return [
        {"value": kind, "label": kind.replace("_", " ").title(), "research_type": rt.value}
        for kind, rt in ingestion.DOCUMENT_KINDS.items()
    ]


@router.delete("/{document_id}", status_code=204, response_model=None)
def delete_document(
    document_id: uuid.UUID,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
) -> None:
    document = session.execute(
        select(UploadedDocument).where(
            UploadedDocument.id == document_id, UploadedDocument.project_id == project.id
        )
    ).scalar_one_or_none()
    if document is not None:
        session.delete(document)


@jobs.handler("ingest_document")
def _ingest_job(session: Session, job: Job) -> dict:
    project = session.get(Project, job.project_id)
    document = session.get(UploadedDocument, uuid.UUID(job.payload["document_id"]))
    jobs.progress(session, job, f"Extracting evidence from {document.filename}.")
    created = ingestion.extract_evidence(session, project, document)
    return {
        "document_ref": document.ref,
        "evidence": [e.ref for e in created],
        "phi_detected": document.phi_scan.get("found", False),
    }

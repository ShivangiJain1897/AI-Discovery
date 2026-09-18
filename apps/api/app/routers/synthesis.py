"""Synthesis and findings."""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Job, Project, Synthesis
from app.domain.api import (
    FindingOut,
    FindingsOut,
    InsightOut,
    JobOut,
    SynthesisOut,
    ThemeOut,
)
from app.domain.enums import ExportFormat
from app.exporters import builder, export_artifact
from app.orchestration import synthesis as synthesis_stage
from app.routers.deps import get_db, get_project
from app.services import jobs

router = APIRouter(prefix="/projects/{project_id}", tags=["synthesis"])


@router.post("/synthesis", response_model=JobOut, status_code=202)
def run_synthesis(
    background: BackgroundTasks,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
) -> JobOut:
    if not project.evidence:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "No evidence to synthesize. Run research or upload internal material first.",
        )
    job = jobs.enqueue(session, kind="synthesis", project_id=project.id)
    session.commit()
    background.add_task(jobs.execute, job.id)
    return JobOut.model_validate(job)


@router.get("/findings", response_model=FindingsOut)
def get_findings(
    project: Project = Depends(get_project), session: Session = Depends(get_db)
) -> FindingsOut:
    synthesis = _latest(session, project)
    return FindingsOut(
        synthesis=SynthesisOut.model_validate(synthesis) if synthesis else None,
        themes=[ThemeOut.model_validate(t) for t in sorted(project.themes, key=lambda t: t.ref)],
        findings=[
            FindingOut.model_validate(f) for f in sorted(project.findings, key=lambda f: f.ref)
        ],
        insights=[
            InsightOut.model_validate(i) for i in sorted(project.insights, key=lambda i: i.ref)
        ],
    )


@router.get("/synthesis", response_model=SynthesisOut)
def get_synthesis(
    project: Project = Depends(get_project), session: Session = Depends(get_db)
) -> SynthesisOut:
    synthesis = _latest(session, project)
    if synthesis is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No synthesis yet.")
    return SynthesisOut.model_validate(synthesis)


@router.get("/research-report")
def export_research_report(
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
    format: ExportFormat = Query(ExportFormat.DOCX),
) -> Response:
    synthesis = _latest(session, project)
    if synthesis is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No synthesis to export.")
    doc = builder.from_synthesis(session, project, synthesis)
    data, filename, media_type = export_artifact(doc, format.value)
    return Response(
        content=data,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@jobs.handler("synthesis")
def _synthesis_job(session: Session, job: Job) -> dict:
    project = session.get(Project, job.project_id)
    jobs.progress(session, job, "Clustering evidence into themes.")
    synthesis, runs = synthesis_stage.synthesize(session, project)
    jobs.progress(
        session, job,
        f"Synthesized {len(project.findings)} findings from {synthesis.evidence_examined} "
        "evidence items.",
    )
    return {
        "synthesis_id": str(synthesis.id),
        "synthesis_ref": synthesis.ref,
        "findings": len(project.findings),
        "insights": len(project.insights),
        "themes": len(project.themes),
        "stages": [r.as_dict() for r in runs],
    }


def _latest(session: Session, project: Project) -> Synthesis | None:
    return session.execute(
        select(Synthesis)
        .where(Synthesis.project_id == project.id)
        .order_by(Synthesis.version.desc())
    ).scalars().first()

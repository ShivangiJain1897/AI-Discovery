"""Artifact generation, versioning and export."""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Artifact, ArtifactVersion, Job, Project
from app.domain.api import (
    ArtifactDetail,
    ArtifactOut,
    ArtifactVersionOut,
    ExportRequest,
    GenerateArtifactRequest,
    JobOut,
    RegenerateSectionRequest,
)
from app.domain.enums import ArtifactType, Persona
from app.exporters import builder, export_artifact
from app.orchestration import artifacts as artifact_stage
from app.routers.deps import get_db, get_project
from app.services import artifact_templates, jobs

router = APIRouter(prefix="/projects/{project_id}/artifacts", tags=["artifacts"])


@router.get("/types")
def list_artifact_types() -> list[dict]:
    """What can be generated, and in what formats."""
    return [
        {
            "artifact_type": t.value,
            "label": t.label,
            "sections": artifact_templates.section_headings(t.value),
            "export_formats": artifact_templates.export_formats(t.value),
        }
        for t in ArtifactType
    ]


@router.post("", response_model=JobOut, status_code=202)
def generate_artifact(
    body: GenerateArtifactRequest,
    background: BackgroundTasks,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
) -> JobOut:
    if not project.evidence:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Artifacts are generated from project evidence. Run research first.",
        )
    job = jobs.enqueue(
        session,
        kind="artifact",
        project_id=project.id,
        payload={
            "artifact_type": body.artifact_type.value,
            "title": body.title,
            "persona": body.persona.value if body.persona else None,
            "evidence_refs": body.evidence_refs,
            "finding_refs": body.finding_refs,
            "analysis_refs": body.analysis_refs,
            "opportunity_refs": body.opportunity_refs,
            "use_case_refs": body.use_case_refs,
        },
    )
    session.commit()
    background.add_task(jobs.execute, job.id)
    return JobOut.model_validate(job)


@router.get("", response_model=list[ArtifactOut])
def list_artifacts(
    project: Project = Depends(get_project), session: Session = Depends(get_db)
) -> list[ArtifactOut]:
    rows = session.execute(
        select(Artifact)
        .where(Artifact.project_id == project.id)
        .order_by(Artifact.created_at.desc())
    ).scalars().all()
    return [ArtifactOut.model_validate(a) for a in rows]


@router.get("/{artifact_ref}", response_model=ArtifactDetail)
def get_artifact(
    artifact_ref: str,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
    version: int | None = Query(None),
) -> ArtifactDetail:
    artifact = _artifact(session, project, artifact_ref)
    row = _version(session, artifact, version)
    detail = ArtifactDetail.model_validate(artifact)
    detail.version = ArtifactVersionOut.model_validate(row) if row else None
    detail.export_formats = artifact_templates.export_formats(artifact.artifact_type)
    return detail


@router.get("/{artifact_ref}/versions", response_model=list[ArtifactVersionOut])
def list_versions(
    artifact_ref: str,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
) -> list[ArtifactVersionOut]:
    artifact = _artifact(session, project, artifact_ref)
    rows = session.execute(
        select(ArtifactVersion)
        .where(ArtifactVersion.artifact_id == artifact.id)
        .order_by(ArtifactVersion.version.desc())
    ).scalars().all()
    return [ArtifactVersionOut.model_validate(v) for v in rows]


@router.post("/{artifact_ref}/regenerate", response_model=JobOut, status_code=202)
def regenerate(
    artifact_ref: str,
    body: RegenerateSectionRequest,
    background: BackgroundTasks,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
) -> JobOut:
    """Regenerate one section, producing a new version of the document."""
    artifact = _artifact(session, project, artifact_ref)
    job = jobs.enqueue(
        session,
        kind="artifact_section",
        project_id=project.id,
        payload={
            "artifact_id": str(artifact.id),
            "heading": body.heading,
            "instruction": body.instruction,
        },
    )
    session.commit()
    background.add_task(jobs.execute, job.id)
    return JobOut.model_validate(job)


@router.post("/{artifact_ref}/export")
def export(
    artifact_ref: str,
    body: ExportRequest,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
) -> Response:
    artifact = _artifact(session, project, artifact_ref)
    row = _version(session, artifact, body.version)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No version to export.")

    doc = builder.from_artifact_version(session, project, artifact, row)
    try:
        data, filename, media_type = export_artifact(doc, body.format.value)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    return Response(
        content=data,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/{artifact_ref}", status_code=204, response_model=None)
def delete_artifact(
    artifact_ref: str,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
) -> None:
    session.delete(_artifact(session, project, artifact_ref))


# ── job handlers ─────────────────────────────────────────────


@jobs.handler("artifact")
def _artifact_job(session: Session, job: Job) -> dict:
    project = session.get(Project, job.project_id)
    payload = job.payload
    artifact_type = ArtifactType(payload["artifact_type"])
    jobs.progress(session, job, f"Generating {artifact_type.label} from project evidence.")

    selection = artifact_stage.ArtifactInputs(
        evidence_refs=payload.get("evidence_refs"),
        finding_refs=payload.get("finding_refs"),
        analysis_refs=payload.get("analysis_refs"),
        opportunity_refs=payload.get("opportunity_refs"),
        use_case_refs=payload.get("use_case_refs"),
    )
    artifact, version, _ = artifact_stage.generate(
        session,
        project,
        artifact_type,
        selection=selection,
        persona=Persona(payload["persona"]) if payload.get("persona") else None,
        title=payload.get("title"),
    )

    critique = version.critique or {}
    jobs.progress(
        session, job,
        "Quality check " + ("passed." if critique.get("passed") else
                            f"flagged {len(critique.get('issues', []))} issue(s)."),
    )
    return {
        "artifact_ref": artifact.ref,
        "version": version.version,
        "critique_passed": bool(critique.get("passed")),
        "issues": len(critique.get("issues", [])),
    }


@jobs.handler("artifact_section")
def _artifact_section_job(session: Session, job: Job) -> dict:
    import uuid as _uuid

    project = session.get(Project, job.project_id)
    artifact = session.get(Artifact, _uuid.UUID(job.payload["artifact_id"]))
    heading = job.payload["heading"]
    jobs.progress(session, job, f"Regenerating section: {heading}")

    version, _ = artifact_stage.regenerate_section(
        session, project, artifact, heading, instruction=job.payload.get("instruction", "")
    )
    return {"artifact_ref": artifact.ref, "version": version.version, "section": heading}


# ── helpers ──────────────────────────────────────────────────


def _artifact(session: Session, project: Project, ref: str) -> Artifact:
    artifact = session.execute(
        select(Artifact).where(Artifact.project_id == project.id, Artifact.ref == ref)
    ).scalar_one_or_none()
    if artifact is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Artifact {ref} not found")
    return artifact


def _version(session: Session, artifact: Artifact, version: int | None) -> ArtifactVersion | None:
    target = version or artifact.current_version
    return session.execute(
        select(ArtifactVersion).where(
            ArtifactVersion.artifact_id == artifact.id, ArtifactVersion.version == target
        )
    ).scalars().first()

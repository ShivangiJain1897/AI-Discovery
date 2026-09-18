"""Project lifecycle: create, read, context editing, coverage."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import (
    Analysis,
    Artifact,
    Evidence,
    Finding,
    Insight,
    Opportunity,
    Project,
    ProjectContext,
    Source,
    Synthesis,
    Theme,
    UploadedDocument,
    UseCase,
    Workspace,
)
from app.domain.api import (
    CoverageEntryOut,
    CreateProjectRequest,
    ProjectContextOut,
    ProjectCounts,
    ProjectDetail,
    ProjectSummary,
    UpdateContextRequest,
)
from app.orchestration import context as context_stage
from app.routers.deps import get_db, get_project, get_workspace
from app.services import coverage

router = APIRouter(prefix="/projects", tags=["projects"])


def _title_from(question: str) -> str:
    text = " ".join(question.split())
    return text if len(text) <= 90 else text[:87].rsplit(" ", 1)[0] + "…"


@router.post("", response_model=ProjectDetail, status_code=201)
def create_project(
    body: CreateProjectRequest,
    session: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
) -> ProjectDetail:
    project = Project(
        workspace_id=workspace.id,
        title=body.title or _title_from(body.question),
        question=body.question,
        persona=body.persona,
        ref_counters={},
    )
    session.add(project)
    session.flush()

    if body.normalize:
        context_stage.normalize(session, project)
        context_stage.clarify(session, project)
    else:
        session.add(ProjectContext(project_id=project.id, objective=body.question))
        session.flush()

    session.refresh(project)
    return _detail(session, project)


@router.get("", response_model=list[ProjectSummary])
def list_projects(
    session: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
    limit: int = Query(50, le=200),
) -> list[ProjectSummary]:
    rows = session.execute(
        select(Project)
        .where(Project.workspace_id == workspace.id)
        .order_by(Project.updated_at.desc())
        .limit(limit)
    ).scalars().all()
    return [ProjectSummary.model_validate(p) for p in rows]


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project_detail(
    project: Project = Depends(get_project), session: Session = Depends(get_db)
) -> ProjectDetail:
    return _detail(session, project)


@router.patch("/{project_id}/context", response_model=ProjectContextOut)
def update_context(
    body: UpdateContextRequest,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
) -> ProjectContextOut:
    ctx = project.context
    if ctx is None:
        ctx = ProjectContext(project_id=project.id)
        session.add(ctx)
        session.flush()
    edits = body.model_dump(exclude_none=True)
    context_stage.apply_edits(session, ctx, edits)
    return ProjectContextOut.model_validate(ctx)


@router.get("/{project_id}/coverage", response_model=list[CoverageEntryOut])
def get_coverage(
    project: Project = Depends(get_project), session: Session = Depends(get_db)
) -> list[CoverageEntryOut]:
    report = coverage.assess(session, project.id)
    coverage.persist(session, project.id, report)
    return [CoverageEntryOut(**entry.model_dump(mode="json")) for entry in report.entries]


@router.delete("/{project_id}", status_code=204, response_model=None)
def delete_project(
    project: Project = Depends(get_project), session: Session = Depends(get_db)
) -> None:
    session.delete(project)


# ── helpers ──────────────────────────────────────────────────


def _count(session: Session, model, project_id) -> int:
    return session.execute(
        select(func.count()).select_from(model).where(model.project_id == project_id)
    ).scalar_one()


def _detail(session: Session, project: Project) -> ProjectDetail:
    counts = ProjectCounts(
        sources=_count(session, Source, project.id),
        evidence=_count(session, Evidence, project.id),
        themes=_count(session, Theme, project.id),
        findings=_count(session, Finding, project.id),
        insights=_count(session, Insight, project.id),
        analyses=_count(session, Analysis, project.id),
        opportunities=_count(session, Opportunity, project.id),
        use_cases=_count(session, UseCase, project.id),
        artifacts=_count(session, Artifact, project.id),
        documents=_count(session, UploadedDocument, project.id),
    )

    synthesis = session.execute(
        select(Synthesis)
        .where(Synthesis.project_id == project.id)
        .order_by(Synthesis.version.desc())
    ).scalars().first()
    if synthesis:
        counts.open_questions = len(synthesis.evidence_gaps or []) + len(
            synthesis.primary_research_questions or []
        )

    report = coverage.assess(session, project.id)

    detail = ProjectDetail.model_validate(project)
    detail.context = (
        ProjectContextOut.model_validate(project.context) if project.context else None
    )
    detail.counts = counts
    detail.coverage = [CoverageEntryOut(**e.model_dump(mode="json")) for e in report.entries]
    detail.latest_synthesis_ref = synthesis.ref if synthesis else None
    detail.has_plan = bool(project.research_plans)
    return detail

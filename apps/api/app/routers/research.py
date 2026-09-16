"""Research planning and execution."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Job, Project, ResearchPlan, ResearchQuestion, ResearchRun
from app.domain.api import (
    AddQuestionRequest,
    JobOut,
    PlanResearchRequest,
    ResearchPlanOut,
    ResearchQuestionOut,
    ResearchRunOut,
    RunResearchRequest,
    UpdatePlanRequest,
    UpdateQuestionRequest,
)
from app.domain.enums import JobStatus, ResearchDepth
from app.orchestration import planner
from app.orchestration import research as research_stage
from app.routers.deps import get_db, get_project
from app.services import jobs, refs

router = APIRouter(prefix="/projects/{project_id}/research", tags=["research"])


@router.post("/plan", response_model=ResearchPlanOut, status_code=201)
def create_plan(
    body: PlanResearchRequest,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
) -> ResearchPlanOut:
    plan, _ = planner.plan_research(session, project, depth=body.depth)
    session.refresh(plan)
    return ResearchPlanOut.model_validate(plan)


@router.get("/plan", response_model=ResearchPlanOut)
def get_current_plan(
    project: Project = Depends(get_project), session: Session = Depends(get_db)
) -> ResearchPlanOut:
    plan = _latest_plan(session, project)
    return ResearchPlanOut.model_validate(plan)


@router.get("/plans", response_model=list[ResearchPlanOut])
def list_plans(
    project: Project = Depends(get_project), session: Session = Depends(get_db)
) -> list[ResearchPlanOut]:
    rows = session.execute(
        select(ResearchPlan)
        .where(ResearchPlan.project_id == project.id)
        .order_by(ResearchPlan.version.desc())
    ).scalars().all()
    return [ResearchPlanOut.model_validate(p) for p in rows]


@router.patch("/plan/{plan_id}", response_model=ResearchPlanOut)
def update_plan(
    plan_id: uuid.UUID,
    body: UpdatePlanRequest,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
) -> ResearchPlanOut:
    plan = _get_plan(session, project, plan_id)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(plan, field, value)
    session.flush()
    return ResearchPlanOut.model_validate(plan)


@router.post("/plan/{plan_id}/questions", response_model=ResearchQuestionOut, status_code=201)
def add_question(
    plan_id: uuid.UUID,
    body: AddQuestionRequest,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
) -> ResearchQuestionOut:
    plan = _get_plan(session, project, plan_id)
    question = ResearchQuestion(
        plan_id=plan.id,
        project_id=project.id,
        ref=refs.allocate_one(session, project.id, "research_question"),
        position=len(plan.questions),
        question=body.question,
        why=body.why,
        research_types=[t.value for t in body.research_types],
        expected_evidence=body.expected_evidence,
    )
    session.add(question)
    session.flush()
    return ResearchQuestionOut.model_validate(question)


@router.patch("/questions/{question_id}", response_model=ResearchQuestionOut)
def update_question(
    question_id: uuid.UUID,
    body: UpdateQuestionRequest,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
) -> ResearchQuestionOut:
    question = session.execute(
        select(ResearchQuestion).where(
            ResearchQuestion.id == question_id, ResearchQuestion.project_id == project.id
        )
    ).scalar_one_or_none()
    if question is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Research question not found")

    data = body.model_dump(exclude_none=True)
    if "research_types" in data:
        data["research_types"] = [t.value for t in body.research_types]
    for field, value in data.items():
        setattr(question, field, value)
    session.flush()
    return ResearchQuestionOut.model_validate(question)


@router.delete("/questions/{question_id}", status_code=204, response_model=None)
def delete_question(
    question_id: uuid.UUID,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
) -> None:
    question = session.execute(
        select(ResearchQuestion).where(
            ResearchQuestion.id == question_id, ResearchQuestion.project_id == project.id
        )
    ).scalar_one_or_none()
    if question is not None:
        session.delete(question)


@router.post("/run", response_model=JobOut, status_code=202)
def run_research(
    body: RunResearchRequest,
    background: BackgroundTasks,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
) -> JobOut:
    """Start a research run.

    Returns a job immediately; the run itself can take minutes. Progress is
    reported per research question on the run record.
    """
    plan = (
        _get_plan(session, project, body.plan_id)
        if body.plan_id
        else _latest_plan(session, project)
    )
    job = jobs.enqueue(
        session,
        kind="research_run",
        project_id=project.id,
        payload={
            "plan_id": str(plan.id),
            "depth": (body.depth or ResearchDepth(plan.depth)).value,
            "question_refs": body.question_refs,
        },
    )
    session.commit()
    background.add_task(jobs.execute, job.id)
    return JobOut.model_validate(job)


@router.get("/runs", response_model=list[ResearchRunOut])
def list_runs(
    project: Project = Depends(get_project), session: Session = Depends(get_db)
) -> list[ResearchRunOut]:
    rows = session.execute(
        select(ResearchRun)
        .where(ResearchRun.project_id == project.id)
        .order_by(ResearchRun.created_at.desc())
    ).scalars().all()
    return [ResearchRunOut.model_validate(r) for r in rows]


@router.get("/runs/{run_id}", response_model=ResearchRunOut)
def get_run(
    run_id: uuid.UUID,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
) -> ResearchRunOut:
    run = session.execute(
        select(ResearchRun).where(
            ResearchRun.id == run_id, ResearchRun.project_id == project.id
        )
    ).scalar_one_or_none()
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Research run not found")
    return ResearchRunOut.model_validate(run)


# ── job handler ──────────────────────────────────────────────


@jobs.handler("research_run")
def _run_research_job(session: Session, job: Job) -> dict:
    project = session.get(Project, job.project_id)
    plan = session.get(ResearchPlan, uuid.UUID(job.payload["plan_id"]))
    jobs.progress(session, job, "Starting research run.")

    run = research_stage.run_research(
        session,
        project,
        plan,
        depth=ResearchDepth(job.payload["depth"]),
        question_refs=job.payload.get("question_refs"),
    )
    jobs.progress(
        session, job,
        f"Examined {run.sources_examined} sources, extracted {run.evidence_extracted} "
        "evidence items.",
    )
    return {
        "run_id": str(run.id),
        "run_ref": run.ref,
        "status": run.status.value if isinstance(run.status, JobStatus) else str(run.status),
        "sources_examined": run.sources_examined,
        "evidence_extracted": run.evidence_extracted,
    }


# ── helpers ──────────────────────────────────────────────────


def _latest_plan(session: Session, project: Project) -> ResearchPlan:
    plan = session.execute(
        select(ResearchPlan)
        .where(ResearchPlan.project_id == project.id)
        .order_by(ResearchPlan.version.desc())
    ).scalars().first()
    if plan is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "No research plan yet. Create one first."
        )
    return plan


def _get_plan(session: Session, project: Project, plan_id) -> ResearchPlan:
    plan = session.execute(
        select(ResearchPlan).where(
            ResearchPlan.id == plan_id, ResearchPlan.project_id == project.id
        )
    ).scalar_one_or_none()
    if plan is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Research plan not found")
    return plan

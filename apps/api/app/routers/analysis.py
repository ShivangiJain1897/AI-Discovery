"""Analysis, opportunities, use cases, recommendations and prioritization."""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Analysis, Job, Opportunity, Project, Recommendation, UseCase
from app.domain.api import (
    AnalysisOut,
    AnalysisRecommendationOut,
    AnalysisRoutingOut,
    JobOut,
    OpportunityOut,
    PrioritizeRequest,
    RecommendationOut,
    RunAnalysisRequest,
    UpdateOpportunityRequest,
    UpdateRecommendationRequest,
    UseCaseOut,
)
from app.domain.enums import AnalysisType, ExportFormat, Persona, PrioritizationMethod
from app.exporters import builder, export_artifact
from app.orchestration import analysis as analysis_stage
from app.routers.deps import get_db, get_project
from app.services import jobs

router = APIRouter(prefix="/projects/{project_id}", tags=["analysis"])


@router.get("/analysis/recommended", response_model=AnalysisRoutingOut)
def recommended_analyses(
    project: Project = Depends(get_project), session: Session = Depends(get_db)
) -> AnalysisRoutingOut:
    """What to analyse next, plus the full catalog for manual selection."""
    available = [
        {"analysis_type": t.value, "label": t.label} for t in AnalysisType
    ]
    if not project.findings:
        return AnalysisRoutingOut(
            recommended=[],
            reasoning="No findings yet. Run synthesis before analysing.",
            available=available,
        )

    routing, _ = analysis_stage.recommend_analyses(session, project)
    return AnalysisRoutingOut(
        recommended=[
            AnalysisRecommendationOut(
                analysis_type=r.analysis_type,
                label=r.analysis_type.label,
                why=r.why,
                priority=r.priority,
            )
            for r in routing.recommended
        ],
        reasoning=routing.reasoning,
        available=available,
    )


@router.post("/analysis", response_model=JobOut, status_code=202)
def run_analyses(
    body: RunAnalysisRequest,
    background: BackgroundTasks,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
) -> JobOut:
    if not project.evidence:
        raise HTTPException(status.HTTP_409_CONFLICT, "No evidence to analyse.")
    job = jobs.enqueue(
        session,
        kind="analysis",
        project_id=project.id,
        payload={
            "analysis_types": [t.value for t in body.analysis_types],
            "persona": body.persona.value if body.persona else None,
            "parameters": body.parameters,
        },
    )
    session.commit()
    background.add_task(jobs.execute, job.id)
    return JobOut.model_validate(job)


@router.get("/analysis", response_model=list[AnalysisOut])
def list_analyses(
    project: Project = Depends(get_project), session: Session = Depends(get_db)
) -> list[AnalysisOut]:
    rows = session.execute(
        select(Analysis)
        .where(Analysis.project_id == project.id)
        .order_by(Analysis.created_at.desc())
    ).scalars().all()
    return [AnalysisOut.model_validate(a) for a in rows]


@router.get("/analysis/{analysis_ref}", response_model=AnalysisOut)
def get_analysis(
    analysis_ref: str,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
) -> AnalysisOut:
    return AnalysisOut.model_validate(_analysis(session, project, analysis_ref))


@router.get("/analysis/{analysis_ref}/export")
def export_analysis(
    analysis_ref: str,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
    format: ExportFormat = Query(ExportFormat.DOCX),
) -> Response:
    analysis = _analysis(session, project, analysis_ref)
    doc = builder.from_analysis(session, project, analysis)
    data, filename, media_type = export_artifact(doc, format.value)
    return Response(
        content=data,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/analysis/{analysis_ref}", status_code=204, response_model=None)
def delete_analysis(
    analysis_ref: str,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
) -> None:
    session.delete(_analysis(session, project, analysis_ref))


# ── opportunities ────────────────────────────────────────────


@router.post("/opportunities", response_model=JobOut, status_code=202)
def generate_opportunities(
    background: BackgroundTasks,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
    replace: bool = Query(False),
) -> JobOut:
    job = jobs.enqueue(
        session, kind="opportunities", project_id=project.id, payload={"replace": replace}
    )
    session.commit()
    background.add_task(jobs.execute, job.id)
    return JobOut.model_validate(job)


@router.get("/opportunities", response_model=list[OpportunityOut])
def list_opportunities(
    project: Project = Depends(get_project), session: Session = Depends(get_db)
) -> list[OpportunityOut]:
    rows = sorted(project.opportunities, key=lambda o: o.ref)
    return [OpportunityOut.model_validate(o) for o in rows]


@router.patch("/opportunities/{opportunity_ref}", response_model=OpportunityOut)
def update_opportunity(
    opportunity_ref: str,
    body: UpdateOpportunityRequest,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
) -> OpportunityOut:
    opportunity = session.execute(
        select(Opportunity).where(
            Opportunity.project_id == project.id, Opportunity.ref == opportunity_ref
        )
    ).scalar_one_or_none()
    if opportunity is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Opportunity {opportunity_ref} not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(opportunity, field, value)
    session.flush()
    return OpportunityOut.model_validate(opportunity)


@router.post("/prioritize", response_model=AnalysisOut, status_code=201)
def prioritize(
    body: PrioritizeRequest,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
) -> AnalysisOut:
    analysis, _ = analysis_stage.prioritize(
        session,
        project,
        method=PrioritizationMethod(body.method),
        weights=body.weights,
        target=body.target,
    )
    return AnalysisOut.model_validate(analysis)


# ── use cases ────────────────────────────────────────────────


@router.post("/use-cases", response_model=JobOut, status_code=202)
def generate_use_cases(
    background: BackgroundTasks,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
    count: int = Query(10, ge=1, le=40),
) -> JobOut:
    job = jobs.enqueue(
        session, kind="use_cases", project_id=project.id, payload={"count": count}
    )
    session.commit()
    background.add_task(jobs.execute, job.id)
    return JobOut.model_validate(job)


@router.get("/use-cases", response_model=list[UseCaseOut])
def list_use_cases(
    project: Project = Depends(get_project), session: Session = Depends(get_db)
) -> list[UseCaseOut]:
    rows = session.execute(
        select(UseCase).where(UseCase.project_id == project.id).order_by(UseCase.ref)
    ).scalars().all()
    return [UseCaseOut.model_validate(u) for u in rows]


# ── recommendations ──────────────────────────────────────────


@router.post("/recommendations", response_model=JobOut, status_code=202)
def generate_recommendations(
    background: BackgroundTasks,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
    persona: Persona | None = Query(None),
) -> JobOut:
    job = jobs.enqueue(
        session,
        kind="recommendations",
        project_id=project.id,
        payload={"persona": persona.value if persona else None},
    )
    session.commit()
    background.add_task(jobs.execute, job.id)
    return JobOut.model_validate(job)


@router.get("/recommendations", response_model=list[RecommendationOut])
def list_recommendations(
    project: Project = Depends(get_project), session: Session = Depends(get_db)
) -> list[RecommendationOut]:
    rows = session.execute(
        select(Recommendation)
        .where(Recommendation.project_id == project.id)
        .order_by(Recommendation.ref)
    ).scalars().all()
    return [RecommendationOut.model_validate(r) for r in rows]


@router.patch("/recommendations/{recommendation_ref}", response_model=RecommendationOut)
def update_recommendation(
    recommendation_ref: str,
    body: UpdateRecommendationRequest,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
) -> RecommendationOut:
    recommendation = session.execute(
        select(Recommendation).where(
            Recommendation.project_id == project.id, Recommendation.ref == recommendation_ref
        )
    ).scalar_one_or_none()
    if recommendation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Recommendation not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(recommendation, field, value)
    # A user edit wins: regeneration must not silently overwrite it.
    recommendation.user_edited = True
    session.flush()
    return RecommendationOut.model_validate(recommendation)


# ── job handlers ─────────────────────────────────────────────


@jobs.handler("analysis")
def _analysis_job(session: Session, job: Job) -> dict:
    project = session.get(Project, job.project_id)
    persona = Persona(job.payload["persona"]) if job.payload.get("persona") else None
    created = []
    for value in job.payload["analysis_types"]:
        analysis_type = AnalysisType(value)
        jobs.progress(session, job, f"Running {analysis_type.label}.")
        analysis, _ = analysis_stage.run_analysis(
            session, project, analysis_type,
            persona=persona, parameters=job.payload.get("parameters") or {},
        )
        created.append({"ref": analysis.ref, "type": analysis_type.value})
    return {"analyses": created}


@jobs.handler("opportunities")
def _opportunities_job(session: Session, job: Job) -> dict:
    project = session.get(Project, job.project_id)
    jobs.progress(session, job, "Identifying opportunities from findings.")
    created, _ = analysis_stage.generate_opportunities(
        session, project, replace=bool(job.payload.get("replace"))
    )
    return {"opportunities": [o.ref for o in created]}


@jobs.handler("use_cases")
def _use_cases_job(session: Session, job: Job) -> dict:
    project = session.get(Project, job.project_id)
    count = int(job.payload.get("count", 10))
    jobs.progress(session, job, f"Deriving up to {count} use cases.")
    created, _ = analysis_stage.generate_use_cases(session, project, count=count)
    return {"use_cases": [u.ref for u in created]}


@jobs.handler("recommendations")
def _recommendations_job(session: Session, job: Job) -> dict:
    project = session.get(Project, job.project_id)
    persona = Persona(job.payload["persona"]) if job.payload.get("persona") else None
    jobs.progress(session, job, "Generating recommendations.")
    created, _ = analysis_stage.generate_recommendations(session, project, persona=persona)
    return {"recommendations": [r.ref for r in created]}


def _analysis(session: Session, project: Project, ref: str) -> Analysis:
    analysis = session.execute(
        select(Analysis).where(Analysis.project_id == project.id, Analysis.ref == ref)
    ).scalar_one_or_none()
    if analysis is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Analysis {ref} not found")
    return analysis

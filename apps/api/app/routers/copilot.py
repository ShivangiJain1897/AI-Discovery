"""The project copilot endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db.models import Evidence, Project
from app.domain.api import CopilotRequest, CopilotResponse, EvidenceOut
from app.orchestration import copilot as copilot_stage
from app.routers.deps import get_db, get_project

router = APIRouter(prefix="/projects/{project_id}/copilot", tags=["copilot"])


@router.get("/suggestions")
def suggestions() -> list[str]:
    return copilot_stage.SUGGESTIONS


@router.post("", response_model=CopilotResponse)
def ask(
    body: CopilotRequest,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
) -> CopilotResponse:
    answer, _ = copilot_stage.ask(
        session, project, body.question, focus_refs=body.focus_refs
    )

    cited = []
    if answer.evidence_refs:
        cited = session.execute(
            select(Evidence)
            .options(joinedload(Evidence.source))
            .where(Evidence.project_id == project.id, Evidence.ref.in_(answer.evidence_refs))
            .order_by(Evidence.ref)
        ).unique().scalars().all()

    return CopilotResponse(
        answer=answer.answer,
        evidence_refs=answer.evidence_refs,
        knowledge_state=answer.knowledge_state,
        caveats=answer.caveats,
        suggested_actions=answer.suggested_actions,
        evidence=[EvidenceOut.model_validate(e) for e in cited],
    )

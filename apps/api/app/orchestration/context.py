"""Project context normalization and clarification."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models import Project, ProjectContext
from app.domain.contracts import ClarificationSet, NormalizedContext
from app.orchestration.agents import StageRun, run_stage
from app.orchestration.serializers import context_dict

#: Fields the user has edited are never re-inferred; their edit wins over any
#: later normalization pass.
_CONTEXT_FIELDS = (
    "objective", "decision", "domain", "subdomain", "product_type", "primary_user",
    "secondary_users", "geography", "organization_context", "discovery_stage", "constraints",
)


def normalize(
    session: Session, project: Project, *, known_context: dict | None = None
) -> tuple[ProjectContext, StageRun]:
    """Infer project framing from the user's question."""
    result, run = run_stage(
        "context_normalizer",
        {
            "question": project.question,
            "persona": project.persona,
            "known_context": known_context or {},
        },
        schema=NormalizedContext,
        fast=True,
    )

    ctx = project.context or ProjectContext(project_id=project.id)
    protected = set(ctx.user_edited_fields or [])

    for field in _CONTEXT_FIELDS:
        if field in protected:
            continue
        value = getattr(result, field, None)
        if value is not None:
            setattr(ctx, field, value)

    ctx.assumptions = [a.model_dump(mode="json") for a in result.assumptions]

    if ctx not in session:
        session.add(ctx)
    session.flush()
    return ctx, run


def clarify(session: Session, project: Project) -> tuple[ClarificationSet, StageRun]:
    """Ask at most three questions, and only when the answer changes the plan."""
    result, run = run_stage(
        "clarification_agent",
        {
            "question": project.question,
            "normalized_context": context_dict(project.context),
        },
        schema=ClarificationSet,
        fast=True,
    )
    if project.context is not None:
        project.context.clarifications = [q.model_dump(mode="json") for q in result.questions]
        session.flush()
    return result, run


def apply_edits(session: Session, ctx: ProjectContext, edits: dict) -> ProjectContext:
    """Apply user edits and mark those fields as no longer inferable."""
    edited = set(ctx.user_edited_fields or [])
    for field, value in edits.items():
        if field in _CONTEXT_FIELDS:
            setattr(ctx, field, value)
            edited.add(field)
    ctx.user_edited_fields = sorted(edited)
    session.flush()
    return ctx

"""The project copilot.

Answers questions against the project's own evidence, not against the model's
general knowledge. That constraint is the point: "what evidence supports this?"
must return this project's evidence, and "what don't we know?" must be answered
from the recorded gaps rather than improvised.
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Evidence, Project, Source, Synthesis
from app.domain.contracts import CopilotAnswer
from app.orchestration.agents import StageRun, run_stage
from app.orchestration.serializers import (
    analysis_dict,
    context_dict,
    evidence_dict,
    finding_dict,
    insight_dict,
    opportunity_dict,
)
from app.services import embeddings

logger = logging.getLogger(__name__)

#: Suggested prompts shown in the copilot panel. They map onto what the
#: evidence model can actually answer.
SUGGESTIONS = [
    "What evidence supports this?",
    "Find contradictions.",
    "What don't we know?",
    "Compare these competitors.",
    "Turn this into a use case.",
    "Challenge this recommendation.",
    "What primary research should I conduct?",
    "Generate interview questions.",
    "Create a PRD from these opportunities.",
]


def retrieve_evidence(
    session: Session, project: Project, question: str, *, limit: int = 24
) -> list[dict]:
    """Find the evidence most relevant to a question.

    Tries vector similarity first and falls back to keyword overlap, so the
    copilot still works when embeddings are unavailable.
    """
    try:
        provider = embeddings.get_embedding_provider()
        vector = provider.embed([question])[0]
        rows = session.execute(
            select(Evidence, Source)
            .join(Source, Evidence.source_id == Source.id)
            .where(Evidence.project_id == project.id, Evidence.embedding.is_not(None))
            .order_by(Evidence.embedding.cosine_distance(vector))
            .limit(limit)
        ).all()
        if rows:
            return [evidence_dict(e, s) for e, s in rows]
    except Exception as exc:
        logger.debug("Vector retrieval unavailable, falling back to keyword: %s", exc)

    rows = session.execute(
        select(Evidence, Source)
        .join(Source, Evidence.source_id == Source.id)
        .where(Evidence.project_id == project.id)
        .order_by(Evidence.ref)
    ).all()
    terms = {w.lower().strip(".,?!") for w in question.split() if len(w) > 4}
    scored = []
    for evidence, source in rows:
        haystack = f"{evidence.statement} {evidence.relevance} {evidence.excerpt}".lower()
        score = sum(1 for term in terms if term in haystack)
        if score:
            scored.append((score, evidence, source))
    scored.sort(key=lambda row: -row[0])
    if scored:
        return [evidence_dict(e, s) for _, e, s in scored[:limit]]

    return [evidence_dict(e, s) for e, s in rows[:limit]]


def ask(
    session: Session, project: Project, question: str, *, focus_refs: list[str] | None = None
) -> tuple[CopilotAnswer, StageRun]:
    """Answer a question from project context and evidence."""
    evidence = retrieve_evidence(session, project, question)
    if focus_refs:
        focused = [e for e in evidence if e["ref"] in set(focus_refs)]
        # Keep the focused items first without discarding surrounding context.
        evidence = focused + [e for e in evidence if e not in focused]

    synthesis = (
        session.execute(
            select(Synthesis)
            .where(Synthesis.project_id == project.id)
            .order_by(Synthesis.version.desc())
        )
        .scalars()
        .first()
    )

    return run_stage(
        "general_analysis",
        {
            "question": question,
            "evidence_items": evidence,
            "findings": [finding_dict(f) for f in project.findings],
            "insights": [insight_dict(i) for i in project.insights],
            "analyses": [analysis_dict(a) for a in project.analyses],
            "opportunities": [opportunity_dict(o) for o in project.opportunities],
            "contradictions": synthesis.contradictions if synthesis else [],
            "evidence_gaps": synthesis.evidence_gaps if synthesis else [],
            "normalized_context": context_dict(project.context),
            "persona": project.persona,
        },
        schema=CopilotAnswer,
        fast=True,
    )

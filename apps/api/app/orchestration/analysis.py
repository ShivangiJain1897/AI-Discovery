"""The analysis engine.

Research answers "what did we learn?". Analysis answers "what does this mean?".
They are separate actions in the product and separate stages here, sharing one
evidence base — which is what makes "research once, analyse many ways" real
rather than a slogan.
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    Analysis,
    Evidence,
    Opportunity,
    Project,
    Recommendation,
    Source,
    UseCase,
)
from app.domain.contracts import (
    AnalysisContract,
    AnalysisRouting,
    OpportunitySet,
    PrioritizationContract,
    RecommendationSet,
    UseCaseSet,
)
from app.domain.enums import (
    AnalysisType,
    OpportunityStatus,
    Persona,
    PrioritizationMethod,
    ProjectStatus,
)
from app.orchestration.agents import StageRun, run_stage
from app.orchestration.serializers import (
    analysis_dict,
    context_dict,
    evidence_dict,
    finding_dict,
    insight_dict,
    opportunity_dict,
)
from app.services import refs

logger = logging.getLogger(__name__)

#: Which prompt implements each analysis type. Types without a dedicated prompt
#: run through the general analysis sequence.
PROMPT_FOR_ANALYSIS: dict[AnalysisType, str] = {
    AnalysisType.GENERAL_SYNTHESIS: "general_analysis",
    AnalysisType.SWOT: "swot_analysis",
    AnalysisType.JTBD: "jtbd_analysis",
    AnalysisType.PAIN_POINT: "pain_point_analysis",
    AnalysisType.ROOT_CAUSE: "general_analysis",
    AnalysisType.COMPETITIVE_GAP: "competitive_analysis",
    AnalysisType.FEATURE: "feature_analysis",
    AnalysisType.USE_CASE: "use_case_analysis",
    AnalysisType.OPPORTUNITY: "opportunity_analysis",
    AnalysisType.WORKFLOW: "workflow_analysis",
    AnalysisType.REGULATORY_IMPACT: "regulatory_analysis",
    AnalysisType.TECHNICAL_FEASIBILITY: "technical_analysis",
    AnalysisType.BUILD_BUY_PARTNER: "technical_analysis",
    AnalysisType.PRIORITIZATION: "prioritization",
    AnalysisType.STRATEGIC_PORTFOLIO: "general_analysis",
}

ANALYSIS_CATALOG = {
    t.value: {"label": t.label, "prompt": PROMPT_FOR_ANALYSIS[t]} for t in AnalysisType
}


def _project_payload(session: Session, project: Project) -> dict:
    """The shared evidence context every analysis stage receives."""
    rows = session.execute(
        select(Evidence, Source)
        .join(Source, Evidence.source_id == Source.id)
        .where(Evidence.project_id == project.id)
        .order_by(Evidence.ref)
    ).all()
    synthesis = project_synthesis(session, project)
    return {
        "evidence_items": [evidence_dict(e, s) for e, s in rows],
        "findings": [finding_dict(f) for f in project.findings],
        "insights": [insight_dict(i) for i in project.insights],
        "contradictions": synthesis.contradictions if synthesis else [],
        "normalized_context": context_dict(project.context),
        "persona": project.persona,
    }


def project_synthesis(session: Session, project: Project):
    from app.db.models import Synthesis

    return session.execute(
        select(Synthesis)
        .where(Synthesis.project_id == project.id)
        .order_by(Synthesis.version.desc())
    ).scalars().first()


def recommend_analyses(session: Session, project: Project) -> tuple[AnalysisRouting, StageRun]:
    """Suggest which analyses this evidence base can actually support."""
    payload = _project_payload(session, project)
    return run_stage(
        "analysis_router",
        {
            "findings": payload["findings"],
            "themes": [
                {"name": t.name, "evidence_refs": t.evidence_refs} for t in project.themes
            ],
            "normalized_context": payload["normalized_context"],
            "persona": project.persona,
            "analysis_catalog": ANALYSIS_CATALOG,
            "evidence_items": payload["evidence_items"],
        },
        schema=AnalysisRouting,
        fast=True,
    )


def run_analysis(
    session: Session,
    project: Project,
    analysis_type: AnalysisType,
    *,
    persona: Persona | None = None,
    parameters: dict | None = None,
) -> tuple[Analysis, StageRun]:
    """Run one analysis over the project's evidence base."""
    payload = _project_payload(session, project)
    if persona:
        payload["persona"] = persona.value

    inputs = dict(payload)
    inputs["analysis_type"] = analysis_type.value
    if parameters:
        inputs.update(parameters)
    if analysis_type is AnalysisType.USE_CASE:
        inputs.setdefault("count", (parameters or {}).get("count", 10))
    if analysis_type is AnalysisType.OPPORTUNITY:
        inputs["opportunities"] = [opportunity_dict(o) for o in project.opportunities]

    result, run = run_stage(
        PROMPT_FOR_ANALYSIS[analysis_type],
        inputs,
        schema=AnalysisContract,
    )

    analysis = Analysis(
        project_id=project.id,
        ref=refs.allocate_one(session, project.id, "analysis"),
        analysis_type=analysis_type,
        title=result.title[:400] or analysis_type.label,
        summary=result.summary,
        sections=[s.model_dump(mode="json") for s in result.sections],
        evidence_refs=_known_refs(result.evidence_refs, payload["evidence_items"]),
        finding_refs=result.finding_refs,
        assumptions=result.assumptions,
        unknowns=result.unknowns,
        confidence=result.confidence,
        persona=persona or Persona(project.persona),
        parameters=parameters or {},
    )
    session.add(analysis)
    project.status = ProjectStatus.ACTIVE
    session.flush()

    if analysis_type is AnalysisType.USE_CASE:
        _persist_use_cases_from(session, project, analysis, payload)

    return analysis, run


def _known_refs(candidate_refs: list[str], evidence_items: list[dict]) -> list[str]:
    """Drop citations that do not resolve. A broken ref is worse than none."""
    known = {item["ref"] for item in evidence_items}
    return [ref for ref in candidate_refs if ref in known]


# ── opportunities ────────────────────────────────────────────


def generate_opportunities(
    session: Session, project: Project, *, replace: bool = False
) -> tuple[list[Opportunity], StageRun]:
    payload = _project_payload(session, project)
    result, run = run_stage(
        "opportunity_analysis", payload, schema=OpportunitySet
    )

    if replace:
        for existing in list(project.opportunities):
            session.delete(existing)
        session.flush()

    created: list[Opportunity] = []
    opportunity_refs = refs.allocate(
        session, project.id, "opportunity", len(result.opportunities)
    )
    known = {item["ref"] for item in payload["evidence_items"]}
    for contract, ref in zip(result.opportunities, opportunity_refs, strict=True):
        opportunity = Opportunity(
            project_id=project.id,
            ref=ref,
            title=contract.title[:400],
            problem=contract.problem,
            user=contract.user[:300],
            evidence_refs=[r for r in contract.evidence_refs if r in known],
            finding_refs=contract.finding_refs,
            insight=contract.insight,
            desired_outcome=contract.desired_outcome,
            solution_directions=contract.solution_directions,
            value_hypothesis=contract.value_hypothesis,
            business_value=contract.business_value,
            confidence=contract.confidence,
            assumptions=contract.assumptions,
            dependencies=contract.dependencies,
            risks=contract.risks,
            validation_plan=contract.validation_plan,
            status=OpportunityStatus.IDENTIFIED,
        )
        session.add(opportunity)
        created.append(opportunity)
    session.flush()
    return created, run


def generate_use_cases(
    session: Session, project: Project, *, count: int = 10
) -> tuple[list[UseCase], StageRun]:
    payload = _project_payload(session, project)
    payload["opportunities"] = [opportunity_dict(o) for o in project.opportunities]
    payload["count"] = count

    result, run = run_stage("use_case_analysis", payload, schema=UseCaseSet)
    created = _persist_use_cases(session, project, result, payload)
    return created, run


def _persist_use_cases(
    session: Session, project: Project, result: UseCaseSet, payload: dict, analysis_id=None
) -> list[UseCase]:
    known = {item["ref"] for item in payload["evidence_items"]}
    created: list[UseCase] = []
    use_case_refs = refs.allocate(session, project.id, "use_case", len(result.use_cases))
    for contract, ref in zip(result.use_cases, use_case_refs, strict=True):
        use_case = UseCase(
            project_id=project.id,
            analysis_id=analysis_id,
            ref=ref,
            title=contract.title[:400],
            actor=contract.actor[:200],
            problem=contract.problem,
            trigger=contract.trigger,
            context=contract.context,
            current_behavior=contract.current_behavior,
            desired_outcome=contract.desired_outcome,
            proposed_capability=contract.proposed_capability,
            user_value=contract.user_value,
            business_value=contract.business_value,
            evidence_refs=[r for r in contract.evidence_refs if r in known],
            evidence_strength=contract.evidence_strength,
            dependencies=contract.dependencies,
            risks=contract.risks,
            complexity=contract.complexity,
            success_metric=contract.success_metric,
        )
        session.add(use_case)
        created.append(use_case)
    session.flush()
    return created


def _persist_use_cases_from(
    session: Session, project: Project, analysis: Analysis, payload: dict
) -> None:
    """Turn a use case analysis into first-class UseCase rows.

    The catalog table in the analysis is what the user reads; these rows are
    what they can then select, prioritize and expand into a specification.
    """
    result, _ = run_stage(
        "use_case_analysis",
        {**payload, "count": 12},
        schema=UseCaseSet,
    )
    _persist_use_cases(session, project, result, payload, analysis_id=analysis.id)


# ── recommendations and prioritization ───────────────────────


def generate_recommendations(
    session: Session, project: Project, *, persona: Persona | None = None
) -> tuple[list[Recommendation], StageRun]:
    payload = _project_payload(session, project)
    if persona:
        payload["persona"] = persona.value
    payload["analyses"] = [analysis_dict(a) for a in project.analyses]
    payload["opportunities"] = [opportunity_dict(o) for o in project.opportunities]

    result, run = run_stage("recommendation_generator", payload, schema=RecommendationSet)

    known = {item["ref"] for item in payload["evidence_items"]}
    created: list[Recommendation] = []
    rec_refs = refs.allocate(session, project.id, "recommendation", len(result.recommendations))
    for contract, ref in zip(result.recommendations, rec_refs, strict=True):
        recommendation = Recommendation(
            project_id=project.id,
            ref=ref,
            recommendation=contract.recommendation,
            why=contract.why,
            evidence_refs=[r for r in contract.evidence_refs if r in known],
            finding_refs=contract.finding_refs,
            expected_value=contract.expected_value,
            who_benefits=contract.who_benefits,
            assumptions=contract.assumptions,
            risks=contract.risks,
            confidence=contract.confidence,
            what_would_change_it=contract.what_would_change_it,
            next_validation_step=contract.next_validation_step,
        )
        session.add(recommendation)
        created.append(recommendation)
    session.flush()
    return created, run


def prioritize(
    session: Session,
    project: Project,
    *,
    method: PrioritizationMethod,
    weights: dict[str, float] | None = None,
    target: str = "opportunities",
) -> tuple[Analysis, StageRun]:
    """Score and rank opportunities or use cases with a stated method."""
    if target == "use_cases":
        rows = session.execute(
            select(UseCase).where(UseCase.project_id == project.id)
        ).scalars().all()
        items = [{"ref": u.ref, "title": u.title, "evidence_refs": u.evidence_refs} for u in rows]
    else:
        items = [
            {"ref": o.ref, "title": o.title, "evidence_refs": o.evidence_refs}
            for o in project.opportunities
        ]

    payload = _project_payload(session, project)
    result, run = run_stage(
        "prioritization",
        {
            "items": items,
            "method": method.value,
            "weights": weights or {},
            "evidence_items": payload["evidence_items"],
        },
        schema=PrioritizationContract,
    )

    analysis = Analysis(
        project_id=project.id,
        ref=refs.allocate_one(session, project.id, "analysis"),
        analysis_type=AnalysisType.PRIORITIZATION,
        title=f"Prioritization — {method.value.upper()}",
        summary=result.notes,
        sections=[
            {
                "heading": f"Ranked {target.replace('_', ' ')}",
                "body": result.notes,
                "points": [],
                "columns": ["Rank", "Ref", "Title", "Total", "Assumptions"],
                "rows": [
                    {
                        "Rank": str(item.rank),
                        "Ref": item.item_ref,
                        "Title": item.title,
                        "Total": f"{item.total:.2f}",
                        "Assumptions": "; ".join(item.assumptions),
                    }
                    for item in sorted(result.items, key=lambda i: i.rank)
                ],
                "evidence_refs": [],
                "knowledge_state": "likely",
            }
        ],
        evidence_refs=[],
        finding_refs=[],
        assumptions=[a for item in result.items for a in item.assumptions],
        unknowns=[],
        persona=Persona(project.persona),
        parameters={"method": method.value, "weights": weights or {}, "target": target},
    )
    session.add(analysis)

    # Write scores back so the opportunity backlog can sort by them.
    if target != "use_cases":
        by_ref = {o.ref: o for o in project.opportunities}
        for item in result.items:
            opportunity = by_ref.get(item.item_ref)
            if opportunity is not None:
                opportunity.priority_scores = {
                    "method": method.value,
                    "total": item.total,
                    "rank": item.rank,
                    "scores": item.scores,
                    "assumptions": item.assumptions,
                }
    session.flush()
    return analysis, run

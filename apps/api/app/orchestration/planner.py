"""Research planning.

Produces the plan the user reviews and approves before anything runs. The plan
is editable — questions can be removed, sources added, queries rewritten —
because a researcher who cannot steer the research will not trust its output.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models import Project, ResearchPlan, ResearchQuestion
from app.domain.contracts import ResearchPlanContract
from app.domain.enums import ResearchDepth, ResearchType
from app.orchestration.agents import StageRun, run_stage
from app.orchestration.serializers import context_dict
from app.services import refs, source_registry

#: Given to the planner so it selects from the supported set rather than
#: inventing research types the rest of the system cannot route.
RESEARCH_TYPE_CATALOG = {
    ResearchType.MARKET.value: "Market structure, size, growth, segments, adoption, barriers.",
    ResearchType.COMPETITIVE.value: "Direct, indirect, adjacent and emerging competitors; substitutes.",
    ResearchType.VOICE_OF_CUSTOMER.value: "Support tickets, reviews, surveys, forums, complaints.",
    ResearchType.USER.value: "Behaviours, unmet needs, journeys, usability, primary research design.",
    ResearchType.PROBLEM_DOMAIN.value: "What the problem is, who has it, how often, what causes it.",
    ResearchType.REGULATORY.value: "Regulation, legislation, guidance, standards, privacy, accessibility.",
    ResearchType.TECHNOLOGY.value: "Technologies, APIs, architectures, standards, limits, security.",
    ResearchType.SCIENTIFIC_CLINICAL.value: "Published evidence, trials, endpoints, efficacy, safety.",
    ResearchType.BUSINESS_COMMERCIAL.value: "Business models, pricing, economics, buyers, willingness to pay.",
    ResearchType.WORKFLOW_OPERATIONAL.value: "Current workflow, handoffs, delays, failure points.",
    ResearchType.DATA.value: "Available datasets, quality, ownership, refresh, interoperability.",
    ResearchType.SOLUTION_VENDOR.value: "Vendor landscape, capability, maturity, build vs buy.",
}


def plan_research(
    session: Session,
    project: Project,
    *,
    depth: ResearchDepth = ResearchDepth.STANDARD,
    internal_material: str | None = None,
) -> tuple[ResearchPlan, StageRun]:
    """Generate a research plan and persist it with its questions."""
    ctx = context_dict(project.context)

    result, run = run_stage(
        "research_planner",
        {
            "normalized_context": ctx,
            "persona": project.persona,
            "depth": depth.value,
            "available_internal_material": internal_material,
            "research_type_catalog": RESEARCH_TYPE_CATALOG,
        },
        schema=ResearchPlanContract,
    )

    plan = _persist(session, project, result, depth)
    _enrich_sources(plan, ctx, result)
    session.flush()
    return plan, run


def _persist(
    session: Session, project: Project, result: ResearchPlanContract, depth: ResearchDepth
) -> ResearchPlan:
    version = len(project.research_plans) + 1
    plan = ResearchPlan(
        project_id=project.id,
        ref=refs.allocate_one(session, project.id, "research_plan"),
        version=version,
        objective=result.objective,
        decision_supported=result.decision_supported,
        depth=result.depth or depth,
        research_types=[t.value for t in result.research_types],
        planned_sources=[s.model_dump(mode="json") for s in result.planned_sources],
        primary_research_needed=[p.model_dump(mode="json") for p in result.primary_research_needed],
        anticipated_gaps=result.anticipated_gaps,
        out_of_scope=result.out_of_scope,
        human_readable_plan=result.human_readable_plan,
    )
    session.add(plan)
    session.flush()

    question_refs = refs.allocate(
        session, project.id, "research_question", len(result.research_questions)
    )
    for position, (spec, ref) in enumerate(zip(result.research_questions, question_refs, strict=True)):
        session.add(
            ResearchQuestion(
                plan_id=plan.id,
                project_id=project.id,
                ref=ref,
                position=position,
                question=spec.question,
                why=spec.why,
                research_types=[t.value for t in spec.research_types],
                expected_evidence=spec.expected_evidence,
                answerable_by_secondary=spec.answerable_by_secondary,
                queries=[q.model_dump(mode="json") for q in spec.queries],
            )
        )
    session.flush()
    return plan


def _enrich_sources(plan: ResearchPlan, ctx: dict, result: ResearchPlanContract) -> None:
    """Merge registry sources into the plan.

    The planner proposes sources; the registry contributes the authoritative
    ones it knows about for this domain and geography. The union is what the
    user reviews, so a model that forgot CMS for a Medicaid question does not
    quietly produce a weaker source set.
    """
    proposed = {s.get("name") for s in (plan.planned_sources or [])}
    registry_sources = source_registry.lookup(
        domain=ctx.get("domain"),
        research_types=list(result.research_types),
        geography=ctx.get("geography"),
        limit=14,
    )
    merged = list(plan.planned_sources or [])
    for source in registry_sources:
        if source.name in proposed:
            continue
        merged.append(
            {
                "name": source.name,
                "url": source.url,
                "source_type": source.source_type.value,
                "tier": source.tier.value,
                "why": source.why,
                "research_types": [t.value for t in source.research_types[:3]],
                "from_registry": True,
            }
        )
    # Authoritative sources first, so the review screen leads with them.
    merged.sort(key=lambda s: ({"tier_1_authoritative": 1, "tier_2_strong_secondary": 2,
                                "tier_3_market_user": 3, "tier_4_general_web": 4}
                               .get(s.get("tier", ""), 5), s.get("name", "")))
    plan.planned_sources = merged

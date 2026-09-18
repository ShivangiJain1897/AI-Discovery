"""ORM rows to the plain dictionaries stages consume.

Stages receive dictionaries rather than ORM objects for three reasons: the
payload is what gets serialized into the prompt, the deterministic provider
reads the same shape, and a stage cannot accidentally trigger lazy loading
mid-pipeline.
"""

from __future__ import annotations

from app.db.models import (
    Analysis,
    Evidence,
    Finding,
    Insight,
    Opportunity,
    ProjectContext,
    ResearchPlan,
    Source,
    Theme,
    UseCase,
)


def context_dict(ctx: ProjectContext | None) -> dict:
    if ctx is None:
        return {}
    return {
        "objective": ctx.objective,
        "decision": ctx.decision,
        "domain": ctx.domain,
        "subdomain": ctx.subdomain,
        "product_type": ctx.product_type,
        "primary_user": ctx.primary_user,
        "secondary_users": ctx.secondary_users or [],
        "geography": ctx.geography,
        "organization_context": ctx.organization_context,
        "discovery_stage": ctx.discovery_stage,
        "constraints": ctx.constraints or [],
        "assumptions": ctx.assumptions or [],
    }


def source_dict(source: Source) -> dict:
    return {
        "ref": source.ref,
        "title": source.title,
        "url": source.url,
        "publisher": source.publisher,
        "source_type": source.source_type,
        "tier": source.tier,
        "origin": source.origin,
        "publication_date": source.publication_date.isoformat() if source.publication_date else None,
        "geography": source.geography,
        "snippet": source.snippet,
        "raw_content": source.raw_content,
        "assessment": source.assessment,
    }


def evidence_dict(evidence: Evidence, source: Source | None = None) -> dict:
    src = source or evidence.source
    return {
        "ref": evidence.ref,
        "statement": evidence.statement,
        "excerpt": evidence.excerpt,
        "evidence_type": evidence.evidence_type,
        "origin": evidence.origin,
        "research_type": evidence.research_type,
        "population": evidence.population,
        "geography": evidence.geography,
        "period": evidence.period,
        "quantities": evidence.quantities or [],
        "limitations": evidence.limitations or [],
        "relevance": evidence.relevance,
        "strength": evidence.strength,
        "strength_reasoning": evidence.strength_reasoning,
        "corroboration_count": evidence.corroboration_count,
        "contradiction_flag": evidence.contradiction_flag,
        "theme_candidates": evidence.tags or [],
        "source_ref": src.ref if src else None,
        "source_title": src.title if src else None,
        "source_url": src.url if src else None,
        "publisher": src.publisher if src else None,
        "tier": src.tier if src else None,
        "publication_date": (
            src.publication_date.isoformat() if src and src.publication_date else None
        ),
    }


def theme_dict(theme: Theme) -> dict:
    return {
        "ref": theme.ref,
        "name": theme.name,
        "description": theme.description,
        "prevalence": theme.prevalence,
        "evidence_refs": theme.evidence_refs or [],
    }


def finding_dict(finding: Finding) -> dict:
    return {
        "ref": finding.ref,
        "title": finding.title,
        "finding": finding.finding,
        "evidence_refs": finding.evidence_refs or [],
        "affected_personas": finding.affected_personas or [],
        "themes": finding.themes or [],
        "prevalence": finding.prevalence,
        "why_it_matters": finding.why_it_matters,
        "confidence": finding.confidence,
        "knowledge_state": finding.knowledge_state,
        "limitations": finding.limitations or [],
    }


def insight_dict(insight: Insight) -> dict:
    return {
        "ref": insight.ref,
        "title": insight.title,
        "insight": insight.insight,
        "finding_refs": insight.finding_refs or [],
        "why_it_matters": insight.why_it_matters,
        "product_implication": insight.product_implication,
        "confidence": insight.confidence,
        "knowledge_state": insight.knowledge_state,
    }


def analysis_dict(analysis: Analysis) -> dict:
    return {
        "ref": analysis.ref,
        "analysis_type": analysis.analysis_type,
        "title": analysis.title,
        "summary": analysis.summary,
        "sections": analysis.sections or [],
        "evidence_refs": analysis.evidence_refs or [],
        "finding_refs": analysis.finding_refs or [],
        "assumptions": analysis.assumptions or [],
        "unknowns": analysis.unknowns or [],
        "confidence": analysis.confidence,
    }


def opportunity_dict(opportunity: Opportunity) -> dict:
    return {
        "ref": opportunity.ref,
        "title": opportunity.title,
        "problem": opportunity.problem,
        "user": opportunity.user,
        "evidence_refs": opportunity.evidence_refs or [],
        "finding_refs": opportunity.finding_refs or [],
        "insight": opportunity.insight,
        "desired_outcome": opportunity.desired_outcome,
        "solution_directions": opportunity.solution_directions or [],
        "value_hypothesis": opportunity.value_hypothesis,
        "business_value": opportunity.business_value,
        "confidence": opportunity.confidence,
        "assumptions": opportunity.assumptions or [],
        "dependencies": opportunity.dependencies or [],
        "risks": opportunity.risks or [],
        "validation_plan": opportunity.validation_plan or [],
        "status": opportunity.status,
    }


def use_case_dict(use_case: UseCase) -> dict:
    return {
        "ref": use_case.ref,
        "title": use_case.title,
        "actor": use_case.actor,
        "problem": use_case.problem,
        "trigger": use_case.trigger,
        "context": use_case.context,
        "current_behavior": use_case.current_behavior,
        "desired_outcome": use_case.desired_outcome,
        "proposed_capability": use_case.proposed_capability,
        "user_value": use_case.user_value,
        "business_value": use_case.business_value,
        "evidence_refs": use_case.evidence_refs or [],
        "evidence_strength": use_case.evidence_strength,
        "dependencies": use_case.dependencies or [],
        "risks": use_case.risks or [],
        "complexity": use_case.complexity,
        "success_metric": use_case.success_metric,
        "status": use_case.status,
    }


def plan_dict(plan: ResearchPlan) -> dict:
    return {
        "ref": plan.ref,
        "objective": plan.objective,
        "decision_supported": plan.decision_supported,
        "depth": plan.depth,
        "research_types": plan.research_types or [],
        "planned_sources": plan.planned_sources or [],
        "primary_research_needed": plan.primary_research_needed or [],
        "anticipated_gaps": plan.anticipated_gaps or [],
        "out_of_scope": plan.out_of_scope or [],
        "human_readable_plan": plan.human_readable_plan,
        "research_questions": [
            {
                "ref": q.ref,
                "question": q.question,
                "why": q.why,
                "research_types": q.research_types or [],
                "expected_evidence": q.expected_evidence,
                "answerable_by_secondary": q.answerable_by_secondary,
                "queries": q.queries or [],
                "enabled": q.enabled,
                "status": q.status,
                "evidence_count": q.evidence_count,
            }
            for q in plan.questions
        ],
    }

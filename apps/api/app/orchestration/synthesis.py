"""Synthesis: evidence to themes, findings and insights.

Clustering runs as its own stage before synthesis so the synthesizer receives
groups rather than a flat list — which is what stops it from summarizing source
by source, the failure mode this stage exists to avoid.
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Evidence, Finding, Insight, Project, Source, Synthesis, Theme
from app.domain.contracts import SynthesisContract, ThemeSet
from app.domain.enums import ProjectStatus
from app.orchestration.agents import StageRun, run_stage
from app.orchestration.serializers import context_dict, evidence_dict, plan_dict, theme_dict
from app.services import coverage, refs

logger = logging.getLogger(__name__)


def synthesize(session: Session, project: Project) -> tuple[Synthesis, list[StageRun]]:
    """Cluster evidence, then derive findings and insights across sources."""
    rows = session.execute(
        select(Evidence, Source)
        .join(Source, Evidence.source_id == Source.id)
        .where(Evidence.project_id == project.id)
        .order_by(Evidence.ref)
    ).all()
    if not rows:
        raise ValueError("No evidence to synthesize. Run research first.")

    evidence_payload = [evidence_dict(e, s) for e, s in rows]
    ctx = context_dict(project.context)
    plan = project.research_plans[-1] if project.research_plans else None
    runs: list[StageRun] = []

    # 1. Cluster
    theme_set, cluster_run = run_stage(
        "theme_clusterer",
        {
            "evidence_items": evidence_payload,
            "research_question": ctx.get("objective") or project.question,
        },
        schema=ThemeSet,
    )
    runs.append(cluster_run)
    themes = _persist_themes(session, project, theme_set)

    # 2. Synthesize across clusters
    result, synth_run = run_stage(
        "research_synthesizer",
        {
            "evidence_items": evidence_payload,
            "themes": [theme_dict(t) for t in themes],
            "research_plan": plan_dict(plan) if plan else {},
            "persona": project.persona,
        },
        schema=SynthesisContract,
    )
    runs.append(synth_run)

    synthesis = _persist_synthesis(session, project, result, len(rows))
    _persist_findings(session, project, synthesis, result)

    project.status = ProjectStatus.SYNTHESIZED
    session.flush()

    report = coverage.assess(session, project.id)
    coverage.persist(session, project.id, report)
    session.flush()
    return synthesis, runs


def _persist_themes(session: Session, project: Project, theme_set: ThemeSet) -> list[Theme]:
    """Replace the theme set and re-point evidence at its theme."""
    for existing in list(project.themes):
        session.delete(existing)
    session.flush()

    by_ref = {
        e.ref: e
        for e in session.execute(
            select(Evidence).where(Evidence.project_id == project.id)
        ).scalars()
    }
    for evidence in by_ref.values():
        evidence.theme_id = None

    themes: list[Theme] = []
    theme_refs = refs.allocate(session, project.id, "theme", len(theme_set.themes))
    for contract, ref in zip(theme_set.themes, theme_refs, strict=True):
        theme = Theme(
            project_id=project.id,
            ref=ref,
            name=contract.name[:300],
            description=contract.description,
            prevalence=contract.prevalence,
            evidence_refs=contract.evidence_refs,
        )
        session.add(theme)
        session.flush()
        for evidence_ref in contract.evidence_refs:
            evidence = by_ref.get(evidence_ref)
            if evidence is not None and evidence.theme_id is None:
                evidence.theme_id = theme.id
        themes.append(theme)

    session.flush()
    return themes


def _persist_synthesis(
    session: Session, project: Project, result: SynthesisContract, evidence_count: int
) -> Synthesis:
    version = (
        session.execute(
            select(Synthesis).where(Synthesis.project_id == project.id)
        ).scalars().all()
    )
    synthesis = Synthesis(
        project_id=project.id,
        ref=refs.allocate_one(session, project.id, "synthesis"),
        version=len(version) + 1,
        executive_summary=result.executive_summary,
        research_objective=result.research_objective,
        research_approach=result.research_approach,
        sources_examined=result.sources_examined,
        evidence_examined=evidence_count,
        contradictions=[c.model_dump(mode="json") for c in result.contradictions],
        evidence_gaps=[g.model_dump(mode="json") for g in result.evidence_gaps],
        emerging_opportunities=result.emerging_opportunities,
        primary_research_questions=result.primary_research_questions,
        next_steps=result.next_steps,
    )
    session.add(synthesis)
    session.flush()
    return synthesis


def _persist_findings(
    session: Session, project: Project, synthesis: Synthesis, result: SynthesisContract
) -> None:
    """Replace findings and insights, preserving the finding-ref links."""
    for existing in list(project.findings):
        session.delete(existing)
    for existing in list(project.insights):
        session.delete(existing)
    session.flush()

    finding_refs = refs.allocate(session, project.id, "finding", len(result.findings))
    # Findings are emitted in order, so the synthesizer's positional references
    # ("the second finding") map onto allocated refs deterministically.
    index_to_ref: dict[int, str] = {}
    title_to_ref: dict[str, str] = {}

    for index, (contract, ref) in enumerate(zip(result.findings, finding_refs, strict=True)):
        session.add(
            Finding(
                project_id=project.id,
                synthesis_id=synthesis.id,
                ref=ref,
                title=contract.title[:400],
                finding=contract.finding,
                evidence_refs=contract.evidence_refs,
                affected_personas=contract.affected_personas,
                themes=contract.themes,
                prevalence=contract.prevalence,
                why_it_matters=contract.why_it_matters,
                confidence=contract.confidence,
                knowledge_state=contract.knowledge_state,
                limitations=contract.limitations,
            )
        )
        index_to_ref[index] = ref
        title_to_ref[contract.title.strip().lower()] = ref

    insight_refs = refs.allocate(session, project.id, "insight", len(result.insights))
    for contract, ref in zip(result.insights, insight_refs, strict=True):
        session.add(
            Insight(
                project_id=project.id,
                synthesis_id=synthesis.id,
                ref=ref,
                title=contract.title[:400],
                insight=contract.insight,
                finding_refs=_resolve_finding_refs(
                    contract.finding_refs, index_to_ref, title_to_ref
                ),
                why_it_matters=contract.why_it_matters,
                product_implication=contract.product_implication,
                confidence=contract.confidence,
                knowledge_state=contract.knowledge_state,
            )
        )
    session.flush()


def _resolve_finding_refs(
    raw_refs: list[str], index_to_ref: dict[int, str], title_to_ref: dict[str, str]
) -> list[str]:
    """Map a stage's finding references onto the refs actually allocated.

    A stage may return a real ref, a positional index, or a finding title. All
    three are resolved here so an insight never ends up pointing at nothing.
    """
    resolved: list[str] = []
    known = set(index_to_ref.values())
    for raw in raw_refs:
        text = str(raw).strip()
        if text in known:
            resolved.append(text)
            continue
        if text.lower() in title_to_ref:
            resolved.append(title_to_ref[text.lower()])
            continue
        digits = "".join(c for c in text if c.isdigit())
        if digits:
            # Accept both "F-002" style and bare positional indices.
            candidate = index_to_ref.get(int(digits) - 1)
            if candidate:
                resolved.append(candidate)
                continue
        logger.debug("Unresolvable finding reference dropped: %r", raw)
    return resolved

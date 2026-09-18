"""Research execution: retrieval, tiering, evidence extraction and critique.

Progress is recorded per research question and per source, not as an
indeterminate spinner, because the user needs to see which question is being
answered and by what — and to notice when a question returns nothing.
"""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import Evidence, Project, ResearchPlan, ResearchQuestion, ResearchRun, Source
from app.domain.contracts import EvidenceCritiqueSet, EvidenceExtraction
from app.domain.enums import (
    EvidenceOrigin,
    EvidenceStrength,
    EvidenceType,
    JobStatus,
    ResearchDepth,
    ResearchType,
    SourceTier,
)
from app.orchestration.agents import run_stage
from app.orchestration.serializers import context_dict, evidence_dict, source_dict
from app.search import get_search_provider
from app.services import coverage, embeddings, refs, source_registry

logger = logging.getLogger(__name__)

#: How many sources each depth setting is willing to examine per question.
_SOURCES_PER_QUESTION = {
    ResearchDepth.QUICK_SCAN: 4,
    ResearchDepth.STANDARD: 8,
    ResearchDepth.DEEP: 14,
}


class ProgressReporter:
    """Accumulates per-question progress onto the run row."""

    def __init__(self, session: Session, run: ResearchRun) -> None:
        self.session = session
        self.run = run
        self._entries: dict[str, dict] = {}

    def start(self, question: ResearchQuestion) -> None:
        self._entries[question.ref] = {
            "ref": question.ref,
            "question": question.question,
            "status": "running",
            "queries_run": 0,
            "sources_found": 0,
            "sources_examined": 0,
            "evidence_extracted": 0,
            "notes": [],
        }
        self._flush()

    def update(self, ref: str, **fields) -> None:
        entry = self._entries.setdefault(ref, {"ref": ref})
        for key, value in fields.items():
            if key == "note":
                entry.setdefault("notes", []).append(value)
            else:
                entry[key] = value
        self._flush()

    def finish(self, ref: str, status: str = "complete") -> None:
        self.update(ref, status=status)

    def _flush(self) -> None:
        self.run.progress = list(self._entries.values())
        self.session.flush()


def run_research(
    session: Session,
    project: Project,
    plan: ResearchPlan,
    *,
    depth: ResearchDepth | None = None,
    question_refs: list[str] | None = None,
) -> ResearchRun:
    """Execute a research plan and populate the project's evidence library."""
    depth = depth or ResearchDepth(plan.depth)
    run = ResearchRun(
        project_id=project.id,
        plan_id=plan.id,
        ref=refs.allocate_one(session, project.id, "research_run"),
        status=JobStatus.RUNNING,
        depth=depth,
        research_types=plan.research_types or [],
        started_at=datetime.now(UTC),
    )
    session.add(run)
    session.flush()

    reporter = ProgressReporter(session, run)
    ctx = context_dict(project.context)
    search = get_search_provider()
    per_question = _SOURCES_PER_QUESTION[depth]

    questions = [q for q in plan.questions if q.enabled]
    if question_refs:
        questions = [q for q in questions if q.ref in question_refs]

    seen_urls = _existing_urls(session, project.id)
    total_sources = 0
    total_evidence = 0

    try:
        for question in questions:
            reporter.start(question)
            question.status = "running"
            session.flush()

            results = _retrieve(search, question, ctx, per_question, reporter)
            fresh = [r for r in results if r.url not in seen_urls]
            reporter.update(question.ref, sources_found=len(results))

            if not fresh:
                reporter.update(
                    question.ref,
                    note="No new sources for this question."
                    if results
                    else "No results returned for any query on this question.",
                )

            extracted_here = 0
            for result in fresh[:per_question]:
                seen_urls.add(result.url)
                source = _persist_source(session, project, run, question, result)
                total_sources += 1
                reporter.update(question.ref, sources_examined=total_sources)

                count = _extract_evidence(session, project, run, question, source, ctx)
                extracted_here += count
                total_evidence += count
                reporter.update(question.ref, evidence_extracted=extracted_here)

            question.evidence_count = extracted_here
            question.status = "complete" if extracted_here else "no_evidence"
            if not extracted_here:
                reporter.update(
                    question.ref, note="Sources examined but no relevant evidence extracted."
                )
            reporter.finish(question.ref, question.status)
            session.flush()

        _critique_evidence(session, project)
        _embed_new_evidence(session, project)

        run.status = JobStatus.SUCCEEDED
        run.sources_examined = total_sources
        run.evidence_extracted = total_evidence
        run.completed_at = datetime.now(UTC)
        run.provider_meta = {
            "search_provider": search.name,
            "depth": depth.value,
            "questions_run": len(questions),
        }
    except Exception as exc:
        logger.exception("Research run %s failed", run.ref)
        run.status = JobStatus.FAILED
        run.error = str(exc)[:2000]
        run.completed_at = datetime.now(UTC)
        session.flush()
        raise
    finally:
        session.flush()

    report = coverage.assess(session, project.id)
    coverage.persist(session, project.id, report)
    session.flush()
    return run


# ── retrieval ────────────────────────────────────────────────


def _existing_urls(session: Session, project_id) -> set[str]:
    return {
        url
        for (url,) in session.execute(
            select(Source.url).where(Source.project_id == project_id, Source.url.is_not(None))
        )
    }


def _retrieve(search, question: ResearchQuestion, ctx: dict, limit: int, reporter) -> list:
    """Run every query on a question and return deduplicated results."""
    queries = question.queries or []
    if not queries:
        queries = [
            {
                "query": question.question,
                "research_type": (question.research_types or [ResearchType.MARKET.value])[0],
                "preferred_domains": [],
            }
        ]

    registry_domains = source_registry.search_domains_for(
        source_registry.lookup(
            domain=ctx.get("domain"),
            research_types=[ResearchType(t) for t in (question.research_types or [])],
            geography=ctx.get("geography"),
            limit=6,
        )
    )

    collected: dict[str, object] = {}
    for index, query in enumerate(queries):
        text = query.get("query") if isinstance(query, dict) else str(query)
        if not text:
            continue
        domains = (query.get("preferred_domains") if isinstance(query, dict) else None) or []
        # The first query is aimed at authoritative sources; later ones run
        # open so user-language evidence is not filtered out.
        if not domains and index == 0:
            domains = registry_domains[:4]

        try:
            results = search.search(
                text,
                limit=settings.search_results_per_query,
                include_domains=domains or None,
            )
        except Exception as exc:
            logger.warning("Query failed (%s): %s", text, exc)
            reporter.update(question.ref, note=f"Query failed: {text[:80]}")
            continue

        reporter.update(question.ref, queries_run=index + 1)
        for result in results:
            if result.url and result.url not in collected:
                collected[result.url] = result

    ranked = sorted(collected.values(), key=lambda r: -r.score)
    return ranked[: limit * 2]


def _persist_source(
    session: Session, project: Project, run: ResearchRun, question: ResearchQuestion, result
) -> Source:
    source_type, tier = source_registry.classify_url(result.url, result.title)
    research_types = question.research_types or [ResearchType.MARKET.value]
    source = Source(
        project_id=project.id,
        run_id=run.id,
        ref=refs.allocate_one(session, project.id, "source"),
        title=result.title[:500],
        url=result.url,
        publisher=result.publisher[:300] if result.publisher else None,
        source_type=source_type,
        tier=tier,
        origin=EvidenceOrigin.EXTERNAL,
        publication_date=result.published,
        date_accessed=date.today(),
        geography=project.context.geography if project.context else None,
        research_types=research_types,
        snippet=result.snippet[:4000] if result.snippet else None,
        raw_content=result.content[:60000] if result.content else None,
        relevance_score=result.score,
    )
    session.add(source)
    session.flush()
    return source


# ── extraction ───────────────────────────────────────────────


def _extract_evidence(
    session: Session,
    project: Project,
    run: ResearchRun,
    question: ResearchQuestion,
    source: Source,
    ctx: dict,
) -> int:
    research_type = ResearchType(
        (question.research_types or [ResearchType.MARKET.value])[0]
    )

    extraction, _ = run_stage(
        "evidence_extractor",
        {
            "source": source_dict(source),
            "research_question": question.question,
            "research_type": research_type.value,
            "normalized_context": ctx,
        },
        schema=EvidenceExtraction,
    )

    source.assessment = extraction.source_assessment or None
    if extraction.not_relevant or not extraction.items:
        session.flush()
        return 0

    items = extraction.items[: settings.max_evidence_per_source]
    evidence_refs = refs.allocate(session, project.id, "evidence", len(items))

    for item, ref in zip(items, evidence_refs, strict=True):
        session.add(
            Evidence(
                project_id=project.id,
                source_id=source.id,
                run_id=run.id,
                ref=ref,
                research_type=research_type,
                statement=item.statement,
                excerpt=item.excerpt,
                evidence_type=item.evidence_type,
                origin=EvidenceOrigin.EXTERNAL,
                population=item.population,
                geography=item.geography or source.geography,
                period=item.period,
                quantities=item.quantities,
                tags=item.theme_candidates,
                relevance=item.relevance,
                limitations=item.limitations,
                # Provisional: the critic sets the real strength once the whole
                # library is visible and corroboration can be counted.
                strength=_provisional_strength(source.tier, item.evidence_type),
                strength_reasoning="Provisional, pending evidence critique.",
            )
        )
    session.flush()
    return len(items)


def _provisional_strength(tier: SourceTier, evidence_type: EvidenceType) -> EvidenceStrength:
    if evidence_type in (EvidenceType.OPINION, EvidenceType.INFERENCE):
        return EvidenceStrength.ANECDOTAL
    return {
        SourceTier.TIER_1_AUTHORITATIVE: EvidenceStrength.STRONG,
        SourceTier.TIER_2_STRONG_SECONDARY: EvidenceStrength.MODERATE,
        SourceTier.TIER_3_MARKET_USER: EvidenceStrength.DIRECTIONAL,
        SourceTier.TIER_4_GENERAL_WEB: EvidenceStrength.ANECDOTAL,
    }[tier]


# ── critique ─────────────────────────────────────────────────


def _critique_evidence(session: Session, project: Project) -> None:
    """Assign final strength, corroboration and contradiction flags.

    Runs across the whole library rather than per source, because corroboration
    is by definition a property of the set.
    """
    rows = session.execute(
        select(Evidence, Source)
        .join(Source, Evidence.source_id == Source.id)
        .where(Evidence.project_id == project.id)
    ).all()
    if not rows:
        return

    payload = [evidence_dict(e, s) for e, s in rows]
    critiques, _ = run_stage(
        "evidence_deduplicator",
        {"evidence_items": payload},
        schema=EvidenceCritiqueSet,
    )

    by_ref = {e.ref: e for e, _ in rows}
    for critique in critiques.critiques:
        evidence = by_ref.get(critique.evidence_ref)
        if evidence is None:
            continue
        evidence.strength = critique.strength
        evidence.strength_reasoning = critique.reasoning
        evidence.corroborated_by = critique.corroborated_by
        evidence.corroboration_count = len(critique.corroborated_by)
        evidence.contradicted_by = critique.contradicted_by
        evidence.contradiction_flag = bool(critique.contradicted_by)
        evidence.population_note = critique.population_note
        if critique.should_discard:
            evidence.notes = f"Flagged as duplicate: {critique.discard_reason or 'unspecified'}"
    session.flush()


def _embed_new_evidence(session: Session, project: Project) -> None:
    """Embed evidence that has no vector yet, for semantic retrieval."""
    pending = list(
        session.execute(
            select(Evidence).where(
                Evidence.project_id == project.id, Evidence.embedding.is_(None)
            )
        ).scalars()
    )
    if not pending:
        return

    provider = embeddings.get_embedding_provider()
    texts = [f"{e.statement} {e.relevance}".strip() for e in pending]
    try:
        vectors = provider.embed(texts)
    except Exception as exc:
        # Embedding is an enhancement; research must not fail without it.
        logger.warning("Embedding failed, continuing without vectors: %s", exc)
        return

    for evidence, vector in zip(pending, vectors, strict=True):
        evidence.embedding = vector
    session.flush()

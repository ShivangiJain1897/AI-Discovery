"""Research coverage assessment.

Answers "what research is missing?" across eight dimensions, using qualitative
levels rather than a completeness percentage. A "62% complete" figure would
imply a methodology that does not exist; "Customer: Weak — 3 items, none
authoritative" tells a product manager something they can act on.

Levels are derived from evidence volume and the authority behind it, because
ten blog posts are not stronger coverage than two federal datasets.
"""

from __future__ import annotations

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import CoverageSnapshot, Evidence, Source
from app.domain.contracts import CoverageEntry, CoverageReport
from app.domain.enums import (
    COVERAGE_SOURCES,
    CoverageDimension,
    CoverageLevel,
    ResearchType,
    SourceTier,
)


def _level(evidence_count: int, tier1: int, tier2: int) -> CoverageLevel:
    if evidence_count == 0:
        return CoverageLevel.NOT_RESEARCHED
    # Authority dominates volume: a single authoritative source plus
    # corroboration beats a pile of general-web material.
    if tier1 >= 2 and evidence_count >= 6:
        return CoverageLevel.STRONG
    if (tier1 + tier2) >= 2 and evidence_count >= 4:
        return CoverageLevel.MODERATE
    if evidence_count >= 8 and (tier1 + tier2) >= 1:
        return CoverageLevel.MODERATE
    return CoverageLevel.WEAK


def _rationale(level: CoverageLevel, count: int, tier1: int, tier2: int) -> str:
    if level is CoverageLevel.NOT_RESEARCHED:
        return "No evidence collected for this dimension."
    authority = (
        f"{tier1} authoritative, {tier2} strong-secondary"
        if (tier1 or tier2)
        else "no authoritative or strong-secondary sources"
    )
    if level is CoverageLevel.WEAK:
        return (
            f"{count} evidence item(s), {authority}. Conclusions here would rest on "
            "thin or low-authority evidence."
        )
    if level is CoverageLevel.MODERATE:
        return f"{count} evidence item(s), {authority}. Supports findings with stated limits."
    return f"{count} evidence item(s), {authority}. Supports findings with corroboration."


def assess(session: Session, project_id) -> CoverageReport:
    """Compute coverage for a project from its current evidence library."""
    rows = session.execute(
        select(
            Evidence.research_type,
            Source.tier,
            Evidence.id,
        )
        .join(Source, Evidence.source_id == Source.id)
        .where(Evidence.project_id == project_id)
    ).all()

    by_type: dict[ResearchType, list[SourceTier]] = defaultdict(list)
    for research_type, tier, _ in rows:
        by_type[ResearchType(research_type)].append(SourceTier(tier))

    entries: list[CoverageEntry] = []
    for dimension in CoverageDimension:
        feeding = COVERAGE_SOURCES[dimension]
        tiers = [t for rt in feeding for t in by_type.get(rt, [])]
        count = len(tiers)
        tier1 = sum(1 for t in tiers if t is SourceTier.TIER_1_AUTHORITATIVE)
        tier2 = sum(1 for t in tiers if t is SourceTier.TIER_2_STRONG_SECONDARY)
        level = _level(count, tier1, tier2)
        entries.append(
            CoverageEntry(
                dimension=dimension.value,
                level=level,
                evidence_count=count,
                tier1_count=tier1,
                rationale=_rationale(level, count, tier1, tier2),
            )
        )

    weakest = [
        entry.dimension
        for entry in sorted(entries, key=lambda e: _ORDER.index(e.level))
        if entry.level in (CoverageLevel.NOT_RESEARCHED, CoverageLevel.WEAK)
    ]
    return CoverageReport(entries=entries, weakest=weakest)


_ORDER = [
    CoverageLevel.NOT_RESEARCHED,
    CoverageLevel.WEAK,
    CoverageLevel.MODERATE,
    CoverageLevel.STRONG,
]


def persist(session: Session, project_id, report: CoverageReport) -> None:
    """Store the snapshot so the overview renders without recomputing."""
    existing = {
        snapshot.dimension: snapshot
        for snapshot in session.execute(
            select(CoverageSnapshot).where(CoverageSnapshot.project_id == project_id)
        ).scalars()
    }
    for entry in report.entries:
        snapshot = existing.get(entry.dimension)
        if snapshot is None:
            snapshot = CoverageSnapshot(project_id=project_id, dimension=entry.dimension)
            session.add(snapshot)
        snapshot.level = entry.level
        snapshot.evidence_count = entry.evidence_count
        snapshot.tier1_count = entry.tier1_count
        snapshot.rationale = entry.rationale
    session.flush()

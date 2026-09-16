"""The evidence library: search, filter, facets, import and export."""

from __future__ import annotations

from collections import Counter
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.db.models import Evidence, Project, Source
from app.domain.api import (
    EvidenceListOut,
    EvidenceOut,
    ImportEvidenceRequest,
    SourceOut,
)
from app.domain.enums import (
    EvidenceOrigin,
    EvidenceStrength,
    EvidenceType,
    ExportFormat,
    ResearchType,
    SourceTier,
)
from app.exporters import builder, export_artifact
from app.routers.deps import get_db, get_project
from app.services import refs

router = APIRouter(prefix="/projects/{project_id}", tags=["evidence"])


@router.get("/evidence", response_model=EvidenceListOut)
def list_evidence(
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
    q: str | None = Query(None, description="Free-text search over statement and excerpt"),
    research_type: list[ResearchType] | None = Query(None),
    evidence_type: list[EvidenceType] | None = Query(None),
    strength: list[EvidenceStrength] | None = Query(None),
    tier: list[SourceTier] | None = Query(None),
    origin: EvidenceOrigin | None = Query(None),
    theme_ref: str | None = Query(None),
    source_ref: str | None = Query(None),
    geography: str | None = Query(None),
    published_after: date | None = Query(None),
    contradictions_only: bool = Query(False),
    limit: int = Query(200, le=1000),
    offset: int = Query(0, ge=0),
) -> EvidenceListOut:
    """Filterable evidence library.

    Facets are computed over the filtered set so the counts shown next to each
    filter reflect what is actually reachable from the current view.
    """
    base = (
        select(Evidence)
        .options(joinedload(Evidence.source))
        .join(Source, Evidence.source_id == Source.id)
        .where(Evidence.project_id == project.id)
    )

    if q:
        pattern = f"%{q}%"
        base = base.where(
            or_(
                Evidence.statement.ilike(pattern),
                Evidence.excerpt.ilike(pattern),
                Evidence.relevance.ilike(pattern),
                Source.title.ilike(pattern),
            )
        )
    if research_type:
        base = base.where(Evidence.research_type.in_([t.value for t in research_type]))
    if evidence_type:
        base = base.where(Evidence.evidence_type.in_([t.value for t in evidence_type]))
    if strength:
        base = base.where(Evidence.strength.in_([s.value for s in strength]))
    if tier:
        base = base.where(Source.tier.in_([t.value for t in tier]))
    if origin:
        base = base.where(Evidence.origin == origin.value)
    if geography:
        base = base.where(Evidence.geography.ilike(f"%{geography}%"))
    if published_after:
        base = base.where(Source.publication_date >= published_after)
    if contradictions_only:
        base = base.where(Evidence.contradiction_flag.is_(True))
    if source_ref:
        base = base.where(Source.ref == source_ref)
    if theme_ref:
        from app.db.models import Theme

        theme = session.execute(
            select(Theme).where(Theme.project_id == project.id, Theme.ref == theme_ref)
        ).scalar_one_or_none()
        if theme is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Theme {theme_ref} not found")
        base = base.where(Evidence.theme_id == theme.id)

    total = session.execute(
        select(func.count()).select_from(base.subquery())
    ).scalar_one()

    rows = session.execute(
        base.order_by(Evidence.ref).limit(limit).offset(offset)
    ).unique().scalars().all()

    facet_rows = session.execute(base).unique().scalars().all()
    facets = {
        "research_type": dict(Counter(str(e.research_type) for e in facet_rows)),
        "evidence_type": dict(Counter(str(e.evidence_type) for e in facet_rows)),
        "strength": dict(Counter(str(e.strength) for e in facet_rows)),
        "origin": dict(Counter(str(e.origin) for e in facet_rows)),
        "tier": dict(Counter(str(e.source.tier) for e in facet_rows)),
    }

    return EvidenceListOut(
        items=[EvidenceOut.model_validate(e) for e in rows], total=total, facets=facets
    )


@router.get("/evidence/{evidence_ref}", response_model=EvidenceOut)
def get_evidence(
    evidence_ref: str,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
) -> EvidenceOut:
    evidence = session.execute(
        select(Evidence)
        .options(joinedload(Evidence.source))
        .where(Evidence.project_id == project.id, Evidence.ref == evidence_ref)
    ).unique().scalar_one_or_none()
    if evidence is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Evidence {evidence_ref} not found")
    return EvidenceOut.model_validate(evidence)


@router.post("/evidence/import", response_model=list[EvidenceOut], status_code=201)
def import_evidence(
    body: ImportEvidenceRequest,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
) -> list[EvidenceOut]:
    """Add evidence by hand, for a source the platform cannot retrieve."""
    source = Source(
        project_id=project.id,
        ref=refs.allocate_one(session, project.id, "source"),
        title=body.source_title[:500],
        url=body.source_url,
        publisher=body.publisher,
        source_type=body.source_type,
        tier=body.tier,
        origin=body.origin,
        publication_date=body.publication_date,
        date_accessed=date.today(),
        research_types=[body.research_type.value],
    )
    session.add(source)
    session.flush()

    created: list[Evidence] = []
    evidence_refs = refs.allocate(session, project.id, "evidence", len(body.items))
    for item, ref in zip(body.items, evidence_refs, strict=True):
        evidence = Evidence(
            project_id=project.id,
            source_id=source.id,
            ref=ref,
            research_type=body.research_type,
            statement=item.get("statement", ""),
            excerpt=item.get("excerpt", ""),
            evidence_type=item.get("evidence_type", EvidenceType.CLAIM.value),
            origin=body.origin,
            population=item.get("population"),
            geography=item.get("geography"),
            period=item.get("period"),
            quantities=item.get("quantities", []),
            tags=item.get("theme_candidates", []),
            relevance=item.get("relevance", ""),
            limitations=item.get("limitations", []),
            strength=item.get("strength", EvidenceStrength.MODERATE.value),
            strength_reasoning="Manually imported by a user.",
        )
        session.add(evidence)
        created.append(evidence)

    session.flush()
    for evidence in created:
        session.refresh(evidence)
    return [EvidenceOut.model_validate(e) for e in created]


@router.delete("/evidence/{evidence_ref}", status_code=204, response_model=None)
def delete_evidence(
    evidence_ref: str,
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
) -> None:
    evidence = session.execute(
        select(Evidence).where(Evidence.project_id == project.id, Evidence.ref == evidence_ref)
    ).scalar_one_or_none()
    if evidence is not None:
        session.delete(evidence)


@router.get("/evidence-export")
def export_evidence(
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
    format: ExportFormat = Query(ExportFormat.XLSX),
) -> Response:
    doc = builder.from_evidence_library(session, project)
    data, filename, media_type = export_artifact(doc, format.value)
    return Response(
        content=data,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/sources", response_model=list[SourceOut])
def list_sources(
    project: Project = Depends(get_project),
    session: Session = Depends(get_db),
    tier: list[SourceTier] | None = Query(None),
) -> list[SourceOut]:
    query = select(Source).where(Source.project_id == project.id)
    if tier:
        query = query.where(Source.tier.in_([t.value for t in tier]))
    rows = session.execute(query.order_by(Source.ref)).scalars().all()
    return [SourceOut.model_validate(s) for s in rows]

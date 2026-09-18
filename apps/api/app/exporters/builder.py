"""Builds the export document model from stored records."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    Analysis,
    Artifact,
    ArtifactVersion,
    Evidence,
    Project,
    Source,
    Synthesis,
)
from app.domain.enums import ArtifactType, SourceTier
from app.exporters.model import DocCitation, DocSection, Document


def _citations(session: Session, project: Project, refs: list[str]) -> list[DocCitation]:
    """Resolve refs to full citation records, in ref order."""
    if not refs:
        return []
    rows = session.execute(
        select(Evidence, Source)
        .join(Source, Evidence.source_id == Source.id)
        .where(Evidence.project_id == project.id, Evidence.ref.in_(refs))
        .order_by(Evidence.ref)
    ).all()
    return [
        DocCitation(
            ref=evidence.ref,
            statement=evidence.statement,
            excerpt=evidence.excerpt,
            source_title=source.title,
            source_url=source.url,
            publisher=source.publisher,
            publication_date=(
                source.publication_date.isoformat() if source.publication_date else None
            ),
            tier=SourceTier(source.tier).label,
            strength=evidence.strength,
            evidence_type=evidence.evidence_type,
        )
        for evidence, source in rows
    ]


def _sections(raw: list[dict]) -> list[DocSection]:
    return [
        DocSection(
            heading=item.get("heading", ""),
            body=item.get("body", "") or "",
            points=item.get("points") or [],
            columns=item.get("columns") or [],
            rows=item.get("rows") or [],
            evidence_refs=item.get("evidence_refs") or [],
            knowledge_state=item.get("knowledge_state", "known"),
            note=item.get("note"),
        )
        for item in raw or []
    ]


def from_artifact_version(
    session: Session, project: Project, artifact: Artifact, version: ArtifactVersion
) -> Document:
    sections = _sections(version.sections)
    refs = sorted({r for s in sections for r in s.evidence_refs} | set(version.evidence_refs or []))
    critique = version.critique or {}

    return Document(
        title=version.title or artifact.title,
        subtitle=ArtifactType(artifact.artifact_type).label,
        summary=version.summary,
        sections=sections,
        citations=_citations(session, project, refs),
        open_questions=version.open_questions or [],
        metadata={
            "Project": project.title,
            "Discovery question": project.question,
            "Artifact": f"{artifact.ref} · {ArtifactType(artifact.artifact_type).label}",
            "Version": f"v{version.version}",
            "Persona": str(artifact.persona),
            "Quality check": (
                "Passed" if critique.get("passed") else
                f"{len(critique.get('issues', []))} issue(s) flagged by the artifact critic"
            ),
            "Changes": version.change_summary or "—",
        },
    )


def from_analysis(session: Session, project: Project, analysis: Analysis) -> Document:
    sections = _sections(analysis.sections)
    if analysis.assumptions:
        sections.append(DocSection(heading="Assumptions", points=analysis.assumptions))
    if analysis.unknowns:
        sections.append(DocSection(heading="What we do not know", points=analysis.unknowns))

    refs = sorted({r for s in sections for r in s.evidence_refs} | set(analysis.evidence_refs or []))
    return Document(
        title=analysis.title,
        subtitle="Analysis",
        summary=analysis.summary,
        sections=sections,
        citations=_citations(session, project, refs),
        metadata={
            "Project": project.title,
            "Analysis": f"{analysis.ref} · {analysis.analysis_type}",
            "Confidence": str(analysis.confidence),
            "Persona": str(analysis.persona),
        },
    )


def from_synthesis(session: Session, project: Project, synthesis: Synthesis) -> Document:
    sections: list[DocSection] = [
        DocSection(heading="Research Objective", body=synthesis.research_objective),
        DocSection(heading="Research Approach", body=synthesis.research_approach),
    ]

    findings = sorted(project.findings, key=lambda f: f.ref)
    if findings:
        sections.append(
            DocSection(
                heading="Key Findings",
                columns=["Ref", "Finding", "Why it matters", "Confidence", "Evidence"],
                rows=[
                    {
                        "Ref": f.ref,
                        "Finding": f"{f.title} — {f.finding}",
                        "Why it matters": f.why_it_matters,
                        "Confidence": str(f.confidence),
                        "Evidence": ", ".join(f.evidence_refs or []),
                    }
                    for f in findings
                ],
                evidence_refs=[r for f in findings for r in (f.evidence_refs or [])],
            )
        )

    if project.themes:
        sections.append(
            DocSection(
                heading="Themes",
                columns=["Ref", "Theme", "Prevalence", "Evidence"],
                rows=[
                    {
                        "Ref": t.ref,
                        "Theme": f"{t.name} — {t.description}",
                        "Prevalence": t.prevalence or "Not established",
                        "Evidence": ", ".join(t.evidence_refs or []),
                    }
                    for t in sorted(project.themes, key=lambda t: t.ref)
                ],
            )
        )

    if synthesis.contradictions:
        sections.append(
            DocSection(
                heading="Contradictions",
                columns=["Topic", "Position A", "Position B", "Assessment"],
                rows=[
                    {
                        "Topic": c.get("topic", ""),
                        "Position A": f"{c.get('position_a', '')} [{', '.join(c.get('evidence_refs_a', []))}]",
                        "Position B": f"{c.get('position_b', '')} [{', '.join(c.get('evidence_refs_b', []))}]",
                        "Assessment": c.get("assessment", ""),
                    }
                    for c in synthesis.contradictions
                ],
            )
        )

    if synthesis.evidence_gaps:
        sections.append(
            DocSection(
                heading="Evidence Gaps",
                columns=["Gap", "Why it matters", "Closable by search?", "Suggested approach"],
                rows=[
                    {
                        "Gap": g.get("gap", ""),
                        "Why it matters": g.get("why_it_matters", ""),
                        "Closable by search?": (
                            "Yes" if g.get("can_secondary_research_close_it") else "No"
                        ),
                        "Suggested approach": g.get("suggested_approach", ""),
                    }
                    for g in synthesis.evidence_gaps
                ],
            )
        )

    for heading, values in (
        ("Emerging Opportunities", synthesis.emerging_opportunities),
        ("Questions for Primary Research", synthesis.primary_research_questions),
        ("Recommended Next Steps", synthesis.next_steps),
    ):
        if values:
            sections.append(DocSection(heading=heading, points=values))

    all_refs = sorted({e.ref for e in project.evidence})
    return Document(
        title=f"Research Report — {project.title}",
        subtitle="Research Report",
        summary=synthesis.executive_summary,
        sections=sections,
        citations=_citations(session, project, all_refs),
        metadata={
            "Project": project.title,
            "Discovery question": project.question,
            "Sources examined": str(synthesis.sources_examined),
            "Evidence items": str(synthesis.evidence_examined),
            "Synthesis": f"{synthesis.ref} v{synthesis.version}",
        },
    )


def from_evidence_library(session: Session, project: Project) -> Document:
    rows = session.execute(
        select(Evidence, Source)
        .join(Source, Evidence.source_id == Source.id)
        .where(Evidence.project_id == project.id)
        .order_by(Evidence.ref)
    ).all()
    columns = [
        "Ref", "Statement", "Type", "Strength", "Population", "Geography",
        "Origin", "Research type", "Source", "Publisher", "Tier", "Published", "URL",
    ]
    return Document(
        title=f"Evidence Library — {project.title}",
        subtitle="Evidence Library",
        summary=f"{len(rows)} evidence items.",
        sections=[
            DocSection(
                heading="Evidence",
                columns=columns,
                rows=[
                    {
                        "Ref": e.ref,
                        "Statement": e.statement,
                        "Type": str(e.evidence_type),
                        "Strength": str(e.strength),
                        "Population": e.population or "Not stated",
                        "Geography": e.geography or "Not stated",
                        "Origin": str(e.origin),
                        "Research type": str(e.research_type),
                        "Source": s.title,
                        "Publisher": s.publisher or "",
                        "Tier": SourceTier(s.tier).label,
                        "Published": s.publication_date.isoformat() if s.publication_date else "",
                        "URL": s.url or "",
                    }
                    for e, s in rows
                ],
            )
        ],
        metadata={"Project": project.title, "Discovery question": project.question},
    )

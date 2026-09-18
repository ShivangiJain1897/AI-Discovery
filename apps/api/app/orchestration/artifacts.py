"""Artifact generation, critique and versioning.

Artifacts are built from the project's existing evidence. The generator is
given the evidence, findings, analyses and opportunities the user selected —
it does not go back out and research, because an artifact that quietly
introduces new unsourced material breaks the traceability the whole product
rests on.

Every generated version passes the artifact critic before it is stored. Where
the critic finds blocking issues, its corrections are applied and recorded on
the version, so the user can see what was caught.
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    Artifact,
    ArtifactVersion,
    Citation,
    Evidence,
    Project,
    Source,
    UseCase,
)
from app.domain.contracts import ArtifactContract, ArtifactCritique
from app.domain.enums import ArtifactType, KnowledgeState, Persona
from app.orchestration.agents import StageRun, run_stage
from app.orchestration.serializers import (
    analysis_dict,
    context_dict,
    evidence_dict,
    finding_dict,
    insight_dict,
    opportunity_dict,
    use_case_dict,
)
from app.services import artifact_templates, refs

logger = logging.getLogger(__name__)


class ArtifactInputs:
    """The user's selection of what an artifact should be built from."""

    def __init__(
        self,
        *,
        evidence_refs: list[str] | None = None,
        finding_refs: list[str] | None = None,
        analysis_refs: list[str] | None = None,
        opportunity_refs: list[str] | None = None,
        use_case_refs: list[str] | None = None,
    ) -> None:
        self.evidence_refs = evidence_refs
        self.finding_refs = finding_refs
        self.analysis_refs = analysis_refs
        self.opportunity_refs = opportunity_refs
        self.use_case_refs = use_case_refs

    def as_dict(self) -> dict:
        return {
            "evidence_refs": self.evidence_refs,
            "finding_refs": self.finding_refs,
            "analysis_refs": self.analysis_refs,
            "opportunity_refs": self.opportunity_refs,
            "use_case_refs": self.use_case_refs,
        }


def _gather(session: Session, project: Project, selection: ArtifactInputs) -> dict:
    """Assemble the selected project material for the generator."""
    rows = session.execute(
        select(Evidence, Source)
        .join(Source, Evidence.source_id == Source.id)
        .where(Evidence.project_id == project.id)
        .order_by(Evidence.ref)
    ).all()
    evidence = [evidence_dict(e, s) for e, s in rows]
    if selection.evidence_refs:
        chosen = set(selection.evidence_refs)
        evidence = [e for e in evidence if e["ref"] in chosen]

    findings = [finding_dict(f) for f in project.findings]
    if selection.finding_refs:
        chosen = set(selection.finding_refs)
        findings = [f for f in findings if f["ref"] in chosen]

    analyses = [analysis_dict(a) for a in project.analyses]
    if selection.analysis_refs:
        chosen = set(selection.analysis_refs)
        analyses = [a for a in analyses if a["ref"] in chosen]

    opportunities = [opportunity_dict(o) for o in project.opportunities]
    if selection.opportunity_refs:
        chosen = set(selection.opportunity_refs)
        opportunities = [o for o in opportunities if o["ref"] in chosen]

    use_case_rows = session.execute(
        select(UseCase).where(UseCase.project_id == project.id).order_by(UseCase.ref)
    ).scalars().all()
    use_cases = [use_case_dict(u) for u in use_case_rows]
    if selection.use_case_refs:
        chosen = set(selection.use_case_refs)
        use_cases = [u for u in use_cases if u["ref"] in chosen]

    return {
        "evidence_items": evidence,
        "findings": findings,
        "insights": [insight_dict(i) for i in project.insights],
        "analyses": analyses,
        "opportunities": opportunities,
        "use_cases": use_cases,
        "normalized_context": context_dict(project.context),
    }


def generate(
    session: Session,
    project: Project,
    artifact_type: ArtifactType,
    *,
    selection: ArtifactInputs | None = None,
    persona: Persona | None = None,
    title: str | None = None,
    artifact: Artifact | None = None,
    change_reason: str = "",
) -> tuple[Artifact, ArtifactVersion, list[StageRun]]:
    """Generate an artifact version, critique it, and store both."""
    selection = selection or ArtifactInputs()
    payload = _gather(session, project, selection)
    runs: list[StageRun] = []

    inputs = dict(payload)
    inputs["artifact_type"] = artifact_type.value
    inputs["title"] = title
    inputs["audience"] = (persona or Persona(project.persona)).value
    inputs["section_template"] = artifact_templates.section_headings(artifact_type.value)

    result, generate_run = run_stage(
        artifact_templates.prompt_for(artifact_type.value),
        inputs,
        schema=ArtifactContract,
        max_tokens=16000,
    )
    runs.append(generate_run)

    critique, critic_run = run_stage(
        "artifact_critic",
        {
            "artifact": result.model_dump(mode="json"),
            "evidence_items": payload["evidence_items"],
            "findings": payload["findings"],
            "research_question": project.question,
        },
        schema=ArtifactCritique,
    )
    runs.append(critic_run)

    corrected = _apply_critique(result, critique, payload["evidence_items"])

    if artifact is None:
        artifact = Artifact(
            project_id=project.id,
            ref=refs.allocate_one(session, project.id, "artifact"),
            artifact_type=artifact_type,
            title=title or corrected.title[:400] or artifact_type.label,
            persona=persona or Persona(project.persona),
            inputs=selection.as_dict(),
            current_version=0,
        )
        session.add(artifact)
        session.flush()

    version = _store_version(session, project, artifact, corrected, critique, change_reason)
    return artifact, version, runs


def _apply_critique(
    artifact: ArtifactContract, critique: ArtifactCritique, evidence_items: list[dict]
) -> ArtifactContract:
    """Apply the critic's blocking corrections before the user sees anything.

    Unresolvable citations are removed rather than left to dangle, and any
    section the critic flagged is annotated so the issue is visible in the
    document instead of only in the critique record.
    """
    known = {item["ref"] for item in evidence_items}
    by_section: dict[str, list[str]] = {}
    for issue in critique.issues:
        if issue.section and issue.severity in ("blocking", "warning"):
            by_section.setdefault(issue.section, []).append(
                issue.correction or issue.detail
            )

    for section in artifact.sections:
        dropped = [ref for ref in section.evidence_refs if ref not in known]
        if dropped:
            section.evidence_refs = [r for r in section.evidence_refs if r in known]
            by_section.setdefault(section.heading, []).append(
                f"Removed {len(dropped)} citation(s) that did not resolve: {', '.join(dropped)}"
            )

        notes = by_section.get(section.heading)
        if notes:
            section.note = "; ".join(filter(None, [section.note, *notes]))[:1000]

        has_content = bool(section.body or section.points or section.rows)
        if has_content and not section.evidence_refs and section.knowledge_state is KnowledgeState.KNOWN:
            # A section asserting fact with nothing behind it is downgraded
            # rather than presented at full confidence.
            section.knowledge_state = KnowledgeState.HYPOTHESIS
            section.note = "; ".join(
                filter(None, [section.note, "Unsourced: downgraded to hypothesis."])
            )[:1000]

    artifact.evidence_refs = [r for r in artifact.evidence_refs if r in known]
    if critique.still_unknown:
        existing = set(artifact.open_questions)
        artifact.open_questions += [
            f"Not established by the research: {item}"
            for item in critique.still_unknown
            if item and item not in existing
        ]
    return artifact


def _store_version(
    session: Session,
    project: Project,
    artifact: Artifact,
    result: ArtifactContract,
    critique: ArtifactCritique,
    change_reason: str,
) -> ArtifactVersion:
    previous = (
        session.execute(
            select(ArtifactVersion)
            .where(ArtifactVersion.artifact_id == artifact.id)
            .order_by(ArtifactVersion.version.desc())
        )
        .scalars()
        .first()
    )
    next_version = (previous.version if previous else 0) + 1

    sections = [s.model_dump(mode="json") for s in result.sections]
    changed, delta = _diff(previous, sections, result)

    version = ArtifactVersion(
        artifact_id=artifact.id,
        version=next_version,
        title=result.title[:400],
        summary=result.summary,
        sections=sections,
        evidence_refs=result.evidence_refs,
        open_questions=result.open_questions,
        critique=critique.model_dump(mode="json"),
        change_summary=change_reason or _describe_change(previous, changed, delta),
        changed_sections=changed,
        evidence_delta=delta,
    )
    session.add(version)
    session.flush()

    artifact.current_version = next_version
    _store_citations(session, project, version, result)
    session.flush()
    return version


def _diff(
    previous: ArtifactVersion | None, sections: list[dict], result: ArtifactContract
) -> tuple[list[str], dict]:
    if previous is None:
        return [s["heading"] for s in sections], {
            "added": result.evidence_refs, "removed": []
        }

    old_by_heading = {s.get("heading"): s for s in previous.sections or []}
    changed = [
        s["heading"]
        for s in sections
        if old_by_heading.get(s["heading"]) != s
    ]
    old_refs = set(previous.evidence_refs or [])
    new_refs = set(result.evidence_refs)
    return changed, {
        "added": sorted(new_refs - old_refs),
        "removed": sorted(old_refs - new_refs),
    }


def _describe_change(previous: ArtifactVersion | None, changed: list[str], delta: dict) -> str:
    if previous is None:
        return "Initial version."
    parts = []
    if changed:
        parts.append(f"{len(changed)} section(s) changed: {', '.join(changed[:6])}")
    if delta.get("added"):
        parts.append(f"{len(delta['added'])} evidence reference(s) added")
    if delta.get("removed"):
        parts.append(f"{len(delta['removed'])} removed")
    return "; ".join(parts) or "Regenerated with no detected change."


def _store_citations(
    session: Session, project: Project, version: ArtifactVersion, result: ArtifactContract
) -> None:
    """Persist citations so they survive export and can be walked back."""
    by_ref = {
        e.ref: e
        for e in session.execute(
            select(Evidence).where(Evidence.project_id == project.id)
        ).scalars()
    }
    for section in result.sections:
        for ref in section.evidence_refs:
            evidence = by_ref.get(ref)
            session.add(
                Citation(
                    project_id=project.id,
                    artifact_version_id=version.id,
                    evidence_id=evidence.id if evidence else None,
                    evidence_ref=ref,
                    section_heading=section.heading[:400],
                    quoted_text=(evidence.excerpt[:2000] if evidence else None),
                )
            )


def regenerate_section(
    session: Session,
    project: Project,
    artifact: Artifact,
    heading: str,
    *,
    instruction: str = "",
) -> tuple[ArtifactVersion, list[StageRun]]:
    """Regenerate one section, carrying the rest of the document forward."""
    current = (
        session.execute(
            select(ArtifactVersion)
            .where(
                ArtifactVersion.artifact_id == artifact.id,
                ArtifactVersion.version == artifact.current_version,
            )
        )
        .scalars()
        .one()
    )

    selection = ArtifactInputs(**(artifact.inputs or {}))
    payload = _gather(session, project, selection)

    inputs = dict(payload)
    inputs["artifact_type"] = artifact.artifact_type
    inputs["title"] = artifact.title
    inputs["section_template"] = [heading]
    inputs["regenerate_only"] = heading
    inputs["existing_document"] = current.sections
    if instruction:
        inputs["user_instruction"] = instruction

    result, run = run_stage(
        artifact_templates.prompt_for(artifact.artifact_type),
        inputs,
        schema=ArtifactContract,
    )
    runs = [run]

    replacement = next(
        (s for s in result.sections if s.heading.strip().lower() == heading.strip().lower()),
        result.sections[0] if result.sections else None,
    )
    if replacement is None:
        raise ValueError(f"Regeneration returned no section for '{heading}'")

    merged = ArtifactContract(
        title=current.title,
        summary=current.summary,
        sections=[
            replacement
            if s.get("heading", "").strip().lower() == heading.strip().lower()
            else _section_from_dict(s)
            for s in current.sections
        ],
        evidence_refs=sorted(
            {*(current.evidence_refs or []), *replacement.evidence_refs}
        ),
        open_questions=current.open_questions or [],
    )

    critique, critic_run = run_stage(
        "artifact_critic",
        {
            "artifact": merged.model_dump(mode="json"),
            "evidence_items": payload["evidence_items"],
            "findings": payload["findings"],
            "research_question": project.question,
        },
        schema=ArtifactCritique,
    )
    runs.append(critic_run)

    corrected = _apply_critique(merged, critique, payload["evidence_items"])
    version = _store_version(
        session, project, artifact, corrected, critique,
        change_reason=f"Regenerated section: {heading}"
        + (f" — {instruction}" if instruction else ""),
    )
    return version, runs


def _section_from_dict(data: dict):
    from app.domain.contracts import ArtifactSection

    return ArtifactSection.model_validate(data)

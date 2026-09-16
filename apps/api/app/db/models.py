"""ORM models.

The relationship spine mirrors the discovery method itself:

    Project
      -> ResearchPlan -> ResearchQuestion
      -> ResearchRun  -> Source -> Evidence
      -> Theme -> Finding -> Insight
      -> Analysis -> Opportunity -> Recommendation
      -> Artifact -> ArtifactVersion -> Citation

Every project-scoped record carries a short human-readable ``ref`` (``E-014``,
``F-003``). That ref is what a generated artifact cites, what the UI renders as
a clickable chip, and what survives export — so a sentence in a PRD can be
walked back to the source excerpt behind it.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config import settings
from app.db.base import Base, TimestampMixin, new_uuid
from app.domain.enums import (
    AnalysisType,
    ArtifactType,
    CoverageLevel,
    EvidenceOrigin,
    EvidenceStrength,
    EvidenceType,
    JobStatus,
    KnowledgeState,
    OpportunityStatus,
    Persona,
    ProjectStatus,
    ResearchDepth,
    ResearchType,
    SourceTier,
    SourceType,
)

#: JSONB on Postgres, plain JSON elsewhere (keeps the test suite portable).
JSONType = JSON().with_variant(JSONB(), "postgresql")


def _pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)


# ─────────────────────────────────────────────────────────────
# Identity
# ─────────────────────────────────────────────────────────────


class Workspace(Base, TimestampMixin):
    """Tenant boundary. Evidence never crosses a workspace."""

    __tablename__ = "workspaces"

    id: Mapped[uuid.UUID] = _pk()
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    #: Governance settings: retention, PHI policy, allowed source tiers.
    settings_json: Mapped[dict] = mapped_column(JSONType, default=dict)

    users: Mapped[list[User]] = relationship(back_populates="workspace", cascade="all, delete-orphan")
    projects: Mapped[list[Project]] = relationship(
        back_populates="workspace", cascade="all, delete-orphan"
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = _pk()
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    #: Default lens applied to shared evidence.
    persona: Mapped[Persona] = mapped_column(String(40), default=Persona.PRODUCT_MANAGER)
    role: Mapped[str] = mapped_column(String(40), default="member")

    workspace: Mapped[Workspace] = relationship(back_populates="users")


# ─────────────────────────────────────────────────────────────
# Project
# ─────────────────────────────────────────────────────────────


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = _pk()
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[ProjectStatus] = mapped_column(String(30), default=ProjectStatus.DRAFT)
    persona: Mapped[Persona] = mapped_column(String(40), default=Persona.PRODUCT_MANAGER)
    #: Monotonic counters backing the per-project ``ref`` sequences.
    ref_counters: Mapped[dict] = mapped_column(JSONType, default=dict)

    workspace: Mapped[Workspace] = relationship(back_populates="projects")
    context: Mapped[ProjectContext | None] = relationship(
        back_populates="project", cascade="all, delete-orphan", uselist=False
    )
    research_plans: Mapped[list[ResearchPlan]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    research_runs: Mapped[list[ResearchRun]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    sources: Mapped[list[Source]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    evidence: Mapped[list[Evidence]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    themes: Mapped[list[Theme]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    findings: Mapped[list[Finding]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    insights: Mapped[list[Insight]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    analyses: Mapped[list[Analysis]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    opportunities: Mapped[list[Opportunity]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    artifacts: Mapped[list[Artifact]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    documents: Mapped[list[UploadedDocument]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    coverage: Mapped[list[CoverageSnapshot]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class ProjectContext(Base, TimestampMixin):
    """Inferred framing. Every field is editable; edits are tracked."""

    __tablename__ = "project_contexts"

    id: Mapped[uuid.UUID] = _pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), unique=True, index=True
    )
    objective: Mapped[str] = mapped_column(Text, default="")
    decision: Mapped[str] = mapped_column(Text, default="")
    domain: Mapped[str] = mapped_column(String(120), default="")
    subdomain: Mapped[str | None] = mapped_column(String(120), nullable=True)
    product_type: Mapped[str | None] = mapped_column(String(160), nullable=True)
    primary_user: Mapped[str | None] = mapped_column(String(200), nullable=True)
    secondary_users: Mapped[list] = mapped_column(JSONType, default=list)
    geography: Mapped[str | None] = mapped_column(String(160), nullable=True)
    organization_context: Mapped[str | None] = mapped_column(Text, nullable=True)
    discovery_stage: Mapped[str | None] = mapped_column(String(120), nullable=True)
    constraints: Mapped[list] = mapped_column(JSONType, default=list)
    #: Inferred values surfaced for correction rather than hidden.
    assumptions: Mapped[list] = mapped_column(JSONType, default=list)
    #: Field names the user has overridden — never re-inferred after that.
    user_edited_fields: Mapped[list] = mapped_column(JSONType, default=list)
    clarifications: Mapped[list] = mapped_column(JSONType, default=list)

    project: Mapped[Project] = relationship(back_populates="context")


# ─────────────────────────────────────────────────────────────
# Research
# ─────────────────────────────────────────────────────────────


class ResearchPlan(Base, TimestampMixin):
    __tablename__ = "research_plans"

    id: Mapped[uuid.UUID] = _pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    ref: Mapped[str] = mapped_column(String(20), nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1)
    objective: Mapped[str] = mapped_column(Text, default="")
    decision_supported: Mapped[str] = mapped_column(Text, default="")
    depth: Mapped[ResearchDepth] = mapped_column(String(30), default=ResearchDepth.STANDARD)
    research_types: Mapped[list] = mapped_column(JSONType, default=list)
    planned_sources: Mapped[list] = mapped_column(JSONType, default=list)
    primary_research_needed: Mapped[list] = mapped_column(JSONType, default=list)
    anticipated_gaps: Mapped[list] = mapped_column(JSONType, default=list)
    out_of_scope: Mapped[list] = mapped_column(JSONType, default=list)
    human_readable_plan: Mapped[str] = mapped_column(Text, default="")
    approved: Mapped[bool] = mapped_column(Boolean, default=False)

    project: Mapped[Project] = relationship(back_populates="research_plans")
    questions: Mapped[list[ResearchQuestion]] = relationship(
        back_populates="plan", cascade="all, delete-orphan", order_by="ResearchQuestion.position"
    )
    runs: Mapped[list[ResearchRun]] = relationship(back_populates="plan")

    __table_args__ = (UniqueConstraint("project_id", "ref", name="uq_plan_project_ref"),)


class ResearchQuestion(Base, TimestampMixin):
    __tablename__ = "research_questions"

    id: Mapped[uuid.UUID] = _pk()
    plan_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("research_plans.id", ondelete="CASCADE"), index=True
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    ref: Mapped[str] = mapped_column(String(20), nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    why: Mapped[str] = mapped_column(Text, default="")
    research_types: Mapped[list] = mapped_column(JSONType, default=list)
    expected_evidence: Mapped[str] = mapped_column(Text, default="")
    answerable_by_secondary: Mapped[bool] = mapped_column(Boolean, default=True)
    queries: Mapped[list] = mapped_column(JSONType, default=list)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    #: Set during a run so the UI can show progress per question, not a spinner.
    status: Mapped[str] = mapped_column(String(30), default="pending")
    evidence_count: Mapped[int] = mapped_column(Integer, default=0)

    plan: Mapped[ResearchPlan] = relationship(back_populates="questions")


class ResearchRun(Base, TimestampMixin):
    __tablename__ = "research_runs"

    id: Mapped[uuid.UUID] = _pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    plan_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("research_plans.id", ondelete="SET NULL"), nullable=True
    )
    ref: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[JobStatus] = mapped_column(String(30), default=JobStatus.QUEUED)
    depth: Mapped[ResearchDepth] = mapped_column(String(30), default=ResearchDepth.STANDARD)
    research_types: Mapped[list] = mapped_column(JSONType, default=list)
    #: Per-question progress records, surfaced live in the research UI.
    progress: Mapped[list] = mapped_column(JSONType, default=list)
    sources_examined: Mapped[int] = mapped_column(Integer, default=0)
    evidence_extracted: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider_meta: Mapped[dict] = mapped_column(JSONType, default=dict)

    project: Mapped[Project] = relationship(back_populates="research_runs")
    plan: Mapped[ResearchPlan | None] = relationship(back_populates="runs")
    sources: Mapped[list[Source]] = relationship(back_populates="run")

    __table_args__ = (UniqueConstraint("project_id", "ref", name="uq_run_project_ref"),)


class Source(Base, TimestampMixin):
    __tablename__ = "sources"

    id: Mapped[uuid.UUID] = _pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    run_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("research_runs.id", ondelete="SET NULL"), nullable=True
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("uploaded_documents.id", ondelete="CASCADE"), nullable=True
    )
    ref: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    publisher: Mapped[str | None] = mapped_column(String(300), nullable=True)
    source_type: Mapped[SourceType] = mapped_column(String(40), default=SourceType.NEWS)
    tier: Mapped[SourceTier] = mapped_column(String(40), default=SourceTier.TIER_4_GENERAL_WEB)
    origin: Mapped[EvidenceOrigin] = mapped_column(String(20), default=EvidenceOrigin.EXTERNAL)
    publication_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    date_accessed: Mapped[date | None] = mapped_column(Date, nullable=True)
    geography: Mapped[str | None] = mapped_column(String(160), nullable=True)
    research_types: Mapped[list] = mapped_column(JSONType, default=list)
    snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    assessment: Mapped[str | None] = mapped_column(Text, nullable=True)
    relevance_score: Mapped[float] = mapped_column(Float, default=0.0)

    project: Mapped[Project] = relationship(back_populates="sources")
    run: Mapped[ResearchRun | None] = relationship(back_populates="sources")
    evidence: Mapped[list[Evidence]] = relationship(
        back_populates="source", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("project_id", "ref", name="uq_source_project_ref"),
        Index("ix_sources_project_tier", "project_id", "tier"),
    )


class Evidence(Base, TimestampMixin):
    """One atomic, attributable statement.

    ``evidence_type`` separates what a source asserts from what the platform
    inferred: an INFERENCE row is never presented as source fact.
    """

    __tablename__ = "evidence"

    id: Mapped[uuid.UUID] = _pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sources.id", ondelete="CASCADE"), index=True
    )
    run_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("research_runs.id", ondelete="SET NULL"), nullable=True
    )
    ref: Mapped[str] = mapped_column(String(20), nullable=False)

    research_type: Mapped[ResearchType] = mapped_column(String(40), default=ResearchType.MARKET)
    statement: Mapped[str] = mapped_column(Text, nullable=False)
    excerpt: Mapped[str] = mapped_column(Text, default="")
    evidence_type: Mapped[EvidenceType] = mapped_column(String(30), default=EvidenceType.CLAIM)
    origin: Mapped[EvidenceOrigin] = mapped_column(String(20), default=EvidenceOrigin.EXTERNAL)
    evidence_category: Mapped[str | None] = mapped_column(String(80), nullable=True)

    population: Mapped[str | None] = mapped_column(String(300), nullable=True)
    geography: Mapped[str | None] = mapped_column(String(160), nullable=True)
    period: Mapped[str | None] = mapped_column(String(120), nullable=True)
    quantities: Mapped[list] = mapped_column(JSONType, default=list)

    theme_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("themes.id", ondelete="SET NULL"), nullable=True
    )
    tags: Mapped[list] = mapped_column(JSONType, default=list)
    relevance: Mapped[str] = mapped_column(Text, default="")
    limitations: Mapped[list] = mapped_column(JSONType, default=list)

    #: Qualitative, with the reasoning kept alongside it.
    strength: Mapped[EvidenceStrength] = mapped_column(String(20), default=EvidenceStrength.MODERATE)
    strength_reasoning: Mapped[str] = mapped_column(Text, default="")
    corroboration_count: Mapped[int] = mapped_column(Integer, default=0)
    corroborated_by: Mapped[list] = mapped_column(JSONType, default=list)
    contradicted_by: Mapped[list] = mapped_column(JSONType, default=list)
    contradiction_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    population_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(settings.embedding_dimension), nullable=True
    )

    project: Mapped[Project] = relationship(back_populates="evidence")
    source: Mapped[Source] = relationship(back_populates="evidence")
    theme: Mapped[Theme | None] = relationship(back_populates="evidence")

    __table_args__ = (
        UniqueConstraint("project_id", "ref", name="uq_evidence_project_ref"),
        Index("ix_evidence_project_type", "project_id", "research_type"),
        Index("ix_evidence_project_strength", "project_id", "strength"),
        Index("ix_evidence_project_origin", "project_id", "origin"),
    )


# ─────────────────────────────────────────────────────────────
# Synthesis
# ─────────────────────────────────────────────────────────────


class Theme(Base, TimestampMixin):
    __tablename__ = "themes"

    id: Mapped[uuid.UUID] = _pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    ref: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    prevalence: Mapped[str | None] = mapped_column(String(300), nullable=True)
    evidence_refs: Mapped[list] = mapped_column(JSONType, default=list)

    project: Mapped[Project] = relationship(back_populates="themes")
    evidence: Mapped[list[Evidence]] = relationship(back_populates="theme")

    __table_args__ = (UniqueConstraint("project_id", "ref", name="uq_theme_project_ref"),)


class Finding(Base, TimestampMixin):
    """A pattern across evidence. Always carries at least one evidence ref."""

    __tablename__ = "findings"

    id: Mapped[uuid.UUID] = _pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    synthesis_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("syntheses.id", ondelete="SET NULL"), nullable=True
    )
    ref: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(400), nullable=False)
    finding: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_refs: Mapped[list] = mapped_column(JSONType, default=list)
    affected_personas: Mapped[list] = mapped_column(JSONType, default=list)
    themes: Mapped[list] = mapped_column(JSONType, default=list)
    prevalence: Mapped[str | None] = mapped_column(String(300), nullable=True)
    why_it_matters: Mapped[str] = mapped_column(Text, default="")
    confidence: Mapped[EvidenceStrength] = mapped_column(String(20), default=EvidenceStrength.MODERATE)
    knowledge_state: Mapped[KnowledgeState] = mapped_column(String(20), default=KnowledgeState.KNOWN)
    limitations: Mapped[list] = mapped_column(JSONType, default=list)

    project: Mapped[Project] = relationship(back_populates="findings")

    __table_args__ = (UniqueConstraint("project_id", "ref", name="uq_finding_project_ref"),)


class Insight(Base, TimestampMixin):
    __tablename__ = "insights"

    id: Mapped[uuid.UUID] = _pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    synthesis_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("syntheses.id", ondelete="SET NULL"), nullable=True
    )
    ref: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(400), nullable=False)
    insight: Mapped[str] = mapped_column(Text, nullable=False)
    finding_refs: Mapped[list] = mapped_column(JSONType, default=list)
    why_it_matters: Mapped[str] = mapped_column(Text, default="")
    product_implication: Mapped[str] = mapped_column(Text, default="")
    confidence: Mapped[EvidenceStrength] = mapped_column(String(20), default=EvidenceStrength.MODERATE)
    knowledge_state: Mapped[KnowledgeState] = mapped_column(String(20), default=KnowledgeState.LIKELY)

    project: Mapped[Project] = relationship(back_populates="insights")

    __table_args__ = (UniqueConstraint("project_id", "ref", name="uq_insight_project_ref"),)


class Synthesis(Base, TimestampMixin):
    """A synthesis pass over the evidence library."""

    __tablename__ = "syntheses"

    id: Mapped[uuid.UUID] = _pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    ref: Mapped[str] = mapped_column(String(20), nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1)
    executive_summary: Mapped[str] = mapped_column(Text, default="")
    research_objective: Mapped[str] = mapped_column(Text, default="")
    research_approach: Mapped[str] = mapped_column(Text, default="")
    sources_examined: Mapped[int] = mapped_column(Integer, default=0)
    evidence_examined: Mapped[int] = mapped_column(Integer, default=0)
    contradictions: Mapped[list] = mapped_column(JSONType, default=list)
    evidence_gaps: Mapped[list] = mapped_column(JSONType, default=list)
    emerging_opportunities: Mapped[list] = mapped_column(JSONType, default=list)
    primary_research_questions: Mapped[list] = mapped_column(JSONType, default=list)
    next_steps: Mapped[list] = mapped_column(JSONType, default=list)

    __table_args__ = (UniqueConstraint("project_id", "ref", name="uq_synthesis_project_ref"),)


# ─────────────────────────────────────────────────────────────
# Analysis, opportunities, recommendations
# ─────────────────────────────────────────────────────────────


class Analysis(Base, TimestampMixin):
    __tablename__ = "analyses"

    id: Mapped[uuid.UUID] = _pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    ref: Mapped[str] = mapped_column(String(20), nullable=False)
    analysis_type: Mapped[AnalysisType] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(400), nullable=False)
    summary: Mapped[str] = mapped_column(Text, default="")
    sections: Mapped[list] = mapped_column(JSONType, default=list)
    evidence_refs: Mapped[list] = mapped_column(JSONType, default=list)
    finding_refs: Mapped[list] = mapped_column(JSONType, default=list)
    assumptions: Mapped[list] = mapped_column(JSONType, default=list)
    unknowns: Mapped[list] = mapped_column(JSONType, default=list)
    confidence: Mapped[EvidenceStrength] = mapped_column(String(20), default=EvidenceStrength.MODERATE)
    persona: Mapped[Persona] = mapped_column(String(40), default=Persona.PRODUCT_MANAGER)
    #: Weights and method for prioritization analyses; user-adjustable.
    parameters: Mapped[dict] = mapped_column(JSONType, default=dict)

    project: Mapped[Project] = relationship(back_populates="analyses")

    __table_args__ = (
        UniqueConstraint("project_id", "ref", name="uq_analysis_project_ref"),
        Index("ix_analyses_project_type", "project_id", "analysis_type"),
    )


class Opportunity(Base, TimestampMixin):
    __tablename__ = "opportunities"

    id: Mapped[uuid.UUID] = _pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    analysis_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("analyses.id", ondelete="SET NULL"), nullable=True
    )
    ref: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(400), nullable=False)
    problem: Mapped[str] = mapped_column(Text, default="")
    user: Mapped[str] = mapped_column(String(300), default="")
    evidence_refs: Mapped[list] = mapped_column(JSONType, default=list)
    finding_refs: Mapped[list] = mapped_column(JSONType, default=list)
    insight: Mapped[str] = mapped_column(Text, default="")
    desired_outcome: Mapped[str] = mapped_column(Text, default="")
    solution_directions: Mapped[list] = mapped_column(JSONType, default=list)
    value_hypothesis: Mapped[str] = mapped_column(Text, default="")
    business_value: Mapped[str] = mapped_column(Text, default="")
    confidence: Mapped[EvidenceStrength] = mapped_column(String(20), default=EvidenceStrength.MODERATE)
    assumptions: Mapped[list] = mapped_column(JSONType, default=list)
    dependencies: Mapped[list] = mapped_column(JSONType, default=list)
    risks: Mapped[list] = mapped_column(JSONType, default=list)
    validation_plan: Mapped[list] = mapped_column(JSONType, default=list)
    status: Mapped[OpportunityStatus] = mapped_column(
        String(30), default=OpportunityStatus.IDENTIFIED
    )
    priority_scores: Mapped[dict] = mapped_column(JSONType, default=dict)

    project: Mapped[Project] = relationship(back_populates="opportunities")

    __table_args__ = (
        UniqueConstraint("project_id", "ref", name="uq_opportunity_project_ref"),
        Index("ix_opportunities_project_status", "project_id", "status"),
    )


class Recommendation(Base, TimestampMixin):
    __tablename__ = "recommendations"

    id: Mapped[uuid.UUID] = _pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    analysis_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("analyses.id", ondelete="SET NULL"), nullable=True
    )
    opportunity_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("opportunities.id", ondelete="SET NULL"), nullable=True
    )
    ref: Mapped[str] = mapped_column(String(20), nullable=False)
    recommendation: Mapped[str] = mapped_column(Text, nullable=False)
    why: Mapped[str] = mapped_column(Text, default="")
    evidence_refs: Mapped[list] = mapped_column(JSONType, default=list)
    finding_refs: Mapped[list] = mapped_column(JSONType, default=list)
    expected_value: Mapped[str] = mapped_column(Text, default="")
    who_benefits: Mapped[str] = mapped_column(Text, default="")
    assumptions: Mapped[list] = mapped_column(JSONType, default=list)
    risks: Mapped[list] = mapped_column(JSONType, default=list)
    confidence: Mapped[EvidenceStrength] = mapped_column(String(20), default=EvidenceStrength.MODERATE)
    what_would_change_it: Mapped[str] = mapped_column(Text, default="")
    next_validation_step: Mapped[str] = mapped_column(Text, default="")
    #: Recommendations are editable; user edits win over regeneration.
    user_edited: Mapped[bool] = mapped_column(Boolean, default=False)

    __table_args__ = (UniqueConstraint("project_id", "ref", name="uq_recommendation_project_ref"),)


class UseCase(Base, TimestampMixin):
    __tablename__ = "use_cases"

    id: Mapped[uuid.UUID] = _pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    analysis_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("analyses.id", ondelete="SET NULL"), nullable=True
    )
    opportunity_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("opportunities.id", ondelete="SET NULL"), nullable=True
    )
    ref: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(400), nullable=False)
    actor: Mapped[str] = mapped_column(String(200), default="")
    problem: Mapped[str] = mapped_column(Text, default="")
    trigger: Mapped[str] = mapped_column(Text, default="")
    context: Mapped[str] = mapped_column(Text, default="")
    current_behavior: Mapped[str] = mapped_column(Text, default="")
    desired_outcome: Mapped[str] = mapped_column(Text, default="")
    proposed_capability: Mapped[str] = mapped_column(Text, default="")
    user_value: Mapped[str] = mapped_column(Text, default="")
    business_value: Mapped[str] = mapped_column(Text, default="")
    evidence_refs: Mapped[list] = mapped_column(JSONType, default=list)
    evidence_strength: Mapped[EvidenceStrength] = mapped_column(
        String(20), default=EvidenceStrength.MODERATE
    )
    dependencies: Mapped[list] = mapped_column(JSONType, default=list)
    risks: Mapped[list] = mapped_column(JSONType, default=list)
    #: Qualitative, with its reason — never a number pretending to be an estimate,
    #: so this needs room for the reason.
    complexity: Mapped[str] = mapped_column(String(200), default="unknown")
    success_metric: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(30), default="candidate")

    __table_args__ = (UniqueConstraint("project_id", "ref", name="uq_use_case_project_ref"),)


# ─────────────────────────────────────────────────────────────
# Artifacts
# ─────────────────────────────────────────────────────────────


class Artifact(Base, TimestampMixin):
    __tablename__ = "artifacts"

    id: Mapped[uuid.UUID] = _pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    ref: Mapped[str] = mapped_column(String(20), nullable=False)
    artifact_type: Mapped[ArtifactType] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(400), nullable=False)
    current_version: Mapped[int] = mapped_column(Integer, default=1)
    persona: Mapped[Persona] = mapped_column(String(40), default=Persona.PRODUCT_MANAGER)
    #: The evidence, findings, analyses and opportunities this was built from.
    inputs: Mapped[dict] = mapped_column(JSONType, default=dict)

    project: Mapped[Project] = relationship(back_populates="artifacts")
    versions: Mapped[list[ArtifactVersion]] = relationship(
        back_populates="artifact", cascade="all, delete-orphan", order_by="ArtifactVersion.version"
    )

    __table_args__ = (UniqueConstraint("project_id", "ref", name="uq_artifact_project_ref"),)


class ArtifactVersion(Base, TimestampMixin):
    __tablename__ = "artifact_versions"

    id: Mapped[uuid.UUID] = _pk()
    artifact_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("artifacts.id", ondelete="CASCADE"), index=True
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(400), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    sections: Mapped[list] = mapped_column(JSONType, default=list)
    evidence_refs: Mapped[list] = mapped_column(JSONType, default=list)
    open_questions: Mapped[list] = mapped_column(JSONType, default=list)
    #: Result of the artifact critic for this version.
    critique: Mapped[dict] = mapped_column(JSONType, default=dict)
    #: What changed vs the previous version, and why.
    change_summary: Mapped[str] = mapped_column(Text, default="")
    changed_sections: Mapped[list] = mapped_column(JSONType, default=list)
    evidence_delta: Mapped[dict] = mapped_column(JSONType, default=dict)

    artifact: Mapped[Artifact] = relationship(back_populates="versions")
    citations: Mapped[list[Citation]] = relationship(
        back_populates="artifact_version", cascade="all, delete-orphan"
    )

    __table_args__ = (UniqueConstraint("artifact_id", "version", name="uq_version_artifact"),)


class Citation(Base, TimestampMixin):
    """Binds a sentence in a generated document to the evidence behind it.

    Persisted rather than derived so citations survive export.
    """

    __tablename__ = "citations"

    id: Mapped[uuid.UUID] = _pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    artifact_version_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("artifact_versions.id", ondelete="CASCADE"), nullable=True
    )
    evidence_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("evidence.id", ondelete="SET NULL"), nullable=True
    )
    evidence_ref: Mapped[str] = mapped_column(String(20), nullable=False)
    section_heading: Mapped[str | None] = mapped_column(String(400), nullable=True)
    quoted_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    artifact_version: Mapped[ArtifactVersion | None] = relationship(back_populates="citations")


# ─────────────────────────────────────────────────────────────
# Prompt library
# ─────────────────────────────────────────────────────────────


class PromptTemplate(Base, TimestampMixin):
    """Registry mirror of the version-controlled files in /prompts."""

    __tablename__ = "prompt_templates"

    id: Mapped[uuid.UUID] = _pk()
    key: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    stage: Mapped[str] = mapped_column(String(60), default="")
    purpose: Mapped[str] = mapped_column(Text, default="")
    current_version: Mapped[str] = mapped_column(String(20), default="1.0.0")

    versions: Mapped[list[PromptVersion]] = relationship(
        back_populates="template", cascade="all, delete-orphan"
    )


class PromptVersion(Base, TimestampMixin):
    __tablename__ = "prompt_versions"

    id: Mapped[uuid.UUID] = _pk()
    template_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("prompt_templates.id", ondelete="CASCADE"), index=True
    )
    version: Mapped[str] = mapped_column(String(20), nullable=False)
    inputs: Mapped[list] = mapped_column(JSONType, default=list)
    instructions: Mapped[str] = mapped_column(Text, default="")
    output_schema: Mapped[str] = mapped_column(String(120), default="")
    guardrails: Mapped[list] = mapped_column(JSONType, default=list)
    examples: Mapped[list] = mapped_column(JSONType, default=list)
    checksum: Mapped[str] = mapped_column(String(64), default="")

    template: Mapped[PromptTemplate] = relationship(back_populates="versions")

    __table_args__ = (UniqueConstraint("template_id", "version", name="uq_prompt_version"),)


# ─────────────────────────────────────────────────────────────
# Ingestion, jobs, governance
# ─────────────────────────────────────────────────────────────


class UploadedDocument(Base, TimestampMixin):
    """Internal material. Never used to form a public search query."""

    __tablename__ = "uploaded_documents"

    id: Mapped[uuid.UUID] = _pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    ref: Mapped[str] = mapped_column(String(20), nullable=False)
    filename: Mapped[str] = mapped_column(String(400), nullable=False)
    content_type: Mapped[str] = mapped_column(String(120), default="")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    storage_key: Mapped[str] = mapped_column(Text, default="")
    document_kind: Mapped[str] = mapped_column(String(60), default="other")
    origin: Mapped[EvidenceOrigin] = mapped_column(String(20), default=EvidenceOrigin.INTERNAL)
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    page_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default="uploaded")
    #: Result of the PHI/PII scan performed before any model call.
    phi_scan: Mapped[dict] = mapped_column(JSONType, default=dict)

    project: Mapped[Project] = relationship(back_populates="documents")

    __table_args__ = (UniqueConstraint("project_id", "ref", name="uq_document_project_ref"),)


class Job(Base, TimestampMixin):
    """Long-running work: research runs, ingestion, exports."""

    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = _pk()
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True
    )
    kind: Mapped[str] = mapped_column(String(60), nullable=False)
    status: Mapped[JobStatus] = mapped_column(String(30), default=JobStatus.QUEUED)
    payload: Mapped[dict] = mapped_column(JSONType, default=dict)
    result: Mapped[dict] = mapped_column(JSONType, default=dict)
    progress: Mapped[list] = mapped_column(JSONType, default=list)
    message: Mapped[str] = mapped_column(Text, default="")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = _pk()
    workspace_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workspaces.id", ondelete="SET NULL"), nullable=True
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True
    )
    actor: Mapped[str] = mapped_column(String(200), default="system")
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(80), default="")
    entity_id: Mapped[str] = mapped_column(String(80), default="")
    detail: Mapped[dict] = mapped_column(JSONType, default=dict)


class CoverageSnapshot(Base, TimestampMixin):
    """Qualitative coverage per dimension. No invented completeness score."""

    __tablename__ = "coverage_snapshots"

    id: Mapped[uuid.UUID] = _pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    dimension: Mapped[str] = mapped_column(String(40), nullable=False)
    level: Mapped[CoverageLevel] = mapped_column(String(30), default=CoverageLevel.NOT_RESEARCHED)
    evidence_count: Mapped[int] = mapped_column(Integer, default=0)
    tier1_count: Mapped[int] = mapped_column(Integer, default=0)
    rationale: Mapped[str] = mapped_column(Text, default="")

    project: Mapped[Project] = relationship(back_populates="coverage")

    __table_args__ = (UniqueConstraint("project_id", "dimension", name="uq_coverage_project_dim"),)

"""Request and response models for the HTTP API.

Separate from `contracts.py`: those are the objects agents exchange, these are
what the web client sees. Keeping them apart means an internal pipeline change
does not silently alter the public API shape.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.domain.enums import (
    AnalysisType,
    ArtifactType,
    CoverageLevel,
    EvidenceOrigin,
    EvidenceStrength,
    EvidenceType,
    ExportFormat,
    JobStatus,
    KnowledgeState,
    OpportunityStatus,
    Persona,
    PrioritizationMethod,
    ProjectStatus,
    ResearchDepth,
    ResearchType,
    SourceTier,
    SourceType,
)


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ── Projects ─────────────────────────────────────────────────


class CreateProjectRequest(BaseModel):
    question: str = Field(min_length=8, description="What the user wants to understand or decide")
    title: str | None = None
    persona: Persona = Persona.PRODUCT_MANAGER
    depth: ResearchDepth = ResearchDepth.STANDARD
    #: Run context normalization immediately. Off for tests and bulk imports.
    normalize: bool = True


class AssumptionOut(BaseModel):
    field: str
    value: str
    rationale: str
    confidence: KnowledgeState = KnowledgeState.LIKELY


class ProjectContextOut(ORMModel):
    objective: str
    decision: str
    domain: str
    subdomain: str | None
    product_type: str | None
    primary_user: str | None
    secondary_users: list[str]
    geography: str | None
    organization_context: str | None
    discovery_stage: str | None
    constraints: list[str]
    assumptions: list[dict]
    user_edited_fields: list[str]
    clarifications: list[dict]


class UpdateContextRequest(BaseModel):
    objective: str | None = None
    decision: str | None = None
    domain: str | None = None
    subdomain: str | None = None
    product_type: str | None = None
    primary_user: str | None = None
    secondary_users: list[str] | None = None
    geography: str | None = None
    organization_context: str | None = None
    discovery_stage: str | None = None
    constraints: list[str] | None = None


class ProjectSummary(ORMModel):
    id: uuid.UUID
    title: str
    question: str
    status: ProjectStatus
    persona: Persona
    created_at: datetime
    updated_at: datetime


class ProjectCounts(BaseModel):
    sources: int = 0
    evidence: int = 0
    themes: int = 0
    findings: int = 0
    insights: int = 0
    analyses: int = 0
    opportunities: int = 0
    use_cases: int = 0
    artifacts: int = 0
    documents: int = 0
    open_questions: int = 0


class CoverageEntryOut(ORMModel):
    """Also validates a CoverageSnapshot row directly, since ProjectDetail
    picks the ORM relationship up before the computed report replaces it."""

    dimension: str
    level: CoverageLevel
    evidence_count: int
    tier1_count: int
    rationale: str


class ProjectDetail(ProjectSummary):
    context: ProjectContextOut | None = None
    counts: ProjectCounts = ProjectCounts()
    coverage: list[CoverageEntryOut] = []
    latest_synthesis_ref: str | None = None
    has_plan: bool = False


# ── Research ─────────────────────────────────────────────────


class PlanResearchRequest(BaseModel):
    depth: ResearchDepth = ResearchDepth.STANDARD


class ResearchQuestionOut(ORMModel):
    id: uuid.UUID
    ref: str
    position: int
    question: str
    why: str
    research_types: list[str]
    expected_evidence: str
    answerable_by_secondary: bool
    queries: list[dict]
    enabled: bool
    status: str
    evidence_count: int


class ResearchPlanOut(ORMModel):
    id: uuid.UUID
    ref: str
    version: int
    objective: str
    decision_supported: str
    depth: ResearchDepth
    research_types: list[str]
    planned_sources: list[dict]
    primary_research_needed: list[dict]
    anticipated_gaps: list[str]
    out_of_scope: list[str]
    human_readable_plan: str
    approved: bool
    questions: list[ResearchQuestionOut] = []


class UpdatePlanRequest(BaseModel):
    """Every part of the plan is editable before it runs."""

    objective: str | None = None
    decision_supported: str | None = None
    depth: ResearchDepth | None = None
    planned_sources: list[dict] | None = None
    anticipated_gaps: list[str] | None = None
    out_of_scope: list[str] | None = None
    approved: bool | None = None


class UpdateQuestionRequest(BaseModel):
    question: str | None = None
    why: str | None = None
    research_types: list[ResearchType] | None = None
    expected_evidence: str | None = None
    queries: list[dict] | None = None
    enabled: bool | None = None


class AddQuestionRequest(BaseModel):
    question: str
    why: str = ""
    research_types: list[ResearchType] = [ResearchType.PROBLEM_DOMAIN]
    expected_evidence: str = ""


class RunResearchRequest(BaseModel):
    plan_id: uuid.UUID | None = None
    depth: ResearchDepth | None = None
    question_refs: list[str] | None = None


class ResearchRunOut(ORMModel):
    id: uuid.UUID
    ref: str
    status: JobStatus
    depth: ResearchDepth
    research_types: list[str]
    progress: list[dict]
    sources_examined: int
    evidence_extracted: int
    started_at: datetime | None
    completed_at: datetime | None
    error: str | None
    provider_meta: dict


# ── Sources and evidence ─────────────────────────────────────


class SourceOut(ORMModel):
    id: uuid.UUID
    ref: str
    title: str
    url: str | None
    publisher: str | None
    source_type: SourceType
    tier: SourceTier
    origin: EvidenceOrigin
    publication_date: date | None
    date_accessed: date | None
    geography: str | None
    research_types: list[str]
    snippet: str | None
    assessment: str | None


class EvidenceOut(ORMModel):
    id: uuid.UUID
    ref: str
    statement: str
    excerpt: str
    evidence_type: EvidenceType
    origin: EvidenceOrigin
    research_type: ResearchType
    population: str | None
    geography: str | None
    period: str | None
    quantities: list[str]
    tags: list[str]
    relevance: str
    limitations: list[str]
    strength: EvidenceStrength
    strength_reasoning: str
    corroboration_count: int
    corroborated_by: list[str]
    contradicted_by: list[str]
    contradiction_flag: bool
    population_note: str | None
    notes: str | None
    source: SourceOut


class EvidenceListOut(BaseModel):
    items: list[EvidenceOut]
    total: int
    facets: dict[str, dict[str, int]] = {}


class ImportEvidenceRequest(BaseModel):
    """Manually add evidence, e.g. from a source the platform cannot fetch."""

    source_title: str
    source_url: str | None = None
    publisher: str | None = None
    source_type: SourceType = SourceType.INTERNAL_DOCUMENT
    tier: SourceTier = SourceTier.TIER_3_MARKET_USER
    origin: EvidenceOrigin = EvidenceOrigin.INTERNAL
    publication_date: date | None = None
    research_type: ResearchType = ResearchType.PROBLEM_DOMAIN
    items: list[dict]


# ── Synthesis ────────────────────────────────────────────────


class ThemeOut(ORMModel):
    id: uuid.UUID
    ref: str
    name: str
    description: str
    prevalence: str | None
    evidence_refs: list[str]


class FindingOut(ORMModel):
    id: uuid.UUID
    ref: str
    title: str
    finding: str
    evidence_refs: list[str]
    affected_personas: list[str]
    themes: list[str]
    prevalence: str | None
    why_it_matters: str
    confidence: EvidenceStrength
    knowledge_state: KnowledgeState
    limitations: list[str]


class InsightOut(ORMModel):
    id: uuid.UUID
    ref: str
    title: str
    insight: str
    finding_refs: list[str]
    why_it_matters: str
    product_implication: str
    confidence: EvidenceStrength
    knowledge_state: KnowledgeState


class SynthesisOut(ORMModel):
    id: uuid.UUID
    ref: str
    version: int
    executive_summary: str
    research_objective: str
    research_approach: str
    sources_examined: int
    evidence_examined: int
    contradictions: list[dict]
    evidence_gaps: list[dict]
    emerging_opportunities: list[str]
    primary_research_questions: list[str]
    next_steps: list[str]


class FindingsOut(BaseModel):
    synthesis: SynthesisOut | None = None
    themes: list[ThemeOut] = []
    findings: list[FindingOut] = []
    insights: list[InsightOut] = []


# ── Analysis ─────────────────────────────────────────────────


class RunAnalysisRequest(BaseModel):
    analysis_types: list[AnalysisType] = Field(min_length=1)
    persona: Persona | None = None
    parameters: dict[str, Any] = {}


class AnalysisOut(ORMModel):
    id: uuid.UUID
    ref: str
    analysis_type: AnalysisType
    title: str
    summary: str
    sections: list[dict]
    evidence_refs: list[str]
    finding_refs: list[str]
    assumptions: list[str]
    unknowns: list[str]
    confidence: EvidenceStrength
    persona: Persona
    parameters: dict
    created_at: datetime


class AnalysisRecommendationOut(BaseModel):
    analysis_type: AnalysisType
    label: str
    why: str
    priority: int


class AnalysisRoutingOut(BaseModel):
    recommended: list[AnalysisRecommendationOut]
    reasoning: str
    available: list[dict]


class PrioritizeRequest(BaseModel):
    method: PrioritizationMethod = PrioritizationMethod.RICE
    weights: dict[str, float] = {}
    target: str = "opportunities"


# ── Opportunities, use cases, recommendations ────────────────


class OpportunityOut(ORMModel):
    id: uuid.UUID
    ref: str
    title: str
    problem: str
    user: str
    evidence_refs: list[str]
    finding_refs: list[str]
    insight: str
    desired_outcome: str
    solution_directions: list[str]
    value_hypothesis: str
    business_value: str
    confidence: EvidenceStrength
    assumptions: list[str]
    dependencies: list[str]
    risks: list[str]
    validation_plan: list[str]
    status: OpportunityStatus
    priority_scores: dict


class UpdateOpportunityRequest(BaseModel):
    title: str | None = None
    problem: str | None = None
    user: str | None = None
    desired_outcome: str | None = None
    value_hypothesis: str | None = None
    business_value: str | None = None
    status: OpportunityStatus | None = None
    solution_directions: list[str] | None = None
    validation_plan: list[str] | None = None


class UseCaseOut(ORMModel):
    id: uuid.UUID
    ref: str
    title: str
    actor: str
    problem: str
    trigger: str
    context: str
    current_behavior: str
    desired_outcome: str
    proposed_capability: str
    user_value: str
    business_value: str
    evidence_refs: list[str]
    evidence_strength: EvidenceStrength
    dependencies: list[str]
    risks: list[str]
    complexity: str
    success_metric: str
    status: str


class RecommendationOut(ORMModel):
    id: uuid.UUID
    ref: str
    recommendation: str
    why: str
    evidence_refs: list[str]
    finding_refs: list[str]
    expected_value: str
    who_benefits: str
    assumptions: list[str]
    risks: list[str]
    confidence: EvidenceStrength
    what_would_change_it: str
    next_validation_step: str
    user_edited: bool


class UpdateRecommendationRequest(BaseModel):
    recommendation: str | None = None
    why: str | None = None
    expected_value: str | None = None
    assumptions: list[str] | None = None
    risks: list[str] | None = None
    next_validation_step: str | None = None


# ── Artifacts ────────────────────────────────────────────────


class GenerateArtifactRequest(BaseModel):
    artifact_type: ArtifactType
    title: str | None = None
    persona: Persona | None = None
    evidence_refs: list[str] | None = None
    finding_refs: list[str] | None = None
    analysis_refs: list[str] | None = None
    opportunity_refs: list[str] | None = None
    use_case_refs: list[str] | None = None


class RegenerateSectionRequest(BaseModel):
    heading: str
    instruction: str = ""


class ArtifactVersionOut(ORMModel):
    id: uuid.UUID
    version: int
    title: str
    summary: str
    sections: list[dict]
    evidence_refs: list[str]
    open_questions: list[str]
    critique: dict
    change_summary: str
    changed_sections: list[str]
    evidence_delta: dict
    created_at: datetime


class ArtifactOut(ORMModel):
    id: uuid.UUID
    ref: str
    artifact_type: ArtifactType
    title: str
    current_version: int
    persona: Persona
    inputs: dict
    created_at: datetime
    updated_at: datetime


class ArtifactDetail(ArtifactOut):
    version: ArtifactVersionOut | None = None
    export_formats: list[str] = []


class ExportRequest(BaseModel):
    format: ExportFormat = ExportFormat.DOCX
    version: int | None = None


# ── Uploads, jobs, copilot ───────────────────────────────────


class UploadedDocumentOut(ORMModel):
    id: uuid.UUID
    ref: str
    filename: str
    content_type: str
    size_bytes: int
    document_kind: str
    origin: EvidenceOrigin
    page_count: int
    status: str
    phi_scan: dict
    created_at: datetime


class JobOut(ORMModel):
    id: uuid.UUID
    project_id: uuid.UUID | None
    kind: str
    status: JobStatus
    message: str
    progress: list[dict]
    result: dict
    error: str | None
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime


class CopilotRequest(BaseModel):
    question: str = Field(min_length=2)
    focus_refs: list[str] | None = None


class CopilotResponse(BaseModel):
    answer: str
    evidence_refs: list[str]
    knowledge_state: KnowledgeState
    caveats: list[str]
    suggested_actions: list[str]
    evidence: list[EvidenceOut] = []


# ── Prompt library ───────────────────────────────────────────


class PromptOut(BaseModel):
    key: str
    name: str
    stage: str
    version: str
    purpose: str
    inputs: list[dict]
    output_schema: str | None
    guardrails: list[str]
    instructions: str
    checksum: str


class HealthOut(BaseModel):
    status: str
    version: str
    database: dict
    llm: dict
    search: dict
    embeddings: dict
    prompts: dict
    safety: dict

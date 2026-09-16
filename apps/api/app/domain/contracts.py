"""Structured contracts exchanged between orchestration stages.

Agents communicate through these objects rather than free-form prose. That is
what preserves provenance: a Finding carries the evidence ids it rests on, an
Insight carries the finding ids, and a Recommendation carries both. Nothing in
the chain can quietly become unsourced.

Each model doubles as the JSON schema handed to the model provider, so the
contract in code and the contract in the prompt cannot drift apart.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from .enums import (
    AnalysisType,
    CoverageLevel,
    EvidenceStrength,
    EvidenceType,
    KnowledgeState,
    ResearchDepth,
    ResearchType,
    SourceTier,
    SourceType,
)


class Contract(BaseModel):
    """Base for every inter-agent object."""

    model_config = ConfigDict(use_enum_values=False, populate_by_name=True)

    @classmethod
    def json_contract(cls) -> dict:
        """The JSON schema given to the model provider for structured output."""
        return cls.model_json_schema()


# ─────────────────────────────────────────────────────────────
# 1. Context
# ─────────────────────────────────────────────────────────────


class Assumption(Contract):
    field: str = Field(description="Which context field this assumption fills")
    value: str
    rationale: str = Field(description="Why this was inferred from the user's question")
    confidence: KnowledgeState = KnowledgeState.LIKELY


class NormalizedContext(Contract):
    """Inferred project framing. Every field is user-editable."""

    objective: str = Field(description="What the user is trying to understand or decide")
    decision: str = Field(description="The decision this research should inform")
    domain: str
    subdomain: str | None = None
    product_type: str | None = None
    primary_user: str | None = None
    secondary_users: list[str] = Field(default_factory=list)
    geography: str | None = None
    organization_context: str | None = None
    discovery_stage: str | None = None
    constraints: list[str] = Field(default_factory=list)
    assumptions: list[Assumption] = Field(
        default_factory=list, description="Inferred values shown to the user for correction"
    )


class ClarifyingQuestion(Contract):
    question: str
    why_it_matters: str = Field(description="How a different answer changes the research approach")
    suggested_default: str | None = None


class ClarificationSet(Contract):
    """Zero to three questions. Asked only when the answer changes the approach."""

    questions: list[ClarifyingQuestion] = Field(default_factory=list, max_length=3)
    proceed_without_answers: bool = True


# ─────────────────────────────────────────────────────────────
# 2. Research planning
# ─────────────────────────────────────────────────────────────


class SearchQuery(Contract):
    query: str
    research_type: ResearchType
    intent: str = Field(description="What this specific query is meant to surface")
    preferred_domains: list[str] = Field(
        default_factory=list, description="Site domains to prefer, e.g. cms.gov"
    )
    expected_tier: SourceTier = SourceTier.TIER_2_STRONG_SECONDARY


class ResearchQuestionSpec(Contract):
    question: str
    research_types: list[ResearchType]
    why: str
    expected_evidence: str = Field(description="What would count as a useful answer")
    answerable_by_secondary: bool = True
    queries: list[SearchQuery] = Field(default_factory=list)


class PrimaryResearchNeed(Contract):
    question: str
    method: str = Field(description="Interviews, survey, usability test, diary study, ...")
    participant_profile: str
    why_secondary_is_insufficient: str


class PlannedSource(Contract):
    name: str
    url: str | None = None
    source_type: SourceType
    tier: SourceTier
    why: str
    research_types: list[ResearchType] = Field(default_factory=list)


class ResearchPlanContract(Contract):
    """The minimum sufficient strategy to answer the question reliably."""

    objective: str
    decision_supported: str
    depth: ResearchDepth
    research_questions: list[ResearchQuestionSpec]
    research_types: list[ResearchType]
    planned_sources: list[PlannedSource]
    primary_research_needed: list[PrimaryResearchNeed] = Field(default_factory=list)
    anticipated_gaps: list[str] = Field(
        default_factory=list, description="What secondary research probably cannot establish"
    )
    out_of_scope: list[str] = Field(default_factory=list)
    human_readable_plan: str = Field(description="The plan as prose, for the research brief")


# ─────────────────────────────────────────────────────────────
# 3. Evidence
# ─────────────────────────────────────────────────────────────


class EvidenceContract(Contract):
    """One atomic, attributable piece of evidence.

    Not a summary of an article — a single statement the source actually makes.
    """

    statement: str = Field(description="The extracted fact, claim or observation")
    evidence_type: EvidenceType
    excerpt: str = Field(description="Verbatim text from the source supporting the statement")
    population: str | None = Field(
        default=None, description="Who the statement is about. Never widened beyond the source."
    )
    geography: str | None = None
    period: str | None = Field(default=None, description="Timeframe the statement refers to")
    theme_candidates: list[str] = Field(default_factory=list)
    relevance: str = Field(description="How this bears on the research question")
    limitations: list[str] = Field(
        default_factory=list, description="Methodology, sample or scope caveats"
    )
    quantities: list[str] = Field(
        default_factory=list, description="Figures as stated by the source, never derived"
    )


class EvidenceExtraction(Contract):
    items: list[EvidenceContract] = Field(default_factory=list)
    source_assessment: str = Field(default="", description="What this source is and is not good for")
    not_relevant: bool = False


class EvidenceCritique(Contract):
    """Output of the evidence critic — quality control before synthesis."""

    evidence_ref: str
    strength: EvidenceStrength
    reasoning: str = Field(description="Why this label, in plain language")
    authority_note: str | None = None
    recency_note: str | None = None
    population_note: str | None = Field(
        default=None, description="Flagged when a population was generalized beyond the source"
    )
    corroborated_by: list[str] = Field(default_factory=list)
    contradicted_by: list[str] = Field(default_factory=list)
    should_discard: bool = False
    discard_reason: str | None = None


# ─────────────────────────────────────────────────────────────
# 4. Synthesis
# ─────────────────────────────────────────────────────────────


class ThemeContract(Contract):
    name: str
    description: str
    evidence_refs: list[str]
    prevalence: str | None = Field(
        default=None, description="How widely this appears across sources, as observed"
    )


class FindingContract(Contract):
    """A pattern that holds across evidence — not a restatement of one source."""

    title: str
    finding: str
    evidence_refs: list[str] = Field(min_length=1)
    affected_personas: list[str] = Field(default_factory=list)
    themes: list[str] = Field(default_factory=list)
    prevalence: str | None = None
    why_it_matters: str
    confidence: EvidenceStrength
    knowledge_state: KnowledgeState = KnowledgeState.KNOWN
    limitations: list[str] = Field(default_factory=list)


class InsightContract(Contract):
    """Why a finding matters. Rests on findings, never directly on sources."""

    title: str
    insight: str
    finding_refs: list[str] = Field(min_length=1)
    why_it_matters: str
    product_implication: str
    confidence: EvidenceStrength
    knowledge_state: KnowledgeState = KnowledgeState.LIKELY


class ContradictionContract(Contract):
    """Competing evidence, surfaced rather than reconciled away."""

    topic: str
    position_a: str
    evidence_refs_a: list[str]
    position_b: str
    evidence_refs_b: list[str]
    assessment: str = Field(description="What explains the disagreement, if anything")
    resolution: KnowledgeState = KnowledgeState.UNKNOWN


class EvidenceGapContract(Contract):
    gap: str
    why_it_matters: str
    can_secondary_research_close_it: bool
    suggested_approach: str


class SynthesisContract(Contract):
    """The full output of the synthesis engine."""

    executive_summary: str
    research_objective: str
    research_approach: str
    sources_examined: int = 0
    themes: list[ThemeContract] = Field(default_factory=list)
    findings: list[FindingContract] = Field(default_factory=list)
    insights: list[InsightContract] = Field(default_factory=list)
    contradictions: list[ContradictionContract] = Field(default_factory=list)
    evidence_gaps: list[EvidenceGapContract] = Field(default_factory=list)
    emerging_opportunities: list[str] = Field(default_factory=list)
    primary_research_questions: list[str] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)


# ─────────────────────────────────────────────────────────────
# 5. Analysis
# ─────────────────────────────────────────────────────────────


class AnalysisRecommendation(Contract):
    analysis_type: AnalysisType
    why: str
    priority: int = Field(ge=1, le=5, default=3)


class AnalysisRouting(Contract):
    recommended: list[AnalysisRecommendation] = Field(default_factory=list)
    reasoning: str = ""


class AnalysisSection(Contract):
    """One block of an analysis result.

    `rows` carries tabular analyses (pain points, competitive gaps, use cases);
    `points` carries list-shaped ones (SWOT quadrants). Both may be empty when
    the section is prose.
    """

    heading: str
    body: str = ""
    points: list[str] = Field(default_factory=list)
    rows: list[dict[str, str]] = Field(default_factory=list)
    columns: list[str] = Field(default_factory=list)
    evidence_refs: list[str] = Field(default_factory=list)
    knowledge_state: KnowledgeState = KnowledgeState.KNOWN


class AnalysisContract(Contract):
    analysis_type: AnalysisType
    title: str
    summary: str
    sections: list[AnalysisSection] = Field(default_factory=list)
    evidence_refs: list[str] = Field(default_factory=list)
    finding_refs: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    unknowns: list[str] = Field(default_factory=list)
    confidence: EvidenceStrength = EvidenceStrength.MODERATE


# ─────────────────────────────────────────────────────────────
# 6. Opportunities and recommendations
# ─────────────────────────────────────────────────────────────


class OpportunityContract(Contract):
    title: str
    problem: str
    user: str
    evidence_refs: list[str] = Field(default_factory=list)
    finding_refs: list[str] = Field(default_factory=list)
    insight: str
    desired_outcome: str
    solution_directions: list[str] = Field(default_factory=list)
    value_hypothesis: str
    business_value: str
    confidence: EvidenceStrength = EvidenceStrength.MODERATE
    assumptions: list[str] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    validation_plan: list[str] = Field(default_factory=list)


class RecommendationContract(Contract):
    """A recommendation never appears without its reasoning chain."""

    recommendation: str
    why: str
    evidence_refs: list[str] = Field(default_factory=list)
    finding_refs: list[str] = Field(default_factory=list)
    expected_value: str
    who_benefits: str
    assumptions: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    confidence: EvidenceStrength = EvidenceStrength.MODERATE
    what_would_change_it: str = Field(
        description="The observation that would overturn this recommendation"
    )
    next_validation_step: str


class UseCaseContract(Contract):
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
    evidence_refs: list[str] = Field(default_factory=list)
    evidence_strength: EvidenceStrength = EvidenceStrength.MODERATE
    dependencies: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    complexity: str = "unknown"
    success_metric: str


class PrioritizedItem(Contract):
    item_ref: str
    title: str
    scores: dict[str, float] = Field(default_factory=dict)
    total: float = 0.0
    rank: int = 0
    assumptions: list[str] = Field(
        default_factory=list, description="What each score assumes — always shown with the score"
    )


class PrioritizationContract(Contract):
    method: str
    weights: dict[str, float] = Field(default_factory=dict)
    items: list[PrioritizedItem] = Field(default_factory=list)
    notes: str = ""


# ─────────────────────────────────────────────────────────────
# 7. Artifacts
# ─────────────────────────────────────────────────────────────


class ArtifactSection(Contract):
    heading: str
    body: str = ""
    points: list[str] = Field(default_factory=list)
    rows: list[dict[str, str]] = Field(default_factory=list)
    columns: list[str] = Field(default_factory=list)
    evidence_refs: list[str] = Field(default_factory=list)
    knowledge_state: KnowledgeState = KnowledgeState.KNOWN
    note: str | None = Field(
        default=None, description="Used for Unknown / Assumption / Needs Validation markers"
    )


class ArtifactContract(Contract):
    title: str
    summary: str
    sections: list[ArtifactSection]
    evidence_refs: list[str] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)


class CritiqueIssue(Contract):
    check: str
    severity: str = Field(description="blocking | warning | note")
    detail: str
    section: str | None = None
    correction: str | None = None


class ArtifactCritique(Contract):
    """Quality control run before any artifact is presented."""

    answered_research_question: bool = True
    issues: list[CritiqueIssue] = Field(default_factory=list)
    unsupported_statements: list[str] = Field(default_factory=list)
    overstated_conclusions: list[str] = Field(default_factory=list)
    population_generalizations: list[str] = Field(default_factory=list)
    stale_sources: list[str] = Field(default_factory=list)
    hidden_contradictions: list[str] = Field(default_factory=list)
    assumptions_stated_as_fact: list[str] = Field(default_factory=list)
    citations_preserved: bool = True
    duplication: list[str] = Field(default_factory=list)
    still_unknown: list[str] = Field(default_factory=list)
    passed: bool = True


# ─────────────────────────────────────────────────────────────
# 8. Coverage and copilot
# ─────────────────────────────────────────────────────────────


class CoverageEntry(Contract):
    dimension: str
    level: CoverageLevel
    evidence_count: int = 0
    tier1_count: int = 0
    rationale: str = ""


class CoverageReport(Contract):
    entries: list[CoverageEntry] = Field(default_factory=list)
    weakest: list[str] = Field(default_factory=list)


class CopilotAnswer(Contract):
    answer: str
    evidence_refs: list[str] = Field(default_factory=list)
    knowledge_state: KnowledgeState = KnowledgeState.KNOWN
    caveats: list[str] = Field(default_factory=list)
    suggested_actions: list[str] = Field(default_factory=list)


# ─────────────────────────────────────────────────────────────
# 9. Container contracts
#
# Several stages produce a list. Providers return a single object, so each
# list-shaped stage gets a named container rather than a bare array.
# ─────────────────────────────────────────────────────────────


class SearchQuerySet(Contract):
    queries: list[SearchQuery] = Field(default_factory=list)


class PlannedSourceSet(Contract):
    sources: list[PlannedSource] = Field(default_factory=list)
    routing_rationale: str = ""


class EvidenceCritiqueSet(Contract):
    critiques: list[EvidenceCritique] = Field(default_factory=list)


class ThemeSet(Contract):
    themes: list[ThemeContract] = Field(default_factory=list)
    unclustered_evidence_refs: list[str] = Field(
        default_factory=list, description="Outliers, reported rather than forced into a cluster"
    )


class EvidenceGapSet(Contract):
    gaps: list[EvidenceGapContract] = Field(default_factory=list)


class OpportunitySet(Contract):
    opportunities: list[OpportunityContract] = Field(default_factory=list)


class RecommendationSet(Contract):
    recommendations: list[RecommendationContract] = Field(default_factory=list)


class UseCaseSet(Contract):
    use_cases: list[UseCaseContract] = Field(default_factory=list)
    evidence_supports_count: int = Field(
        default=0, description="How many the evidence actually supports, if fewer than requested"
    )

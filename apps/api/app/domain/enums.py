"""The controlled vocabulary of the discovery domain.

These enums are the product's shared language. The orchestration layer, the
database, the API and the UI all speak in these terms, which is what keeps a
claim traceable from an artifact sentence back to the source excerpt it came
from.
"""

from __future__ import annotations

from enum import StrEnum


class Persona(StrEnum):
    """The lens applied to shared evidence.

    Persona changes interpretation and output emphasis. It never changes the
    underlying evidence.
    """

    BUSINESS_ANALYST = "business_analyst"
    PRODUCT_MANAGER = "product_manager"
    SENIOR_PM = "senior_pm"
    DIRECTOR_VP = "director_vp"
    UX_RESEARCHER = "ux_researcher"
    TECHNICAL_PM = "technical_pm"


class ResearchType(StrEnum):
    MARKET = "market"
    COMPETITIVE = "competitive"
    VOICE_OF_CUSTOMER = "voice_of_customer"
    USER = "user"
    PROBLEM_DOMAIN = "problem_domain"
    REGULATORY = "regulatory"
    TECHNOLOGY = "technology"
    SCIENTIFIC_CLINICAL = "scientific_clinical"
    BUSINESS_COMMERCIAL = "business_commercial"
    WORKFLOW_OPERATIONAL = "workflow_operational"
    DATA = "data"
    SOLUTION_VENDOR = "solution_vendor"


class ResearchDepth(StrEnum):
    QUICK_SCAN = "quick_scan"
    STANDARD = "standard"
    DEEP = "deep"


class SourceTier(StrEnum):
    """Authority tiers. Sources are explicitly not equal."""

    TIER_1_AUTHORITATIVE = "tier_1_authoritative"
    TIER_2_STRONG_SECONDARY = "tier_2_strong_secondary"
    TIER_3_MARKET_USER = "tier_3_market_user"
    TIER_4_GENERAL_WEB = "tier_4_general_web"

    @property
    def rank(self) -> int:
        return {
            "tier_1_authoritative": 1,
            "tier_2_strong_secondary": 2,
            "tier_3_market_user": 3,
            "tier_4_general_web": 4,
        }[self.value]

    @property
    def label(self) -> str:
        return {
            "tier_1_authoritative": "Primary / Authoritative",
            "tier_2_strong_secondary": "Strong Secondary",
            "tier_3_market_user": "Market / User Evidence",
            "tier_4_general_web": "General Web",
        }[self.value]


class SourceType(StrEnum):
    GOVERNMENT = "government"
    REGULATOR = "regulator"
    DATASET = "dataset"
    CLINICAL_REGISTRY = "clinical_registry"
    ACADEMIC = "academic"
    STANDARDS_BODY = "standards_body"
    COMPANY_FILING = "company_filing"
    PRODUCT_DOCUMENTATION = "product_documentation"
    RESEARCH_ORGANIZATION = "research_organization"
    INDUSTRY_PUBLICATION = "industry_publication"
    ANALYST_RESEARCH = "analyst_research"
    PROFESSIONAL_ASSOCIATION = "professional_association"
    REVIEW_PLATFORM = "review_platform"
    APP_STORE = "app_store"
    COMMUNITY_FORUM = "community_forum"
    SOCIAL_MEDIA = "social_media"
    NEWS = "news"
    BLOG = "blog"
    MARKETING = "marketing"
    INTERNAL_DOCUMENT = "internal_document"
    INTERVIEW_TRANSCRIPT = "interview_transcript"
    SUPPORT_TICKETS = "support_tickets"
    SURVEY = "survey"


class EvidenceType(StrEnum):
    """What kind of statement this is.

    The distinction between FACT and INFERENCE is load-bearing: model
    inference is never stored as source fact.
    """

    FACT = "fact"
    CLAIM = "claim"
    OPINION = "opinion"
    USER_FEEDBACK = "user_feedback"
    STATISTIC = "statistic"
    OBSERVATION = "observation"
    INFERENCE = "inference"


class EvidenceOrigin(StrEnum):
    """Internal evidence is never exposed to public search."""

    EXTERNAL = "external"
    INTERNAL = "internal"


class EvidenceStrength(StrEnum):
    """Qualitative strength labels.

    Deliberately not a numeric score: averaging authority, recency and
    corroboration into one decimal invents precision that does not exist.
    """

    STRONG = "strong"
    MODERATE = "moderate"
    DIRECTIONAL = "directional"
    ANECDOTAL = "anecdotal"

    @property
    def label(self) -> str:
        return {
            "strong": "Strong Evidence",
            "moderate": "Moderate Evidence",
            "directional": "Directional Evidence",
            "anecdotal": "Anecdotal Evidence",
        }[self.value]


class KnowledgeState(StrEnum):
    """How firmly the platform holds a statement.

    Saying "unknown" accurately is worth more than confident, unsupported
    product strategy.
    """

    KNOWN = "known"
    LIKELY = "likely"
    HYPOTHESIS = "hypothesis"
    UNKNOWN = "unknown"


class AnalysisType(StrEnum):
    GENERAL_SYNTHESIS = "general_synthesis"
    SWOT = "swot"
    JTBD = "jtbd"
    PAIN_POINT = "pain_point"
    ROOT_CAUSE = "root_cause"
    COMPETITIVE_GAP = "competitive_gap"
    FEATURE = "feature"
    USE_CASE = "use_case"
    OPPORTUNITY = "opportunity"
    WORKFLOW = "workflow"
    REGULATORY_IMPACT = "regulatory_impact"
    TECHNICAL_FEASIBILITY = "technical_feasibility"
    BUILD_BUY_PARTNER = "build_buy_partner"
    PRIORITIZATION = "prioritization"
    STRATEGIC_PORTFOLIO = "strategic_portfolio"

    @property
    def label(self) -> str:
        return _ANALYSIS_LABELS[self.value]


_ANALYSIS_LABELS = {
    "general_synthesis": "General Synthesis",
    "swot": "SWOT",
    "jtbd": "Jobs To Be Done",
    "pain_point": "Pain Point Analysis",
    "root_cause": "Root Cause Analysis",
    "competitive_gap": "Competitive Gap Analysis",
    "feature": "Feature Analysis",
    "use_case": "Use Case Analysis",
    "opportunity": "Opportunity Analysis",
    "workflow": "Workflow Analysis",
    "regulatory_impact": "Regulatory Impact Analysis",
    "technical_feasibility": "Technical Feasibility Analysis",
    "build_buy_partner": "Build vs Buy vs Partner",
    "prioritization": "Prioritization Analysis",
    "strategic_portfolio": "Strategic / Portfolio Analysis",
}


class PrioritizationMethod(StrEnum):
    RICE = "rice"
    VALUE_EFFORT = "value_effort"
    IMPACT_CONFIDENCE = "impact_confidence"
    MOSCOW = "moscow"
    WEIGHTED = "weighted"


class OpportunityStatus(StrEnum):
    IDENTIFIED = "identified"
    NEEDS_VALIDATION = "needs_validation"
    VALIDATED = "validated"
    PRIORITIZED = "prioritized"
    PLANNED = "planned"
    REJECTED = "rejected"


class ArtifactType(StrEnum):
    PRD = "prd"
    FEATURE_BRIEF = "feature_brief"
    BUSINESS_CASE = "business_case"
    USE_CASE_CATALOG = "use_case_catalog"
    USE_CASE = "use_case"
    OPPORTUNITY_BRIEF = "opportunity_brief"
    EXECUTIVE_SUMMARY = "executive_summary"
    RESEARCH_REPORT = "research_report"
    COMPETITIVE_ANALYSIS = "competitive_analysis"
    MARKET_RESEARCH_REPORT = "market_research_report"
    PRODUCT_STRATEGY_BRIEF = "product_strategy_brief"
    DECISION_MEMO = "decision_memo"
    PRODUCT_BACKLOG = "product_backlog"
    USER_STORIES = "user_stories"
    ACCEPTANCE_CRITERIA = "acceptance_criteria"
    EXPERIMENT_PLAN = "experiment_plan"
    RESEARCH_PLAN = "research_plan"
    INTERVIEW_GUIDE = "interview_guide"
    SURVEY_DRAFT = "survey_draft"
    ROADMAP_INPUT = "roadmap_input"

    @property
    def label(self) -> str:
        return _ARTIFACT_LABELS[self.value]


_ARTIFACT_LABELS = {
    "prd": "Product Requirements Document",
    "feature_brief": "Feature Brief",
    "business_case": "Business Case",
    "use_case_catalog": "Use Case Catalog",
    "use_case": "Use Case",
    "opportunity_brief": "Opportunity Brief",
    "executive_summary": "Executive Summary",
    "research_report": "Research Report",
    "competitive_analysis": "Competitive Analysis",
    "market_research_report": "Market Research Report",
    "product_strategy_brief": "Product Strategy Brief",
    "decision_memo": "Decision Memo",
    "product_backlog": "Product Backlog",
    "user_stories": "User Stories",
    "acceptance_criteria": "Acceptance Criteria",
    "experiment_plan": "Experiment Plan",
    "research_plan": "Research Plan",
    "interview_guide": "Interview Guide",
    "survey_draft": "Survey Draft",
    "roadmap_input": "Roadmap Input",
}


class ExportFormat(StrEnum):
    DOCX = "docx"
    PDF = "pdf"
    MARKDOWN = "markdown"
    CSV = "csv"
    XLSX = "xlsx"
    JSON = "json"


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ProjectStatus(StrEnum):
    DRAFT = "draft"
    RESEARCHING = "researching"
    SYNTHESIZED = "synthesized"
    ANALYZING = "analyzing"
    ACTIVE = "active"
    ARCHIVED = "archived"


class CoverageLevel(StrEnum):
    """Qualitative research coverage. No invented completeness percentages."""

    NOT_RESEARCHED = "not_researched"
    WEAK = "weak"
    MODERATE = "moderate"
    STRONG = "strong"

    @property
    def label(self) -> str:
        return {
            "not_researched": "Not researched",
            "weak": "Weak",
            "moderate": "Moderate",
            "strong": "Strong",
        }[self.value]


class CoverageDimension(StrEnum):
    MARKET = "market"
    CUSTOMER = "customer"
    USER = "user"
    COMPETITOR = "competitor"
    REGULATORY = "regulatory"
    TECHNOLOGY = "technology"
    BUSINESS = "business"
    DATA = "data"


#: Which research types feed which coverage dimension.
COVERAGE_SOURCES: dict[CoverageDimension, set[ResearchType]] = {
    CoverageDimension.MARKET: {ResearchType.MARKET},
    CoverageDimension.CUSTOMER: {ResearchType.VOICE_OF_CUSTOMER, ResearchType.BUSINESS_COMMERCIAL},
    CoverageDimension.USER: {ResearchType.USER, ResearchType.PROBLEM_DOMAIN},
    CoverageDimension.COMPETITOR: {ResearchType.COMPETITIVE, ResearchType.SOLUTION_VENDOR},
    CoverageDimension.REGULATORY: {ResearchType.REGULATORY},
    CoverageDimension.TECHNOLOGY: {ResearchType.TECHNOLOGY, ResearchType.SCIENTIFIC_CLINICAL},
    CoverageDimension.BUSINESS: {ResearchType.BUSINESS_COMMERCIAL, ResearchType.WORKFLOW_OPERATIONAL},
    CoverageDimension.DATA: {ResearchType.DATA},
}

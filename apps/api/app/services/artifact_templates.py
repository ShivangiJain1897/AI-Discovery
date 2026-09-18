"""Section templates for each artifact type.

The headings are fixed so a PRD from this platform always has the same shape,
and so the artifact critic can check that a section was addressed rather than
quietly dropped. A section the discovery could not support is marked Unknown,
Assumption or Needs Validation — never removed and never invented.
"""

from __future__ import annotations

from app.domain.enums import ArtifactType

PRD = [
    "Executive Summary", "Background", "Problem Statement", "Evidence", "Target Users",
    "User Needs", "Jobs To Be Done", "Goals", "Non-Goals", "Use Cases",
    "Proposed Experience", "Functional Requirements", "Non-Functional Requirements",
    "Data Requirements", "Business Rules", "Dependencies", "Risks", "Assumptions",
    "Success Metrics", "Analytics / Measurement", "Rollout Considerations",
    "Open Questions", "Appendix / Research References",
]

BUSINESS_CASE = [
    "Problem", "Opportunity", "Evidence", "Target Customer / User", "Market Context",
    "Proposed Direction", "Strategic Alignment", "Expected Customer Value",
    "Expected Business Value", "Cost Categories", "Risks", "Alternatives",
    "Key Assumptions", "Validation Needed", "Recommendation Options",
]

FEATURE_BRIEF = [
    "Summary", "Problem", "Evidence", "Target User", "Proposed Capability",
    "User Value", "Business Value", "Scope", "Out of Scope", "Dependencies",
    "Risks", "Success Metrics", "Open Questions",
]

USE_CASE = [
    "Summary", "Actor", "Problem", "Trigger", "Context", "Preconditions",
    "Current Behavior", "Desired Outcome", "Main Flow", "Alternate Flows",
    "Exception Flows", "Proposed Capability", "Business Rules", "Data Requirements",
    "Dependencies", "Risks", "Acceptance Criteria", "Success Metric",
    "Evidence References",
]

USE_CASE_CATALOG = ["Summary", "Catalog", "Evidence Coverage", "Open Questions"]

OPPORTUNITY_BRIEF = [
    "Opportunity", "Problem", "User", "Evidence", "Insight", "Desired Outcome",
    "Solution Directions", "Value Hypothesis", "Business Value", "Assumptions",
    "Dependencies", "Risks", "Validation Plan",
]

EXECUTIVE_SUMMARY = [
    "The Question", "What We Found", "What It Means", "What We Recommend",
    "What We Do Not Know", "What We Need",
]

RESEARCH_REPORT = [
    "Executive Summary", "Research Objective", "Research Approach", "Sources Examined",
    "Key Findings", "Themes", "Contradictions", "Evidence Gaps",
    "Emerging Opportunities", "Questions for Primary Research",
    "Recommended Next Steps", "Source Appendix",
]

COMPETITIVE_ANALYSIS = [
    "Summary", "Landscape", "Comparison", "Market Convergence",
    "Where Solutions Fall Short", "Recent Product Changes", "Gaps and Whitespace",
    "Differentiation Options", "Evidence Gaps",
]

MARKET_RESEARCH_REPORT = [
    "Executive Summary", "Market Structure", "Market Size", "Growth and Trends",
    "Segments", "Demand Drivers", "Barriers", "Emerging Business Models",
    "Market Opportunities", "Evidence Gaps",
]

PRODUCT_STRATEGY_BRIEF = [
    "Summary", "Market Change", "Strategic Position", "Customer and Market Value",
    "Competing Opportunities", "Portfolio Implications", "Competitive Threats",
    "Economics", "Investment Options", "Strategic Bets", "Risks", "What We Do Not Know",
]

DECISION_MEMO = [
    "Decision Required", "Background", "Options", "Evidence", "Recommendation",
    "Risks", "Assumptions", "What Would Change This", "Next Step",
]

PRODUCT_BACKLOG = ["Summary", "Epics", "Stories", "Dependencies", "Open Questions"]
USER_STORIES = ["Summary", "Stories", "Acceptance Criteria", "Open Questions"]
ACCEPTANCE_CRITERIA = ["Summary", "Criteria", "Edge Cases", "Open Questions"]

EXPERIMENT_PLAN = [
    "Hypothesis", "Rationale", "Evidence", "Metric", "Design", "Population",
    "Duration", "Success Criteria", "Disconfirming Result", "Risks", "Next Step",
]

RESEARCH_PLAN = [
    "Objective", "Decision Supported", "Research Questions", "Research Types",
    "Primary Research Needed", "Secondary Research", "Recommended Sources",
    "Search Strategy", "Expected Evidence", "Anticipated Gaps", "Out of Scope",
]

INTERVIEW_GUIDE = [
    "Research Objective", "Participant Profile", "Screener", "Hypotheses",
    "Warm-up Questions", "Core Questions", "Probes", "Wrap-up",
    "Note-taking Structure", "Synthesis Framework",
]

SURVEY_DRAFT = [
    "Research Objective", "Population", "Sample Size Guidance", "Screener",
    "Questions", "Scales Used", "Analysis Plan", "Limitations",
]

ROADMAP_INPUT = [
    "Summary", "Candidate Items", "Evidence Strength", "Dependencies",
    "Sequencing Rationale", "Open Questions",
]

_TEMPLATES: dict[str, list[str]] = {
    ArtifactType.PRD.value: PRD,
    ArtifactType.BUSINESS_CASE.value: BUSINESS_CASE,
    ArtifactType.FEATURE_BRIEF.value: FEATURE_BRIEF,
    ArtifactType.USE_CASE.value: USE_CASE,
    ArtifactType.USE_CASE_CATALOG.value: USE_CASE_CATALOG,
    ArtifactType.OPPORTUNITY_BRIEF.value: OPPORTUNITY_BRIEF,
    ArtifactType.EXECUTIVE_SUMMARY.value: EXECUTIVE_SUMMARY,
    ArtifactType.RESEARCH_REPORT.value: RESEARCH_REPORT,
    ArtifactType.COMPETITIVE_ANALYSIS.value: COMPETITIVE_ANALYSIS,
    ArtifactType.MARKET_RESEARCH_REPORT.value: MARKET_RESEARCH_REPORT,
    ArtifactType.PRODUCT_STRATEGY_BRIEF.value: PRODUCT_STRATEGY_BRIEF,
    ArtifactType.DECISION_MEMO.value: DECISION_MEMO,
    ArtifactType.PRODUCT_BACKLOG.value: PRODUCT_BACKLOG,
    ArtifactType.USER_STORIES.value: USER_STORIES,
    ArtifactType.ACCEPTANCE_CRITERIA.value: ACCEPTANCE_CRITERIA,
    ArtifactType.EXPERIMENT_PLAN.value: EXPERIMENT_PLAN,
    ArtifactType.RESEARCH_PLAN.value: RESEARCH_PLAN,
    ArtifactType.INTERVIEW_GUIDE.value: INTERVIEW_GUIDE,
    ArtifactType.SURVEY_DRAFT.value: SURVEY_DRAFT,
    ArtifactType.ROADMAP_INPUT.value: ROADMAP_INPUT,
}

#: Which prompt generates which artifact. Types without a dedicated prompt use
#: the generic artifact path with their template headings.
PROMPT_FOR_ARTIFACT: dict[str, str] = {
    ArtifactType.PRD.value: "prd_generator",
    ArtifactType.BUSINESS_CASE.value: "business_case_generator",
    ArtifactType.USE_CASE.value: "use_case_generator",
    ArtifactType.USE_CASE_CATALOG.value: "use_case_analysis",
    ArtifactType.EXECUTIVE_SUMMARY.value: "executive_summary_generator",
    ArtifactType.PRODUCT_BACKLOG.value: "backlog_generator",
    ArtifactType.USER_STORIES.value: "backlog_generator",
    ArtifactType.ACCEPTANCE_CRITERIA.value: "backlog_generator",
    ArtifactType.COMPETITIVE_ANALYSIS.value: "competitive_analysis",
}

#: Export formats that suit each artifact's shape.
EXPORT_FORMATS: dict[str, list[str]] = {
    ArtifactType.USE_CASE_CATALOG.value: ["xlsx", "csv", "docx", "pdf", "markdown", "json"],
    ArtifactType.PRODUCT_BACKLOG.value: ["xlsx", "csv", "docx", "markdown", "json"],
    ArtifactType.USER_STORIES.value: ["xlsx", "csv", "docx", "markdown", "json"],
}
DEFAULT_EXPORT_FORMATS = ["docx", "pdf", "markdown", "json"]


def section_headings(artifact_type: str) -> list[str]:
    return list(_TEMPLATES.get(artifact_type, PRD))


def prompt_for(artifact_type: str) -> str:
    return PROMPT_FOR_ARTIFACT.get(artifact_type, "prd_generator")


def export_formats(artifact_type: str) -> list[str]:
    return EXPORT_FORMATS.get(artifact_type, DEFAULT_EXPORT_FORMATS)

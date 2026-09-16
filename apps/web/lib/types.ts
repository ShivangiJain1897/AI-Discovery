/** Mirrors app/domain/api.py. Kept hand-written and small so the client
 *  surface is reviewable; regenerate from the OpenAPI schema if it grows. */

export type Persona =
  | 'business_analyst' | 'product_manager' | 'senior_pm'
  | 'director_vp' | 'ux_researcher' | 'technical_pm';

export type ResearchDepth = 'quick_scan' | 'standard' | 'deep';
export type EvidenceStrength = 'strong' | 'moderate' | 'directional' | 'anecdotal';
export type KnowledgeState = 'known' | 'likely' | 'hypothesis' | 'unknown';
export type CoverageLevel = 'not_researched' | 'weak' | 'moderate' | 'strong';
export type SourceTier =
  | 'tier_1_authoritative' | 'tier_2_strong_secondary'
  | 'tier_3_market_user' | 'tier_4_general_web';
export type EvidenceType =
  | 'fact' | 'claim' | 'opinion' | 'user_feedback'
  | 'statistic' | 'observation' | 'inference';
export type EvidenceOrigin = 'external' | 'internal';
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type OpportunityStatus =
  | 'identified' | 'needs_validation' | 'validated'
  | 'prioritized' | 'planned' | 'rejected';

export interface ProjectCounts {
  sources: number; evidence: number; themes: number; findings: number;
  insights: number; analyses: number; opportunities: number;
  use_cases: number; artifacts: number; documents: number; open_questions: number;
}

export interface CoverageEntry {
  dimension: string;
  level: CoverageLevel;
  evidence_count: number;
  tier1_count: number;
  rationale: string;
}

export interface Assumption {
  field: string; value: string; rationale: string; confidence: KnowledgeState;
}

export interface ProjectContext {
  objective: string; decision: string; domain: string;
  subdomain: string | null; product_type: string | null;
  primary_user: string | null; secondary_users: string[];
  geography: string | null; organization_context: string | null;
  discovery_stage: string | null; constraints: string[];
  assumptions: Assumption[];
  user_edited_fields: string[];
  clarifications: { question: string; why_it_matters: string; suggested_default?: string }[];
}

export interface ProjectSummary {
  id: string; title: string; question: string;
  status: string; persona: Persona;
  created_at: string; updated_at: string;
}

export interface ProjectDetail extends ProjectSummary {
  context: ProjectContext | null;
  counts: ProjectCounts;
  coverage: CoverageEntry[];
  latest_synthesis_ref: string | null;
  has_plan: boolean;
}

export interface SearchQuery {
  query: string; research_type: string; intent: string;
  preferred_domains: string[]; expected_tier: SourceTier;
}

export interface ResearchQuestion {
  id: string; ref: string; position: number; question: string; why: string;
  research_types: string[]; expected_evidence: string;
  answerable_by_secondary: boolean; queries: SearchQuery[];
  enabled: boolean; status: string; evidence_count: number;
}

export interface PlannedSource {
  name: string; url: string | null; source_type: string;
  tier: SourceTier; why: string; research_types?: string[];
  from_registry?: boolean;
}

export interface PrimaryResearchNeed {
  question: string; method: string; participant_profile: string;
  why_secondary_is_insufficient: string;
}

export interface ResearchPlan {
  id: string; ref: string; version: number;
  objective: string; decision_supported: string; depth: ResearchDepth;
  research_types: string[];
  planned_sources: PlannedSource[];
  primary_research_needed: PrimaryResearchNeed[];
  anticipated_gaps: string[]; out_of_scope: string[];
  human_readable_plan: string; approved: boolean;
  questions: ResearchQuestion[];
}

export interface RunProgress {
  ref: string; question: string; status: string;
  queries_run: number; sources_found: number;
  sources_examined: number; evidence_extracted: number;
  notes?: string[];
}

export interface ResearchRun {
  id: string; ref: string; status: JobStatus; depth: ResearchDepth;
  research_types: string[]; progress: RunProgress[];
  sources_examined: number; evidence_extracted: number;
  started_at: string | null; completed_at: string | null;
  error: string | null; provider_meta: Record<string, unknown>;
}

export interface Source {
  id: string; ref: string; title: string; url: string | null;
  publisher: string | null; source_type: string; tier: SourceTier;
  origin: EvidenceOrigin; publication_date: string | null;
  date_accessed: string | null; geography: string | null;
  research_types: string[]; snippet: string | null; assessment: string | null;
}

export interface Evidence {
  id: string; ref: string; statement: string; excerpt: string;
  evidence_type: EvidenceType; origin: EvidenceOrigin; research_type: string;
  population: string | null; geography: string | null; period: string | null;
  quantities: string[]; tags: string[]; relevance: string; limitations: string[];
  strength: EvidenceStrength; strength_reasoning: string;
  corroboration_count: number; corroborated_by: string[];
  contradicted_by: string[]; contradiction_flag: boolean;
  population_note: string | null; notes: string | null;
  source: Source;
}

export interface EvidenceList {
  items: Evidence[];
  total: number;
  facets: Record<string, Record<string, number>>;
}

export interface Theme {
  id: string; ref: string; name: string; description: string;
  prevalence: string | null; evidence_refs: string[];
}

export interface Finding {
  id: string; ref: string; title: string; finding: string;
  evidence_refs: string[]; affected_personas: string[]; themes: string[];
  prevalence: string | null; why_it_matters: string;
  confidence: EvidenceStrength; knowledge_state: KnowledgeState;
  limitations: string[];
}

export interface Insight {
  id: string; ref: string; title: string; insight: string;
  finding_refs: string[]; why_it_matters: string;
  product_implication: string; confidence: EvidenceStrength;
  knowledge_state: KnowledgeState;
}

export interface Contradiction {
  topic: string; position_a: string; evidence_refs_a: string[];
  position_b: string; evidence_refs_b: string[];
  assessment: string; resolution: KnowledgeState;
}

export interface EvidenceGap {
  gap: string; why_it_matters: string;
  can_secondary_research_close_it: boolean; suggested_approach: string;
}

export interface Synthesis {
  id: string; ref: string; version: number;
  executive_summary: string; research_objective: string; research_approach: string;
  sources_examined: number; evidence_examined: number;
  contradictions: Contradiction[]; evidence_gaps: EvidenceGap[];
  emerging_opportunities: string[]; primary_research_questions: string[];
  next_steps: string[];
}

export interface FindingsBundle {
  synthesis: Synthesis | null;
  themes: Theme[];
  findings: Finding[];
  insights: Insight[];
}

export interface DocSection {
  heading: string; body: string; points: string[];
  columns: string[]; rows: Record<string, string>[];
  evidence_refs: string[]; knowledge_state: KnowledgeState;
  note?: string | null;
}

export interface Analysis {
  id: string; ref: string; analysis_type: string; title: string;
  summary: string; sections: DocSection[];
  evidence_refs: string[]; finding_refs: string[];
  assumptions: string[]; unknowns: string[];
  confidence: EvidenceStrength; persona: Persona;
  parameters: Record<string, unknown>; created_at: string;
}

export interface AnalysisRouting {
  recommended: { analysis_type: string; label: string; why: string; priority: number }[];
  reasoning: string;
  available: { analysis_type: string; label: string }[];
}

export interface Opportunity {
  id: string; ref: string; title: string; problem: string; user: string;
  evidence_refs: string[]; finding_refs: string[]; insight: string;
  desired_outcome: string; solution_directions: string[];
  value_hypothesis: string; business_value: string;
  confidence: EvidenceStrength; assumptions: string[];
  dependencies: string[]; risks: string[]; validation_plan: string[];
  status: OpportunityStatus;
  priority_scores: Record<string, unknown>;
}

export interface UseCase {
  id: string; ref: string; title: string; actor: string; problem: string;
  trigger: string; context: string; current_behavior: string;
  desired_outcome: string; proposed_capability: string;
  user_value: string; business_value: string;
  evidence_refs: string[]; evidence_strength: EvidenceStrength;
  dependencies: string[]; risks: string[]; complexity: string;
  success_metric: string; status: string;
}

export interface Recommendation {
  id: string; ref: string; recommendation: string; why: string;
  evidence_refs: string[]; finding_refs: string[];
  expected_value: string; who_benefits: string;
  assumptions: string[]; risks: string[];
  confidence: EvidenceStrength;
  what_would_change_it: string; next_validation_step: string;
  user_edited: boolean;
}

export interface CritiqueIssue {
  check: string; severity: string; detail: string;
  section?: string | null; correction?: string | null;
}

export interface ArtifactCritique {
  answered_research_question: boolean;
  issues: CritiqueIssue[];
  unsupported_statements: string[];
  overstated_conclusions: string[];
  population_generalizations: string[];
  stale_sources: string[];
  hidden_contradictions: string[];
  assumptions_stated_as_fact: string[];
  citations_preserved: boolean;
  duplication: string[];
  still_unknown: string[];
  passed: boolean;
}

export interface ArtifactVersion {
  id: string; version: number; title: string; summary: string;
  sections: DocSection[]; evidence_refs: string[]; open_questions: string[];
  critique: ArtifactCritique;
  change_summary: string; changed_sections: string[];
  evidence_delta: { added?: string[]; removed?: string[] };
  created_at: string;
}

export interface Artifact {
  id: string; ref: string; artifact_type: string; title: string;
  current_version: number; persona: Persona;
  inputs: Record<string, unknown>;
  created_at: string; updated_at: string;
}

export interface ArtifactDetail extends Artifact {
  version: ArtifactVersion | null;
  export_formats: string[];
}

export interface ArtifactTypeInfo {
  artifact_type: string; label: string;
  sections: string[]; export_formats: string[];
}

export interface UploadedDocument {
  id: string; ref: string; filename: string; content_type: string;
  size_bytes: number; document_kind: string; origin: EvidenceOrigin;
  page_count: number; status: string;
  phi_scan: { found?: boolean; detections?: { kind: string; count: number }[] };
  created_at: string;
}

export interface Job {
  id: string; project_id: string | null; kind: string; status: JobStatus;
  message: string; progress: { at: string; message: string }[];
  result: Record<string, unknown>; error: string | null;
  started_at: string | null; finished_at: string | null; created_at: string;
}

export interface CopilotAnswer {
  answer: string; evidence_refs: string[];
  knowledge_state: KnowledgeState; caveats: string[];
  suggested_actions: string[]; evidence: Evidence[];
}

export interface PromptTemplate {
  key: string; name: string; stage: string; version: string;
  purpose: string; inputs: { name: string; description: string }[];
  output_schema: string | null; guardrails: string[];
  instructions: string; checksum: string;
}

export interface Health {
  status: string; version: string;
  database: Record<string, unknown>;
  llm: { configured: string; effective: string; model: string; live: boolean; note: string | null };
  search: { configured: string; effective: string; live: boolean };
  embeddings: Record<string, unknown>;
  prompts: { count: number; directory: string; stages: Record<string, number> };
  safety: Record<string, unknown>;
}

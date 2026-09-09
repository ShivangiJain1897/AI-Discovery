/**
 * Product Intelligence Orchestrator — domain model.
 *
 * Every request is treated as four separable layers:
 *
 *   Layer 1 RESEARCH   — what evidence needs to be discovered
 *   Layer 2 ANALYSIS   — what reasoning is applied to that evidence
 *   Layer 3 DECISION   — what recommendation should emerge
 *   Layer 4 GENERATION — what artifact the PM actually needs
 *
 * A Session carries all four. It starts as a PLAN the orchestrator proposes
 * (objective, recommended research / analysis / outputs, depth, audience) that
 * the PM can accept or modify, then accumulates evidence, synthesis, analyses,
 * a decision brief and artifacts — each stage reusing everything before it.
 * Research is never repeated just because a second format was requested.
 */

/* ------------------------------ shared scales ----------------------------- */

/** How well-supported a claim is. */
export type EvidenceStrength = "Strong" | "Moderate" | "Directional" | "Hypothesis";

/** The epistemic status of a statement — never blurred (spec Step 5). */
export type EvidenceType = "fact" | "inference" | "assumption" | "gap" | "contradiction";

export type Confidence = "High" | "Medium" | "Low";

/** How much work the PM wants (spec Step 9). */
export type DepthMode = "quick" | "standard" | "deep" | "executive" | "working";

/** Who the output is written for (spec Step 9). */
export type AudienceId =
  | "product_team"
  | "engineering"
  | "design"
  | "leadership"
  | "customer"
  | "sales"
  | "operations"
  | "compliance"
  | "executive";

/** The eleven research capabilities, A–K in the spec. */
export type ResearchId =
  | "voice_of_customer"
  | "product_behavior"
  | "quality_support"
  | "market_category"
  | "competitive"
  | "buyer_commercial"
  | "domain_regulatory"
  | "technology_feasibility"
  | "operational_workflow"
  | "ecosystem_integration"
  | "trend_foresight";

/** What kind of thing the PM brought in. */
export type InputType =
  | "auto"
  | "problem"
  | "question"
  | "idea"
  | "solution"
  | "requirement"
  | "decision"
  | "transcript"
  | "data";

/** Where the session currently is. Stages are revisitable, not a funnel. */
export type Stage = "plan" | "research" | "synthesis" | "analysis" | "decision" | "generate";

/* --------------------------------- plan ---------------------------------- */

/** A question worth asking only because the answer would change the work. */
export interface Clarification {
  id: string;
  question: string;
  /** What materially changes depending on the answer. */
  why: string;
  answer: string;
}

/** One recommended capability / method / output, with the reason it's there. */
export interface PlanItem {
  id: string;
  /** Required = the work is unsound without it. Optional = it would add depth. */
  required: boolean;
  why: string;
  selected: boolean;
}

/**
 * The orchestrator's read of the request plus the package it recommends.
 * Everything here is editable by the PM before anything runs.
 */
export interface Plan {
  /** "I understand the objective as: …" */
  objective: string;
  /** The decision the PM is actually trying to make. */
  decision: string;
  /** Users / customers / buyers / stakeholders in scope. */
  stakeholders: string;
  /** Product, feature, workflow or market in scope. */
  scope: string;
  /** Evidence the PM already has. */
  existingEvidence: string;
  /** Who will consume the final output. */
  consumer: string;
  /** Sensible defaults the orchestrator inferred — labelled, never hidden. */
  assumptions: string[];
  depth: DepthMode;
  audience: AudienceId;
  research: PlanItem[];
  analysis: PlanItem[];
  outputs: PlanItem[];
  clarifications: Clarification[];
}

/* ------------------------------- research -------------------------------- */

/** One piece of evidence, tagged with what it actually is. */
export interface EvidenceItem {
  id: string;
  statement: string;
  type: EvidenceType;
  strength: EvidenceStrength;
  /** Where it came from — a source, a system, or "inferred from …". */
  source?: string;
}

export interface StreamFinding {
  id: string;
  title: string;
  detail: string;
  strength: EvidenceStrength;
}

/**
 * What every research specialist returns (spec: Multi-Agent Orchestration).
 * The orchestrator synthesizes ACROSS these — it never concatenates them.
 */
export interface ResearchStream {
  capabilityId: ResearchId;
  selected: boolean;
  status: "pending" | "running" | "complete" | "error";
  summary?: string;
  evidence: EvidenceItem[];
  findings: StreamFinding[];
  patterns: string[];
  contradictions: string[];
  gaps: string[];
  implications: string[];
  sources: string[];
  /** Free-text the PM adds to this stream — treated as evidence they supplied. */
  userNotes?: string;
  error?: string;
  ranAt?: number;
}

/* ------------------------------- synthesis ------------------------------- */

/** A claim checked against every stream that speaks to it. */
export interface Triangulation {
  insight: string;
  /** Capability ids (or "PM-supplied") that bear on it. */
  sources: string[];
  agreement: "converging" | "conflicting" | "single-source";
  strength: EvidenceStrength;
}

/** An insight with its "so what" made explicit (spec Step 6). */
export type ImplicationKind =
  | "fix"
  | "build"
  | "remove"
  | "simplify"
  | "reposition"
  | "experiment"
  | "validate"
  | "pricing"
  | "onboarding"
  | "workflow"
  | "defer"
  | "retire"
  | "operational";

export interface Insight {
  id: string;
  insight: string;
  soWhat: string;
  implication: ImplicationKind;
  confidence: Confidence;
  supportedBy: string[];
}

export interface Opportunity {
  id: string;
  title: string;
  /** Framed as a How-Might-We. */
  hmw: string;
  userValue: string;
  businessValue: string;
  evidence: EvidenceStrength;
}

export interface Synthesis {
  createdAt: number;
  /** The single headline takeaway. */
  headline: string;
  themes: { title: string; body: string; supportedBy: string[]; strength: EvidenceStrength }[];
  triangulation: Triangulation[];
  insights: Insight[];
  opportunities: Opportunity[];
  contradictions: string[];
  gaps: string[];
}

/* -------------------------------- outputs -------------------------------- */

/** One section of any generated document — prose, bullets and/or a table. */
export interface DocSection {
  heading: string;
  /** The methodology applied, e.g. "Jobs-to-be-Done", "RICE", "TOWS". */
  method?: string;
  body?: string;
  bullets?: string[];
  table?: { headers: string[]; rows: string[][] };
}

/** One applied analysis method (Layer 2). */
export interface AnalysisRun {
  id: string;
  methodId: string;
  name: string;
  method: string;
  family: string;
  sections: DocSection[];
  createdAt: number;
}

/** The decision layer (Layer 3, spec Step 7). */
export interface DecisionOption {
  name: string;
  description: string;
  benefits: string;
  costs: string;
  risks: string;
  effort: string;
}

export interface DecisionBrief {
  createdAt: number;
  /** What we know. */
  evidence: string[];
  /** What it means. */
  insight: string;
  /** What could be done — always includes a do-nothing option. */
  options: DecisionOption[];
  recommendation: string;
  rationale: string;
  confidence: Confidence;
  /** What should be validated next. */
  gaps: string[];
  nextSteps: string[];
}

/** A generated artifact (Layer 4). */
export interface Artifact {
  id: string;
  outputId: string;
  family: string;
  title: string;
  depth: DepthMode;
  audience: AudienceId;
  sections: DocSection[];
  createdAt: number;
}

/* -------------------------------- session -------------------------------- */

export interface Session {
  id: string;
  input: string;
  inputType: InputType;
  detectedType: InputType;
  plan: Plan;
  stage: Stage;
  streams: ResearchStream[];
  synthesis?: Synthesis;
  analyses: AnalysisRun[];
  decision?: DecisionBrief;
  artifacts: Artifact[];
  /** Context the PM adds mid-session; feeds everything generated afterwards. */
  notes: string[];
  mode: "live" | "demo";
  createdAt: number;
  updatedAt: number;
}
